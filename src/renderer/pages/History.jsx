import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  History as HistoryIcon, Search, Calendar, MapPin, Users, Package,
  Plus, ChevronRight, ChevronDown, Building2, BedDouble
} from 'lucide-react'

const STATUS_CONFIG = {
  upcoming:    { label: 'Upcoming',    bg: 'bg-blue-500/15',   text: 'text-blue-300',   border: 'border-blue-500/30',   dot: 'bg-blue-500' },
  confirmed:   { label: 'Confirmed',   bg: 'bg-green-500/15',  text: 'text-green-300',  border: 'border-green-500/30',  dot: 'bg-green-500' },
  in_progress: { label: 'In Progress', bg: 'bg-yellow-500/15', text: 'text-yellow-300', border: 'border-yellow-500/30', dot: 'bg-yellow-500' },
  completed:   { label: 'Completed',   bg: 'bg-gray-500/15',   text: 'text-gray-300',   border: 'border-gray-500/30',   dot: 'bg-gray-400' },
  cancelled:   { label: 'Cancelled',   bg: 'bg-red-500/15',    text: 'text-red-300',    border: 'border-red-500/30',    dot: 'bg-red-500' },
}

function formatDate(d) {
  if (!d) return null
  try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return d }
}

export default function History() {
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(new Set())
  const [loading, setLoading] = useState(null) // eventId-action key while creating

  useEffect(() => {
    window.electronAPI?.events?.getAll().then(setEvents)
  }, [])

  const now = new Date()
  now.setHours(23, 59, 59, 999)

  const pastEvents = events
    .filter(ev => {
      if (ev.status === 'completed' || ev.status === 'cancelled') return true
      const d = ev.load_out || ev.event_date || ev.load_in
      return d ? new Date(d) <= now : false
    })
    .filter(ev =>
      !search ||
      ev.name.toLowerCase().includes(search.toLowerCase()) ||
      (ev.venue_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (ev.venue_city || '').toLowerCase().includes(search.toLowerCase()) ||
      (ev.client || '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => new Date(b.event_date || b.load_in || 0) - new Date(a.event_date || a.load_in || 0))

  const toggleExpand = (id) => setExpanded(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const createFrom = async (source, fields) => {
    if (loading) return
    const key = `${source.id}-${fields.join(',')}`
    setLoading(key)
    try {
      const copyAll = fields.includes('all')
      const suffix = copyAll ? ' (Copy)' : ' — ' + fields.map(f => ({ gear: 'Gear', venue: 'Venue', hotel: 'Hotel', crew: 'Crew' }[f] || f)).join(' + ')
      const newEv = { name: `${source.name}${suffix}`, status: 'upcoming' }
      if (copyAll || fields.includes('gear'))   newEv.gear = (source.gear || []).map(i => ({ ...i }))
      if (copyAll || fields.includes('venue'))  ['venue_name','venue_address','venue_city','venue_state','venue_contact_name','venue_contact_phone','venue_contact_email','venue_notes'].forEach(k => { newEv[k] = source[k] || '' })
      if (copyAll || fields.includes('hotel'))  ['hotel_name','hotel_address','hotel_notes'].forEach(k => { newEv[k] = source[k] || '' })
      if (copyAll || fields.includes('crew'))   newEv.crew = (source.crew || []).map(c => ({ ...c, id: Date.now() + Math.random() * 1000 }))
      const id = await window.electronAPI.events.save(newEv)
      navigate(`/events/${id}`)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <HistoryIcon size={21} className="text-gray-400" /> Event History
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {pastEvents.length} past event{pastEvents.length !== 1 ? 's' : ''}{search ? ' matching your search' : ''}
          </p>
        </div>
        <button onClick={() => navigate('/events')} className="btn-secondary">
          <Calendar size={14} /> All Events
        </button>
      </div>

      <div className="relative mb-5 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <input
          className="input-field pl-9"
          placeholder="Search past events…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {pastEvents.length === 0 ? (
        <div className="card text-center py-16 text-gray-500">
          <HistoryIcon size={40} className="mx-auto mb-3 opacity-25" />
          <p className="text-base">{search ? 'No matching events.' : 'No past events yet.'}</p>
          <p className="text-sm mt-1 text-gray-600">Completed or past-date events will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pastEvents.map(ev => {
            const cfg = STATUS_CONFIG[ev.status] || STATUS_CONFIG.upcoming
            const isExpanded = expanded.has(ev.id)
            const gearUnits = (ev.gear || []).reduce((s, g) => s + (g.quantity || 1), 0)
            const isCreating = loading?.startsWith(`${ev.id}-`)

            return (
              <div key={ev.id} className="card overflow-hidden p-0">
                <div className="flex items-start gap-3 px-5 py-4">
                  <div className={`w-1 mt-1.5 self-stretch rounded-full shrink-0 min-h-[36px] ${cfg.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-semibold text-white">{ev.name}</span>
                      <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                        {cfg.label}
                      </span>
                      {ev.client && <span className="text-xs text-gray-500">{ev.client}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      {ev.event_date && <span className="flex items-center gap-1"><Calendar size={10} /> {formatDate(ev.event_date)}</span>}
                      {ev.venue_name && <span className="flex items-center gap-1"><MapPin size={10} /> {ev.venue_name}{ev.venue_city ? `, ${ev.venue_city}` : ''}</span>}
                      {(ev.crew?.length || 0) > 0 && <span className="flex items-center gap-1"><Users size={10} /> {ev.crew.length} crew</span>}
                      {gearUnits > 0 && <span className="flex items-center gap-1"><Package size={10} /> {gearUnits} gear units</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    {(ev.gear?.length || 0) > 0 && (
                      <button onClick={() => createFrom(ev, ['gear'])} disabled={!!loading} title="Create new event with this gear list" className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-all disabled:opacity-40">
                        <Plus size={11} /> Gear
                      </button>
                    )}
                    {ev.venue_name && (
                      <button onClick={() => createFrom(ev, ['venue'])} disabled={!!loading} title="Create new event with this venue" className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all disabled:opacity-40">
                        <Plus size={11} /> Venue
                      </button>
                    )}
                    {ev.hotel_name && (
                      <button onClick={() => createFrom(ev, ['hotel'])} disabled={!!loading} title="Create new event with this hotel" className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-all disabled:opacity-40">
                        <Plus size={11} /> Hotel
                      </button>
                    )}
                    {(ev.crew?.length || 0) > 0 && (
                      <button onClick={() => createFrom(ev, ['crew'])} disabled={!!loading} title="Create new event with this crew list" className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-all disabled:opacity-40">
                        <Plus size={11} /> Crew
                      </button>
                    )}
                    <button onClick={() => createFrom(ev, ['all'])} disabled={!!loading} title="New event with all data copied" className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-white/5 text-white border border-white/15 hover:bg-white/10 transition-all disabled:opacity-40 font-medium">
                      {isCreating ? '…' : <><Plus size={11} /> Template</>}
                    </button>
                    <button onClick={() => navigate(`/events/${ev.id}`)} className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-dark-600 transition-colors" title="Open event">
                      <ChevronRight size={15} />
                    </button>
                    <button onClick={() => toggleExpand(ev.id)} className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-dark-600 transition-colors" title={isExpanded ? 'Collapse' : 'Show details'}>
                      <ChevronDown size={15} className={`transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90 opacity-40'}`} />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-dark-600/50 px-5 py-4 bg-dark-800/40">
                    <div className="grid grid-cols-2 gap-5 text-sm lg:grid-cols-4">
                      {ev.venue_name && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                            <MapPin size={11} /> Venue
                          </h4>
                          <div className="space-y-0.5 text-xs">
                            <div className="font-medium text-white">{ev.venue_name}</div>
                            {ev.venue_address && <div className="text-gray-400">{ev.venue_address}</div>}
                            {(ev.venue_city || ev.venue_state) && <div className="text-gray-400">{[ev.venue_city, ev.venue_state].filter(Boolean).join(', ')}</div>}
                            {ev.venue_contact_name && <div className="text-gray-500 mt-1">{ev.venue_contact_name}</div>}
                            {ev.venue_contact_phone && <div className="text-gray-500">{ev.venue_contact_phone}</div>}
                            {ev.venue_contact_email && <div className="text-gray-500 truncate">{ev.venue_contact_email}</div>}
                            {ev.venue_notes && <div className="text-gray-600 mt-1 italic">{ev.venue_notes.slice(0, 120)}{ev.venue_notes.length > 120 ? '…' : ''}</div>}
                          </div>
                        </div>
                      )}
                      {ev.hotel_name && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                            <BedDouble size={11} /> Hotel
                          </h4>
                          <div className="space-y-0.5 text-xs">
                            <div className="font-medium text-white">{ev.hotel_name}</div>
                            {ev.hotel_address && <div className="text-gray-400">{ev.hotel_address}</div>}
                            {(ev.hotel_checkin || ev.hotel_checkout) && <div className="text-gray-500">{formatDate(ev.hotel_checkin)} → {formatDate(ev.hotel_checkout)}</div>}
                            {ev.hotel_confirmation && <div className="text-gray-500 font-mono">#{ev.hotel_confirmation}</div>}
                          </div>
                        </div>
                      )}
                      {(ev.crew?.length || 0) > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                            <Users size={11} /> Crew ({ev.crew.length})
                          </h4>
                          <div className="space-y-1 text-xs">
                            {ev.crew.slice(0, 7).map((c, i) => (
                              <div key={i} className="flex items-baseline gap-2">
                                <span className="text-gray-200">{c.name}</span>
                                {c.role && <span className="text-gray-500">{c.role}</span>}
                              </div>
                            ))}
                            {ev.crew.length > 7 && <div className="text-gray-500">+{ev.crew.length - 7} more</div>}
                          </div>
                        </div>
                      )}
                      {(ev.gear?.length || 0) > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                            <Package size={11} /> Gear ({gearUnits} units)
                          </h4>
                          <div className="space-y-1 text-xs">
                            {ev.gear.slice(0, 7).map((g, i) => (
                              <div key={i} className="flex items-baseline justify-between gap-2">
                                <span className="text-gray-200 truncate">{g.name}</span>
                                <span className="text-gray-500 shrink-0">×{g.quantity || 1}</span>
                              </div>
                            ))}
                            {ev.gear.length > 7 && <div className="text-gray-500">+{ev.gear.length - 7} more types</div>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
