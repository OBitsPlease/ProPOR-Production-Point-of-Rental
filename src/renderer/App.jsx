import { Routes, Route, Navigate } from 'react-router-dom'
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
import { useEffect, useState } from 'react'
import { applyHoverTips, getHoverTipsEnabled } from './utils/hoverTips'

export default function App() {
  const [inventoryNotification, setInventoryNotification] = useState(null)

  useEffect(() => {
    if (!window.electronAPI) return
    window.electronAPI.onInventoryImported((data) => {
      setInventoryNotification({ type: 'success', message: `Inventory imported: ${data.filePath}`, data })
      setTimeout(() => setInventoryNotification(null), 5000)
    })
    window.electronAPI.onInventoryError((err) => {
      setInventoryNotification({ type: 'error', message: `Import error: ${err}` })
      setTimeout(() => setInventoryNotification(null), 5000)
    })
    return () => window.electronAPI.removeInventoryListeners()
  }, [])

  // Hover tips: apply on mount and re-apply whenever DOM changes
  useEffect(() => {
    const enabled = getHoverTipsEnabled()
    applyHoverTips(enabled)
    const observer = new MutationObserver(() => applyHoverTips(getHoverTipsEnabled()))
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-dark-900">
      <Sidebar />
      <main className="flex-1 overflow-hidden flex flex-col">
        {inventoryNotification && (
          <div className={`mx-4 mt-3 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2 ${
            inventoryNotification.type === 'success'
              ? 'bg-green-900/40 text-green-300 border border-green-700/40'
              : 'bg-red-900/40 text-red-300 border border-red-700/40'
          }`}>
            {inventoryNotification.type === 'success' ? '✓' : '✗'} {inventoryNotification.message}
          </div>
        )}
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
  )
}
