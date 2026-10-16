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
