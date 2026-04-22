import { NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import {
  LayoutDashboard, Truck, Package, Layers, FileText,
  Tag, ChevronRight, Settings, Archive, Wrench,
  Calendar, History, BookUser, Pencil, PanelLeftClose, PanelLeft
} from 'lucide-react'

const navItems = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/events',      icon: Calendar,        label: 'Events' },
  { to: '/history',     icon: History,         label: 'History' },
  { to: '/address-book',icon: BookUser,        label: 'Address Book' },
  { to: '/trucks',      icon: Truck,           label: 'Truck Profiles' },
  { to: '/departments', icon: Tag,             label: 'Departments' },
  { to: '/items',       icon: Package,         label: 'Items' },
  { to: '/bulk-edit',   icon: Pencil,          label: 'Bulk Edit' },
  { to: '/planner',     icon: Layers,          label: 'Load Planner' },
  { to: '/repacks',     icon: Archive,         label: 'RePacks' },
  { to: '/repairs',     icon: Wrench,          label: 'Repairs' },
  { to: '/reports',     icon: FileText,        label: 'Reports' },
]

const LS_KEY = 'sidebar_pinned'

export default function Sidebar() {
  const location = useLocation()
  const [pinned, setPinned] = useState(() => {
    try { return localStorage.getItem(LS_KEY) === 'true' } catch { return false }
  })
  const [hovered, setHovered] = useState(false)
  const hoverTimer = useRef(null)

  const isExpanded = pinned || hovered

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, String(pinned)) } catch {}
  }, [pinned])

  const handleMouseEnter = () => {
    clearTimeout(hoverTimer.current)
    if (!pinned) {
      hoverTimer.current = setTimeout(() => setHovered(true), 350)
    }
  }
  const handleMouseLeave = () => {
    if (!pinned) {
      clearTimeout(hoverTimer.current)
      hoverTimer.current = setTimeout(() => setHovered(false), 120)
    }
  }

  const NavItem = ({ to, icon: Icon, label }) => (
    <NavLink
      to={to}
      title={!isExpanded ? label : undefined}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group ${
          isActive
            ? 'bg-brand-primary/15 text-brand-primary border border-brand-primary/25'
            : 'text-gray-400 hover:text-gray-100 hover:bg-dark-600'
        }`
      }
    >
      <Icon size={16} className="shrink-0" />
      {isExpanded && (
        <>
          <span className="flex-1 whitespace-nowrap overflow-hidden">{label}</span>
          {location.pathname.startsWith(to) && to !== '/dashboard' && (
            <ChevronRight size={12} className="text-brand-primary/60 shrink-0" />
          )}
        </>
      )}
    </NavLink>
  )

  return (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ width: isExpanded ? '224px' : '56px' }}
      className="bg-dark-800 border-r border-dark-600 flex flex-col select-none shrink-0 transition-[width] duration-200 overflow-hidden"
    >
      {/* Logo / App Name */}
      <div className="px-3 py-4 border-b border-dark-600 titlebar-drag flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center shrink-0">
          <Truck size={16} className="text-white" />
        </div>
        {isExpanded && (
          <div className="min-w-0 flex-1">
            <div className="text-white font-semibold text-sm leading-tight whitespace-nowrap">ProPOR</div>
            <div className="text-gray-500 text-xs whitespace-nowrap">Production Point of Rental</div>
          </div>
        )}
      </div>

      {/* Pin button row */}
      <div className={`px-2 py-1.5 border-b border-dark-600 titlebar-no-drag flex ${isExpanded ? 'justify-end' : 'justify-center'}`}>
        <button
          onClick={() => setPinned(p => !p)}
          title={pinned ? 'Auto-hide sidebar' : 'Pin sidebar open'}
          className="p-1.5 rounded text-gray-600 hover:text-gray-200 hover:bg-dark-600 transition-colors"
        >
          {pinned ? <PanelLeftClose size={14} /> : <PanelLeft size={14} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto overflow-x-hidden titlebar-no-drag">
        {navItems.map(item => <NavItem key={item.to} {...item} />)}
      </nav>

      {/* Settings link */}
      <div className="px-2 pb-2 titlebar-no-drag">
        <NavLink
          to="/settings"
          title={!isExpanded ? 'Settings' : undefined}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group ${
              isActive
                ? 'bg-brand-primary/15 text-brand-primary border border-brand-primary/25'
                : 'text-gray-400 hover:text-gray-100 hover:bg-dark-600'
            }`
          }
        >
          <Settings size={16} className="shrink-0" />
          {isExpanded && <span className="flex-1 whitespace-nowrap">Settings</span>}
        </NavLink>
      </div>

      {/* Footer */}
      {isExpanded && (
        <div className="px-5 py-3 border-t border-dark-600 text-xs text-gray-600 whitespace-nowrap">
          v2.0.8
        </div>
      )}
    </aside>
  )
}
