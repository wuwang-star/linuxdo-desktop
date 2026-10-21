#!/usr/bin/env bash
# ============================================================
# v1.0.0 一键发布（外闭①打通脚本）
# 前置：① gh auth login 已完成（Clash 开启供 GitHub 上传）② 四项 AC 已过
# 用法：bash scripts/release-1.0.0.sh
# 幂等：repo/remote 已存在则跳过创建；重复运行安全
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

TAG=v1.0.0
REPO_NAME=linuxdo-desktop

echo "== 0. 前置检查 =="
gh auth status >/dev/null 2>&1 || { echo "FAIL: 先运行 gh auth login"; exit 1; }
OWNER=$(gh api user --jq .login)
echo "owner=$OWNER repo=$REPO_NAME"

echo "== 1. 版本号 0.1.0 → 1.0.0 =="
node -e "
const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));
if(p.version!=='1.0.0'){p.version='1.0.0';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');console.log('bumped to 1.0.0')}else console.log('already 1.0.0')
"
git add package.json
git diff --cached --quiet || git commit -m "chore: release 1.0.0" --quiet

echo "== 2. repo（无则建，public）==="
gh repo view "$OWNER/$REPO_NAME" >/dev/null 2>&1 || gh repo create "$REPO_NAME" --public --description "「下载即用」的 linux.do Windows 桌面客户端——内置 ECH 直连，免配置代理"

echo "== 3. remote + push =="
git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/$OWNER/$REPO_NAME.git"
git push -u origin master

echo "== 4. 启用 electron-builder publish 段 =="
python - "$OWNER" <<'PY'
import io, sys
owner = sys.argv[1]
p = 'electron-builder.yml'
s = io.open(p, encoding='utf8').read()
old = """# publish:
#   provider: github
#   owner: your-owner
#   repo: your-repo"""
new = f"""publish:
  provider: github
  owner: {owner}
  repo: {REPO_NAME}"""
assert old in s, 'publish 注释段未找到（可能已启用）'
s = s.replace(old, new)
io.open(p, 'w', encoding='utf8', newline='\n').write(s)
print('publish 段已启用')
PY

echo "== 5. 重新 dist（打上 app-update.yml，updater 生效）=="
npm run dist

echo "== 6. tag + push =="
git add electron-builder.yml
git diff --cached --quiet || git commit -m "chore: 启用 GitHub Releases publish 通道" --quiet
git tag -f "$TAG"
git push origin "$TAG"

echo "== 7. GitHub Release（附安装包）=="
python - "$OWNER" <<'PY'
import io, sys
owner = sys.argv[1]
s = io.open('docs/release-post.md', encoding='utf8').read()
io.open('/tmp/release-notes.md', 'w', encoding='utf8').write(
    s.replace('<owner/repo>', owner + '/' + 'linuxdo-desktop')
     .replace('https://github.com/<owner/repo>', 'https://github.com/' + owner + '/linuxdo-desktop'))
PY
gh release create "$TAG" \
  "dist/LinuxDo Desktop-$TAG-setup.exe" \
  "dist/LinuxDo Desktop-$TAG-setup.exe.blockmap" \
  --title "LinuxDo Desktop v1.0.0" \
  --notes-file /tmp/release-notes.md

echo ""
echo "✅ DONE: https://github.com/$OWNER/$REPO_NAME/releases/tag/$TAG"
echo "发布帖：把 docs/release-post.md 里的链接占位替换后发 linux.do（发布前 checklist 六条见文末）"
