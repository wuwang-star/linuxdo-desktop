import { a as defineComponent, A as useAuthStore, i as onMounted, c as createElementBlock, b as createBaseVNode, t as toDisplayString, f as createCommentVNode, F as Fragment, m as renderList, r as ref, o as openBlock, n as normalizeClass, l as createTextVNode, u as unref, g as relTime, B as useRouter } from "./index-kxDMqK0j.js";
const _hoisted_1 = { class: "notif-page" };
const _hoisted_2 = { class: "notif-head" };
const _hoisted_3 = ["disabled"];
const _hoisted_4 = {
  key: 0,
  class: "loading"
};
const _hoisted_5 = {
  key: 1,
  class: "error"
};
const _hoisted_6 = {
  key: 2,
  class: "loading"
};
const _hoisted_7 = ["onClick"];
const _hoisted_8 = { class: "tag" };
const _hoisted_9 = { class: "body" };
const _hoisted_10 = { key: 0 };
const _hoisted_11 = { class: "time" };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "NotificationsView",
  setup(__props) {
    const router = useRouter();
    const auth = useAuthStore();
    const items = ref([]);
    const loading = ref(false);
    const error = ref("");
    const marking = ref(false);
    const TYPE_LABEL = {
      1: "提及",
      2: "回复",
      5: "编辑",
      6: "点赞",
      9: "点赞",
      11: "私信",
      12: "徽章",
      16: "回复",
      17: "引用",
      34: "已解决"
    };
    function label(n) {
      return TYPE_LABEL[n.notification_type] ?? "通知";
    }
    async function load() {
      loading.value = true;
      error.value = "";
      try {
        const res = await window.api.fetchNotifications(1);
        items.value = res.notifications ?? [];
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
      } finally {
        loading.value = false;
      }
    }
    async function markAllRead() {
      if (marking.value) return;
      marking.value = true;
      try {
        await window.api.markNotificationsRead();
        items.value = items.value.map((n) => ({ ...n, read: true }));
        await auth.refresh();
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
      } finally {
        marking.value = false;
      }
    }
    function open(n) {
      if (!n.read) {
        n.read = true;
        void auth.refresh();
      }
      void router.push({ path: `/t/${n.topic_id}`, query: n.post_number > 1 ? { pn: String(n.post_number) } : {} });
    }
    onMounted(() => void load());
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createBaseVNode("div", _hoisted_2, [
          _cache[0] || (_cache[0] = createBaseVNode("h2", null, "通知", -1)),
          createBaseVNode("button", {
            class: "act",
            disabled: marking.value,
            onClick: markAllRead
          }, toDisplayString(marking.value ? "处理中…" : "全部已读"), 9, _hoisted_3)
        ]),
        loading.value ? (openBlock(), createElementBlock("div", _hoisted_4, "加载中…")) : error.value ? (openBlock(), createElementBlock("div", _hoisted_5, toDisplayString(error.value), 1)) : items.value.length === 0 ? (openBlock(), createElementBlock("div", _hoisted_6, "暂无通知（未登录时不可见）")) : createCommentVNode("", true),
        (openBlock(true), createElementBlock(Fragment, null, renderList(items.value, (n) => {
          return openBlock(), createElementBlock("button", {
            key: n.id,
            class: normalizeClass(["notif-item", { unread: !n.read }]),
            onClick: ($event) => open(n)
          }, [
            createBaseVNode("span", {
              class: normalizeClass(["dot", { on: !n.read }])
            }, null, 2),
            createBaseVNode("span", _hoisted_8, toDisplayString(label(n)), 1),
            createBaseVNode("span", _hoisted_9, [
              createBaseVNode("strong", null, toDisplayString(n.data?.display_username ?? n.data?.original_username ?? "有人"), 1),
              createTextVNode(" " + toDisplayString(n.data?.topic_title ?? n.fancy_title ?? "") + " ", 1),
              n.post_number > 1 ? (openBlock(), createElementBlock("em", _hoisted_10, "#" + toDisplayString(n.post_number), 1)) : createCommentVNode("", true)
            ]),
            createBaseVNode("span", _hoisted_11, toDisplayString(unref(relTime)(n.created_at)), 1)
          ], 10, _hoisted_7);
        }), 128))
      ]);
    };
  }
});
export {
  _sfc_main as default
};
