# dsh-plugin-doubao-search

豆包搜索（火山引擎「联网搜索」Custom 版 / Web Search API）的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件。

- 注册全局模型工具 **`doubao_search`**：网页/图片实时搜索，返回标题、来源站点、URL、摘要/正文、权威度、发布时间等结构化信息，便于引用核对与补充最新事实。
- 标准 DSH bundle 形态：`package.json` 声明 `dsh.bundle.patch`（宿主行）与 `dsh.client`（浏览器半），`index.js` 导出 Cordis 插件（`name` / `inject` / `Config` / `apply`）。
- **跨平台**：宿主端插件在 DSH 的 Node 进程中无沙箱运行，直接用全局 `fetch`，Windows / macOS / Linux 均可用，无 shell 依赖。
- **Web「设置 → 插件 → 插件配置」自带配置卡片**（`client.js`，按 `doubao-search` 命名空间与宿主半自动配对）：在卡片里粘贴保存 API Key 即可，无需碰命令行/配置文件。

## 安装

### 方式 A：作为 bundle 安装（推荐给其他人 / 打 Git 分发）

在 `dsh` 可执行目录（或用 `npx @deepseek-ai/dsh`）执行：

```bash
# 本地目录 / npm 包 / GitHub 仓库均可
dsh plugin --profile web add ./dsh-plugin-doubao-search
# 或 dsh plugin --profile web add github:你的名字/你的仓库#子目录
```

`dsh plugin` 会用 pnpm 把包装进 profile，并把声明了 `dsh.bundle.patch` 的包自动加入 `dsh.profile.bundles`。**重启 dsh 后生效**（bundle 层在启动时组装）。

### 方式 B：手动补丁行（无需装包 / 可热加载）

在 profile 的 `cordis.patch.yml`（本机默认 `C:\Users\Administrator\.dsh\profiles\web\cordis.patch.yml`，web profile 支持 live reload）里追加：

```yaml
- insert:
    - id: doubao-search
      name: dsh-plugin-doubao-search   # 已装入该 profile node_modules 时的包名
      config:
        apiKeyEnv: DOUBAO_API_KEY
```

开发态可直接引用仓库文件（相对 patch 文件的路径）：

```yaml
- insert:
    - id: doubao-search
      name: ../../../Documents/DSH-Plugins/dsh-plugin-doubao-search/index.js
      config:
        apiKeyEnv: DOUBAO_API_KEY
```

> 本地文件方式要求插件依赖（`@deepseek-ai/schemastery` 等）能从该路径解析，例如在仓库根建一个指向 DSH 共享依赖目录的 `node_modules/@deepseek-ai` junction（见下文「本地开发」）。

> **浏览器半（配置卡片）的生效时机**：宿主工具行可以 live-reload，但 Web 页面的客户端模块清单（`window.__DSH_BOOT__`）在启动/重扫时组装——新增/修改包的 `dsh.client` 声明后，**需要重启一次 dsh（或重新加载页面并在重启后硬刷新）**，设置页才会出现卡片。

## 配置 API Key

两种方式任选其一：

1. **Web「设置 → 插件 → 插件配置」**：豆包搜索卡片里粘贴 API Key 保存（推荐）。
2. 环境变量/凭据：见下方代码块（`DOUBAO_API_KEY`，默认）。

解析顺序（逐个回退）：

1. 设置命名空间 `doubao-search` 的 `apiKey` 字段（卡片保存到这里）
2. 凭据 / 环境变量 `DOUBAO_API_KEY`（默认；可用行配置 `apiKeyEnv` 改名字，例如 `ARK_API_KEY`）

```bash
# Windows PowerShell（启动 dsh 前）
$env:DOUBAO_API_KEY = "你的 Agent Plan / 豆包搜索 API Key"
dsh web

# macOS / Linux
export DOUBAO_API_KEY="你的 Agent Plan / 豆包搜索 API Key"
dsh web
```

Key 在哪拿：火山引擎开通豆包搜索后，在「Agent Plan / 豆包搜索控制台」创建 API Key。每月每火山账号 500 次免费额度。

## 用法（模型工具 doubao_search）

| 参数 | 说明 |
| --- | --- |
| `query` | 必填，1~100 字，支持口语化（配 `query_rewrite`） |
| `search_type` | `web`（默认）/ `image`（最多 5 条） |
| `count` | web ≤50（默认 10）；image ≤5（默认 5） |
| `time_range` | `OneDay/OneWeek/OneMonth/OneYear` 或 `YYYY-MM-DD..YYYY-MM-DD` |
| `auth_level` | `1`=仅非常权威来源 |
| `need_content` | `true` 时返回正文（建议配合小 count） |
| `sites` / `block_hosts` | 站点白名单 / 黑名单（`|` 分隔） |
| `industry` | `finance` / `game` / `gov` 行业搜索 |
| `query_rewrite` / `content_formats` | 改写开关 / 正文格式 `text|markdown` |

## 本地开发

- 依赖解析：本仓库的 `node_modules/@deepseek-ai` 是 DSH 共享依赖目录的 junction（不入库，`node_modules` 已在 `.gitignore`）。
- 校验：`node --check index.js`；直接用 Node 试加载：`node -e "import('file:///'+process.cwd().replace(/\\/g,'/')+'/dsh-plugin-doubao-search/index.js').then(m=>console.log(Object.keys(m)))"`（在 DSH-Plugins 根执行）。
- 改完 `cordis.patch.yml` 触发 DSH live reload；或对整行做一次任意内容改动让 watcher 重新应用。

## 许可

MIT
