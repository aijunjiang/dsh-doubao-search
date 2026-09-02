# dsh-plugin-doubao-search

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）装上「**豆包搜索**」（火山引擎联网搜索 / Web Search API）：安装后，你的 Agent 就多了一把联网搜索的钥匙，可以帮你检索最新事实、核对信息出处，并把带来源链接的结果整理回来给你看。

> 面向**使用者**的引导在前；面向**开发者**的打包/架构细节在文末独立成章，按需阅读即可。

---

## 一、装完你能得到什么

- 🔍 一个全局模型工具 **`doubao_search`**：网页搜索 + 图片搜索，返回 **标题、来源站点、URL、摘要、权威度、发布时间**，需要时还能取回正文 —— 每条结果都带原文链接，方便你点开核对。
- 🎛️ 配置零命令行：在 **DSH 设置 → 插件 → 插件配置** 里有一张「豆包搜索」卡片，填一次 Key 就能用；卡片会折叠、会显示当前是**已配置 / 未配置**。
- 💻 跨平台：Windows / macOS / Linux 都能跑（插件直接用 Node 内置网络能力，不依赖 PowerShell / shell）。
- ⚡ 宿主工具**即装即生效**（web profile 支持热加载，不用重启）；浏览器配置卡片在重启或刷新后出现。
- 📌 结果侧重**时效性与出处**：适合查新闻、版本发布、行情/政策更新，或核实某个说法。

### 什么时候用它
- “豆包搜一下 xxx 的最新消息 / 发布时间 / 政策原文”
- “帮我找 gov.cn / 官方站点的说法并给出来源”
- “搜一张关于 xxx 的图片”
- 对模型拿不准的时效性事实做交叉核对

---

## 二、三步装好

### 1) 安装插件（二选一）

**方式 A：标准 bundle 安装（适合给别人 / 发 GitHub 分发）**

```bash
dsh plugin --profile web add ./dsh-plugin-doubao-search
# 或从 GitHub 装：dsh plugin --profile web add github:你的名字/你的仓库
```

`dsh plugin` 会把包装进 profile 并自动登记。**重启一次 dsh 后生效**（bundle 层启动时组装）。

**方式 B：手动补丁（本机自用 / 想立刻热加载）**

打开 profile 的补丁文件（默认 `~/.dsh/profiles/web/cordis.patch.yml`，web profile 支持热加载），把下面这段**追加进去并保存**：

```yaml
- insert:
    - id: doubao-search
      name: dsh-plugin-doubao-search   # 仓库已放入该 profile node_modules 时的包名
      config:
        apiKeyEnv: DOUBAO_API_KEY
```

保存后宿主工具行即生效，**无需重启**；浏览器配置卡片需要在 **重启一次 dsh 或刷新页面** 后出现（客户端清单在启动/重扫时组装）。

### 2) 填入 API Key（两种方式任选）

**方式一（推荐）：设置页面卡片**

1. 打开 **设置 → 插件 → 插件配置**；
2. 找到「豆包搜索 doubao_search」卡片（头部徽标会显示「未配置」）；
3. 点卡片展开 → 粘贴你的 API Key → **保存并收起**；
4. 徽标变为「已配置」即完成。

**方式二：环境变量（适合脚本/服务器部署）**

```bash
# Windows PowerShell（启动 dsh 前）
$env:DOUBAO_API_KEY = "你的 API Key"
dsh web

# macOS / Linux
export DOUBAO_API_KEY="你的 API Key"
dsh web
```

> Key 从哪里来：开通火山引擎「豆包搜索」后，在 **Agent Plan / 豆包搜索控制台** 创建 API Key。每个火山账号每月有 500 次免费调用额度（以官方控制台为准）。
>
> 🔒 安全说明：卡片保存的 Key 写进本机 DSH 凭据库（`~/.dsh/.credentials.yaml`），不会回显在页面、也不会进入对话记录。**不要把 Key 提交到 git。**

### 3) 用起来

直接对 Agent 说：

- “**用豆包搜一下** DeepSeek V4 什么时候发布”
- “用豆包搜 **最近一周** 的 xxx 政策，**只看官方站点**”
- “豆包帮我**搜几张**有关 xxx 的图”

结果里会带 `URL / 来源 / 权威度 / 时间`，Agent 会据此回答并附上出处。

### 常用控制参数（交给模型，也可你手动提）

| 你想控制什么 | 说法示例 |
| --- | --- |
| 只要最新 | “搜**近一周**的…”（`time_range`） |
| 只要官方来源 | “**只查 gov.cn / 权威机构**”（`auth_level=1` 或 `sites=gov.cn\|…`） |
| 只要结果链接别太长 | “每条**别展开正文**”（默认不带正文） |
| 看完整网页内容 | “搜 3 条并**带上正文**”（`need_content=true` + `count=3`） |
| 图片搜索 | “**搜图片**：xxx”（`search_type=image`） |
| 某个领域 | “按**金融/游戏/政务**角度搜”（`industry`） |

完整参数表见文末「技术细节 · API 对接」。

### 遇到问题？

| 现象 | 处理 |
| --- | --- |
| 页面上没有豆包卡片 | 重启一次 dsh 后硬刷新（Ctrl+F5）；或确认补丁行确实写入 |
| 卡片显示「环境变量来源」 | 说明该 Key 来自环境变量（只读），想改成界面管理就先 `unset DOUBAO_API_KEY` 再保存 |
| 徽标显示未配置，但我明明填过 | 旧版曾把 Key 存进“设置字段”；在卡片里重新保存一次即可统一到凭据库（旧值仍兼容生效） |
| 返回 `invalid api key` | Key 不对，或该 Key 未开通豆包搜索 / 免费额度用尽，去控制台核对 |
| 模型没主动搜 | 提醒它“用 doubao_search 工具”即可；搜索约 1~3 秒 |

---

## 三、开发者 / 技术细节（按需阅读）

### 这是什么形态

一个标准的 **DSH 插件包（bundle）**，由两个半区组成、运行在同一份源码仓库里：

| 文件 | 职责 |
| --- | --- |
| `package.json` | 包元数据；`dsh.bundle.patch`（宿主行补丁）、`dsh.client`（浏览器半声明）、`exports["./client"]` |
| `index.js` | **宿主半**：Cordis 插件（导出 `name / inject / Config / apply`）；注册全局工具 + 设置命名空间 |
| `client.js` | **浏览器半**：手工产出的客户端模块产物（`window.__ModuleLoader__.load` 闭包工厂），注册「设置→插件」配置卡片 |
| `cordis.patch.yml` | 分发用的 bundle 补丁层（`- insert` 声明插件行） |
| `README.md` | 本文档 |

### 宿主半做了什么

- 以 loader 行挂载，在 DSH Node 宿主进程内**无沙箱运行**，直接用全局 `fetch` 调豆包搜索接口（因此跨平台、零 shell 依赖）。
- `ctx.tools.register({ name: 'doubao_search', … })`：注册**全局**模型工具，所有会话可见。
- `ctx.settings.installSection(ctx, 'doubao-search', Config, …)`：注册设置命名空间，供 Web 配置面与用户文档叠加。
- API Key 解析顺序（每次调用逐个回退）：
  1. 设置命名空间 `doubao-search.apiKey`（保留的兼容字段，普通用户不再使用）
  2. 凭据库引用 `apiKeyEnv`（默认 `DOUBAO_API_KEY`，即卡片写入的位置）
  3. 进程环境变量 `apiKeyEnv`
- 行配置项：`apiKeyEnv`、`defaultCount`、`timeoutMs`（Schemastery schema 见 `index.js` 的 `Config`）。

### 浏览器半（配置卡片）如何工作

- 产物格式为客户端模块系统的**闭包工厂**：`window.__ModuleLoader__.load({ id, factory })`，factory 内仅通过注入的 `require` 取平台种子（`react`），其余代码全部内联 —— 因此不依赖任何第三方客户端包，规避客户端 bundle 纯度门槛，且无需仓库内构建工具即可维护。
- 通过 `ctx.slots.register({ name: 'settings.plugin.item', key: 'doubao-search' }, Card)` 注册卡片，与宿主注册的命名空间**自动配对**（官方支持的第三方卡片机制）。
- 密钥走**凭据域**而非设置文档（对齐官方 `WebSearchCard` 模式）：`ctx.remote.credentials.describe/set/unset`，页面只展示 configured/writable 布尔状态，密钥字面量永不回显。
- 运行时注入服务：`slots`、`settingsScope`、`remote`、`remote.credentials`。

### API 对接（豆包搜索 Custom 版）

- 端点：`POST https://open.feedcoopapi.com/search_api/web_search`，`Authorization: Bearer <API_KEY>`。
- 请求体字段与校验边界（`validateArgs` 内置）：`Query`(1~100) / `SearchType`(`web`|`image`) / `Count`(web≤50, image≤5) / `Filter{AuthInfoLevel,NeedContent,NeedUrl,Sites(≤20),BlockHosts(≤5),Industry}` / `TimeRange`(`OneDay..OneYear` 或 `YYYY-MM-DD..YYYY-MM-DD`) / `QueryControl{QueryRewrite}` / `ContentFormats`(`text|markdown`)。
- 响应：`ResponseMetadata`（含业务错误码）+ `Result{WebResults|ImageResults, ResultCount, SearchContext, TimeCost, LogId}`；工具会整理为带 URL/来源/权威度/时间的文本返回模型。

### 本地开发与热加载

- 依赖解析：仓库根的 `node_modules/@deepseek-ai` 是指向 DSH 共享依赖目录的 junction（不入库，已在 `.gitignore`）。
- 宿主侧改动：保存 profile 的 `cordis.patch.yml` 即触发 loader 热加载；若改了行结构（如行 id/name），会同时触发 client-modules 重扫。
- 浏览器侧产物改动：`client.js` 的字节由宿主按 rev 提供 —— 直接改文件后，页面**硬刷新**即可拿到（服务端重扫后 rev 已更新）；新增/恢复 `dsh.client` 声明的**结构性**变化才需要重启。
- 校验：`npm run check`（`node --check index.js && node --check client.js`）。

---

## 许可

MIT
