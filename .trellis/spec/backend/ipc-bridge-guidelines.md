# IPC Bridge Guidelines

> Contract for exposing main-process Discourse API functions to the renderer. Followed by every feature that adds an endpoint (latest/hot/top/search/notifications/... all follow this).

---

## The Four Touch Points (required, in order)

Adding one Discourse endpoint = edit exactly four files. Missing any one breaks typecheck or the bridge.

1. **`src/main/api/client.ts`** — response interfaces + request function. Types live here and are imported by both processes.
   ```ts
   export interface SearchResponse { posts?: SearchResultPost[]; topics?: DiscourseTopicLite[]; ... }
   export function fetchSearch(q: string, page = 0): Promise<SearchResponse> {
     return discourseRequest<SearchResponse>('/search.json', { query: { q, page } })
   }
   ```
2. **`src/main/ipc.ts`** — import the fn, register a handler inside `registerIpc()`:
   ```ts
   ipcMain.handle('discourse:search', (_e, q: string, page: number) => fetchSearch(q ?? '', page ?? 0))
   ```
3. **`src/preload/index.ts`** — expose on the `api` object (contextBridge):
   ```ts
   fetchSearch: (q: string, page: number) => ipcRenderer.invoke('discourse:search', q, page),
   ```
4. **`src/preload/index.d.ts`** — add the method to `ApiBridge` + import its response type from `../main/api/client`.

Renderer consumes `window.api.<fn>()`, typed via `ApiBridge`.

---

## Rules

- **Channel naming**: `discourse:<endpoint>` for Discourse JSON reads; domain prefixes for the rest (`auth:`, `topic:`, `post:`, `user:`, `settings:`, `notifications:`, `offline...`, ...). Follow the nearest existing example.
- **Normalize args at the ipc layer**: optional numerics become `page ?? 0`, strings `q ?? ''` — handlers are the trust boundary between processes.
- **Never import `main/api/client.ts` (or any main module) into the renderer** — it pulls in Electron. This duplicates the rule in frontend/component-guidelines.md (link handling); it applies to every endpoint, not just links. Response types may be `import type`-ed (type-only imports are erased at build).
- **Errors cross the bridge as `Error`**: main-process rejects arrive in the renderer as `Error` with `.message`; renderer catch blocks do `e instanceof Error ? e.message : String(e)` and surface it in the view's error slot. Don't wrap errors in new shapes per endpoint.
- **Long-poll/loop endpoints** (offline save etc.) must NOT set the 20s `TOPIC_FETCH_TIMEOUT_MS`-style timeout — timeout is opt-in per call in client.ts, default no timeout.

---

## Discourse Endpoint Notes

- List endpoints (`/latest.json`, `/hot.json`, `/top.json`, `/c/<slug>/<id>.json`) share the `TopicListResponse` shape and paginate by `?page=` (0-based).
- `/search.json` (`full_page` mode) paginates by `?page=` **up to 10 pages** upstream — page 11+ returns empty; UI must treat an empty page as exhausted, not an error. Response sideloads `posts` + `topics` + `users` + `categories`; join `posts[].topic_id → topics[].id` client-side (topics carry title/posts_count/category_id; posts carry blurb/username/created_at).
- Verify new endpoints against the real site (user's logged-in browser probe) before building UI on assumed shapes; anonymous requests to linux.do get 403.

---

## Common Mistakes

- Editing only `preload/index.ts` and forgetting `index.d.ts` → renderer type error (or silent `any` drift).
- Adding the handler but calling `window.api.<oldName>` — preload fn name and `ApiBridge` method name must match exactly.
- Re-parsing/reshaping the response in the renderer per view; normalize once in the store or a local helper (see HomeView `rowsOf` for the search posts×topics join).
