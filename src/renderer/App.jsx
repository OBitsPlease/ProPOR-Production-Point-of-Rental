import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Events from './pages/Events'
import EventDetail from './pages/EventDetail'
import History from './pages/History'
import AddressBook from './pages/AddressBook'
import BulkEdit from './pages/BulkEdit'
import TruckProfiles from './pages/TruckProfiles'
import Items from './pages/Items'
import LoadPlanner from './pages/LoadPlanner'
import RePacks from './pages/RePacks'
import Reports from './pages/Reports'
import Departments from './pages/Departments'
import SettingsPage from './pages/Settings'
import Repairs from './pages/Repairs'
import CrewView from './pages/CrewView'
import { useEffect, useState } from 'react'
import { applyHoverTips, getHoverTipsEnabled } from './utils/hoverTips'
import { X } from 'lucide-react'

const SHORTCUTS = [
  { section: 'Navigation' },
  { key: '⌘\\', desc: 'Toggle sidebar pin' },
  { key: '?', desc: 'Show this shortcuts panel' },
  { section: 'Forms & Modals' },
  { key: 'Enter', desc: 'Save / submit open form' },
  { key: 'Esc', desc: 'Cancel / close modal' },
  { section: 'Load Planner' },
  { key: 'Ctrl+Z', desc: 'Undo last drag' },
  { key: 'Space', desc: 'Toggle snap (in edit mode)' },
  { section: 'Settings Toggles' },
  { key: 'Space / Enter', desc: 'Toggle focused setting' },
]

function ShortcutsModal({ onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' || e.key === '?') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-dark-800 border border-dark-600 rounded-xl shadow-2xl w-80 max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-600">
          <h2 className="text-sm font-semibold text-white">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 transition-colors"><X size={14} /></button>
        </div>
        <div className="px-5 py-4 space-y-1">
          {SHORTCUTS.map((s, i) =>
            s.section ? (
              <div key={i} className={`text-xs font-semibold text-brand-primary uppercase tracking-wider ${i > 0 ? 'mt-4' : ''} mb-2`}>{s.section}</div>
            ) : (
              <div key={i} className="flex items-center justify-between py-1">
                <span className="text-xs text-gray-400">{s.desc}</span>
                <kbd className="ml-4 shrink-0 px-2 py-0.5 rounded bg-dark-700 border border-dark-500 text-xs text-gray-300 font-mono">{s.key}</kbd>
              </div>
            )
          )}
        </div>
        <div className="px-5 py-3 border-t border-dark-600 text-xs text-gray-600 text-center">Press <kbd className="px-1 py-0.5 rounded bg-dark-700 border border-dark-500 font-mono">?</kbd> or <kbd className="px-1 py-0.5 rounded bg-dark-700 border border-dark-500 font-mono">Esc</kbd> to dismiss</div>
      </div>
    </div>
  )
}

export default function App() {
  const location = useLocation()
  const [tunnelChangedUrl, setTunnelChangedUrl] = useState(null)
  const [copyLabel, setCopyLabel] = useState('Copy New Link')
  const [showShortcuts, setShowShortcuts] = useState(false)

  // Crew view renders with no chrome — just the page itself
  if (location.pathname.startsWith('/crew/')) {
    return (
      <Routes>
        <Route path="/crew/:token" element={<CrewView />} />
      </Routes>
    )
  }

  // Hover tips: apply on mount and re-apply whenever DOM changes
  useEffect(() => {
    const enabled = getHoverTipsEnabled()
    applyHoverTips(enabled)
    const observer = new MutationObserver(() => applyHoverTips(getHoverTipsEnabled()))
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  // ? key opens shortcuts modal (unless typing in an input/textarea)
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === '?') { e.preventDefault(); setShowShortcuts(s => !s) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Tunnel URL change detection — show banner so user can reshare with crew
  useEffect(() => {
    if (!window.electronAPI?.tunnel?.onUrlChanged) return
    window.electronAPI.tunnel.onUrlChanged(({ url }) => {
      setTunnelChangedUrl(url)
      setCopyLabel('Copy New Link')
    })
    return () => window.electronAPI.tunnel.removeListeners?.()
  }, [])

  function handleCopyLink() {
    if (!tunnelChangedUrl) return
    navigator.clipboard.writeText(tunnelChangedUrl).catch(() => {})
    setCopyLabel('Copied!')
    setTimeout(() => setCopyLabel('Copy New Link'), 2500)
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-dark-900 flex-col">
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      {tunnelChangedUrl && (
        <div className="flex items-center justify-center gap-3 bg-amber-500/10 border-b border-amber-500/30 pl-20 pr-4 py-2 text-sm text-amber-300 flex-shrink-0">
          <span className="font-medium">⚠ Your crew view link changed this session.</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="bg-amber-500 hover:bg-amber-400 text-black font-semibold px-3 py-1 rounded text-xs transition-colors"
            >
              {copyLabel}
            </button>
            <button
              onClick={() => setTunnelChangedUrl(null)}
              className="text-amber-400 hover:text-amber-200 px-2 py-1 rounded text-xs transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden flex flex-col">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/:eventId" element={<EventDetail />} />
            <Route path="/history" element={<History />} />
            <Route path="/address-book" element={<AddressBook />} />
            <Route path="/trucks" element={<TruckProfiles />} />
            <Route path="/departments" element={<Departments />} />
            <Route path="/items" element={<Items />} />
            <Route path="/planner" element={<LoadPlanner />} />
            <Route path="/planner/:planId" element={<LoadPlanner />} />
            <Route path="/planner/event/:eventId" element={<LoadPlanner />} />
            <Route path="/bulk-edit" element={<BulkEdit />} />
            <Route path="/repacks" element={<RePacks />} />
            <Route path="/repairs" element={<Repairs />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
