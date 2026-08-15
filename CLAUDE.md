# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Start Vite dev server (default: http://localhost:3008)
- `npm run build` — Production build to `dist/`
- `npm run preview` — Preview production build locally
- `npm run tauri:dev` — Start Tauri desktop app in dev mode (Rust + Vite HMR)
- `npm run tauri:build` — Build production desktop app for current platform

## Architecture

Vite + Vue 3 SPA — no router, no Pinia, no UI framework, minimal dependencies.

### Project entry points

- **`index.html`** — Vite entry HTML, loads `src/main.js`
- **`src/main.js`** — Vue app bootstrap (createApp, mount)
- **`src/style.css`** — Global styles (dark theme, scrollbar, code block)
- **`vite.config.js`** — Vite config (Vue plugin, dev server port 3008)
- **`package-lock.json`** — Should be committed (dependency lock)

### Data flow

```
ConfigProfileStore ──► configStore (reactive proxy) ──► api.js
sessionStore (reactive + localStorage) ──────────────► ChatArea
ChatArea ──► api.js (fetch SSE) ──► MessageBubble (streaming render)
```

### Key modules

- **stores/configProfileStore.js** — Config Profile CRUD, localStorage persistence, auto-migration from old config. Export factory `useProfileStore()` returning: profiles (reactive array), activeProfile (computed), create/update/delete/switchProfile.
- **stores/configStore.js** — Thin reactive proxy that reads apiUrl/apiKey/model from the active profile. Export `useConfig()` returning a reactive object with getters that delegate to the profile store.
- **stores/sessionStore.js** — Session CRUD, message management, auto-naming. Messages support optional `images` field: `[{ data: string (base64), mimeType: string }]`. Reactive array with computed `activeSession`. `activeId` is a `shallowRef` for proper reactivity. Export factory `useSessionStore()`.
- **utils/api.js** — `sendChatMessage()` with SSE streaming (`onToken` callback via `response.body.getReader()`) and non-streaming fallback. Messages with `images` are auto-converted to OpenAI vision format (`content` array with `text` + `image_url` parts) via `toApiMessage()`. Single code path for all API providers (OpenAI-compatible, Sensenova, etc.).
- **utils/storage.js** — Light `localStorage` wrapper with `github-ai-chat:` prefix and JSON serialization (`getItem`/`setItem`/`removeItem`).

### Component tree

```
App.vue
├── TitleBar.vue          — App title + window control buttons (─ □ ✕), uses @tauri-apps/api/window
├── TabBar.vue            — Session tabs: switch, create (+), close (✕), highlight active
├── ToolBar.vue           — Custom profile dropdown, model name, gear icon (opens ConfigModal)
├── ChatArea.vue          — Message list + input bar, image picker (Tauri dialog + fs), response time tracking
│   └── MessageBubble.vue — User/AI bubbles, code block rendering, image gallery + lightbox, streaming cursor blink, loading dots animation, response time
└── ConfigModal.vue       — Modal overlay: profile list (left) + edit form (right) + password toggle + copy buttons + save/new/delete
```

### State management

No Pinia/Vuex — uses Vue 3 `reactive` / `shallowRef` / `computed` objects exported from store modules. Components import stores directly (no provide/inject).

- Store modules use factory functions (`useXxxStore()`) returning plain objects with reactive state
- `configStore` returns a `reactive` object whose getters delegate to the active profile
- `configProfileStore` manages the profile list at module scope; `configStore` is a consumer
- Session `activeId` uses `shallowRef` (not a plain `let`) so computed properties react to switches

### API contract

Single endpoint: `POST <apiUrl>` with OpenAI Chat Completions format.

- Stream mode: `fetch` with `response.body.getReader()` parsing SSE `data:` lines
- Non-streaming fallback: same endpoint with `stream: false`
- Abort: `AbortController` passed via `signal` option
- Image support: user messages with `images` field are converted to OpenAI vision format (`content` array with `{ type: "text" }` and `{ type: "image_url", image_url: { url: "data:..." } }` parts). Same format for all API providers (OpenAI, Sensenova, etc.).

### localStorage keys (prefix: `github-ai-chat:`)

- `config-profiles` — ConfigProfile[] array
- `active-profile-id` — Current active profile ID
- `chat-sessions` — Sessions array with full message history

## Tauri Desktop App

Standalone desktop application via [Tauri v2](https://v2.tauri.app/). Built distributables located at `src-tauri/target/release/bundle/`.

- **`src-tauri/tauri.conf.json`** — Window config (1000x700, min 600x400, no native decorations), bundle targets: all
- **`src-tauri/Cargo.toml`** — Rust deps: tauri 2, serde, tauri-plugin-shell, tauri-plugin-dialog, tauri-plugin-fs
- **`src-tauri/src/lib.rs`** — App entry with shell + dialog + fs plugins registered
- **`src-tauri/src/main.rs`** — Main binary with `windows_subsystem = "windows"`
- **`src-tauri/capabilities/default.json`** — Permissions: window core + shell:default + dialog:default + fs:default (read all paths)
- **`src-tauri/icons/`** — Generated app icons all required sizes

TitleBar.vue imports `@tauri-apps/api/window` to control native window operations (minimize/maximize/close). Uses `data-tauri-drag-region` for window dragging. Calls are wrapped in try-catch so the web-only dev mode still works.

### Cross-platform builds

| Platform | Command | Output |
|----------|---------|--------|
| macOS | `npm run tauri:build` | `.app` + `.dmg` |
| Windows | `npm run tauri:build` on Windows | `.msi` |
| Linux | `npm run tauri:build` on Linux | `.AppImage` + `.deb` |

### Tauri dev/build requirements

- Xcode Command Line Tools (required on macOS)
- Xcode (required for `tauri build`, not for `tauri dev`)
- Rust toolchain (rustc + cargo), installed via rustup
- Windows: WebView2 (included in Windows 10+)
- Linux: various system packages (webkit2gtk, etc.)