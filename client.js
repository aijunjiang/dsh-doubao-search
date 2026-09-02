/* dsh-plugin-doubao-search — browser half.
 * 手工按 DSH 客户端模块系统的闭包工厂契约产出的产物：
 *   经典脚本加载后调用 window.__ModuleLoader__.load({ id, factory })；
 *   仅在 factory 内部通过注入的 require 取平台种子（react），
 *   其余一律内联，不依赖任何第三方客户端包，规避客户端 bundle 纯度门槛。
 *
 * 卡片行为（对齐官方 WebSearchCard 的模式）：
 *   - 可折叠：头部一行显示 状态徽标（已配置/未配置/未知/不可写）+ 标题 + 展开箭头，
 *     点击头部展开/收起配置表单；保存成功后自动收起并刷新状态。
 *   - API Key 走「凭据域」而非设置文档：页面只显示“是否已配置”，
 *     密钥字面量永不回显；写入/清除通过 ctx.remote.credentials。
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-doubao-search',
  factory: (require) => {
    'use strict'
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    var React = require('react')
    var createElement = React.createElement
    var useState = React.useState
    var useEffect = React.useEffect

    /** 设置命名空间（必须与宿主半 DOUBAO_NS 一致）。 */
    var NS = 'doubao-search'
    /** 未显式配置时使用的默认凭据引用。 */
    var DEFAULT_REF = 'DOUBAO_API_KEY'

    var css = {
      card: {
        border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.3))',
        borderRadius: '10px',
        background: 'var(--dsw-alias-bg-layer-2, transparent)',
        overflow: 'hidden',
      },
      header: {
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '12px 16px', cursor: 'pointer', width: '100%', boxSizing: 'border-box',
        border: 'none', background: 'none', textAlign: 'left', font: 'inherit', color: 'inherit',
      },
      badge: { borderRadius: '999px', padding: '1px 10px', fontSize: '11px', lineHeight: '18px', whiteSpace: 'nowrap' },
      badgeOk: { background: 'var(--dsw-alias-color-success-bg, rgba(34,197,94,.18))', color: 'var(--dsw-alias-label-success, #16a34a)' },
      badgeEmpty: { background: 'var(--dsw-alias-bg-module-platform, rgba(128,128,128,.18))', color: 'var(--dsw-alias-label-secondary, #888)' },
      badgeWarn: { background: 'rgba(234,179,8,.18)', color: '#ca8a04' },
      title: { flex: '1', fontSize: '13px', fontWeight: 600, color: 'var(--dsw-alias-label-primary, inherit)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      chevron: { color: 'var(--dsw-alias-label-tertiary, #999)', fontSize: '11px', flexShrink: 0 },
      body: { padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: '10px' },
      desc: { margin: 0, fontSize: '12px', lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary, #888)' },
      row: { display: 'flex', flexDirection: 'column', gap: '6px' },
      label: { fontSize: '13px', color: 'var(--dsw-alias-label-primary, inherit)' },
      hint: { margin: 0, fontSize: '12px', lineHeight: 1.6, color: 'var(--dsw-alias-label-tertiary, #999)' },
      input: { border: '1px solid var(--dsw-alias-border-l2, #555)', background: 'var(--dsw-alias-bg-layer-3, #222)', color: 'var(--dsw-alias-label-primary, inherit)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', width: '100%', boxSizing: 'border-box' },
      buttons: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
      btn: { borderRadius: '8px', padding: '6px 14px', fontSize: '13px', cursor: 'pointer', border: '1px solid var(--dsw-alias-border-l2, #555)', background: 'var(--dsw-alias-bg-module-platform, #333)', color: 'var(--dsw-alias-label-primary, inherit)' },
      primary: { background: 'var(--dsw-alias-brand-primary, #3b82f6)', borderColor: 'transparent', color: '#fff' },
      note: { fontSize: '12px', lineHeight: 1.5, margin: 0 },
      noteOk: { color: 'var(--dsw-alias-label-success, #16a34a)' },
      noteError: { color: 'var(--dsw-alias-label-error, #ef4444)' },
      divider: { margin: 0, border: 'none', borderTop: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.2))' },
    }

    function DoubaoCard(props) {
      var snap = props.useDoubaoCard(function (s) { return s })
      // 设置域与凭据域状态
      var settingsWritable = !!(snap && snap.writable && snap.status === 'ready')
      var cred = (snap && snap.credential) || { ref: DEFAULT_REF, configured: false, writable: true, known: false }

      var [open, setOpen] = useState(false)
      var [keyText, setKeyText] = useState('')
      var [busy, setBusy] = useState(false)
      var [notice, setNotice] = useState(null)

      var allowKeyWrite = cred.writable
      var badgeText = ''
      var badgeStyle = css.badge
      if (!cred.known) {
        badgeStyle = Object.assign({}, badgeStyle, css.badgeEmpty)
        badgeText = '检查中…'
      } else if (cred.configured) {
        badgeStyle = Object.assign({}, badgeStyle, css.badgeOk)
        badgeText = '已配置'
      } else if (!allowKeyWrite) {
        badgeStyle = Object.assign({}, badgeStyle, css.badgeWarn)
        badgeText = '环境变量来源'
      } else {
        badgeStyle = Object.assign({}, badgeStyle, css.badgeEmpty)
        badgeText = '未配置'
      }

      useEffect(function () {
        props.refreshCredential()
      }, [])

      function onSave() {
        var key = keyText.replace(/^\s+|\s+$/g, '')
        if (key === '') {
          setNotice({ ok: false, text: '请先在上方输入框粘贴 API Key。' })
          return
        }
        setBusy(true)
        setNotice(null)
        props.saveKey(key).then(function (res) {
          setBusy(false)
          if (res && res.error) {
            setNotice({ ok: false, text: res.error })
            return
          }
          setKeyText('')
          setNotice({ ok: true, text: '已写入凭据 ' + cred.ref + '。' })
          // 保存成功后收起，头部徽标随即刷新为“已配置”
          setOpen(false)
        })
      }

      function onClear() {
        setBusy(true)
        setNotice(null)
        props.clearKey().then(function (res) {
          setBusy(false)
          if (res && res.error) {
            setNotice({ ok: false, text: res.error })
            return
          }
          setKeyText('')
          setNotice({ ok: true, text: '已清除凭据 ' + cred.ref + '。' })
          setOpen(false)
        })
      }

      var chevronLabel = open ? '收起 ▾' : '展开 ▸'
      return createElement('div', { style: css.card },
        createElement('div', {
          style: css.header,
          role: 'button',
          tabIndex: 0,
          'aria-expanded': String(open),
          onClick: function () { setOpen(!open) },
          onKeyDown: function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open) }
          },
        },
          createElement('span', { style: badgeStyle }, badgeText),
          createElement('span', { style: css.title }, '豆包搜索 doubao_search'),
          createElement('span', { style: css.chevron }, chevronLabel),
        ),
        open ? createElement('div', { style: css.body },
          createElement('hr', { style: css.divider }),
          createElement('p', { style: css.desc },
            '调用火山引擎豆包搜索（联网搜索 Custom 版）实时获取网页/图片结果。API Key 保存在本机 DSH 凭据库，界面不回显。'
            + (cred.known && !cred.configured && allowKeyWrite ? ' 当前未配置，粘贴 Agent Plan / 豆包搜索 API Key 后点保存。' : '')),
          createElement('div', { style: css.row },
            createElement('label', { style: css.label, htmlFor: 'doubao-search-api-key' }, 'API Key'),
            createElement('input', {
              id: 'doubao-search-api-key',
              style: css.input,
              type: 'password',
              autoComplete: 'new-password',
              spellCheck: false,
              placeholder: '粘贴 API Key（留空并保存 = 不做改动）',
              value: keyText,
              disabled: busy || !allowKeyWrite,
              onChange: function (e) { setKeyText(e.target.value) },
            }),
            createElement('p', { style: css.hint },
              '凭据引用：' + cred.ref
              + (allowKeyWrite ? '' : ' — 该引用由环境变量/只读来源提供，不能在此修改'),
            ),
          ),
          createElement('div', { style: css.buttons },
            createElement('button', {
              style: Object.assign({}, css.btn, css.primary),
              disabled: busy || !allowKeyWrite,
              onClick: onSave,
            }, busy ? '保存中…' : '保存并收起'),
            createElement('button', { style: css.btn, disabled: busy || !allowKeyWrite, onClick: onClear }, '清除已存 Key'),
            notice
              ? createElement('span', { style: notice.ok ? css.noteOk : css.noteError }, notice.text)
              : null,
          ),
        ) : null,
      )
    }

    function apply(ctx) {
      var scope = ctx.settingsScope.bind({ namespace: NS })

      var latest = {
        status: 'loading',
        writable: false,
        revision: undefined,
        credential: { ref: DEFAULT_REF, configured: false, writable: true, known: false },
      }
      var listeners = []
      var scheduled = false

      function notify() {
        scheduled = false
        var list = listeners.slice()
        for (var i = 0; i < list.length; i++) {
          try { list[i]() } catch (err) { /* 忽略渲染端监听器异常 */ }
        }
      }
      function update(next) {
        var changed =
          next.status !== latest.status
          || next.writable !== latest.writable
          || next.revision !== latest.revision
          || next.credential.ref !== latest.credential.ref
          || next.credential.configured !== latest.credential.configured
          || next.credential.writable !== latest.credential.writable
          || next.credential.known !== latest.credential.known
        latest = next
        if (changed && !scheduled) {
          scheduled = true
          queueMicrotask(notify)
        }
      }

      function refOf() {
        var s = scope.getSnapshot()
        var declared = s && s.value && s.value.apiKeyEnv
        return (typeof declared === 'string' && declared.length > 0) ? declared : DEFAULT_REF
      }

      function remoteCreds() {
        return ctx.remote ? ctx.remote.credentials : undefined
      }

      function refreshCredential() {
        var ref = refOf()
        var creds = remoteCreds()
        if (!creds || typeof creds.describe !== 'function') {
          update(Object.assign({}, latest, {
            credential: { ref: ref, configured: false, writable: true, known: true },
          }))
          return
        }
        // 状态先行归零，避免旧引用状态残留
        update(Object.assign({}, latest, {
          credential: { ref: ref, configured: false, writable: true, known: false },
        }))
        creds.describe([ref]).then(function (response) {
          if (ref !== refOf()) return
          var view = response && response.ok && response.value ? response.value[ref] : undefined
          update(Object.assign({}, latest, {
            credential: {
              ref: ref,
              configured: !!(view && view.configured),
              writable: view ? view.writable !== false : true,
              known: true,
            },
          }))
        }).catch(function () {
          if (ref !== refOf()) return
          update(Object.assign({}, latest, {
            credential: { ref: ref, configured: false, writable: true, known: true },
          }))
        })
      }

      // 设置域变化时重新派生并顺带刷新凭据状态
      scope.subscribe(function () {
        var s = scope.getSnapshot()
        update(Object.assign({}, latest, {
          status: s ? s.status : 'unavailable',
          writable: !!(s && s.writable),
          revision: s ? s.revision : undefined,
        }))
        refreshCredential()
      })
      var s0 = scope.getSnapshot()
      update(Object.assign({}, latest, {
        status: s0 ? s0.status : 'unavailable',
        writable: !!(s0 && s0.writable),
        revision: s0 ? s0.revision : undefined,
      }))
      refreshCredential()

      function saveKey(key) {
        var ref = refOf()
        var creds = remoteCreds()
        if (!creds || typeof creds.set !== 'function') {
          return Promise.resolve({ error: '凭据服务不可用（remote.credentials 缺失）。' })
        }
        return creds.set(ref, key).then(function () {
          refreshCredential()
          return {}
        }).catch(function (err) {
          return { error: String((err && err.message) || err) }
        })
      }
      function clearKey() {
        var ref = refOf()
        var creds = remoteCreds()
        if (!creds || typeof creds.unset !== 'function') {
          return Promise.resolve({ error: '凭据服务不可用（remote.credentials 缺失）。' })
        }
        return creds.unset(ref).then(function () {
          refreshCredential()
          return {}
        }).catch(function (err) {
          return { error: String((err && err.message) || err) }
        })
      }

      var store = {
        getSnapshot: function () { return latest },
        subscribe: function (listener) {
          listeners.push(listener)
          return function () {
            var i = listeners.indexOf(listener)
            if (i >= 0) listeners.splice(i, 1)
          }
        },
      }

      ctx.slots.inject('settings.plugin.item', function* registerCard() {
        yield ctx.slots.register({
          name: 'settings.plugin.item',
          key: NS,
          inject: function () {
            return {
              hooks: { doubaoCard: store },
              saveKey: saveKey,
              clearKey: clearKey,
              refreshCredential: refreshCredential,
            }
          },
        }, DoubaoCard)
      })
    }

    exports.inject = ['slots', 'settingsScope', 'remote', 'remote.credentials']
    exports.apply = apply
    return module.exports
  },
})
