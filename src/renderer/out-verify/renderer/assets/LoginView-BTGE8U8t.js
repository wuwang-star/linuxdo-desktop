import { a as defineComponent, A as useAuthStore, i as onMounted, c as createElementBlock, b as createBaseVNode, u as unref, l as createTextVNode, t as toDisplayString, f as createCommentVNode, k as withDirectives, p as vModelText, F as Fragment, m as renderList, r as ref, o as openBlock, n as normalizeClass } from "./index-AK7QyO2R.js";
const _hoisted_1 = { class: "login-page" };
const _hoisted_2 = { class: "card" };
const _hoisted_3 = { key: 0 };
const _hoisted_4 = { key: 1 };
const _hoisted_5 = { class: "status-list" };
const _hoisted_6 = {
  key: 2,
  class: "message"
};
const _hoisted_7 = { class: "card" };
const _hoisted_8 = { class: "row" };
const _hoisted_9 = ["disabled"];
const _hoisted_10 = { class: "card" };
const _hoisted_11 = { class: "row" };
const _hoisted_12 = ["disabled"];
const _hoisted_13 = { class: "card" };
const _hoisted_14 = { class: "row" };
const _hoisted_15 = ["disabled"];
const _hoisted_16 = { class: "card" };
const _hoisted_17 = { class: "row" };
const _hoisted_18 = ["disabled"];
const _hoisted_19 = { class: "card" };
const _hoisted_20 = { class: "tip" };
const _hoisted_21 = { class: "row" };
const _hoisted_22 = ["disabled"];
const _hoisted_23 = {
  key: 0,
  class: "message"
};
const _hoisted_24 = { class: "card" };
const _hoisted_25 = { class: "diag" };
const _hoisted_26 = { class: "st" };
const _hoisted_27 = { class: "ms" };
const _hoisted_28 = { class: "url" };
const _hoisted_29 = {
  key: 0,
  class: "tip"
};
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "LoginView",
  setup(__props) {
    const auth = useAuthStore();
    const apiKey = ref("");
    const apiUsername = ref("");
    const diag = ref([]);
    const trBaseUrl = ref("");
    const trModel = ref("");
    const trKey = ref("");
    const trSaving = ref(false);
    const trMessage = ref("");
    const trConfigured = ref(false);
    async function saveTranslate() {
      if (trSaving.value) return;
      trSaving.value = true;
      trMessage.value = "";
      try {
        const cfg = await window.api.setTranslateConfig(
          trBaseUrl.value,
          trModel.value,
          trKey.value ? trKey.value : void 0
        );
        trConfigured.value = Boolean(cfg.baseUrl) && cfg.hasKey;
        trKey.value = "";
        trMessage.value = "翻译服务配置已保存";
      } catch (e) {
        trMessage.value = e instanceof Error ? e.message : String(e);
      } finally {
        trSaving.value = false;
      }
    }
    const tCookie = ref("");
    async function pasteCookie() {
      if (!tCookie.value.trim() || auth.loading) return;
      await auth.pasteTCookie(tCookie.value);
      tCookie.value = "";
    }
    onMounted(async () => {
      await auth.refresh();
      diag.value = await window.api.diagnostics();
      const cfg = await window.api.getTranslateConfig();
      trBaseUrl.value = cfg.baseUrl;
      trModel.value = cfg.model;
      trConfigured.value = Boolean(cfg.baseUrl) && cfg.hasKey;
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createBaseVNode("section", _hoisted_2, [
          _cache[11] || (_cache[11] = createBaseVNode("h2", null, "登录状态", -1)),
          unref(auth).status?.user ? (openBlock(), createElementBlock("p", _hoisted_3, [
            _cache[10] || (_cache[10] = createTextVNode("✅ 已登录：", -1)),
            createBaseVNode("strong", null, "@" + toDisplayString(unref(auth).status.user.username), 1)
          ])) : (openBlock(), createElementBlock("p", _hoisted_4, "未登录（游客可浏览公开内容）")),
          createBaseVNode("ul", _hoisted_5, [
            createBaseVNode("li", null, "Cookie 会话：" + toDisplayString(unref(auth).status?.cookie ? "✅" : "—"), 1),
            createBaseVNode("li", null, " API Key：" + toDisplayString(unref(auth).status?.apiKey ? `✅（${unref(auth).status.apiKeyKind === "user-api-key" ? "用户授权" : "手动填入"}）` : "—"), 1)
          ]),
          unref(auth).message ? (openBlock(), createElementBlock("p", _hoisted_6, toDisplayString(unref(auth).message), 1)) : createCommentVNode("", true)
        ]),
        createBaseVNode("section", _hoisted_7, [
          _cache[12] || (_cache[12] = createBaseVNode("h2", null, "方式一：授权 User API Key（推荐，重启免登录）", -1)),
          _cache[13] || (_cache[13] = createBaseVNode("p", { class: "tip" }, "打开 linux.do 授权页，点一次「授权」即可。Key 经系统加密长期保存在本机，不依赖浏览器 cookie，站点可随时撤销。", -1)),
          createBaseVNode("div", _hoisted_8, [
            createBaseVNode("button", {
              class: "primary",
              disabled: unref(auth).loading,
              onClick: _cache[0] || (_cache[0] = ($event) => unref(auth).startUserApiKey())
            }, "一键申请授权", 8, _hoisted_9)
          ])
        ]),
        createBaseVNode("section", _hoisted_10, [
          _cache[14] || (_cache[14] = createBaseVNode("h2", null, "方式二：浏览器登录（支持 Connect / OAuth / 2FA）", -1)),
          _cache[15] || (_cache[15] = createBaseVNode("p", { class: "tip" }, "弹出的窗口就是真实浏览器，照常登录即可；检测到登录态后自动关闭并落盘 cookie。", -1)),
          createBaseVNode("div", _hoisted_11, [
            createBaseVNode("button", {
              class: "primary",
              disabled: unref(auth).loading,
              onClick: _cache[1] || (_cache[1] = ($event) => unref(auth).openLogin())
            }, "打开登录窗口", 8, _hoisted_12)
          ])
        ]),
        createBaseVNode("section", _hoisted_13, [
          _cache[16] || (_cache[16] = createBaseVNode("h2", null, "方式三：粘贴 _t cookie（测试用，秒切会话）", -1)),
          _cache[17] || (_cache[17] = createBaseVNode("p", { class: "tip" }, [
            createTextVNode("浏览器 F12 → Application → Cookies → linux.do → 复制 "),
            createBaseVNode("code", null, "_t"),
            createTextVNode(" 的值粘贴到这里。")
          ], -1)),
          createBaseVNode("div", _hoisted_14, [
            withDirectives(createBaseVNode("input", {
              "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => tCookie.value = $event),
              placeholder: "_t cookie 值",
              style: { "flex": "1" }
            }, null, 512), [
              [vModelText, tCookie.value]
            ]),
            createBaseVNode("button", {
              class: "primary",
              disabled: unref(auth).loading || !tCookie.value.trim(),
              onClick: pasteCookie
            }, "注入", 8, _hoisted_15)
          ])
        ]),
        createBaseVNode("section", _hoisted_16, [
          _cache[18] || (_cache[18] = createBaseVNode("h2", null, "方式四：手动填 Api-Key（持有现成 Key 时）", -1)),
          _cache[19] || (_cache[19] = createBaseVNode("p", { class: "tip" }, "若你持有 linux.do 的 User API Key，可在此填入；凭据将以系统加密存储在本机。", -1)),
          withDirectives(createBaseVNode("input", {
            "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => apiUsername.value = $event),
            placeholder: "用户名（如 neo）"
          }, null, 512), [
            [vModelText, apiUsername.value]
          ]),
          withDirectives(createBaseVNode("input", {
            "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => apiKey.value = $event),
            placeholder: "API Key",
            type: "password"
          }, null, 512), [
            [vModelText, apiKey.value]
          ]),
          createBaseVNode("div", _hoisted_17, [
            createBaseVNode("button", {
              class: "primary",
              disabled: unref(auth).loading || !apiKey.value || !apiUsername.value,
              onClick: _cache[5] || (_cache[5] = ($event) => unref(auth).saveApiKey(apiKey.value, apiUsername.value))
            }, " 保存 ", 8, _hoisted_18),
            unref(auth).status?.apiKey ? (openBlock(), createElementBlock("button", {
              key: 0,
              onClick: _cache[6] || (_cache[6] = ($event) => unref(auth).clearApiKey())
            }, "清除")) : createCommentVNode("", true)
          ])
        ]),
        createBaseVNode("section", _hoisted_19, [
          _cache[20] || (_cache[20] = createBaseVNode("h2", null, "翻译服务（OpenAI 兼容）", -1)),
          createBaseVNode("p", _hoisted_20, " 用于楼内「译」按钮的双语翻译。填任意 OpenAI 兼容端点（如 https://api.openai.com/v1 或自建网关）。 API Key 以系统加密存储在本机。状态：" + toDisplayString(trConfigured.value ? "✅ 已配置" : "未配置"), 1),
          withDirectives(createBaseVNode("input", {
            "onUpdate:modelValue": _cache[7] || (_cache[7] = ($event) => trBaseUrl.value = $event),
            placeholder: "Base URL，如 https://api.openai.com/v1"
          }, null, 512), [
            [vModelText, trBaseUrl.value]
          ]),
          withDirectives(createBaseVNode("input", {
            "onUpdate:modelValue": _cache[8] || (_cache[8] = ($event) => trModel.value = $event),
            placeholder: "模型，如 gpt-4o-mini"
          }, null, 512), [
            [vModelText, trModel.value]
          ]),
          withDirectives(createBaseVNode("input", {
            "onUpdate:modelValue": _cache[9] || (_cache[9] = ($event) => trKey.value = $event),
            placeholder: "API Key（留空表示不修改）",
            type: "password"
          }, null, 512), [
            [vModelText, trKey.value]
          ]),
          createBaseVNode("div", _hoisted_21, [
            createBaseVNode("button", {
              class: "primary",
              disabled: trSaving.value || !trBaseUrl.value || !trModel.value,
              onClick: saveTranslate
            }, toDisplayString(trSaving.value ? "保存中…" : "保存"), 9, _hoisted_22)
          ]),
          trMessage.value ? (openBlock(), createElementBlock("p", _hoisted_23, toDisplayString(trMessage.value), 1)) : createCommentVNode("", true)
        ]),
        createBaseVNode("section", _hoisted_24, [
          _cache[21] || (_cache[21] = createBaseVNode("h2", null, "请求诊断（最近）", -1)),
          createBaseVNode("div", _hoisted_25, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(diag.value.slice(0, 20), (d, i) => {
              return openBlock(), createElementBlock("div", {
                key: i,
                class: normalizeClass(["diag-row", { bad: d.status >= 400 || d.status === 0 }])
              }, [
                createBaseVNode("span", _hoisted_26, toDisplayString(d.status), 1),
                createBaseVNode("span", _hoisted_27, toDisplayString(d.ms) + "ms", 1),
                createBaseVNode("span", _hoisted_28, toDisplayString(d.url.replace("https://linux.do", "")), 1)
              ], 2);
            }), 128)),
            diag.value.length === 0 ? (openBlock(), createElementBlock("div", _hoisted_29, "暂无请求")) : createCommentVNode("", true)
          ])
        ])
      ]);
    };
  }
});
export {
  _sfc_main as default
};
