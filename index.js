// dsh-plugin-doubao-search: 把「豆包搜索（火山引擎联网搜索 Custom 版）」
// 注册为 DSH 全局模型工具 doubao_search。
//
// 作为标准 DSH 插件（bundle）行挂载：在 Node 宿主进程内无沙箱运行，
// 直接使用全局 fetch，天然跨 Windows / macOS / Linux。
// API Key 解析顺序：1) 设置命名空间 apiKey 字段  2) 凭据/环境变量（默认 DOUBAO_API_KEY）。
import z from '@deepseek-ai/schemastery'

/** Cordis 插件名（loader 诊断用）。 */
export const name = 'doubao-search'

/** 需要注入的服务：tools=注册工具，settings=注册配置命名空间。 */
export const inject = ['tools', 'settings']

/** 设置命名空间（Web「设置 → 插件」将来的配置卡片按此 key 配对）。 */
export const DOUBAO_NS = 'doubao-search'

const ENDPOINT = 'https://open.feedcoopapi.com/search_api/web_search'
const TRAFFIC_TAG = 'ark_dsh_doubao_search'
const DEFAULT_KEY_ENV = 'DOUBAO_API_KEY'
const DEFAULT_COUNT = 10
const DEFAULT_TIMEOUT_MS = 30000

/** 行级默认配置（可被命名空间用户层逐字段覆盖）。 */
export const Config = z.object({
  apiKey: z.string().role('secret'),
  apiKeyEnv: z.string().role('credential-ref').default(DEFAULT_KEY_ENV),
  defaultCount: z.number().step(1).min(1).max(50).default(DEFAULT_COUNT),
  timeoutMs: z.number().min(1000).max(120000).default(DEFAULT_TIMEOUT_MS),
})

function withDefaults(config) {
  const c = config && typeof config === 'object' ? config : {}
  return {
    apiKey: typeof c.apiKey === 'string' ? c.apiKey : '',
    apiKeyEnv: typeof c.apiKeyEnv === 'string' && c.apiKeyEnv !== '' ? c.apiKeyEnv : DEFAULT_KEY_ENV,
    defaultCount: Number.isInteger(c.defaultCount) ? c.defaultCount : DEFAULT_COUNT,
    timeoutMs: Number.isInteger(c.timeoutMs) ? c.timeoutMs : DEFAULT_TIMEOUT_MS,
  }
}

const trunc = (text, max) => {
  if (typeof text !== 'string' || text.length === 0) return ''
  return text.length > max ? text.slice(0, max) + '…[已截断]' : text
}

/** 校验 host 列表（sites / block_hosts 的 | 分隔域名）。 */
function parseHosts(value, label, max) {
  if (value === undefined || value === null) return { ok: true, list: '' }
  const norm = String(value).trim()
  if (norm === '') return { ok: true, list: '' }
  const items = norm.split('|').map((s) => s.trim()).filter((s) => s !== '')
  if (items.length === 0) return { ok: false, msg: `错误：${label} 需为非空域名列表（| 分隔）` }
  if (items.length > max) return { ok: false, msg: `错误：${label} 最多 ${max} 个域名` }
  return { ok: true, list: items.join('|') }
}

/** 校验工具入参，返回错误文案或 null。 */
function validateArgs(args) {
  const q = String(args.query === undefined ? '' : args.query).trim()
  if (q === '') return { err: '错误：query 不能为空' }
  if (q.length > 100) return { err: '错误：query 长度需为 1~100 个字符' }
  const searchType = args.search_type === undefined || args.search_type === '' ? 'web' : String(args.search_type).toLowerCase()
  if (searchType !== 'web' && searchType !== 'image') return { err: '错误：search_type 仅支持 web 或 image' }
  let count = args.count
  if (count === undefined || count === null) count = searchType === 'web' ? 10 : 5
  count = Number(count)
  const maxCount = searchType === 'web' ? 50 : 5
  if (!Number.isInteger(count) || count < 1 || count > maxCount) {
    return { err: `错误：count 需为 1~${maxCount} 的整数（${searchType} 类型）` }
  }
  const authLevel = args.auth_level === undefined || args.auth_level === null ? 0 : Number(args.auth_level)
  if (authLevel !== 0 && authLevel !== 1) return { err: '错误：auth_level 仅支持 0 或 1' }
  let timeRange = args.time_range === undefined ? '' : String(args.time_range).trim()
  if (timeRange !== '') {
    const shorts = ['OneDay', 'OneWeek', 'OneMonth', 'OneYear']
    const m = timeRange.match(/^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/)
    if (shorts.indexOf(timeRange) === -1 && !m) {
      return { err: '错误：time_range 需为 OneDay/OneWeek/OneMonth/OneYear 或日期区间 YYYY-MM-DD..YYYY-MM-DD' }
    }
    if (m && m[1] > m[2]) return { err: '错误：time_range 的开始日期不能晚于结束日期' }
  }
  if (args.industry !== undefined && args.industry !== '' && !['finance', 'game', 'gov'].includes(String(args.industry).toLowerCase())) {
    return { err: '错误：industry 仅支持 finance/game/gov' }
  }
  if (args.content_formats !== undefined && args.content_formats !== '' && !['text', 'markdown'].includes(String(args.content_formats).toLowerCase())) {
    return { err: '错误：content_formats 仅支持 text/markdown' }
  }
  const industry = args.industry === undefined ? '' : String(args.industry).toLowerCase()
  const contentFormats = args.content_formats === undefined ? '' : String(args.content_formats).toLowerCase()
  const sites = parseHosts(args.sites, 'sites', 20)
  if (!sites.ok) return { err: sites.msg }
  const blockHosts = parseHosts(args.block_hosts, 'block_hosts', 5)
  if (!blockHosts.ok) return { err: blockHosts.msg }
  const needContent = args.need_content === undefined || args.need_content === null ? false : !!args.need_content
  const needUrlGiven = args.need_url !== undefined && args.need_url !== null
  const needUrl = needUrlGiven ? !!args.need_url : true
  if (searchType === 'image') {
    const webOnly = []
    if (timeRange !== '') webOnly.push('time_range')
    if (authLevel !== 0) webOnly.push('auth_level')
    if (needContent) webOnly.push('need_content')
    if (needUrlGiven) webOnly.push('need_url')
    if (args.sites !== undefined && args.sites !== '') webOnly.push('sites')
    if (args.block_hosts !== undefined && args.block_hosts !== '') webOnly.push('block_hosts')
    if (industry !== '') webOnly.push('industry')
    if (contentFormats !== '') webOnly.push('content_formats')
    if (webOnly.length > 0) return { err: `错误：${webOnly.join(', ')} 仅支持 web 搜索` }
  }
  const payload = { Query: q, SearchType: searchType, Count: count }
  if (searchType === 'web') {
    const filter = {}
    if (authLevel === 1) filter.AuthInfoLevel = 1
    filter.NeedUrl = needUrl
    if (needContent) filter.NeedContent = true
    if (sites.list !== '') filter.Sites = sites.list
    if (blockHosts.list !== '') filter.BlockHosts = blockHosts.list
    if (industry !== '') filter.Industry = industry
    if (Object.keys(filter).length > 0) payload.Filter = filter
    if (timeRange !== '') payload.TimeRange = timeRange
    if (contentFormats !== '') payload.ContentFormats = contentFormats
  }
  const qrw = args.query_rewrite
  if (qrw !== undefined && qrw !== null) payload.QueryControl = { QueryRewrite: !!qrw }
  return { payload }
}

/** 把 API 原始响应整理成给模型阅读的文本。 */
function formatResult(query, data) {
  if (!data || typeof data !== 'object') return '豆包搜索返回了异常数据。'
  if (data.ResponseMetadata && data.ResponseMetadata.Error) {
    const e = data.ResponseMetadata.Error
    const code = e.CodeN !== undefined && e.CodeN !== null ? e.CodeN : (e.Code !== undefined ? e.Code : '')
    const msg = e.Message || '未知错误'
    return `豆包搜索返回错误 [${code}] ${msg}（RequestId: ${data.ResponseMetadata.RequestId || ''}）`
  }
  const r = data.Result
  if (!r) return '豆包搜索未返回 Result 字段。'
  const lines = []
  if (Array.isArray(r.WebResults) && r.WebResults.length > 0) {
    const web = r.WebResults
    lines.push(`豆包搜索（web，query: ${query}）— 命中 ${r.ResultCount !== undefined ? r.ResultCount : web.length} 条，展示 ${web.length} 条`)
    web.forEach((w, i) => {
      lines.push('')
      lines.push(`[${i + 1}] ${w.Title || '(无标题)'}`)
      const meta = []
      if (w.SiteName) meta.push(`来源: ${w.SiteName}`)
      if (w.AuthInfoDes) meta.push(`权威度: ${w.AuthInfoDes}`)
      if (w.PublishTime) meta.push(`时间: ${w.PublishTime}`)
      if (meta.length) lines.push('    ' + meta.join(' | '))
      if (w.Url) lines.push(`    URL: ${w.Url}`)
      if (w.Snippet) lines.push(`    摘要: ${trunc(w.Snippet, 600)}`)
      if (w.Summary) lines.push(`    相关片段: ${trunc(w.Summary, 2000)}`)
      if (w.Content) lines.push(`    正文: ${trunc(w.Content, 3000)}`)
    })
  } else if (Array.isArray(r.ImageResults) && r.ImageResults.length > 0) {
    const imgs = r.ImageResults
    lines.push(`豆包搜索（image，query: ${query}）— 命中图片 ${r.ResultCount !== undefined ? r.ResultCount : imgs.length} 张，展示 ${imgs.length} 张`)
    imgs.forEach((it, i) => {
      const img = it.Image || {}
      lines.push('')
      lines.push(`[${i + 1}] ${it.Title || '(无标题)'}`)
      const meta = []
      if (it.SiteName) meta.push(`来源: ${it.SiteName}`)
      if (img.Shape) meta.push(`形状: ${img.Shape}`)
      if (img.Width && img.Height) meta.push(`尺寸: ${img.Width}x${img.Height}`)
      if (meta.length) lines.push('    ' + meta.join(' | '))
      if (img.Url) lines.push(`    图片: ${img.Url}`)
      if (it.Url) lines.push(`    落地页: ${it.Url}`)
    })
  } else {
    lines.push(`未返回任何结果（ResultCount=${r.ResultCount === undefined ? '?' : r.ResultCount}）。`)
  }
  lines.push('')
  lines.push(`（耗时 ${r.TimeCost !== undefined ? r.TimeCost : '?'}ms，LogId ${r.LogId || ''}）`)
  return lines.join('\n')
}

/** 生成 fetch 失败时的可读错误。 */
function readHttpError(error) {
  if (error && error.name === 'AbortError') return '豆包搜索请求超时或已中止。'
  return `豆包搜索 HTTP 请求失败：${error && error.message ? error.message : String(error)}`
}

export function apply(ctx, entry) {
  let current = () => withDefaults(entry)
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.installSection(ctx, DOUBAO_NS, Config, withDefaults(entry), {
      setSource(source) {
        current = () => withDefaults(source())
      },
      onChange() {},
    })
  })

  /** 解析本轮调用使用的 API Key。 */
  async function resolveKey() {
    const cfg = current()
    if (cfg.apiKey !== '') return cfg.apiKey
    const envName = cfg.apiKeyEnv || DEFAULT_KEY_ENV
    const credentials = ctx.get('credentials')
    if (credentials !== undefined) {
      try {
        const resolved = await credentials.resolve(envName)
        if (resolved && resolved.value && resolved.value.length > 0) return resolved.value
      } catch (err) {
        // 凭据解析失败时继续走环境变量兜底
      }
    }
    if (typeof process !== 'undefined' && process.env) {
      const v = process.env[envName]
      if (v !== undefined && v !== '') return v
    }
    return ''
  }

  ctx.tools.register({
    name: 'doubao_search',
    description:
      '调用火山引擎「豆包搜索」（联网搜索 Custom 版 API，POST https://open.feedcoopapi.com/search_api/web_search）'
      + '获取实时网页/图片搜索结果：标题、来源站点、URL、摘要、正文、权威度、发布时间等，'
      + '用于补充训练截止后的最新事实与核对信息出处。\n'
      + 'API Key 解析顺序：DSH 设置命名空间 doubao-search 的 apiKey → 环境变量 DOUBAO_API_KEY（可在 dsh 启动前 export）。\n'
      + '提示：web 搜索默认请求带原文链接的结果；如需阅读正文请设 need_content=true（正文较长，建议同时把 count 降到 3~5）；图片搜索最多返回 5 条。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索 query，1~100 个字符。可传口语化长问题，配合 query_rewrite 自动改写。' },
        search_type: { type: 'string', enum: ['web', 'image'], description: '搜索类型：web=网页（默认），image=图片。' },
        count: { type: 'integer', description: '返回条数。默认 web=10、image=5；web 最多 50，image 最多 5。' },
        time_range: { type: 'string', description: '发文时间范围：OneDay/OneWeek/OneMonth/OneYear，或日期区间 YYYY-MM-DD..YYYY-MM-DD。仅 web。' },
        auth_level: { type: 'integer', enum: [0, 1], description: '权威等级过滤：0=不限（默认）；1=仅非常权威来源。仅 web。' },
        need_content: { type: 'boolean', description: '是否请求网页正文（Content 字段），默认 false。仅 web。' },
        need_url: { type: 'boolean', description: '是否只返回带原文链接的结果，默认 true。仅 web。' },
        sites: { type: 'string', description: '仅在这些站点内搜索，| 分隔，最多 20 个。仅 web。' },
        block_hosts: { type: 'string', description: '排除这些站点，| 分隔，最多 5 个。仅 web。' },
        industry: { type: 'string', enum: ['finance', 'game', 'gov'], description: '行业搜索：finance/game/gov。仅 web。' },
        query_rewrite: { type: 'boolean', description: '是否开启 Query 改写（略增耗时），默认 false。' },
        content_formats: { type: 'string', enum: ['text', 'markdown'], description: '请求的正文格式：text（默认）/ markdown。仅 web。' },
      },
      required: ['query'],
    },
    output: {
      schema: { type: 'string' },
      render(_args, value) {
        return [{ type: 'text', text: value }]
      },
    },
    timeoutMs: 120000,
    async execute(args, exec) {
      const checked = validateArgs(args)
      if (checked.err) return checked.err
      const payload = checked.payload
      const cfg = current()
      const apiKey = await resolveKey()
      if (apiKey === '') {
        return '未配置豆包搜索 API Key。\n'
          + `请设置环境变量 ${cfg.apiKeyEnv || DEFAULT_KEY_ENV}（或 DSH 设置中 doubao-search 命名空间的 apiKey）后重试。`
      }
      const timeoutMs = cfg.timeoutMs || DEFAULT_TIMEOUT_MS
      let signal
      try {
        signal = exec && exec.signal ? AbortSignal.any([AbortSignal.timeout(timeoutMs), exec.signal]) : AbortSignal.timeout(timeoutMs)
      } catch (err) {
        signal = exec && exec.signal ? exec.signal : undefined
      }
      let response
      try {
        response = await fetch(ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'X-Traffic-Tag': TRAFFIC_TAG,
          },
          body: JSON.stringify(payload),
          signal,
        })
      } catch (error) {
        return readHttpError(error)
      }
      let text
      try {
        text = await response.text()
      } catch (error) {
        return readHttpError(error)
      }
      if (response.status < 200 || response.status >= 300) {
        const body = text && text.length > 0 ? text.slice(0, 800) : ''
        return `豆包搜索 HTTP 调用失败（状态码 ${response.status}）${body !== '' ? '：' + body : ''}`
      }
      let data
      try {
        data = JSON.parse(text)
      } catch (err) {
        return text.trim() !== '' ? `豆包搜索返回了无法解析的内容：${trunc(text, 2000)}` : '豆包搜索未返回内容。'
      }
      return formatResult(payload.Query, data)
    },
  })
}
