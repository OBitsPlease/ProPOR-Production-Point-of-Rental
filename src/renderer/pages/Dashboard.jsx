import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Layers, Package, Truck, ArrowRight, Plus, Calendar, Tag,
  Archive, FileText, BookOpen, RefreshCw, Pencil, ChevronRight
} from 'lucide-react'
import { applyHoverTips, getHoverTipsEnabled, setHoverTipsEnabled } from '../utils/hoverTips'

const STATUS_COLORS = {
  upcoming:    'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  confirmed:   'bg-green-500/20 text-green-300 border border-green-500/30',
  in_progress: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
  completed:   'bg-gray-500/20 text-gray-400 border border-gray-500/25',
  cancelled:   'bg-red-500/20 text-red-300 border border-red-500/30',
}
const STATUS_LABELS = { upcoming:'Upcoming', confirmed:'Confirmed', in_progress:'In Progress', completed:'Completed', cancelled:'Cancelled' }

function fmtDate(d) {
  if (!d) return null
  try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return d }
}

export default function Dashboard() {
  const [plans, setPlans]       = useState([])
  const [trucks, setTrucks]     = useState([])
  const [items, setItems]       = useState([])
  const [events, setEvents]     = useState([])
  const [depts, setDepts]       = useState([])
  const [repacks, setRepacks]   = useState([])
  const [hoverTips, setHoverTipsState] = useState(() => getHoverTipsEnabled())

  const toggleHoverTips = () => {
    const next = !hoverTips
    setHoverTipsState(next)
    setHoverTipsEnabled(next)
    applyHoverTips(next)
  }
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      if (!window.electronAPI) return
      const [p, t, i, e, d, r] = await Promise.all([
        window.electronAPI.getLoadPlans(),
        window.electronAPI.getTrucks(),
        window.electronAPI.getItems(),
        window.electronAPI.events?.getAll?.() ?? [],
        window.electronAPI.getDepartments?.() ?? [],
        window.electronAPI.repack?.list?.() ?? [],
      ])
      setPlans(p); setTrucks(t); setItems(i); setEvents(e); setDepts(d); setRepacks(r)
    }
    load()
  }, [])

  // Derived stats
  const today = new Date()
  const todayStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const totalItemUnits = items.reduce((s, i) => s + (i.quantity || 1), 0)
  const activeEvents = events.filter(e => e.status === 'upcoming' || e.status === 'confirmed' || e.status === 'in_progress')
  const now = new Date(); now.setHours(23,59,59,999)
  const upcomingEvents = events
    .filter(e => e.status !== 'completed' && e.status !== 'cancelled' &&
      (e.event_date || e.load_in ? new Date((e.event_date || e.load_in) + 'T12:00:00') >= today : true))
    .sort((a, b) => new Date(a.event_date || a.load_in || 0) - new Date(b.event_date || b.load_in || 0))
    .slice(0, 5)
  const recentPlans = [...plans].sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0)).slice(0, 5)

  return (
    <div className="p-6 overflow-y-auto h-full">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-0.5">{todayStr}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleHoverTips}
            className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${hoverTips ? 'border-brand-primary/40 text-brand-primary bg-brand-primary/10' : 'border-dark-500 text-gray-400 hover:text-gray-200'}`}
          >
            Hover Tips: {hoverTips ? 'On' : 'Off'}
          </button>
          <button onClick={() => navigate('/events')} className="btn-primary">
            <Plus size={14} /> New Event
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-6 gap-3 mb-6">
        {[
          { icon: Calendar, label: 'Events',      value: events.length,    sub: `${activeEvents.length} active`,         color: 'bg-blue-500/20',   path: '/events' },
          { icon: Layers,   label: 'Load Plans',  value: plans.length,     sub: 'truck loads',                           color: 'bg-purple-500/20', path: '/planner' },
          { icon: Truck,    label: 'Trucks',       value: trucks.length,    sub: 'profiles',                              color: 'bg-orange-500/20', path: '/trucks' },
          { icon: Package,  label: 'Items',        value: items.length,     sub: `${totalItemUnits} units`,               color: 'bg-green-500/20',  path: '/items' },
          { icon: Tag,      label: 'Departments',  value: depts.length,     sub: 'categories',                            color: 'bg-pink-500/20',   path: '/departments' },
          { icon: Archive,  label: 'RePacks',      value: repacks.length,   sub: 'saved packs',                           color: 'bg-amber-500/20',  path: '/repacks' },
        ].map(({ icon: Icon, label, value, sub, color, path }) => (
          <div key={label} onClick={() => navigate(path)} className="card cursor-pointer hover:border-brand-primary/40 transition-all hover:scale-[1.02] p-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color} mb-3`}>
              <Icon size={18} className="text-white" />
            </div>
            <div className="text-2xl font-bold text-white leading-none mb-1">{value}</div>
            <div className="text-sm font-medium text-white">{label}</div>
            <div className="text-xs text-gray-500 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-[1fr_300px] gap-6">

        {/* Left column */}
        <div className="space-y-6 min-w-0">

          {/* Upcoming Events */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Calendar size={16} className="text-blue-400" /> Upcoming Events
              </h2>
              <button onClick={() => navigate('/events')} className="text-xs text-brand-primary hover:underline">View all</button>
            </div>
            {upcomingEvents.length === 0 ? (
              <div className="card py-8 text-center text-gray-500">
                <Calendar size={28} className="mx-auto mb-2 opacity-25" />
                <p className="text-sm">No upcoming events.</p>
                <button onClick={() => navigate('/events')} className="btn-secondary mt-3 mx-auto text-xs"><Plus size={12} /> New Event</button>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map(ev => (
                  <div key={ev.id} onClick={() => navigate(`/events/${ev.id}`)}
                    className="card cursor-pointer hover:border-brand-primary/40 transition-all flex items-center gap-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white text-sm truncate">{ev.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[ev.status] || STATUS_COLORS.upcoming}`}>
                          {STATUS_LABELS[ev.status] || ev.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-3 flex-wrap">
                        {ev.event_date && <span>{fmtDate(ev.event_date)}</span>}
                        {ev.venue_name && <span className="flex items-center gap-1"><span className="opacity-50">📍</span>{ev.venue_name}{ev.venue_city ? `, ${ev.venue_city}` : ''}</span>}
                        {ev.crew?.length > 0 && <span>👤 {ev.crew.length}</span>}
                        {ev.gear?.length > 0 && <span>📦 {ev.gear.reduce((s,g)=>s+(g.quantity||1),0)} units</span>}
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-gray-600 shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div>
            <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
              ⚡ Quick Actions
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'New Event',     sub: 'Plan a show or gig',          icon: Calendar, color: 'bg-blue-600/20 border-blue-600/25 hover:border-blue-500/50',    path: '/events'     },
                { label: 'New Load Plan', sub: 'Pack a truck',                 icon: Layers,   color: 'bg-purple-600/20 border-purple-600/25 hover:border-purple-500/50', path: '/planner'    },
                { label: 'Add Item',      sub: 'To inventory',                 icon: Package,  color: 'bg-green-600/20 border-green-600/25 hover:border-green-500/50',   path: '/items'      },
                { label: 'Add Truck',     sub: 'New profile',                  icon: Truck,    color: 'bg-orange-600/20 border-orange-600/25 hover:border-orange-500/50', path: '/trucks'     },
                { label: 'Departments',   sub: 'Manage categories',            icon: Tag,      color: 'bg-pink-600/20 border-pink-600/25 hover:border-pink-500/50',      path: '/departments'},
                { label: 'Reports',       sub: 'Export pack sheets',           icon: FileText, color: 'bg-red-700/20 border-red-700/25 hover:border-red-600/50',          path: '/reports'    },
              ].map(({ label, sub, icon: Icon, color, path }) => (
                <button key={label} onClick={() => navigate(path)}
                  className={`card text-left p-4 transition-all hover:scale-[1.02] border ${color}`}>
                  <Icon size={20} className="mb-2 text-white/70" />
                  <div className="font-medium text-white text-sm">{label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Recommended Workflow */}
          <div>
            <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
              <ArrowRight size={16} className="text-brand-primary" /> Recommended Workflow
            </h2>
            <div className="card divide-y divide-dark-600 p-0 overflow-hidden">
              {[
                { n:1, label:'Create or Open Event',      desc:'Set dates, venue, crew, and event gear needs first.',                                               cta:'Go to Events',    path:'/events'   },
                { n:2, label:'Prepare Inventory & Cases', desc:'Add/edit items, build case contents, and verify dimensions/weights.',                               cta:'Go to Items',     path:'/items'    },
                { n:3, label:'Build the Load Plan',       desc:'Pack your selected truck profile and adjust until utilization looks right.',                        cta:'Open Planner',    path:'/planner'  },
                { n:4, label:'Finalize & Export',         desc:'Generate reports or PDFs for warehouse, truck pack, and show-day docs.',                            cta:'Open Reports',    path:'/reports'  },
              ].map(({ n, label, desc, cta, path }) => (
                <div key={n} className="flex items-center gap-4 px-5 py-4 hover:bg-dark-700/30 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-brand-primary/20 border border-brand-primary/30 flex items-center justify-center text-brand-primary text-xs font-bold shrink-0">{n}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white text-sm">{label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
                  </div>
                  <button onClick={() => navigate(path)} className="text-xs text-brand-primary hover:underline shrink-0 font-medium">{cta}</button>
                </div>
              ))}
            </div>
          </div>

          {/* End-Of-Load Reset */}
          <div>
            <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
              <RefreshCw size={15} className="text-amber-400" /> End-Of-Load Reset & Corrections
            </h2>
            <div className="card divide-y divide-dark-600 p-0 overflow-hidden">
              {[
                { n:1, label:'Empty cases for the next load',       desc:'In Items Library, use the Empty button in case view to return all contents to loose inventory.',      cta:'Open Cases',       path:'/items'      },
                { n:2, label:'Make item and case corrections',      desc:'Edit dimensions, weight, stacking, notes, and quantities from Items and Case edit screens.',          cta:'Edit Items/Cases', path:'/items'      },
                { n:3, label:'Use Bulk Edit for repeated fixes',    desc:'Apply one correction to every item or case with the same name for fast cleanup.',                     cta:'Open Bulk Edit',   path:'/bulk-edit'  },
              ].map(({ n, label, desc, cta, path }) => (
                <div key={n} className="flex items-center gap-4 px-5 py-4 hover:bg-dark-700/30 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xs font-bold shrink-0">{n}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white text-sm">{label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
                  </div>
                  <button onClick={() => navigate(path)} className="text-xs text-amber-400 hover:underline shrink-0 font-medium">{cta}</button>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right column */}
        <div className="space-y-6">

          {/* Recent Plans */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Layers size={15} className="text-purple-400" /> Recent Plans
              </h2>
              <button onClick={() => navigate('/planner')} className="text-xs text-brand-primary hover:underline">View all</button>
            </div>
            {recentPlans.length === 0 ? (
              <div className="card py-8 text-center text-gray-500">
                <Layers size={28} className="mx-auto mb-2 opacity-25" />
                <p className="text-sm">No load plans yet.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {recentPlans.map(p => (
                  <div key={p.id} onClick={() => navigate(`/planner/${p.id}`)}
                    className="card cursor-pointer hover:border-brand-primary/40 py-2.5 px-4 flex items-center gap-2 transition-all">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{p.name}</div>
                      <div className="text-xs text-gray-500">{p.truck_name || 'No truck'}{p.utilization ? ` · ${p.utilization}%` : ''}</div>
                    </div>
                    <ChevronRight size={12} className="text-gray-600 shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Items by Group */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <BookOpen size={15} className="text-green-400" /> Items by Group
              </h2>
              <button onClick={() => navigate('/departments')} className="text-xs text-brand-primary hover:underline">Manage</button>
            </div>
            {depts.length === 0 ? (
              <div className="card py-6 text-center text-gray-500 text-sm">No departments yet.</div>
            ) : (
              <div className="space-y-1.5">
                {depts.slice(0, 8).map(d => {
                  const count = items.filter(i => i.department_id === d.id || i.department_name === d.name).length
                  return (
                    <div key={d.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-dark-800 border border-dark-600">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color || '#6b7280' }} />
                      <span className="text-sm text-white flex-1 truncate">{d.name}</span>
                      <span className="text-xs text-gray-500">{count}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
