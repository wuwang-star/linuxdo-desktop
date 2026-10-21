# Component Guidelines

> How components are built in this project.

---

## Overview

<!--
Document your project's component conventions here.

Questions to answer:
- What component patterns do you use?
- How are props defined?
- How do you handle composition?
- What accessibility standards apply?
-->

(To be filled by the team)

---

## Component Structure

<!-- Standard structure of a component file -->

(To be filled by the team)

---

## Props Conventions

<!-- How props should be defined and typed -->

(To be filled by the team)

---

## Styling Patterns

<!-- How styles are applied (CSS modules, styled-components, Tailwind, etc.) -->

(To be filled by the team)

---

## Accessibility

<!-- A11y requirements and patterns -->

(To be filled by the team)

---

## Common Mistakes

<!-- Component-related mistakes your team has made -->

(To be filled by the team)

---

## Link Handling in v-html Content (contract)

`cooked` HTML is rendered via `v-html`; its `<a>` clicks must never reach default navigation (it would wipe the SPA). Contract (since 2026-10-16):

- One capture-phase click listener on the reading scroller (`TopicView.onCookedClick`) intercepts every `a[href]` inside `.cooked`.
- Site topic links (`/t/<slug>/<id>[/<post>]`) parsed by `utils/links.ts#parseSiteTopicLink`: same topic → `store.jumpTo(n)`; other topic → `router.push('/t/<id>?pn=<n>')` (BrowseView rebuilds the dual-pane reader; `pn` consumed in `onMounted`).
- Everything else → `window.open(href, '_blank')`; main-process `setWindowOpenHandler` routes it to the system browser. No new IPC for this.
- Main process `will-navigate` guard (main/index.ts) is the safety net: non-app URLs are denied and opened externally.
- Do NOT import main-process constants (e.g. `BASE_URL` from `main/api/client.ts`) into the renderer — that module pulls in Electron; duplicate the site origin in `utils/links.ts`.

---

## App Shell (since 2026-10-17 feishu-im-frame)

**What**: the global chrome is `App.vue` `.app-shell` = `components/RailNav.vue` (left rail: avatar/search/最新/队列/通知/设置/收起) + `.shell-main` (RouterView) + floating `.win-btns` (absolute top-right, close = tray). The old `header.topbar` is deleted; `assets/styles/topbar.css` is deprecated (kept empty to avoid import breakage).

**Why**: Feishu-style outer frame (user decision 2026-10-17); window buttons are self-drawn because native `titleBarOverlay` was removed earlier.

**Rules**:
- Global-chrome changes go to `RailNav.vue` + `assets/styles/shell.css`, never back into topbar.css.
- Drag regions (`-webkit-app-region: drag`): rail top, list section head, content topic head; every interactive control inside must be marked `no-drag`.
- Rail collapse state lives in `ldd-reading` prefs (`railCollapsed`); `viewMode` (时间流/树形) is dead — thread folding (`clusterThreads` in `stores/topic.ts`) is the only topic mode.

## IM Frame Color Tokens (convention)

**What**: Feishu-announcement palette lives in `tokens.css` under `/* @scope: feishu-im-frame */` as `--im-*` variables (light + `:root[data-theme='dark']` pairs). Tone is a provisional decision — user will retune it later.

**Why**: base tokens already own `--panel/--line/--text`; coordination rules forbid touching existing variables, so the frame got its own prefixed slots.

**Rules**: restyling the IM frame = edit the `--im-*` group only (both themes); never alias base token names; new shell styles consume `var(--im-*)`.

> **Superseded 2026-10-21 (ui-spec-calibration, 1a6f685)**: palette unified onto base tokens; `--im-*` color slots deleted. Structural/motion/spacing tokens remain (`--space-*`, `--indent-step`, `--rail-gap`, `--motion-*`, `--font-*`, `--radius-*`, `--shadow-*`). Change colors in base `tokens.css` only.

## Cascade Order Gotcha (gotcha)

> **Warning**: `main.ts` imports shell.css **before** all part CSS files. A shell.css rule with the same specificity as a part-file rule (e.g. `.notif-page { padding }` vs notifications.css shorthand) is silently overridden by the later file. Global shell rules that must win: prefix with `.shell-main` (raises specificity above single-class part rules) — e.g. the 112px window-button clearance. Verified via computed style, not by grep (acceptance 09cb9a2 regression).

## Theme-Workshop Skin Compatibility (gotcha)

> **Warning**: `assets/themes/feishu.ts` (and future skin packs) target stable class names such as `.queue-panel`. When relocating/restyling a floated panel (e.g. queue popover moved into RailNav), keep the original class name and restyle via the part CSS file, or skin packs silently lose their hooks.

