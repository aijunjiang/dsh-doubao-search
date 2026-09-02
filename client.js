/* dsh-plugin-doubao-search — browser half.
 * 手工按 DSH 客户端模块系统的闭包工厂契约产出的产物：
 *   经典脚本加载后调用 window.__ModuleLoader__.load({ id, factory })；
 *   仅在 factory 内部通过注入的 require 取平台种子（react），
 *   其余一律内联，不依赖任何第三方客户端包，规避客户端 bundle 纯度门槛。
 * 运行期只依赖两个客户端服务：slots（注册卡片）、settingsScope（读写配置）。
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

    /** 设置命名空间（必须与宿主半 DOUBAO_NS 一致）。 */
    var NS = 'doubao-search'

    /* ---- 简单的内联样式（跟随 DSH 主题 token，缺省有回退色） ---- */
    var style = {
      card: { border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.3))', borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--dsw-alias-bg-layer-2, transparent)' },
      row: { display: 'flex', flexDirection: 'column', gap: '6px' },
      title: { margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--dsw-alias-label-primary, inherit)' },
      desc: { margin: 0, fontSize: '12px', lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary, #888)' },
      label: { fontSize: '13px', color: 'var(--dsw-alias-label-primary, inherit)' },
      hint: { margin: 0, fontSize: '12px', lineHeight: 1.6, color: 'var(--dsw-alias-label-tertiary, #999)' },
      input: { border: '1px solid var(--dsw-alias-border-l2, #555)', background: 'var(--dsw-alias-bg-layer-3, #222)', color: 'var(--dsw-alias-label-primary, inherit)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', width: '100%', boxSizing: 'border-box' },
      buttons: { display: 'flex', gap: '8px', alignItems: 'center' },
      btn: { borderRadius: '8px', padding: '6px 14px', fontSize: '13px', cursor: 'pointer', border: '1px solid var(--dsw-alias-border-l2, #555)', background: 'var(--dsw-alias-bg-module-platform, #333)', color: 'var(--dsw-alias-label-primary, inherit)' },
      primary: { background: 'var(--dsw-alias-brand-primary, #3b82f6)', borderColor: 'transparent', color: '#fff' },
      status: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary, #999)' },
      error: { fontSize: '12px', color: 'var(--dsw-alias-label-error, #ef4444)' },
    }

    function DoubaoCard(props) {
      var snapshot = props.useDoubaoCard(function (s) { return s })
      var ready = snapshot && snapshot.status === 'ready'
      var writable = !!(snapshot && snapshot.writable && ready)
      var [keyText, setKeyText] = React.useState('')
      var [busy, setBusy] = React.useState(false)
      var [notice, setNotice] = React.useState(null)

      function onSave() {
        var key = keyText.replace(/^\s+|\s+$/g, '')
        if (key === '') {
          setNotice({ ok: true, text: '未填写内容，未做任何修改。' })
          return
        }
        setBusy(true)
        setNotice(null)
        props.saveKey(key).then(function (err) {
          setBusy(false)
          if (err) setNotice({ ok: false, text: err })
          else {
            setKeyText('')
            setNotice({ ok: true, text: '已保存。留空输入框再次点击保存即可保留旧 Key；直接用于模型工具前请刷新页面。' })
          }
        })
      }

      function onClear() {
        setBusy(true)
        setNotice(null)
        props.clearKey().then(function (err) {
          setBusy(false)
          if (err) setNotice({ ok: false, text: err })
          else setNotice({ ok: true, text: '已清除配置中的 Key（若行级/环境变量仍提供 Key 则继续生效）。' })
        })
      }

      var disabled = !writable || busy
      var statusLine
      if (!snapshot || snapshot.status === 'loading') statusLine = '正在读取配置…'
      else if (snapshot.status === 'unavailable') statusLine = '该命名空间当前未在宿主端提供，卡片暂不可用。'
      else if (!ready) statusLine = '配置读取异常。'
      else if (!writable) statusLine = '当前设置文档只读，无法保存。'
      else statusLine = 'Key 仅保存在本机 DSH 设置中，不会显示回显。'

      return createElement('div', { style: style.card },
        createElement('p', { style: style.title }, '豆包搜索 doubao_search'),
        createElement('p', { style: style.desc }, '调用火山引擎豆包搜索（联网搜索 Custom 版）实时获取网页/图片结果。填写 Agent Plan / 豆包搜索 API Key 即可启用。'),
        createElement('div', { style: style.row },
          createElement('label', { style: style.label, htmlFor: 'doubao-search-api-key' }, 'API Key'),
          createElement('input', {
            id: 'doubao-search-api-key',
            style: style.input,
            type: 'password',
            autoComplete: 'off',
            spellCheck: false,
            placeholder: '粘贴 API Key（留空则不改动已存 Key）',
            value: keyText,
            disabled: disabled,
            onChange: function (e) { setKeyText(e.target.value) },
          }),
          createElement('p', { style: style.hint }, '解析顺序：此处 Key → 环境变量 DOUBAO_API_KEY。' + (snapshot && snapshot.mode === 'memory' ? '（当前进程为临时模式）' : '')),
        ),
        createElement('div', { style: style.buttons },
          createElement('button', { style: Object.assign({}, style.btn, style.primary), disabled: disabled, onClick: onSave }, busy ? '保存中…' : '保存'),
          createElement('button', { style: style.btn, disabled: disabled, onClick: onClear }, '清除已存 Key'),
          notice
            ? createElement('span', { style: notice.ok ? style.status : style.error }, notice.text)
            : createElement('span', { style: style.status }, statusLine),
        ),
      )
    }

    function apply(ctx) {
      var scope = ctx.settingsScope.bind({ namespace: NS })

      function saveKey(key) {
        return scope.set('apiKey', key).then(
          function () { return null },
          function (err) { return String((err && err.message) || err) },
        )
      }
      function clearKey() {
        return scope.unset('apiKey').then(
          function () { return null },
          function (err) { return String((err && err.message) || err) },
        )
      }

      ctx.slots.inject('settings.plugin.item', function* registerCard() {
        yield ctx.slots.register({
          name: 'settings.plugin.item',
          key: NS,
          inject: function () {
            return {
              hooks: { doubaoCard: scope },
              saveKey: saveKey,
              clearKey: clearKey,
            }
          },
        }, DoubaoCard)
      })
    }

    exports.inject = ['slots', 'settingsScope']
    exports.apply = apply
    return module.exports
  },
})
