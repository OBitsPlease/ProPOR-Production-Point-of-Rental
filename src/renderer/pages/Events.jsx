import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar, Plus, Trash2, ChevronRight, List,
  ChevronLeft, Search, X, Package, Users, MapPin
} from 'lucide-react'

const STATUS_CONFIG = {
  upcoming:    { label: 'Upcoming',    bg: 'bg-blue-500/15',   text: 'text-blue-300',   border: 'border-blue-500/30',   dot: 'bg-blue-500' },
  confirmed:   { label: 'Confirmed',   bg: 'bg-green-500/15',  text: 'text-green-300',  border: 'border-green-500/30',  dot: 'bg-green-500' },
  in_progress: { label: 'In Progress', bg: 'bg-yellow-500/15', text: 'text-yellow-300', border: 'border-yellow-500/30', dot: 'bg-yellow-500' },
  completed:   { label: 'Completed',   bg: 'bg-gray-500/15',   text: 'text-gray-300',   border: 'border-gray-500/30',   dot: 'bg-gray-500' },
  cancelled:   { label: 'Cancelled',   bg: 'bg-red-500/15',    text: 'text-red-300',    border: 'border-red-500/30',    dot: 'bg-red-500' },
}

const DOT_COLOR = {
  upcoming: 'bg-blue-500', confirmed: 'bg-green-500', in_progress: 'bg-yellow-500',
  completed: 'bg-gray-500', cancelled: 'bg-red-500',
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.upcoming
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.label}
    </span>
  )
}

function formatDate(d) {
  if (!d) return null
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return d }
}

export default function Events() {
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState('list') // 'list' | 'calendar'
  const [calendar, setCalendar] = useState(() => {
    const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [showNew, setShowNew] = useState(null) // null | { prefillDate }
  const [newName, setNewName] = useState('')
  const [repacks, setRepacks] = useState([])
  const [selectedRepack, setSelectedRepack] = useState('')

  const load = async () => {
    if (!window.electronAPI?.events) return
    const [evts, rpks] = await Promise.all([
      window.electronAPI.events.getAll(),
      window.electronAPI.repack?.list?.() ?? [],
    ])
    setEvents(evts)
    setRepacks(rpks || [])
  }

  useEffect(() => { load() }, [])

  const openNew = (prefillDate = null) => {
    setNewName('')
    setSelectedRepack('')
    setShowNew({ prefillDate })
  }

  const createEvent = async () => {
    const name = newName.trim() || 'New Event'
    let gear = []
    if (selectedRepack) {
      const rp = await window.electronAPI.repack.load(selectedRepack)
      gear = (rp?.items || []).map(item =>
        item?._type === 'case' || item?._isCase || Array.isArray(item?.items)
          ? { ...item, _type: 'case', quantity: item.quantity || 1, items: item.items || [] }
          : { ...item }
      )
    }
    const id = await window.electronAPI.events.save({
      name,
      gear,
      ...(showNew?.prefillDate ? { event_date: showNew.prefillDate, load_in: showNew.prefillDate } : {}),
    })
    setShowNew(null)
    navigate(`/events/${id}`)
  }

  const deleteEvent = async (e, id) => {
    e.stopPropagation()
    if (!confirm('Delete this event and all its files?')) return
    await window.electronAPI.events.delete(id)
    load()
  }

  const filtered = events.filter(ev =>
    ev.name.toLowerCase().includes(search.toLowerCase()) ||
    (ev.client || '').toLowerCase().includes(search.toLowerCase()) ||
    (ev.venue_name || '').toLowerCase().includes(search.toLowerCase())
  )

  // Calendar helpers
  const toDateStr = (day) => {
    const { year, month } = calendar
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  const calendarDays = () => {
    const { year, month } = calendar
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }
  const eventsOnDay = (day) => {
    if (!day) return []
    const ds = toDateStr(day)
    return events.filter(ev => {
      const from = ev.load_in || ev.event_date
      const to   = ev.load_out || ev.load_in || ev.event_date
      return from ? ds >= from && ds <= to : false
    })
  }
  const today = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  })()

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-dark-600 bg-dark-900/30 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Events</h1>
            <p className="text-gray-400 text-sm mt-0.5">{events.length} event{events.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center bg-dark-700 border border-dark-500 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-dark-500 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                <List size={14} /> List
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'calendar' ? 'bg-dark-500 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                <Calendar size={14} /> Calendar
              </button>
            </div>
            <button onClick={() => openNew()} className="btn-primary">
              <Plus size={16} /> New Event
            </button>
          </div>
        </div>
        {viewMode === 'list' && (
          <input
            type="text"
            className="input-field mt-3 max-w-sm"
            placeholder="Search events..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        )}
      </div>

      {/* List View */}
      {viewMode === 'list' && (
        <div className="flex-1 overflow-y-auto p-6">
          {filtered.length === 0 ? (
            <div className="card text-center py-16 text-gray-500">
              <Calendar size={40} className="mx-auto mb-4 opacity-25" />
              <p className="text-base font-medium">{events.length === 0 ? 'No events yet.' : 'No events match your search.'}</p>
              {events.length === 0 && (
                <button onClick={() => openNew()} className="btn-primary mt-4 mx-auto">
                  <Plus size={14} /> Create First Event
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(ev => (
                <div
                  key={ev.id}
                  onClick={() => navigate(`/events/${ev.id}`)}
                  className="card cursor-pointer hover:border-brand-primary/40 transition-all hover:bg-dark-800/80 p-0 overflow-hidden"
                >
                  <div className="flex items-stretch">
                    <div className={`w-1.5 shrink-0 ${DOT_COLOR[ev.status] || 'bg-blue-500'}`} />
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-white font-semibold text-base truncate">{ev.name}</h3>
                            <StatusBadge status={ev.status} />
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                            {ev.client && <span className="font-medium text-gray-300">{ev.client}</span>}
                            {ev.event_date && (
                              <span className="flex items-center gap-1">
                                <Calendar size={11} /> {formatDate(ev.event_date)}
                              </span>
                            )}
                            {ev.venue_name && (
                              <span className="flex items-center gap-1">
                                <MapPin size={11} /> {ev.venue_name}{ev.venue_city ? `, ${ev.venue_city}` : ''}
                              </span>
                            )}
                            {(ev.crew?.length || 0) > 0 && (
                              <span className="flex items-center gap-1"><Users size={11} /> {ev.crew.length} crew</span>
                            )}
                            {(ev.gear?.length || 0) > 0 && (
                              <span className="flex items-center gap-1">
                                <Package size={11} /> {ev.gear.reduce((s, g) => s + (g.quantity || 1), 0)} gear units
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={e => deleteEvent(e, ev.id)} className="text-gray-600 hover:text-red-400 transition-colors p-1">
                            <Trash2 size={14} />
                          </button>
                          <ChevronRight size={16} className="text-gray-600" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCalendar(({ year, month }) => month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 })}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-dark-700 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <h2 className="text-lg font-semibold text-white">{MONTHS[calendar.month]} {calendar.year}</h2>
            <button
              onClick={() => setCalendar(({ year, month }) => month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 })}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-dark-700 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs font-medium text-gray-500 py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays().map((day, i) => {
              const ds = day ? toDateStr(day) : null
              const dayEvents = eventsOnDay(day)
              const isToday = ds === today
              return (
                <div
                  key={i}
                  onClick={() => day && openNew(toDateStr(day))}
                  className={`min-h-[90px] rounded-lg p-1.5 transition-colors ${
                    day
                      ? `cursor-pointer hover:bg-dark-700 border border-dark-600 ${isToday ? 'border-brand-primary/60 bg-brand-primary/5' : 'bg-dark-800'}`
                      : 'border border-transparent'
                  }`}
                >
                  {day && (
                    <>
                      <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-brand-primary text-white' : 'text-gray-400'}`}>
                        {day}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map(ev => (
                          <div
                            key={ev.id}
                            onClick={e => { e.stopPropagation(); navigate(`/events/${ev.id}`) }}
                            className={`text-xs px-1.5 py-0.5 rounded truncate font-medium text-white cursor-pointer hover:brightness-125 transition-all ${DOT_COLOR[ev.status] || 'bg-blue-500'}`}
                            title={ev.name}
                          >
                            {ev.name}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-xs text-gray-500 px-1">+{dayEvents.length - 3} more</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
            <span>Click any day to create a new event on that date.</span>
            <div className="flex items-center gap-3 ml-auto">
              {Object.entries({ upcoming: 'Upcoming', confirmed: 'Confirmed', in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled' }).map(([k, label]) => (
                <span key={k} className="flex items-center gap-1">
                  <span className={`w-2.5 h-2.5 rounded-sm ${DOT_COLOR[k]}`} /> {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* New Event Modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-700 border border-dark-500 rounded-xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dark-500">
              <h2 className="font-semibold text-white">New Event</h2>
              <button onClick={() => setShowNew(null)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
              <label className="label">Event Name</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Summer Festival 2026"
                value={newName}
                autoFocus
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createEvent(); if (e.key === 'Escape') setShowNew(null) }}
              />
              {repacks.length > 0 && (
                <div className="mt-4">
                  <label className="label">Start with saved truck repack (optional)</label>
                  <select className="input-field" value={selectedRepack} onChange={e => setSelectedRepack(e.target.value)}>
                    <option value="">None — start with empty event gear</option>
                    {repacks.map(rp => (
                      <option key={rp.filename} value={rp.filename}>
                        {rp.name}{rp.truck ? ` — ${rp.truck}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    If selected, this event will auto-add the repack cases/items into the event pack sheet.
                  </p>
                </div>
              )}
              {showNew?.prefillDate && (
                <p className="text-xs text-gray-500 mt-2">Date: {showNew.prefillDate}</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-dark-500">
              <button onClick={() => setShowNew(null)} className="btn-secondary">Cancel</button>
              <button onClick={createEvent} className="btn-primary">
                <Plus size={14} /> Create Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
