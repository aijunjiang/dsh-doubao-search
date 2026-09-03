/* dsh-plugin-doubao-search — browser half (v3).
 * 产物形态：DSH 客户端模块系统的闭包工厂（window.__ModuleLoader__.load），
 * 仅在 factory 内通过注入 require 取平台种子 react，其余全内联。
 *
 * v3 要点：
 *  - 外观对齐官方设置卡片（PluginCard 结构 + --dsw-alias-* 主题 token）：
 *    名称+描述堆叠的表头、unsaved 胶囊、旋转箭头、字段分隔线、
 *    右对齐 放弃/保存、保存成功自动收起。
 *  - 文案 i18n：通过 DSH locale 服务注册 settings.doubaoSearch 字典，
 *    跟随界面语言自动在 中文/English 间切换（缺省回退 en）。
 *  - API Key 走凭据域（ctx.remote.credentials），仅展示 已配置/未配置，
 *    密钥字面量永不回显。
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
    var useRef = React.useRef

    var NS = 'doubao-search' // 设置命名空间（与宿主半一致）
    var LNS = 'settings.doubaoSearch' // 本卡片自己的 locale 命名空间
    var DEFAULT_REF = 'DOUBAO_API_KEY'

    /* ================= 文案字典 (zh / en) ================= */
    var dict = {
      zh: {
        title: '豆包搜索 doubao_search',
        description: '调用火山引擎豆包搜索（联网搜索 Custom 版）实时检索网页 / 图片，为对话补充最新事实并给出出处。',
        apiKeyLabel: 'API Key',
        apiKeyPlaceholder: '粘贴 API Key（留空保存 = 不改动已存 Key）',
        apiKeyHint: 'Key 保存在本机 DSH 凭据库（~/.dsh/.credentials.yaml），界面永不回显。',
        envSourceHint: '该引用当前由环境变量 / 只读来源提供，不能在界面修改。',
        configured: '已配置',
        unconfigured: '未配置',
        checking: '检查中…',
        envSource: '环境变量来源',
        unsaved: '未保存的修改',
        dirtyEmpty: '先在输入框粘贴 Key，才能保存。',
        discard: '放弃',
        save: '保存',
        saving: '保存中…',
        clearKey: '清除已存 Key',
        saved: '已保存到凭据库，可在对话中使用。',
        cleared: '已清除凭据中的 Key。',
        saveFailed: '保存失败，请重试。',
        expandAria: '展开配置',
        collapseAria: '收起配置',
      },
      en: {
        title: 'Doubao Search (doubao_search)',
        description: 'Live web / image search via Volcengine Doubao (web-search API), returning dated results with source links for grounding.',
        apiKeyLabel: 'API Key',
        apiKeyPlaceholder: 'Paste API key (leave blank & save = keep current key)',
        apiKeyHint: 'Stored in the local DSH credential store (~/.dsh/.credentials.yaml); never echoed on screen.',
        envSourceHint: 'This reference is provided by the environment / a read-only source and cannot be edited here.',
        configured: 'Configured',
        unconfigured: 'Not configured',
        checking: 'Checking…',
        envSource: 'Env source',
        unsaved: 'Unsaved changes',
        dirtyEmpty: 'Type a key first, then save.',
        discard: 'Discard',
        save: 'Save',
        saving: 'Saving…',
        clearKey: 'Clear stored key',
        saved: 'Saved to the credential store; ready to use in conversations.',
        cleared: 'Key removed from the credential store.',
        saveFailed: 'Save failed. Please try again.',
        expandAria: 'Expand settings',
        collapseAria: 'Collapse settings',
      },
    }

    /* ================= 与官方一致的样式（同一套主题 token）================= */
    var css = {
      card: {
        listStyle: 'none',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '12px',
        background: 'var(--dsw-alias-bg-layer-3)',
        transition: 'border-color .16s, background .16s',
      },
      cardOpen: { background: 'var(--dsw-alias-bg-layer-2)', borderColor: 'var(--dsw-alias-label-dimmed)' },
      header: {
        width: '100%', appearance: 'none', border: '0', background: 'none', font: 'inherit',
        color: 'inherit', textAlign: 'left', cursor: 'pointer', display: 'flex',
        alignItems: 'center', gap: '12px', padding: '14px 16px', borderRadius: '12px',
        outlineOffset: '-2px',
      },
      headText: { flex: '1', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '4px' },
      name: { fontSize: '15px', fontWeight: 600, lineHeight: '1.4', color: 'var(--dsw-alias-label-primary)' },
      description: { fontSize: '13px', lineHeight: '1.5', color: 'var(--dsw-alias-label-tertiary)' },
      pill: { flex: 'none', borderRadius: '999px', padding: '1px 8px', fontSize: '11px', lineHeight: '17px', fontWeight: 500, whiteSpace: 'nowrap', background: 'var(--dsw-alias-bg-module-platform)', color: 'var(--dsw-alias-label-secondary)' },
      pillOk: { color: 'var(--dsw-alias-label-success, #16a34a)' },
      pillEmpty: { color: 'var(--dsw-alias-label-tertiary, #888)' },
      chevron: { flex: 'none', color: 'var(--dsw-alias-label-tertiary)', transition: 'transform .16s' },
      chevronOpen: { transform: 'rotate(180deg)' },
      body: { borderTop: '1px solid var(--dsw-alias-border-l2)', margin: '0 16px', paddingBottom: '8px' },
      readOnly: { margin: '12px 0 0', fontSize: '12px', lineHeight: '1.5', color: 'var(--dsw-alias-label-tertiary)' },
      field: { display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px 0', borderBottom: '1px solid var(--dsw-alias-border-l2)' },
      fieldHead: { display: 'flex', alignItems: 'center', gap: '8px' },
      label: { minWidth: '0', color: 'var(--dsw-alias-label-primary)', flex: '1', fontSize: '13px', fontWeight: 500, lineHeight: '1.5' },
      statePill: { whiteSpace: 'nowrap', background: 'var(--dsw-alias-bg-module-platform)', color: 'var(--dsw-alias-label-secondary)', borderRadius: '999px', padding: '1px 8px', fontSize: '11px', lineHeight: '17px', fontWeight: 500 },
      input: { border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-layer-3)', height: '34px', font: 'inherit', color: 'var(--dsw-alias-label-primary)', borderRadius: '8px', padding: '0 12px', fontSize: '13px', lineHeight: '1.5', boxSizing: 'border-box', width: '100%' },
      inputDisabled: { color: 'var(--dsw-alias-label-tertiary)', cursor: 'default' },
      hint: { color: 'var(--dsw-alias-label-tertiary)', margin: '0', fontSize: '12px', lineHeight: '1.5' },
      footer: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 0 4px', borderTop: '1px solid var(--dsw-alias-border-l2)' },
      footerLeft: { flex: '1', minWidth: '0', display: 'flex', gap: '8px', alignItems: 'center' },
      failed: { margin: '0', fontSize: '12px', lineHeight: '1.5', color: 'var(--dsw-alias-label-error)' },
      ok: { margin: '0', fontSize: '12px', lineHeight: '1.5', color: 'var(--dsw-alias-label-success, #16a34a)' },
      link: { appearance: 'none', border: '0', background: 'none', font: 'inherit', fontSize: '12px', color: 'var(--dsw-alias-label-secondary)', cursor: 'pointer', padding: '2px 0', textDecoration: 'none' },
      btn: { appearance: 'none', border: '1px solid transparent', borderRadius: '8px', padding: '5px 14px', font: 'inherit', fontSize: '13px', lineHeight: '1.5', cursor: 'pointer' },
      btnDisabled: { opacity: '0.4', cursor: 'default' },
      discard: { borderColor: 'var(--dsw-alias-border-l2)', background: 'none', color: 'var(--dsw-alias-label-secondary)' },
      save: { background: 'var(--dsw-alias-label-primary)', color: 'var(--dsw-alias-bg-layer-3)' },
    }

    function merge(a, b) { return Object.assign({}, a, b || null) }
    function pill(extra, text) {
      return createElement('span', { style: merge(css.pill, extra) }, text)
    }
    function Chevron(open) {
      return createElement('svg', {
        width: 14, height: 14, viewBox: '0 0 16 16',
        style: merge(css.chevron, open ? css.chevronOpen : null), 'aria-hidden': 'true',
      }, createElement('path', {
        d: 'M4 6l4 4 4-4', fill: 'none', stroke: 'currentColor',
        strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round',
      }))
    }

    function DoubaoCard(props) {
      var snap = props.useDoubaoCard(function (s) { return s })
      var s = snap || { status: 'loading', writable: false }
      var t = (snap && snap.strings) || dict.en
      var cred = (snap && snap.credential) || { ref: DEFAULT_REF, configured: false, writable: true, known: false }
      var allowWrite = cred.writable

      var [open, setOpen] = useState(false)
      var [keyText, setKeyText] = useState('')
      var [busy, setBusy] = useState(false)
      var [notice, setNotice] = useState(null)

      var dirty = keyText !== ''

      // 保存成功且无草稿 → 自动收起（对齐官方：宿主确认写入后再收起）
      useEffect(function () {
        if (busy) return
        if (notice && notice.ok && !dirty) setOpen(false)
      }, [busy, notice, dirty])

      // 打开卡片时刷新一次凭据状态
      useEffect(function () {
        props.refreshCredential()
      }, [])

      function statusPill() {
        var text
        var extra
        if (!cred.known) { text = t.checking; extra = css.pillEmpty }
        else if (cred.configured) { text = t.configured; extra = css.pillOk }
        else if (!cred.writable) { text = t.envSource; extra = css.pillEmpty }
        else { text = t.unconfigured; extra = css.pillEmpty }
        return pill(extra, text)
      }

      function onSave() {
        if (keyText === '') { setNotice({ ok: false, text: t.dirtyEmpty }); return }
        setBusy(true)
        setNotice(null)
        props.saveKey(keyText).then(function (res) {
          setBusy(false)
          if (res && res.error) { setNotice({ ok: false, text: res.error || t.saveFailed }); return }
          setKeyText('')
          setNotice({ ok: true, text: t.saved })
        })
      }
      function onDiscard() { setKeyText(''); setNotice(null) }
      function onClear() {
        setBusy(true)
        setNotice(null)
        props.clearKey().then(function (res) {
          setBusy(false)
          if (res && res.error) { setNotice({ ok: false, text: res.error || t.saveFailed }); return }
          setNotice({ ok: true, text: t.cleared })
        })
      }

      var readOnlyLine = null
      if (cred.known && !cred.configured && !cred.writable) readOnlyLine = t.envSourceHint
      else if (!cred.known) readOnlyLine = t.checking

      return createElement('li', { style: merge(css.card, open ? css.cardOpen : null) },
        createElement('button', {
          type: 'button',
          style: css.header,
          'aria-expanded': String(open),
          'aria-label': (open ? t.collapseAria : t.expandAria) + ': ' + t.title,
          onClick: function () { setOpen(!open) },
        },
          createElement('span', { style: css.headText },
            createElement('span', { style: css.name }, t.title),
            createElement('span', { style: css.description }, t.description),
          ),
          dirty ? pill(null, t.unsaved) : statusPill(),
          Chevron(open),
        ),
        open ? createElement('div', { style: css.body },
          readOnlyLine ? createElement('p', { style: css.readOnly, role: 'status' }, readOnlyLine) : null,
          createElement('div', { style: css.field },
            createElement('div', { style: css.fieldHead },
              createElement('span', { style: css.label }, t.apiKeyLabel),
              cred.known && cred.configured ? createElement('span', { style: css.statePill }, t.configured) : null,
            ),
            createElement('input', {
              type: 'password',
              autoComplete: 'new-password',
              spellCheck: false,
              style: merge(css.input, (!allowWrite || busy) ? css.inputDisabled : null),
              placeholder: t.apiKeyPlaceholder,
              value: keyText,
              disabled: !allowWrite || busy,
              onChange: function (e) { setKeyText(e.target.value) },
            }),
            createElement('p', { style: css.hint }, t.apiKeyHint + (allowWrite ? '' : ' ' + t.envSourceHint)),
          ),
          createElement('div', { style: css.footer },
            createElement('div', { style: css.footerLeft },
              notice ? createElement('p', { style: notice.ok ? css.ok : css.failed, role: 'status' }, notice.text) : null,
              createElement('button', { type: 'button', style: css.link, disabled: !allowWrite || busy, onClick: onClear }, t.clearKey),
            ),
            createElement('button', {
              type: 'button',
              style: merge(css.btn, css.discard, (!dirty || busy) ? css.btnDisabled : null),
              disabled: !dirty || busy,
              onClick: onDiscard,
            }, t.discard),
            createElement('button', {
              type: 'button',
              style: merge(css.btn, css.save, (!dirty || busy) ? css.btnDisabled : null),
              disabled: !dirty || busy,
              onClick: onSave,
            }, busy ? t.saving : t.save),
          ),
        ) : null,
      )
    }

    /* ================= 宿主接线（i18n + settingsScope + 凭据） ================= */
    function apply(ctx) {
      var scope = ctx.settingsScope.bind({ namespace: NS })
      var locale = ctx.get('locale')
      var activeLocale = 'zh'
      if (locale && typeof locale.getSnapshot === 'function') {
        var ls = locale.getSnapshot()
        if (ls && ls.active) activeLocale = ls.active
      }

      // 注册自己的字典；DSH 切换语言后 active/revision 更新 → 卡片自动换文案
      if (locale && typeof locale.register === 'function') {
        ctx.effect(function () {
          return locale.register(LNS, dict)
        }, 'doubao-search: card dictionaries')
      }

      function strings() { return dict[activeLocale] || dict.en }

      var latest = {
        status: 'loading',
        writable: false,
        revision: undefined,
        activeLocale: activeLocale,
        strings: strings(),
        credential: { ref: DEFAULT_REF, configured: false, writable: true, known: false },
      }
      var listeners = []
      var scheduled = false

      function notify() {
        scheduled = false
        var list = listeners.slice()
        for (var i = 0; i < list.length; i++) { try { list[i]() } catch (err) { /* ignore */ } }
      }
      function update(next) {
        var changed = false
        var keys = ['status', 'writable', 'revision', 'activeLocale']
        for (var i = 0; i < keys.length; i++) {
          if (next[keys[i]] !== latest[keys[i]]) { changed = true; break }
        }
        if (!changed) {
          var c1 = next.credential, c2 = latest.credential
          changed = !c1 || !c2 || c1.ref !== c2.ref || c1.configured !== c2.configured || c1.writable !== c2.writable || c1.known !== c2.known
        }
        latest = next
        if (changed && !scheduled) { scheduled = true; queueMicrotask(notify) }
      }

      function refOf() {
        var s = scope.getSnapshot()
        var declared = s && s.value && s.value.apiKeyEnv
        return (typeof declared === 'string' && declared.length > 0) ? declared : DEFAULT_REF
      }

      function remoteCreds() { return ctx.remote ? ctx.remote.credentials : undefined }

      function refreshCredential() {
        var ref = refOf()
        var creds = remoteCreds()
        if (!creds || typeof creds.describe !== 'function') {
          update(Object.assign({}, latest, {
            credential: { ref: ref, configured: false, writable: true, known: true },
          }))
          return
        }
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

      // 设置域 / 语言变化都重新派生
      scope.subscribe(function () {
        var s = scope.getSnapshot()
        update(Object.assign({}, latest, {
          status: s ? s.status : 'unavailable',
          writable: !!(s && s.writable),
          revision: s ? s.revision : undefined,
        }))
        refreshCredential()
      })
      if (locale && typeof locale.subscribe === 'function') {
        locale.subscribe(function () {
          var snap = locale.getSnapshot()
          if (snap && snap.active) activeLocale = snap.active
          update(Object.assign({}, latest, { activeLocale: activeLocale, strings: strings() }))
        })
      }
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
          return Promise.resolve({ error: 'credential service unavailable' })
        }
        return creds.set(ref, key).then(function () { refreshCredential(); return {} })
          .catch(function (err) { return { error: String((err && err.message) || err) } })
      }
      function clearKey() {
        var ref = refOf()
        var creds = remoteCreds()
        if (!creds || typeof creds.unset !== 'function') {
          return Promise.resolve({ error: 'credential service unavailable' })
        }
        return creds.unset(ref).then(function () { refreshCredential(); return {} })
          .catch(function (err) { return { error: String((err && err.message) || err) } })
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
          locale: LNS,
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

    exports.inject = ['slots', 'settingsScope', 'locale', 'remote', 'remote.credentials']
    exports.apply = apply
    return module.exports
  },
})
