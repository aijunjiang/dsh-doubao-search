# dsh-plugin-doubao-search

> **English · [中文](./README.md)**

Give [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) a **Doubao Search** (Volcengine web-search API) superpower: after installation your agent gains live web search — it can fetch recent facts, verify sources, and hand results back with their links attached.

> A **user**-facing guide comes first; **developer** packaging/architecture details live in a separate section at the end — read on demand.

---

## 1. What you get

- 🔍 A global model tool **`doubao_search`**: web + image search returning **title, site, URL, snippet, authority, publish time**, and optional full content — every result carries a link you can open and check.
- 🎛️ Zero-command configuration: a **Doubao Search** card in **DSH Settings → Plugins → Plugin configuration**. Type your key once and you are done; the card matches the official settings-card look, is collapsible, and shows **Configured / Not configured** at a glance.
- 🌐 Multilingual: card copy follows the DSH UI language automatically (**Chinese / English**), just like the rest of DSH settings.
- 💻 Cross-platform: Windows / macOS / Linux (the plugin uses Node's built-in networking — no PowerShell or shell dependency).
- ⚡ The host tool activates immediately on a web profile (hot-reload, no restart); the browser config card appears after a restart or page refresh.
- 📌 Results emphasize **recency and provenance** — great for news, releases, price/policy updates, or verifying a claim.

### When to use it
- “Search the latest news / release date / policy text for X”
- “Find what gov.cn / official sites say, with sources”
- “Find an image about X”
- Cross-check time-sensitive facts the model is unsure about

---

## 2. Install in three steps

### 1) Install the plugin (pick one)

**Option A — standard bundle install (sharing / GitHub distribution)**

```bash
dsh plugin --profile web add ./dsh-plugin-doubao-search
# or from GitHub: dsh plugin --profile web add github:you/your-repo
```

`dsh plugin` installs the package into the profile and registers it automatically. **Restart dsh once** — bundle layers are assembled at startup.

**Option B — manual patch row (local use / want it live right away)**

Open the profile patch file (default `~/.dsh/profiles/web/cordis.patch.yml`; the web profile hot-reloads), **append and save**:

```yaml
- insert:
    - id: doubao-search
      name: dsh-plugin-doubao-search   # the package name once it is installed in this profile's node_modules
      config:
        apiKeyEnv: DOUBAO_API_KEY
```

The host tool becomes active immediately — **no restart needed**; the browser config card appears after **one dsh restart or a page refresh** (the client manifest is assembled at startup/rescan).

### 2) Set the API key (either way)

**Way one (recommended): the Settings card**

1. Open **Settings → Plugins → Plugin configuration**;
2. Find the **Doubao Search** card (header shows “Not configured”);
3. Click to expand → paste your API key → **Save**;
4. The badge turns “Configured”.

**Way two: environment variable (scripts / servers)**

```bash
# Windows PowerShell (before launching dsh)
$env:DOUBAO_API_KEY = "your API key"
dsh web

# macOS / Linux
export DOUBAO_API_KEY="your API key"
dsh web
```

> Where to get the key: enable Volcengine **Doubao Search**, then create an API key in the **Agent Plan / Doubao Search console**. Every Volcengine account gets 500 free calls per month (check the console for current terms).
>
> 🔒 Security: keys saved via the card go into the local DSH credential store (`~/.dsh/.credentials.yaml`); they are never echoed on the page or written into conversation logs. **Never commit keys to git.**

### 3) Start using it

Just tell the agent:

- “**Use Doubao Search** to find when DeepSeek V4 was released”
- “Search the **last week** of X policy, **official sites only**”
- “Doubao, **find some images** of X”

Results carry `URL / source / authority / date`, which the agent uses to answer with citations.

### Common knobs (for the model — or you can phrase them yourself)

| What you want | Example phrasing |
| --- | --- |
| Only recent results | “search the **past week**” (`time_range`) |
| Official sources only | “**gov.cn / official institutions only**” (`auth_level=1` or `sites=gov.cn\|…`) |
| Shorter results | “**no full content**, links only” (default) |
| Full page content | “3 results **with full text**” (`need_content=true` + `count=3`) |
| Image search | “**search images** of X” (`search_type=image`) |
| A vertical | “search from the **finance/gaming/government** angle” (`industry`) |

See “Technical details · API” at the end for the full parameter table.

### Troubleshooting

| Symptom | Fix |
| --- | --- |
| No Doubao card on the page | Restart dsh once and hard-refresh (Ctrl+F5); verify the patch row was written |
| Card shows “Env source” | The key comes from the environment (read-only); `unset DOUBAO_API_KEY` first if you want to manage it in the UI |
| Badge says unconfigured though you saved before | An older build stored the key in a “settings field”; save it once via the card to unify into the credential store (old value still works) |
| `invalid api key` error | Wrong key, or the key has no Doubao Search quota/entitlement — check the console |
| Model does not search automatically | Ask it to “use the doubao_search tool”; a search takes ~1–3 s |

---

## 3. Developer / technical details (read on demand)

### Shape of the package

A standard **DSH plugin package (bundle)** with two halves in one repository:

| File | Role |
| --- | --- |
| `package.json` | Metadata; `dsh.bundle.patch` (host row patch), `dsh.client` (browser-half declaration), `exports["./client"]` |
| `index.js` | **Host half**: a Cordis plugin (exports `name / inject / Config / apply`); registers the global tool + the settings namespace |
| `client.js` | **Browser half**: a hand-built client module artifact (`window.__ModuleLoader__.load` closure factory) registering the “Settings → Plugins” card |
| `cordis.patch.yml` | The distribution bundle patch layer (`- insert` row declaration) |
| `README.md` / `README.en.md` | This doc (Chinese / English) |

### What the host half does

- Mounted as a loader row, it runs **unsandboxed inside the DSH Node process** and calls the Doubao API with global `fetch` — cross-platform, zero shell dependency.
- `ctx.tools.register({ name: 'doubao_search', … })` registers the **global** model tool, visible to every session.
- `ctx.settings.installSection(ctx, 'doubao-search', Config, …)` registers the settings namespace layered over the row config and the user document.
- API-key resolution order (per call, first hit wins):
  1. settings namespace `doubao-search.apiKey` (kept for backward compatibility)
  2. credential reference `apiKeyEnv` (default `DOUBAO_API_KEY` — where the card writes)
  3. process environment variable `apiKeyEnv`
- Row config fields: `apiKeyEnv`, `defaultCount`, `timeoutMs` (Schemastery schema in `index.js` → `Config`).

### How the browser half (config card) works

- Artifact format: the client module system's **closure factory** — `window.__ModuleLoader__.load({ id, factory })`; the factory only takes platform seeds (`react`) through the injected `require`, everything else is inlined, so no third-party client package is needed and no in-repo build tooling is required to maintain it.
- Registered via `ctx.slots.register({ name: 'settings.plugin.item', key: 'doubao-search' }, Card)` and **auto-paired** with the host-registered namespace (the officially supported third-party card mechanism). The card chrome (name/description header, unsaved pill, Discard/Save, collapse-after-save) shares the official `--dsw-alias-*` theme tokens, so it looks native.
- i18n: registers a `settings.doubaoSearch` dictionary (`ctx.locale.register`) and subscribes to locale snapshots (`active`/`revision`) — copy switches between Chinese and English with the DSH UI language, no restart.
- Keys go through the **credentials domain**, not the settings document (same pattern as the official `WebSearchCard`): `ctx.remote.credentials.describe/set/unset`; the page only sees `configured`/`writable` booleans, never the key itself.
- Injected services at runtime: `slots`, `settingsScope`, `locale`, `remote`, `remote.credentials`.

### API integration (Doubao Search Custom)

- Endpoint: `POST https://open.feedcoopapi.com/search_api/web_search`, `Authorization: Bearer <API_KEY>`.
- Request fields & validation bounds (inside `validateArgs`): `Query` (1–100) / `SearchType` (`web`|`image`) / `Count` (web ≤50, image ≤5) / `Filter{AuthInfoLevel,NeedContent,NeedUrl,Sites(≤20),BlockHosts(≤5),Industry}` / `TimeRange` (`OneDay..OneYear` or `YYYY-MM-DD..YYYY-MM-DD`) / `QueryControl{QueryRewrite}` / `ContentFormats` (`text|markdown`).
- Response: `ResponseMetadata` (business error codes) + `Result{WebResults|ImageResults, ResultCount, SearchContext, TimeCost, LogId}`; the tool renders it as text with URL/source/authority/date for the model.

### Local development & hot reload

- Dependency resolution: `node_modules/@deepseek-ai` at the repository root is a junction to the DSH shared dependency directory (not committed; ignored by `.gitignore`).
- Host-side changes: saving the profile's `cordis.patch.yml` triggers a loader hot-reload; structural row changes (id/name) also trigger a client-modules rescan.
- Browser-side artifact changes: `client.js` bytes are served by the host under a rev — after editing, a page **hard refresh** picks them up (rev updates on server-side rescan); only *structural* `dsh.client` declaration changes need a restart.
- Checks: `npm run check` (`node --check index.js && node --check client.js`).

---

## License

MIT
