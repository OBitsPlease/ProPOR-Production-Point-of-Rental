// Hover Tips — auto-generates browser-native title tooltips on buttons/links
// based on their text content. Persisted in localStorage.

const STORAGE_KEY = 'tp_hover_tips_enabled'
const TITLE_GUARD_KEY = 'data-title-guard'
const TITLE_TEXT_KEY = 'data-title-text'

function attachTitleGuard(el) {
  if (el.getAttribute(TITLE_GUARD_KEY) === '1') return

  const initialTitle = normalize(el.getAttribute('title'))
  if (initialTitle) el.setAttribute(TITLE_TEXT_KEY, initialTitle)

  const showTitle = () => {
    const text = normalize(el.getAttribute(TITLE_TEXT_KEY))
    if (text) el.setAttribute('title', text)
  }

  const hideTitle = () => {
    const current = normalize(el.getAttribute('title'))
    if (current) el.setAttribute(TITLE_TEXT_KEY, current)
    el.removeAttribute('title')
  }

  el.addEventListener('mouseenter', showTitle)
  el.addEventListener('mouseleave', hideTitle)
  el.addEventListener('mousedown', hideTitle)
  el.addEventListener('blur', hideTitle)
  el.__tpTitleGuardHandlers = { showTitle, hideTitle }
  el.setAttribute(TITLE_GUARD_KEY, '1')
}

function detachTitleGuard(el) {
  const handlers = el.__tpTitleGuardHandlers
  if (!handlers) return
  el.removeEventListener('mouseenter', handlers.showTitle)
  el.removeEventListener('mouseleave', handlers.hideTitle)
  el.removeEventListener('mousedown', handlers.hideTitle)
  el.removeEventListener('blur', handlers.hideTitle)
  delete el.__tpTitleGuardHandlers
  el.removeAttribute(TITLE_GUARD_KEY)
}

function attachAutoTipHandlers(el) {
  if (el.__tpHoverTipHandlers) return

  const showTip = () => {
    if (!getHoverTipsEnabled()) return
    const tip = normalize(el.getAttribute('data-auto-tip-text'))
    if (tip) el.setAttribute('title', tip)
  }

  const hideTip = () => {
    if (el.getAttribute('data-auto-tip') === '1') {
      el.removeAttribute('title')
    }
  }

  el.addEventListener('mouseenter', showTip)
  el.addEventListener('mouseleave', hideTip)
  el.addEventListener('blur', hideTip)
  el.__tpHoverTipHandlers = { showTip, hideTip }
}

function detachAutoTipHandlers(el) {
  const handlers = el.__tpHoverTipHandlers
  if (!handlers) return
  el.removeEventListener('mouseenter', handlers.showTip)
  el.removeEventListener('mouseleave', handlers.hideTip)
  el.removeEventListener('blur', handlers.hideTip)
  delete el.__tpHoverTipHandlers
}

function normalize(s) {
  return (s || '').replace(/\s+/g, ' ').trim()
}

function buildTip(el) {
  const text = normalize(
    el.getAttribute('data-tip') ||
    el.getAttribute('aria-label') ||
    el.innerText ||
    el.textContent ||
    el.value
  )
  if (!text) return null
  const t = text.toLowerCase()

  if (t.includes('hover tips: on') || t.includes('hover tips: off'))
    return 'Turn step-by-step hover guidance on or off.'
  if (t.includes('new event'))
    return 'Step 1: Create an event and fill dates, venue, crew, and gear.'
  if (t.includes('add item'))
    return 'Step 2: Add loose inventory items before planning.'
  if (t.includes('create case') || t.includes('add case'))
    return 'Step 2: Create a road case and assign contents.'
  if (t.includes('empty case'))
    return 'End-of-load reset: Empty this case to move its contents back to loose inventory.'
  if (t.includes('bulk edit'))
    return 'Maintenance step: Use Bulk Edit to correct repeated names and dimensions in one pass.'
  if (t.includes('load planner') || t.includes('open planner'))
    return 'Step 3: Build or adjust the truck load plan.'
  if (t.includes('open reports') || t.includes('open report') || (t.includes('report') && !t.includes('export')))
    return 'Step 4: Export reports after finalizing the load.'
  if (t.includes('save'))
    return 'Save your changes.'
  if (t.includes('cancel'))
    return 'Cancel and close without applying new changes.'
  if (t.includes('delete') || t.includes('clear'))
    return 'Remove this data. You may be asked to confirm.'
  if (t.includes('import'))
    return 'Import data from an external file into this page.'
  if (t.includes('export'))
    return 'Export current data to a file.'
  if (t.includes('dashboard'))
    return 'Go to Dashboard for the recommended step-by-step workflow.'
  if (t.includes('settings'))
    return 'Open app settings and defaults.'
  if (t.includes('events'))
    return 'Step 1: Build the event and schedule details first.'
  if (t.includes('items'))
    return 'Step 2: Build inventory, cases, and corrections before planning.'
  if (t.includes('trucks') || t.includes('truck profiles'))
    return 'Set truck profiles and dimensions used during planning.'
  if (t.includes('departments'))
    return 'Manage departments and color tags.'
  if (t.includes('address book') || t.includes('address'))
    return 'Open the address book for customers, venues, and hotels.'
  if (t.includes('history'))
    return 'Open event history and quick template copy actions.'
  if (t.includes('repacks'))
    return 'Save and reuse common load configurations.'
  if (t.includes('repairs'))
    return 'Track items that need repair or are out of service.'
  if (t.includes('next') || t.includes('continue'))
    return 'Go to the next step.'
  if (t.includes('back'))
    return 'Go back to the previous screen.'
  if (el.tagName.toLowerCase() === 'a')
    return `Open ${text}.`
  return `Use ${text}.`
}

export function applyHoverTips(enabled, container = document) {
  if (!container) return

  container.querySelectorAll('[title], [data-title-text]').forEach(el => {
    attachTitleGuard(el)
    if (!enabled) {
      if (el.getAttribute('data-auto-tip') === '1') {
        detachTitleGuard(el)
      } else {
        const text = normalize(el.getAttribute(TITLE_TEXT_KEY))
        if (text) el.setAttribute('title', text)
      }
    }
  })

  container.querySelectorAll('button, a, [role="button"]').forEach(el => {
    const existingTitle = normalize(el.getAttribute('title'))
    const wasAutoSet = el.getAttribute('data-auto-tip') === '1'

    if (!enabled) {
      if (wasAutoSet) {
        detachAutoTipHandlers(el)
        detachTitleGuard(el)
        el.removeAttribute('title')
        el.removeAttribute(TITLE_TEXT_KEY)
        el.removeAttribute(TITLE_GUARD_KEY)
        el.removeAttribute('data-auto-tip-text')
        el.removeAttribute('data-auto-tip')
      }
      return
    }

    // Don't overwrite manually set titles
    if (existingTitle && !wasAutoSet) return

    const tip = buildTip(el)
    if (tip) {
      attachTitleGuard(el)
      attachAutoTipHandlers(el)
      el.setAttribute('data-auto-tip-text', tip)
      el.setAttribute('data-auto-tip', '1')
      if (el.matches(':hover')) el.setAttribute('title', tip)
    }
  })
}

export function getHoverTipsEnabled() {
  const val = localStorage.getItem(STORAGE_KEY)
  return val === null ? true : val === 'true'
}

export function setHoverTipsEnabled(val) {
  localStorage.setItem(STORAGE_KEY, String(val))
}
