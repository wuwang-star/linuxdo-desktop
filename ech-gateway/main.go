// ech-gateway — ECH 直连网关（10-19-ech-engine P1）
//
// 职责单一：对内终结 Chromium 的 CONNECT TLS（MITM，本地 CA），对外用 DoH+ECH 出站。
// 不解析业务内容；请求逻辑全部在应用 TS 层（client.ts）。
//
// 用法（standalone 验收）：
//   go run . --listen 127.0.0.1:9443 --template https://edge.1molchuan.top/linuxdo --ca-dir .certs
//   curl --proxy http://127.0.0.1:9443 --cacert .certs/ca.pem https://linux.do/about -I
// stdout 首行输出 {"port":N}（P2 Electron sidecar 协议）。
package main

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/binary"
	"encoding/pem"
	"flag"
	"fmt"
	"io"
	"math/big"
	"net"
	"net/http"
	"net/http/httputil"
	"os"
	"strings"
	"path/filepath"
	"sync"
	"time"
)

// ---------- DoH（A + HTTPS RR，60s 缓存） ----------

type rrEntry struct {
	ips    []string
	ech    []byte
	expire time.Time
}

var (
	rrCache    = sync.Map{} // host → rrEntry
	dohTemplate = flag.String("template", "https://edge.1molchuan.top/linuxdo", "DoH 模板")
	rrTTL       = 60 * time.Second
)

func splitLabels(s string) []string {
	var out []string
	cur := ""
	for _, c := range s {
		if c == '.' {
			out = append(out, cur)
			cur = ""
		} else {
			cur += string(c)
		}
	}
	if cur != "" {
		out = append(out, cur)
	}
	return out
}

func skipName(b []byte, off int) int {
	for off < len(b) {
		l := int(b[off])
		if l == 0 {
			return off + 1
		}
		if l&0xc0 == 0xc0 {
			return off + 2
		}
		off += l + 1
	}
	return off
}

func b64url(b []byte) string {
	const cs = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
	out := []byte{}
	for i := 0; i < len(b); i += 3 {
		v := uint32(b[i]) << 16
		n := len(b) - i
		if n > 1 {
			v |= uint32(b[i+1]) << 8
		}
		if n > 2 {
			v |= uint32(b[i+2])
		}
		out = append(out, cs[v>>18&63], cs[v>>12&63])
		if n > 1 {
			out = append(out, cs[v>>6&63])
		}
		if n > 2 {
			out = append(out, cs[v&63])
		}
	}
	return string(out)
}

func dohQuery(name string, qtype uint16) [][]byte {
	q := []byte{0x12, 0x34, 0x01, 0x00, 0, 1, 0, 0, 0, 0, 0, 0}
	for _, l := range splitLabels(name) {
		q = append(q, byte(len(l)))
		q = append(q, l...)
	}
	q = append(q, 0, byte(qtype>>8), byte(qtype), 0, 1)
	client := &http.Client{Timeout: 6 * time.Second}
	resp, err := client.Get(*dohTemplate + "?dns=" + b64url(q))
	if err != nil {
		return nil
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
	if err != nil || len(body) < 12 {
		return nil
	}
	off := 12
	qd := int(binary.BigEndian.Uint16(body[4:6]))
	an := int(binary.BigEndian.Uint16(body[6:8]))
	for i := 0; i < qd; i++ {
		off = skipName(body, off)
		off += 4
	}
	var out [][]byte
	for i := 0; i < an && off+10 <= len(body); i++ {
		off = skipName(body, off)
		rtype := binary.BigEndian.Uint16(body[off:])
		rdlen := int(binary.BigEndian.Uint16(body[off+8:]))
		off += 10
		if rtype == qtype && off+rdlen <= len(body) {
			out = append(out, body[off:off+rdlen])
		}
		off += rdlen
	}
	return out
}

// echOf：HTTPS RR (SVCB) rdata → ech SvcParam (key=5) 的 ECHConfigList
func echOf(rdata []byte) []byte {
	if len(rdata) < 2 {
		return nil
	}
	off := skipName(rdata, 2)
	for off+4 <= len(rdata) {
		key := binary.BigEndian.Uint16(rdata[off:])
		l := int(binary.BigEndian.Uint16(rdata[off+2:]))
		off += 4
		if key == 5 && off+l <= len(rdata) {
			return rdata[off : off+l]
		}
		off += l
	}
	return nil
}

// resolve：A 记录 + ECH 配置（缓存 60s）。ech 为 nil 表示该域无 ECH（普通直连）。
func resolve(host string) (ips []string, ech []byte, err error) {
	if e, ok := rrCache.Load(host); ok {
		en := e.(rrEntry)
		if time.Now().Before(en.expire) {
			return en.ips, en.ech, nil
		}
	}
	ipsRaw := dohQuery(host, 1)
	if len(ipsRaw) == 0 {
		return nil, nil, fmt.Errorf("DoH 无 A 记录: %s", host)
	}
	ips = make([]string, 0, len(ipsRaw))
	for _, r := range ipsRaw {
		if len(r) == 4 {
			ips = append(ips, net.IP(r).String())
		}
	}
	hs := dohQuery(host, 65)
	if len(hs) > 0 {
		ech = echOf(hs[0])
	}
	entry := rrEntry{ips: ips, ech: ech, expire: time.Now().Add(rrTTL)}
	rrCache.Store(host, entry)
	return ips, ech, nil
}

// ---------- 本地 CA + 按需签发 ----------

type certAuthority struct {
	cert tls.Certificate
	pool *x509.CertPool // 导出用（curl --cacert）
	path string

	mu    sync.Mutex
	leafs sync.Map // host → tls.Certificate
}

func loadOrCreateCA(dir string) (*certAuthority, error) {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}
	certPath := filepath.Join(dir, "ca.pem")
	keyPath := filepath.Join(dir, "ca-key.pem")
	if _, err := os.Stat(certPath); os.IsNotExist(err) {
		key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		if err != nil {
			return nil, err
		}
		tpl := &x509.Certificate{
			SerialNumber:          big.NewInt(1),
			Subject:               pkix.Name{CommonName: "LinuxDo Desktop ECH Gateway CA"},
			NotBefore:             time.Now().Add(-time.Hour),
			NotAfter:              time.Now().AddDate(10, 0, 0),
			IsCA:                  true,
			KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageDigitalSignature,
			BasicConstraintsValid: true,
		}
		der, err := x509.CreateCertificate(rand.Reader, tpl, tpl, &key.PublicKey, key)
		if err != nil {
			return nil, err
		}
		keyDer, err := x509.MarshalECPrivateKey(key)
		if err != nil {
			return nil, err
		}
		if err := os.WriteFile(certPath, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), 0o600); err != nil {
			return nil, err
		}
		if err := os.WriteFile(keyPath, pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDer}), 0o600); err != nil {
			return nil, err
		}
	}
	certPEM, err := os.ReadFile(certPath)
	if err != nil {
		return nil, err
	}
	keyPEM, err := os.ReadFile(keyPath)
	if err != nil {
		return nil, err
	}
	cert, err := tls.X509KeyPair(certPEM, keyPEM)
	if err != nil {
		return nil, err
	}
	leaf, err := x509.ParseCertificate(cert.Certificate[0])
	if err != nil {
		return nil, err
	}
	pool := x509.NewCertPool()
	pool.AddCert(leaf)
	return &certAuthority{cert: cert, pool: pool, path: certPath}, nil
}

// leafFor：为目标域现场签发证书（缓存）。
func (ca *certAuthority) leafFor(host string) (tls.Certificate, error) {
	if c, ok := ca.leafs.Load(host); ok {
		return c.(tls.Certificate), nil
	}
	ca.mu.Lock()
	defer ca.mu.Unlock()
	if c, ok := ca.leafs.Load(host); ok {
		return c.(tls.Certificate), nil
	}
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return tls.Certificate{}, err
	}
	tpl := &x509.Certificate{
		SerialNumber: big.NewInt(time.Now().UnixNano()),
		Subject:      pkix.Name{CommonName: host},
		DNSNames:     []string{host},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().AddDate(0, 0, 30),
		KeyUsage:     x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}
	caLeaf, err := x509.ParseCertificate(ca.cert.Certificate[0])
	if err != nil {
		return tls.Certificate{}, err
	}
	der, err := x509.CreateCertificate(rand.Reader, tpl, caLeaf, &key.PublicKey, ca.cert.PrivateKey)
	if err != nil {
		return tls.Certificate{}, err
	}
	cert := tls.Certificate{Certificate: [][]byte{der, ca.cert.Certificate[0]}, PrivateKey: key}
	ca.leafs.Store(host, cert)
	return cert, nil
}

// ---------- ECH 出站 Transport ----------

func echTransport() *http.Transport {
	return &http.Transport{
		ForceAttemptHTTP2: true,
		DialTLSContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			h, p, err := net.SplitHostPort(addr)
			if err != nil {
				return nil, err
			}
			ips, ech, err := resolve(h)
			if err != nil {
				return nil, err
			}
			cfg := &tls.Config{ServerName: h, NextProtos: []string{"h2", "http/1.1"}}
			if ech != nil {
				cfg.EncryptedClientHelloConfigList = ech
			}
			var last error
			for _, ip := range ips {
				d := &net.Dialer{Timeout: 8 * time.Second}
				raw, derr := d.DialContext(ctx, network, net.JoinHostPort(ip, p))
				if derr != nil {
					last = derr
					continue
				}
				tlsConn := tls.Client(raw, cfg)
				if herr := tlsConn.HandshakeContext(ctx); herr != nil {
					raw.Close()
					last = herr
					continue
				}
				st := tlsConn.ConnectionState()
				logf("out %s:%s via %s TLS=%s ECHAccepted=%v", h, p, ip, tls.VersionName(st.Version), st.ECHAccepted)
				return tlsConn, nil
			}
			return nil, last
		},
	}
}

// ---------- CONNECT MITM 服务 ----------

var (
	ca     *certAuthority
	proxyT *http.Transport
)

func logf(format string, a ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", a...)
}

// serveTLSConn：终结后的明文连接交给 ReverseProxy（origin-form + Host 语义保持）
func serveTLSConn(conn net.Conn) {
	rp := &httputil.ReverseProxy{
		Transport: proxyT,
		Director: func(r *http.Request) {
			r.URL.Scheme = "https"
			r.URL.Host = r.Host
		},
	}
	h := http.Server{Handler: rp, ReadHeaderTimeout: 15 * time.Second}
	h.Serve(&singleConnListener{conn: conn})
}

type singleConnListener struct {
	conn net.Conn
	used bool
	mu   sync.Mutex
}

func (l *singleConnListener) Accept() (net.Conn, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.used {
		return nil, net.ErrClosed
	}
	l.used = true
	return l.conn, nil
}
func (l *singleConnListener) Close() error   { return nil }
func (l *singleConnListener) Addr() net.Addr { return l.conn.LocalAddr() }

// handleCONNECT：回应 200 → 对内以目标域证书终结 TLS → serveTLSConn
func handleCONNECT(client net.Conn, host string) {
	leaf, err := ca.leafFor(host)
	if err != nil {
		client.Close()
		return
	}
	client.Write([]byte("HTTP/1.1 200 Connection Established\r\n\r\n"))
	tlsSrv := tls.Server(client, &tls.Config{
		Certificates: []tls.Certificate{leaf},
		NextProtos:   []string{"h2", "http/1.1"},
	})
	if err := tlsSrv.Handshake(); err != nil {
		logf("mitm %s 握手失败: %v", host, err)
		client.Close()
		return
	}
	serveTLSConn(tlsSrv)
}

func main() {
	listen := flag.String("listen", "127.0.0.1:0", "监听地址")
	caDir := flag.String("ca-dir", ".certs", "本地 CA 目录")
	flag.Parse()

	var err error
	ca, err = loadOrCreateCA(*caDir)
	if err != nil {
		logf("CA 初始化失败: %v", err)
		os.Exit(1)
	}
	proxyT = echTransport()

	ln, err := net.Listen("tcp", *listen)
	if err != nil {
		logf("listen 失败: %v", err)
		os.Exit(1)
	}
	// sidecar 协议：stdout 首行端口（P2 Electron spawn 消费）
	fmt.Printf(`{"port":%d}`+"\n", ln.Addr().(*net.TCPAddr).Port)
	logf("ech-gateway 就绪 %s（DoH: %s）", ln.Addr(), *dohTemplate)

	for {
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		go handleConn(conn)
	}
}

// handleConn：识别 CONNECT（https）→ MITM；普通明文代理请求 P1 不支持（应用流量全 https）
func handleConn(conn net.Conn) {
	defer func() {
		if r := recover(); r != nil {
			conn.Close()
		}
	}()
	conn.SetDeadline(time.Now().Add(30 * time.Second))
	buf := make([]byte, 8192)
	n, err := conn.Read(buf)
	if err != nil || n == 0 {
		conn.Close()
		return
	}
	conn.SetDeadline(time.Time{})
	line := string(buf[:n])
	fields := strings.Fields(line)
	if len(fields) >= 2 && fields[0] == "CONNECT" {
		conn.Write(buf[:0]) // no-op 占位：连接 deadline 已重置
		handleCONNECT(conn, hostOnly(fields[1]))
		return
	}
	logf("P1 仅支持 CONNECT，收到: %.40s", line)
	conn.Write([]byte("HTTP/1.1 405 Method Not Allowed\r\nConnection: close\r\n\r\n"))
	conn.Close()
}

func hostOnly(hostport string) string {
	if h, _, err := net.SplitHostPort(hostport); err == nil {
		return h
	}
	return hostport
}
