import { d as defineStore, a as defineComponent, r as ref, o as openBlock, c as createElementBlock, b as createBaseVNode, u as unref, e as avatarUrl, t as toDisplayString, f as createCommentVNode, g as relTime, n as normalizeClass, h as computed, w as watch, i as onMounted, j as onBeforeUnmount, F as Fragment, k as withDirectives, v as vModelCheckbox, l as createTextVNode, m as renderList, p as vModelText, q as withKeys, s as withModifiers, x as createBlock, y as useRoute, z as nextTick } from "./index-D4_WdOiw.js";
const CHUNK = 20;
const progressKey = (topicId) => `ldd:progress:${topicId}`;
const LIKE_ACTION = 2;
function likeInfo(post) {
  const a = post.actions_summary?.find((x) => x.id === LIKE_ACTION);
  return { count: a?.count ?? 0, acted: a?.acted === true };
}
function withLike(post, liked, delta) {
  const summary = (post.actions_summary ?? []).map((s) => ({ ...s }));
  const idx = summary.findIndex((s) => s.id === LIKE_ACTION);
  if (idx >= 0) {
    summary[idx] = {
      ...summary[idx],
      count: Math.max(0, (summary[idx].count ?? 0) + delta),
      acted: liked
    };
  } else {
    summary.push({ id: LIKE_ACTION, count: Math.max(0, delta), acted: liked });
  }
  return { ...post, actions_summary: summary };
}
const useTopicStore = defineStore("topic", {
  state: () => ({
    topic: null,
    stream: [],
    postsById: /* @__PURE__ */ new Map(),
    postNumberToId: /* @__PURE__ */ new Map(),
    minLoadedIdx: Number.MAX_SAFE_INTEGER,
    maxLoadedIdx: -1,
    loading: false,
    loadingOlder: false,
    onlyOp: false,
    currentPostNumber: 1,
    pendingJump: 0,
    error: ""
  }),
  getters: {
    opUsername(state) {
      return state.topic?.details?.created_by?.username ?? state.postsById.get(state.stream[0] ?? -1)?.username ?? null;
    },
    orderedPosts(state) {
      const out = [];
      for (let i = state.minLoadedIdx; i <= state.maxLoadedIdx; i++) {
        const id = state.stream[i];
        const p = state.postsById.get(id);
        if (p) out.push(p);
      }
      return out;
    },
    visiblePosts() {
      const all = this.orderedPosts;
      if (!this.onlyOp || !this.opUsername) return all;
      return all.filter((p) => p.username === this.opUsername);
    }
  },
  actions: {
    reset() {
      this.topic = null;
      this.stream = [];
      this.postsById = /* @__PURE__ */ new Map();
      this.postNumberToId = /* @__PURE__ */ new Map();
      this.minLoadedIdx = Number.MAX_SAFE_INTEGER;
      this.maxLoadedIdx = -1;
      this.onlyOp = false;
      this.currentPostNumber = 1;
      this.pendingJump = 0;
      this.error = "";
    },
    ingestPosts(posts) {
      for (const p of posts) {
        this.postsById.set(p.id, p);
        this.postNumberToId.set(p.post_number, p.id);
      }
    },
    async open(topicId) {
      this.reset();
      this.loading = true;
      try {
        const topic = await window.api.fetchTopic(topicId);
        this.topic = topic;
        this.stream = topic.post_stream?.stream ?? [];
        this.ingestPosts(topic.post_stream?.posts ?? []);
        for (const p of topic.post_stream?.posts ?? []) {
          const idx = this.stream.indexOf(p.id);
          if (idx >= 0) {
            this.minLoadedIdx = Math.min(this.minLoadedIdx, idx);
            this.maxLoadedIdx = Math.max(this.maxLoadedIdx, idx);
          }
        }
        const saved = Number(localStorage.getItem(progressKey(topicId)) ?? "0");
        if (saved > 1) {
          await this.jumpTo(saved);
        } else if (this.minLoadedIdx > 0) {
          await this.loadChunk(0, CHUNK);
        }
      } catch (e) {
        this.error = e instanceof Error ? e.message : String(e);
      } finally {
        this.loading = false;
      }
    },
    async loadChunk(startIdx, count) {
      if (!this.stream.length || !this.topic) return;
      const clampedStart = Math.max(0, startIdx);
      const ids = this.stream.slice(clampedStart, clampedStart + count).filter((id) => !this.postsById.has(id));
      this.minLoadedIdx = Math.min(this.minLoadedIdx, clampedStart);
      this.maxLoadedIdx = Math.max(
        this.maxLoadedIdx,
        Math.min(this.stream.length - 1, clampedStart + count - 1)
      );
      if (ids.length === 0) return;
      const res = await window.api.fetchPosts(this.topic.id, ids);
      this.ingestPosts(res.post_stream?.posts ?? []);
    },
    async loadOlder() {
      if (this.loadingOlder || this.minLoadedIdx <= 0 || !this.topic) return;
      this.loadingOlder = true;
      try {
        await this.loadChunk(Math.max(0, this.minLoadedIdx - CHUNK), CHUNK);
      } finally {
        this.loadingOlder = false;
      }
    },
    /** 跳到指定楼层：未加载则先加载该楼层所在分块 */
    async jumpTo(postNumber) {
      const target = Math.max(1, Math.min(postNumber, Math.max(1, this.stream.length)));
      const estIdx = Math.min(this.stream.length - 1, target - 1);
      if (!this.postNumberToId.has(target)) {
        await this.loadChunk(Math.max(0, estIdx - 2), CHUNK);
      }
      if (this.postNumberToId.has(target)) this.currentPostNumber = target;
      this.pendingJump = target;
    },
    saveProgress(topicId, postNumber) {
      if (postNumber <= 0) return;
      const prev = Number(localStorage.getItem(progressKey(topicId)) ?? "0");
      if (postNumber > prev) localStorage.setItem(progressKey(topicId), String(postNumber));
      this.currentPostNumber = Math.max(this.currentPostNumber, postNumber);
    },
    readProgress(topicId) {
      return Number(localStorage.getItem(progressKey(topicId)) ?? "0");
    },
    /** 回帖：成功后把新楼追加到流末尾并跳转过去 */
    async sendReply(raw, replyTo) {
      if (!this.topic || !raw.trim()) return false;
      try {
        const post = await window.api.createReply(this.topic.id, raw.trim(), replyTo);
        if (!this.postNumberToId.has(post.post_number)) {
          this.stream.push(post.id);
          this.ingestPosts([post]);
          this.maxLoadedIdx = this.stream.length - 1;
          this.pendingJump = post.post_number;
        }
        return true;
      } catch (e) {
        this.error = e instanceof Error ? e.message : String(e);
        return false;
      }
    },
    /** 点赞/取消点赞（乐观更新，失败回滚并提示） */
    async toggleLike(postId) {
      const post = this.postsById.get(postId);
      if (!post) return;
      const info = likeInfo(post);
      try {
        if (info.acted) {
          await window.api.unlikePost(postId);
          this.postsById.set(postId, withLike(post, false, -1));
        } else {
          await window.api.likePost(postId);
          this.postsById.set(postId, withLike(post, true, 1));
        }
      } catch (e) {
        this.postsById.set(postId, post);
        this.error = e instanceof Error ? e.message : String(e);
      }
    },
    /** 收藏主题（P1 仅添加） */
    async bookmark() {
      if (!this.topic || this.topic.bookmarked) return;
      try {
        await window.api.bookmarkTopic(this.topic.id);
        this.topic = { ...this.topic, bookmarked: true };
      } catch (e) {
        this.error = e instanceof Error ? e.message : String(e);
      }
    }
  }
});
const _hoisted_1$1 = ["id"];
const _hoisted_2$1 = ["src"];
const _hoisted_3$1 = { class: "post-body" };
const _hoisted_4$1 = { class: "post-head" };
const _hoisted_5$1 = { class: "author" };
const _hoisted_6$1 = { class: "floor" };
const _hoisted_7$1 = { class: "time" };
const _hoisted_8$1 = ["id", "innerHTML"];
const _hoisted_9$1 = {
  key: 0,
  class: "tr-block"
};
const _hoisted_10$1 = { class: "tr-text" };
const _hoisted_11$1 = { class: "post-actions" };
const _hoisted_12$1 = ["disabled"];
const _hoisted_13$1 = {
  key: 0,
  class: "tr-error"
};
const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "PostItem",
  props: {
    post: {}
  },
  emits: ["jump", "like", "reply"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const like = computed(() => likeInfo(props.post));
    const floor = computed(() => `#${props.post.post_number}`);
    const trKey = computed(() => `ldd:tr:${props.post.id}`);
    const translation = ref(localStorage.getItem(trKey.value) ?? "");
    const trLoading = ref(false);
    const trError = ref("");
    const trVisible = ref(false);
    async function translate() {
      if (translation.value) {
        trVisible.value = !trVisible.value;
        return;
      }
      trVisible.value = true;
      if (trLoading.value) return;
      trLoading.value = true;
      trError.value = "";
      try {
        const el = document.getElementById(`cooked-${props.post.id}`);
        const text = (el?.textContent ?? "").trim();
        if (!text) throw new Error("没有可翻译的文本");
        const out = await window.api.translatePost(props.post.id, text);
        translation.value = out;
        localStorage.setItem(trKey.value, out);
      } catch (e) {
        trError.value = e instanceof Error ? e.message : String(e);
        trVisible.value = false;
      } finally {
        trLoading.value = false;
      }
    }
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("article", {
        class: "post",
        id: `post-${__props.post.post_number}`
      }, [
        createBaseVNode("img", {
          class: "avatar",
          src: unref(avatarUrl)(__props.post.avatar_template),
          alt: "",
          loading: "lazy"
        }, null, 8, _hoisted_2$1),
        createBaseVNode("div", _hoisted_3$1, [
          createBaseVNode("header", _hoisted_4$1, [
            createBaseVNode("span", _hoisted_5$1, "@" + toDisplayString(__props.post.username), 1),
            createBaseVNode("span", _hoisted_6$1, toDisplayString(floor.value), 1),
            __props.post.reply_to_post_number ? (openBlock(), createElementBlock("button", {
              key: 0,
              class: "reply-to",
              onClick: _cache[0] || (_cache[0] = ($event) => emit("jump", __props.post.reply_to_post_number))
            }, " ↩ 回复 #" + toDisplayString(__props.post.reply_to_post_number), 1)) : createCommentVNode("", true),
            createBaseVNode("span", _hoisted_7$1, toDisplayString(unref(relTime)(__props.post.created_at)), 1)
          ]),
          createBaseVNode("div", {
            class: "cooked",
            id: `cooked-${__props.post.id}`,
            innerHTML: __props.post.cooked
          }, null, 8, _hoisted_8$1),
          translation.value && trVisible.value ? (openBlock(), createElementBlock("div", _hoisted_9$1, [
            _cache[3] || (_cache[3] = createBaseVNode("div", { class: "tr-label" }, "译文", -1)),
            createBaseVNode("div", _hoisted_10$1, toDisplayString(translation.value), 1)
          ])) : createCommentVNode("", true),
          createBaseVNode("footer", _hoisted_11$1, [
            createBaseVNode("button", {
              class: normalizeClass(["act", { acted: like.value.acted }]),
              onClick: _cache[1] || (_cache[1] = ($event) => emit("like", __props.post.id))
            }, toDisplayString(like.value.acted ? "❤" : "🤍") + " " + toDisplayString(like.value.count || ""), 3),
            createBaseVNode("button", {
              class: "act",
              onClick: _cache[2] || (_cache[2] = ($event) => emit("reply", __props.post.post_number))
            }, "💬 回复"),
            createBaseVNode("button", {
              class: "act",
              disabled: trLoading.value,
              onClick: translate
            }, toDisplayString(trLoading.value ? "翻译中…" : translation.value ? trVisible.value ? "隐藏译文" : "显示译文" : "译"), 9, _hoisted_12$1),
            trError.value ? (openBlock(), createElementBlock("span", _hoisted_13$1, toDisplayString(trError.value), 1)) : createCommentVNode("", true)
          ])
        ])
      ], 8, _hoisted_1$1);
    };
  }
});
const _hoisted_1 = { class: "topic-page" };
const _hoisted_2 = {
  key: 0,
  class: "loading"
};
const _hoisted_3 = {
  key: 1,
  class: "error"
};
const _hoisted_4 = { class: "topic-title-h1" };
const _hoisted_5 = { class: "topic-sub" };
const _hoisted_6 = { class: "only-op" };
const _hoisted_7 = ["disabled"];
const _hoisted_8 = {
  key: 0,
  class: "hint"
};
const _hoisted_9 = {
  key: 0,
  class: "error-inline"
};
const _hoisted_10 = {
  key: 1,
  class: "loading"
};
const _hoisted_11 = {
  key: 2,
  class: "loading"
};
const _hoisted_12 = { class: "timeline" };
const _hoisted_13 = { class: "tl-head" };
const _hoisted_14 = ["onClick"];
const _hoisted_15 = {
  key: 0,
  class: "composer"
};
const _hoisted_16 = { class: "composer-head" };
const _hoisted_17 = { key: 0 };
const _hoisted_18 = { key: 1 };
const _hoisted_19 = ["onKeydown"];
const _hoisted_20 = { class: "composer-foot" };
const _hoisted_21 = ["disabled"];
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "TopicView",
  setup(__props) {
    const route = useRoute();
    const store = useTopicStore();
    const scroller = ref(null);
    const topicId = computed(() => Number(route.params.id));
    const composerOpen = ref(false);
    const composerText = ref("");
    const replyingToFloor = ref(null);
    const sending = ref(false);
    const bookmarking = ref(false);
    const total = computed(() => store.stream.length || store.topic?.posts_count || 0);
    const timelineTicks = computed(() => {
      const n = total.value;
      if (!n) return [];
      const step = Math.max(1, Math.ceil(n / 60));
      const ticks = [];
      for (let i = 1; i <= n; i += step) ticks.push(i);
      if (ticks[ticks.length - 1] !== n) ticks.push(n);
      return ticks;
    });
    let progressTimer;
    async function consumePendingJump() {
      const target = store.pendingJump;
      if (!target || !scroller.value) return;
      store.pendingJump = 0;
      await nextTick();
      const el = document.getElementById(`post-${target}`);
      if (el) {
        el.scrollIntoView({ block: "start" });
        el.classList.add("flash");
        setTimeout(() => el.classList.remove("flash"), 1200);
      }
    }
    function onScroll() {
      const el = scroller.value;
      if (!el || !store.topic) return;
      if (el.scrollTop < 400 && store.minLoadedIdx > 0 && !store.loadingOlder) {
        const prevHeight = el.scrollHeight;
        void store.loadOlder().then(() => {
          void nextTick().then(() => {
            if (scroller.value) scroller.value.scrollTop += scroller.value.scrollHeight - prevHeight;
          });
        });
      }
      if (progressTimer !== void 0) window.clearTimeout(progressTimer);
      progressTimer = window.setTimeout(() => {
        if (!scroller.value || !store.topic) return;
        const top = scroller.value.getBoundingClientRect().top;
        let current = 0;
        for (const p of store.orderedPosts) {
          const node = document.getElementById(`post-${p.post_number}`);
          if (!node) continue;
          if (node.getBoundingClientRect().bottom > top + 80) {
            current = p.post_number;
            break;
          }
        }
        if (current > 0) store.saveProgress(topicId.value, current);
      }, 200);
    }
    watch(
      () => store.pendingJump,
      () => void consumePendingJump()
    );
    function openComposer(replyToFloor) {
      replyingToFloor.value = replyToFloor;
      composerOpen.value = true;
    }
    async function sendReply() {
      if (!composerText.value.trim() || sending.value) return;
      sending.value = true;
      store.error = "";
      const ok = await store.sendReply(composerText.value, replyingToFloor.value ?? void 0);
      sending.value = false;
      if (ok) {
        composerText.value = "";
        composerOpen.value = false;
        replyingToFloor.value = null;
      }
    }
    async function doBookmark() {
      if (bookmarking.value) return;
      bookmarking.value = true;
      await store.bookmark();
      bookmarking.value = false;
    }
    onMounted(() => {
      void store.open(topicId.value).then(() => {
        const pn = Number(route.query.pn ?? 0);
        if (pn > 0) void store.jumpTo(pn);
      });
      scroller.value?.addEventListener("scroll", onScroll, { passive: true });
      void nextTick().then(() => void consumePendingJump());
    });
    onBeforeUnmount(() => {
      scroller.value?.removeEventListener("scroll", onScroll);
      if (progressTimer !== void 0) window.clearTimeout(progressTimer);
    });
    function go(postNumber) {
      void store.jumpTo(postNumber);
    }
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createBaseVNode("div", {
          ref_key: "scroller",
          ref: scroller,
          class: "topic-scroller"
        }, [
          unref(store).loading ? (openBlock(), createElementBlock("div", _hoisted_2, "加载中…")) : unref(store).error && !unref(store).topic ? (openBlock(), createElementBlock("div", _hoisted_3, toDisplayString(unref(store).error), 1)) : unref(store).topic ? (openBlock(), createElementBlock(Fragment, { key: 2 }, [
            createBaseVNode("h1", _hoisted_4, toDisplayString(unref(store).topic.title), 1),
            createBaseVNode("div", _hoisted_5, [
              createBaseVNode("span", null, "共 " + toDisplayString(unref(store).topic.posts_count) + " 楼 · 已读至 #" + toDisplayString(unref(store).readProgress(topicId.value) || 1), 1),
              createBaseVNode("label", _hoisted_6, [
                withDirectives(createBaseVNode("input", {
                  type: "checkbox",
                  "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => unref(store).onlyOp = $event)
                }, null, 512), [
                  [vModelCheckbox, unref(store).onlyOp]
                ]),
                _cache[5] || (_cache[5] = createTextVNode(" 只看楼主 ", -1))
              ]),
              createBaseVNode("button", {
                class: normalizeClass(["act", { acted: unref(store).topic.bookmarked }]),
                disabled: bookmarking.value || unref(store).topic.bookmarked,
                onClick: doBookmark
              }, toDisplayString(unref(store).topic.bookmarked ? "★ 已收藏" : "☆ 收藏"), 11, _hoisted_7),
              unref(store).minLoadedIdx > 0 ? (openBlock(), createElementBlock("span", _hoisted_8, "（向上滚动加载更早楼层）")) : createCommentVNode("", true)
            ]),
            unref(store).error ? (openBlock(), createElementBlock("div", _hoisted_9, toDisplayString(unref(store).error), 1)) : createCommentVNode("", true),
            unref(store).loadingOlder ? (openBlock(), createElementBlock("div", _hoisted_10, "加载更早楼层…")) : createCommentVNode("", true),
            (openBlock(true), createElementBlock(Fragment, null, renderList(unref(store).visiblePosts, (p) => {
              return openBlock(), createBlock(_sfc_main$1, {
                key: p.id,
                post: p,
                onJump: go,
                onLike: _cache[1] || (_cache[1] = (id) => unref(store).toggleLike(id)),
                onReply: openComposer
              }, null, 8, ["post"]);
            }), 128)),
            unref(store).visiblePosts.length === 0 ? (openBlock(), createElementBlock("div", _hoisted_11, "没有可见楼层")) : createCommentVNode("", true)
          ], 64)) : createCommentVNode("", true)
        ], 512),
        createBaseVNode("aside", _hoisted_12, [
          createBaseVNode("div", _hoisted_13, toDisplayString(total.value) + " 楼", 1),
          (openBlock(true), createElementBlock(Fragment, null, renderList(timelineTicks.value, (n) => {
            return openBlock(), createElementBlock("button", {
              key: n,
              class: normalizeClass(["tl-tick", { current: Math.abs(n - unref(store).currentPostNumber) < 5 }]),
              onClick: ($event) => go(n)
            }, toDisplayString(n), 11, _hoisted_14);
          }), 128))
        ]),
        composerOpen.value ? (openBlock(), createElementBlock("div", _hoisted_15, [
          createBaseVNode("div", _hoisted_16, [
            replyingToFloor.value ? (openBlock(), createElementBlock("span", _hoisted_17, "回复 #" + toDisplayString(replyingToFloor.value), 1)) : (openBlock(), createElementBlock("span", _hoisted_18, "回复主题")),
            createBaseVNode("button", {
              class: "act",
              onClick: _cache[2] || (_cache[2] = ($event) => {
                composerOpen.value = false;
                replyingToFloor.value = null;
              })
            }, "收起")
          ]),
          withDirectives(createBaseVNode("textarea", {
            "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => composerText.value = $event),
            placeholder: "支持 Markdown…（Ctrl+Enter 发送）",
            onKeydown: [
              withKeys(withModifiers(sendReply, ["ctrl", "prevent"]), ["enter"]),
              withKeys(withModifiers(sendReply, ["meta", "prevent"]), ["enter"])
            ]
          }, null, 40, _hoisted_19), [
            [vModelText, composerText.value]
          ]),
          createBaseVNode("div", _hoisted_20, [
            _cache[6] || (_cache[6] = createBaseVNode("span", { class: "hint" }, "发帖走原站 API，以当前登录账号提交", -1)),
            createBaseVNode("button", {
              class: "primary",
              disabled: sending.value || !composerText.value.trim(),
              onClick: sendReply
            }, toDisplayString(sending.value ? "发送中…" : "发送"), 9, _hoisted_21)
          ])
        ])) : (openBlock(), createElementBlock("button", {
          key: 1,
          class: "composer-open act",
          onClick: _cache[4] || (_cache[4] = ($event) => openComposer(null))
        }, "💬 回复主题"))
      ]);
    };
  }
});
export {
  _sfc_main as default
};
