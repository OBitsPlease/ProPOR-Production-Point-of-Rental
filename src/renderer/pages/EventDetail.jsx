import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Save, Trash2, Check, Calendar, MapPin, Users, Package,
  Plus, X, Paperclip, Truck, ChevronDown, BookUser, History,
  BedDouble, FileText, Search, AlertTriangle, GripVertical
} from 'lucide-react'

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUSES = [
  { value: 'upcoming',    label: 'Upcoming'    },
  { value: 'confirmed',   label: 'Confirmed'   },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed',   label: 'Completed'   },
  { value: 'cancelled',   label: 'Cancelled'   },
]

const CREW_ROLES = [
  'Production Manager','Stage Manager','Audio Engineer','A2','Lighting Designer',
  'LD Operator','Video Director','Video Tech','Rigger','Stagehand','Driver','Tour Manager','Other',
]

const EMPTY_EVENT = {
  name:'', client:'', event_date:'', load_in:'', load_out:'', status:'upcoming', notes:'',
  venue_name:'', venue_address:'', venue_city:'', venue_state:'',
  venue_contact_name:'', venue_contact_phone:'', venue_contact_email:'', venue_notes:'',
  hotel_name:'', hotel_address:'', hotel_checkin:'', hotel_checkout:'', hotel_confirmation:'', hotel_notes:'',
  crew:[], gear:[], files:[],
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return null
  try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return d }
}

function eventsOverlap(a, b) {
  if (a.id === b.id) return false
  const af = a.load_in || a.event_date, at = a.load_out || a.load_in || a.event_date
  const bf = b.load_in || b.event_date, bt = b.load_out || b.load_in || b.event_date
  if (!af || !bf) return false
  return af <= bt && bf <= at
}

function buildAvailability(event, allEvents, allItems) {
  const overlapping = allEvents.filter(e => eventsOverlap(event, e))
  const committed = new Map()
  for (const oe of overlapping) {
    for (const g of oe.gear || []) {
      if (g._type === 'case') {
        for (const item of g.items || []) {
          const id = item.item_id
          const c = committed.get(id) || { qty: 0, events: [] }
          c.qty += (item.qty || 1) * (g.quantity || 1)
          if (!c.events.includes(oe.name)) c.events.push(oe.name)
          committed.set(id, c)
        }
      } else {
        const id = g.item_id
        const c = committed.get(id) || { qty: 0, events: [] }
        c.qty += g.quantity || 1
        if (!c.events.includes(oe.name)) c.events.push(oe.name)
        committed.set(id, c)
      }
    }
  }
  const avail = new Map()
  for (const item of allItems) {
    const c = committed.get(item.id) || { qty: 0, events: [] }
    avail.set(item.id, {
      available: Math.max(0, (item.quantity || 1) - c.qty),
      committed: c.qty,
      total: item.quantity || 1,
      conflictEvents: c.events,
    })
  }
  return avail
}

function buildCrewConflicts(event, allEvents) {
  const overlapping = allEvents.filter(e => eventsOverlap(event, e))
  const conflicts = new Map()
  for (const oe of overlapping) {
    for (const cm of oe.crew || []) {
      const key = (cm.email || cm.name || '').toLowerCase().trim()
      if (!key) continue
      if (!conflicts.has(key)) conflicts.set(key, [])
      if (!conflicts.get(key).includes(oe.name)) conflicts.get(key).push(oe.name)
    }
  }
  return conflicts
}

// ─── Tab Button ──────────────────────────────────────────────────────────────

function TabBtn({ id, active, onClick, icon: Icon, label, badge, badgeColor = 'bg-blue-500' }) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${active ? 'border-brand-primary text-brand-primary bg-dark-800/40' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'}`}
    >
      <Icon size={14} />
      {label}
      {badge != null && (
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full text-white ${badgeColor}`}>{badge}</span>
      )}
    </button>
  )
}

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function EventDetail() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const [event, setEvent]         = useState(EMPTY_EVENT)
  const [allItems, setAllItems]   = useState([])
  const [allCases, setAllCases]   = useState([])
  const [allEvents, setAllEvents] = useState([])
  const [contacts, setContacts]   = useState([])
  const [dirty, setDirty]         = useState(false)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [tab, setTab]             = useState('info')

  // Address book picker
  const [abPicker, setAbPicker]   = useState(null)  // { section }
  const [abSearch, setAbSearch]   = useState('')

  // Past event import picker
  const [importPicker, setImportPicker] = useState(null)  // { section, mode }

  // Gear two-column layout
  const [gearItemSearch, setGearItemSearch] = useState('')
  const [showCasePicker, setShowCasePicker] = useState(false)
  const [casePickerSearch, setCasePickerSearch] = useState('')
  const draggingItemLibId = useRef(null)
  const [dropTarget, setDropTarget] = useState(null) // { type: 'case', gearIdx } | { type: 'standalone' }

  // Crew new member form
  const [newCrew, setNewCrew]     = useState({ name:'', role:'', phone:'', email:'' })

  const load = useCallback(async () => {
    if (!window.electronAPI) return
    const [ev, its, css, evts, ab] = await Promise.all([
      window.electronAPI.events.get(Number(eventId)),
      window.electronAPI.getItems(),
      window.electronAPI.cases?.getAll() ?? [],
      window.electronAPI.events.getAll(),
      window.electronAPI.addressBook?.getAll() ?? [],
    ])
    if (ev) {
      setEvent({ ...EMPTY_EVENT, ...ev })
      if (!ev.gear || ev.gear.length === 0) setTab('gear')
    }
    setAllItems(its); setAllCases(css); setAllEvents(evts); setContacts(ab)
  }, [eventId])

  useEffect(() => { load() }, [load])

  const update = (patch) => { setEvent(e => ({ ...e, ...patch })); setDirty(true) }

  const saveEvent = async () => {
    if (saving) return
    setSaving(true)
    try {
      await window.electronAPI.events.save({ ...event, id: Number(eventId) })
      setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch (err) { console.error('Save failed:', err) }
    finally { setSaving(false) }
  }

  const deleteEvent = async () => {
    if (!await window.electronAPI.dialog.confirm(`Delete "${event.name}"?`, 'This cannot be undone.'))
      return
    await window.electronAPI.events.delete(Number(eventId))
    navigate('/events')
  }

  const attachFiles = async () => {
    const files = await window.electronAPI.events.attachFile(Number(eventId))
    if (files) { setEvent(e => ({ ...e, files })); setDirty(false) }
    load()
  }

  const removeFile = async (fileName) => {
    await window.electronAPI.events.removeFile(Number(eventId), fileName)
    load()
  }

  const openFile = (filePath) => { window.electronAPI.events.openFile(filePath) }

  // ─── Availability / conflicts ─────────────────────────────────────────────
  const availability = buildAvailability(event, allEvents, allItems)
  const crewConflicts = buildCrewConflicts(event, allEvents)

  // Gear stats
  const gearUnits = (event.gear || []).reduce((s, g) => s + (g.quantity || 1), 0)
  const conflictGear = (event.gear || []).filter(g => {
    if (g._type === 'case') {
      return (g.items || []).some(item => {
        const a = availability.get(item.item_id)
        return a && (a.available < (item.qty || 1) * (g.quantity || 1))
      })
    }
    const a = availability.get(g.item_id)
    return a && a.available < (g.quantity || 1)
  })

  // Past events for import picker
  const now = new Date(); now.setHours(23,59,59,999)
  const pastEvents = allEvents.filter(e =>
    e.id !== Number(eventId) &&
    (e.status === 'completed' || e.status === 'cancelled' ||
     (e.load_out || e.event_date || e.load_in ? new Date(e.load_out || e.event_date || e.load_in) <= now : false))
  ).sort((a, b) => new Date(b.event_date || b.load_in || 0) - new Date(a.event_date || a.load_in || 0))

  // ─── Address Book picker apply ────────────────────────────────────────────
  const applyContact = (contact) => {
    if (!abPicker) return
    const { section } = abPicker
    if (section === 'customer') {
      update({ client: contact.name || contact.company || '', ...(contact.company ? {} : {}) })
    } else if (section === 'venue') {
      update({
        venue_name: contact.name || '',
        venue_address: contact.address || '',
        venue_city: contact.city || '',
        venue_state: contact.state || '',
        venue_contact_name: contact.contact_name || '',
        venue_contact_phone: contact.contact_phone || '',
        venue_contact_email: contact.contact_email || '',
      })
    } else if (section === 'hotel') {
      update({
        hotel_name: contact.name || '',
        hotel_address: contact.address || '',
      })
    }
    setAbPicker(null); setAbSearch('')
  }

  // ─── Past event import apply ──────────────────────────────────────────────
  const applyImport = (source, section) => {
    if (!importPicker) return
    if (section === 'venue') {
      update({
        venue_name: source.venue_name || '',
        venue_address: source.venue_address || '',
        venue_city: source.venue_city || '',
        venue_state: source.venue_state || '',
        venue_contact_name: source.venue_contact_name || '',
        venue_contact_phone: source.venue_contact_phone || '',
        venue_contact_email: source.venue_contact_email || '',
        venue_notes: source.venue_notes || '',
      })
    } else if (section === 'hotel') {
      update({
        hotel_name: source.hotel_name || '',
        hotel_address: source.hotel_address || '',
        hotel_notes: source.hotel_notes || '',
      })
    } else if (section === 'crew') {
      update({ crew: (source.crew || []).map(c => ({ ...c, id: Date.now() + Math.random() * 1000 })) })
    }
    setImportPicker(null)
  }

  // ─── Gear management ──────────────────────────────────────────────────────
  const removeGear = (idx) => {
    const gear = [...(event.gear || [])]
    gear.splice(idx, 1)
    update({ gear })
  }

  const setGearQty = (idx, qty) => {
    const gear = [...(event.gear || [])]
    gear[idx] = { ...gear[idx], quantity: Math.max(1, parseInt(qty) || 1) }
    update({ gear })
  }

  const addCaseToGear = (cs) => {
    const gear = [...(event.gear || [])]
    const existing = gear.findIndex(g => g._type === 'case' && g.case_id === cs.id)
    if (existing >= 0) { setShowCasePicker(false); setCasePickerSearch(''); return }
    const items = (cs.items || []).map(ci => {
      const item = allItems.find(i => i.id === (ci.item_id || ci.id))
      return item ? { item_id: item.id, qty: ci.qty || 1, name: item.name, weight: item.weight || 0, department_name: item.department_name || '', department_color: item.department_color || '' } : null
    }).filter(Boolean)
    gear.push({
      _type: 'case', case_id: cs.id, name: cs.name, color: cs.color || '#f59e0b',
      sku: cs.sku || '', length: cs.length, width: cs.width, height: cs.height,
      weight: cs.weight || 0, items, quantity: 1,
      can_rotate_lr: cs.can_rotate_lr, can_tip_side: cs.can_tip_side, can_flip: cs.can_flip,
      can_stack_on_others: cs.can_stack_on_others, allow_stacking_on_top: cs.allow_stacking_on_top,
      max_stack_weight: cs.max_stack_weight || 0,
    })
    update({ gear })
    setShowCasePicker(false); setCasePickerSearch('')
  }

  const handleDropItemOnCase = (e, gearIdx) => {
    e.preventDefault()
    setDropTarget(null)
    const itemId = draggingItemLibId.current
    draggingItemLibId.current = null
    if (!itemId) return
    const item = allItems.find(i => i.id === itemId)
    if (!item) return
    const gear = [...(event.gear || [])]
    const target = gear[gearIdx]
    if (!target || target._type !== 'case') return
    const existingIdx = (target.items || []).findIndex(ci => ci.item_id === item.id)
    const newItems = existingIdx >= 0
      ? target.items.map((ci, i) => i === existingIdx ? { ...ci, qty: (ci.qty || 1) + 1 } : ci)
      : [...(target.items || []), { item_id: item.id, name: item.name, qty: 1, weight: item.weight || 0, department_name: item.department_name || '', department_color: item.department_color || '' }]
    gear[gearIdx] = { ...target, items: newItems }
    update({ gear })
  }

  const handleDropItemStandalone = (e) => {
    e.preventDefault()
    setDropTarget(null)
    const itemId = draggingItemLibId.current
    draggingItemLibId.current = null
    if (!itemId) return
    const item = allItems.find(i => i.id === itemId)
    if (!item) return
    const gear = [...(event.gear || [])]
    const existingIdx = gear.findIndex(g => !g._type && g.item_id === item.id)
    if (existingIdx >= 0) {
      gear[existingIdx] = { ...gear[existingIdx], quantity: (gear[existingIdx].quantity || 1) + 1 }
    } else {
      gear.push({
        item_id: item.id, name: item.name, sku: item.sku || '',
        department_name: item.department_name || '', department_color: item.department_color || '',
        weight: item.weight || 0, length: item.length, width: item.width, height: item.height,
        quantity: 1, can_rotate_lr: item.can_rotate_lr, can_tip_side: item.can_tip_side,
        can_flip: item.can_flip, can_stack_on_others: item.can_stack_on_others,
        allow_stacking_on_top: item.allow_stacking_on_top, max_stack_weight: item.max_stack_weight || 0,
      })
    }
    update({ gear })
  }

  const setCaseItemQty = (gearIdx, itemId, qty) => {
    const gear = [...(event.gear || [])]
    const target = gear[gearIdx]
    if (!target) return
    gear[gearIdx] = { ...target, items: (target.items || []).map(ci => ci.item_id === itemId ? { ...ci, qty: Math.max(1, parseInt(qty) || 1) } : ci) }
    update({ gear })
  }

  const removeItemFromCase = (gearIdx, itemId) => {
    const gear = [...(event.gear || [])]
    const target = gear[gearIdx]
    if (!target) return
    gear[gearIdx] = { ...target, items: (target.items || []).filter(ci => ci.item_id !== itemId) }
    update({ gear })
  }

  // ─── Crew management ─────────────────────────────────────────────────────
  const addCrewMember = () => {
    if (!newCrew.name.trim()) return
    update({ crew: [...(event.crew || []), { ...newCrew, id: Date.now() }] })
    setNewCrew({ name: '', role: '', phone: '', email: '' })
  }

  const removeCrewMember = (id) => {
    update({ crew: (event.crew || []).filter(c => c.id !== id) })
  }

  const updateCrew = (id, patch) => {
    update({ crew: (event.crew || []).map(c => c.id === id ? { ...c, ...patch } : c) })
  }

  // ─── Open in Load Planner ────────────────────────────────────────────────
  const openInPlanner = () => {
    navigate(`/planner/event/${eventId}`)
  }

  // ─── Gear search / computed ──────────────────────────────────────────────
  const gearItemSearchLC = gearItemSearch.toLowerCase()
  const filteredGearItems = allItems.filter(it =>
    !gearItemSearch ||
    it.name.toLowerCase().includes(gearItemSearchLC) ||
    (it.sku || '').toLowerCase().includes(gearItemSearchLC) ||
    (it.department_name || '').toLowerCase().includes(gearItemSearchLC)
  )
  const eventCaseGear = (event.gear || []).map((g, idx) => ({ ...g, _gearIdx: idx })).filter(g => g._type === 'case')
  const standaloneGear = (event.gear || []).map((g, idx) => ({ ...g, _gearIdx: idx })).filter(g => !g._type)
  const alreadyAddedCaseIds = new Set(eventCaseGear.map(g => g.case_id))
  const casePickerLC = casePickerSearch.toLowerCase()
  const casePickerResults = allCases.filter(cs =>
    !alreadyAddedCaseIds.has(cs.id) &&
    (!casePickerSearch || cs.name.toLowerCase().includes(casePickerLC) || (cs.sku || '').toLowerCase().includes(casePickerLC))
  )

  // ─── Address book filtered for picker ────────────────────────────────────
  const abFiltered = abPicker
    ? contacts.filter(c => c.type === abPicker.section)
        .filter(c =>
          !abSearch ||
          (c.name || '').toLowerCase().includes(abSearch.toLowerCase()) ||
          (c.company || '').toLowerCase().includes(abSearch.toLowerCase()) ||
          (c.city || '').toLowerCase().includes(abSearch.toLowerCase()) ||
          (c.contact_name || '').toLowerCase().includes(abSearch.toLowerCase())
        )
    : []

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="px-6 py-3 border-b border-dark-600 bg-dark-900/30 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/events')} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-dark-700 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <input
              className="text-xl font-bold text-white bg-transparent border-0 outline-none w-full focus:bg-dark-700/40 rounded px-2 py-0.5"
              value={event.name}
              onChange={e => update({ name: e.target.value })}
              placeholder="Event Name"
            />
          </div>
          <select
            className="input-field text-sm py-1.5 w-36"
            value={event.status}
            onChange={e => update({ status: e.target.value })}
          >
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {saved && (
            <span className="flex items-center gap-1 text-xs text-green-400 font-medium">
              <Check size={14} /> Saved
            </span>
          )}
          <button
            onClick={saveEvent}
            disabled={!dirty || saving}
            className="btn-primary disabled:opacity-40"
          >
            <Save size={14} /> {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={deleteEvent} className="text-gray-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-dark-700 transition-colors">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0 px-6 border-b border-dark-600 bg-dark-900/20 overflow-x-auto shrink-0">
        <TabBtn id="info"  active={tab==='info'}  onClick={setTab} icon={Calendar}    label="Info" />
        <TabBtn id="venue" active={tab==='venue'} onClick={setTab} icon={MapPin}      label="Venue" />
        <TabBtn id="crew"  active={tab==='crew'}  onClick={setTab} icon={Users}       label="Crew"
          badge={event.crew.length || null}
          badgeColor={crewConflicts.size > 0 ? 'bg-red-500' : 'bg-blue-500'} />
        <TabBtn id="hotel" active={tab==='hotel'} onClick={setTab} icon={BedDouble}   label="Hotel" />
        <TabBtn id="gear"  active={tab==='gear'}  onClick={setTab} icon={Package}     label="Gear"
          badge={gearUnits || null}
          badgeColor={conflictGear.length > 0 ? 'bg-red-500' : 'bg-green-600'} />
        <TabBtn id="files" active={tab==='files'} onClick={setTab} icon={FileText}    label="Files"
          badge={(event.files?.length) || null} badgeColor="bg-gray-600" />
        <TabBtn id="pack"  active={tab==='pack'}  onClick={setTab} icon={Truck}       label="Load Plan" />
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* INFO */}
        {tab === 'info' && (
          <div className="max-w-2xl space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Client / Company">
                <div className="flex gap-2">
                  <input className="input-field flex-1" value={event.client} onChange={e => update({ client: e.target.value })} placeholder="Client name" />
                  {contacts.filter(c => c.type === 'customer').length > 0 && (
                    <button onClick={() => { setAbPicker({ section: 'customer' }); setAbSearch('') }} className="shrink-0 flex items-center gap-1 text-xs text-gray-400 hover:text-white px-2.5 py-1.5 rounded-lg border border-dark-500 hover:border-dark-400 bg-dark-800 transition-colors" title="Choose from Address Book">
                      <BookUser size={12} />
                    </button>
                  )}
                </div>
              </Field>
              <Field label="Event Date">
                <input type="date" className="input-field" value={event.event_date} onChange={e => update({ event_date: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Load In"><input type="date" className="input-field" value={event.load_in} onChange={e => update({ load_in: e.target.value })} /></Field>
              <Field label="Load Out"><input type="date" className="input-field" value={event.load_out} onChange={e => update({ load_out: e.target.value })} /></Field>
            </div>
            <div className="bg-dark-800 border border-dark-600 rounded-lg p-3 text-xs text-gray-400">
              <strong className="text-gray-300">Availability window:</strong>{' '}
              {event.load_in || event.load_out || event.event_date
                ? `${event.load_in || event.event_date || '?'} → ${event.load_out || event.load_in || event.event_date || '?'}`
                : 'Set at least one date to enable conflict detection.'}
              {' '}<span className="text-gray-500">— Gear and crew booked in this window will flag conflicts with other events.</span>
            </div>
            <Field label="Notes">
              <textarea className="input-field resize-none" rows={5} value={event.notes} onChange={e => update({ notes: e.target.value })} placeholder="General event notes…" />
            </Field>
          </div>
        )}

        {/* VENUE */}
        {tab === 'venue' && (
          <div className="max-w-2xl space-y-5">
            <div className="flex justify-end gap-2">
              {contacts.filter(c => c.type === 'venue').length > 0 && (
                <button onClick={() => { setAbPicker({ section: 'venue' }); setAbSearch('') }} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-dark-500 hover:border-dark-400 bg-dark-800 transition-colors">
                  <BookUser size={12} /> Choose from Address Book
                </button>
              )}
              {pastEvents.length > 0 && (
                <button onClick={() => setImportPicker({ section: 'venue' })} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-dark-500 hover:border-dark-400 bg-dark-800 transition-colors">
                  <History size={12} /> Import from past event
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Venue Name" className="col-span-2"><input className="input-field" value={event.venue_name} onChange={e => update({ venue_name: e.target.value })} placeholder="e.g. Madison Square Garden" /></Field>
              <Field label="Address" className="col-span-2"><input className="input-field" value={event.venue_address} onChange={e => update({ venue_address: e.target.value })} placeholder="Street address" /></Field>
              <Field label="City"><input className="input-field" value={event.venue_city} onChange={e => update({ venue_city: e.target.value })} /></Field>
              <Field label="State"><input className="input-field" value={event.venue_state} onChange={e => update({ venue_state: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Contact Name"><input className="input-field" value={event.venue_contact_name} onChange={e => update({ venue_contact_name: e.target.value })} /></Field>
              <Field label="Contact Phone"><input className="input-field" value={event.venue_contact_phone} onChange={e => update({ venue_contact_phone: e.target.value })} /></Field>
              <Field label="Contact Email"><input className="input-field" value={event.venue_contact_email} onChange={e => update({ venue_contact_email: e.target.value })} /></Field>
            </div>
            <Field label="Venue Notes"><textarea className="input-field resize-none" rows={4} value={event.venue_notes} onChange={e => update({ venue_notes: e.target.value })} placeholder="Load-in access, stage specs…" /></Field>
          </div>
        )}

        {/* CREW */}
        {tab === 'crew' && (
          <div className="max-w-2xl space-y-5">
            <div className="flex justify-end gap-2">
              {pastEvents.length > 0 && (
                <button onClick={() => setImportPicker({ section: 'crew' })} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-dark-500 hover:border-dark-400 bg-dark-800 transition-colors">
                  <History size={12} /> Import from past event
                </button>
              )}
            </div>

            {crewConflicts.size > 0 && (
              <div className="px-4 py-3 rounded-lg bg-red-900/20 border border-red-700/30 text-red-300 text-xs flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>{crewConflicts.size} crew member{crewConflicts.size !== 1 ? 's' : ''} may have scheduling conflicts with other events.</span>
              </div>
            )}

            <div className="space-y-2">
              {(event.crew || []).map(cm => {
                const key = (cm.email || cm.name || '').toLowerCase().trim()
                const hasConflict = crewConflicts.has(key) && crewConflicts.get(key).length > 0
                return (
                  <div key={cm.id} className={`card p-0 overflow-hidden ${hasConflict ? 'border-red-500/30' : ''}`}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      {hasConflict && <AlertTriangle size={14} className="text-red-400 shrink-0" title={`Conflict: ${crewConflicts.get(key)?.join(', ')}`} />}
                      <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                        <input className="input-field text-sm py-1.5" placeholder="Name" value={cm.name} onChange={e => updateCrew(cm.id, { name: e.target.value })} />
                        <select className="input-field text-sm py-1.5" value={cm.role} onChange={e => updateCrew(cm.id, { role: e.target.value })}>
                          <option value="">Role…</option>
                          {CREW_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <input className="input-field text-sm py-1.5" placeholder="Phone" value={cm.phone || ''} onChange={e => updateCrew(cm.id, { phone: e.target.value })} />
                        <input className="input-field text-sm py-1.5" placeholder="Email" value={cm.email || ''} onChange={e => updateCrew(cm.id, { email: e.target.value })} />
                      </div>
                      <button onClick={() => removeCrewMember(cm.id)} className="text-gray-600 hover:text-red-400 p-1 transition-colors shrink-0">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Add crew row */}
            <div className="card p-4 border-dashed">
              <p className="text-xs font-medium text-gray-400 mb-3">Add Crew Member</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                <input className="input-field text-sm py-1.5" placeholder="Name" value={newCrew.name} onChange={e => setNewCrew(c => ({ ...c, name: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addCrewMember()} />
                <select className="input-field text-sm py-1.5" value={newCrew.role} onChange={e => setNewCrew(c => ({ ...c, role: e.target.value }))}>
                  <option value="">Role…</option>
                  {CREW_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <input className="input-field text-sm py-1.5" placeholder="Phone" value={newCrew.phone} onChange={e => setNewCrew(c => ({ ...c, phone: e.target.value }))} />
                <input className="input-field text-sm py-1.5" placeholder="Email" value={newCrew.email} onChange={e => setNewCrew(c => ({ ...c, email: e.target.value }))} />
              </div>
              <button onClick={addCrewMember} disabled={!newCrew.name.trim()} className="btn-secondary text-sm disabled:opacity-40">
                <Plus size={13} /> Add
              </button>
            </div>
          </div>
        )}

        {/* HOTEL */}
        {tab === 'hotel' && (
          <div className="max-w-2xl space-y-5">
            <div className="flex justify-end gap-2">
              {contacts.filter(c => c.type === 'hotel').length > 0 && (
                <button onClick={() => { setAbPicker({ section: 'hotel' }); setAbSearch('') }} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-dark-500 hover:border-dark-400 bg-dark-800 transition-colors">
                  <BookUser size={12} /> Choose from Address Book
                </button>
              )}
              {pastEvents.length > 0 && (
                <button onClick={() => setImportPicker({ section: 'hotel' })} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-dark-500 hover:border-dark-400 bg-dark-800 transition-colors">
                  <History size={12} /> Import from past event
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Hotel Name" className="col-span-2"><input className="input-field" value={event.hotel_name} onChange={e => update({ hotel_name: e.target.value })} placeholder="e.g. Marriott Downtown" /></Field>
              <Field label="Address" className="col-span-2"><input className="input-field" value={event.hotel_address} onChange={e => update({ hotel_address: e.target.value })} placeholder="Street address" /></Field>
              <Field label="Check-In Date"><input type="date" className="input-field" value={event.hotel_checkin} onChange={e => update({ hotel_checkin: e.target.value })} /></Field>
              <Field label="Check-Out Date"><input type="date" className="input-field" value={event.hotel_checkout} onChange={e => update({ hotel_checkout: e.target.value })} /></Field>
              <Field label="Confirmation #"><input className="input-field" value={event.hotel_confirmation} onChange={e => update({ hotel_confirmation: e.target.value })} placeholder="Booking confirmation number" /></Field>
            </div>
            <Field label="Hotel Notes"><textarea className="input-field resize-none" rows={4} value={event.hotel_notes} onChange={e => update({ hotel_notes: e.target.value })} placeholder="Parking, check-in instructions…" /></Field>
          </div>
        )}

        {/* GEAR */}
        {tab === 'gear' && (
          <div className="flex gap-4 h-full" style={{ minHeight: 0 }}>

            {/* LEFT: Items Library */}
            <div className="w-64 shrink-0 flex flex-col bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
              <div className="px-3 py-3 border-b border-dark-600 shrink-0">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Items Library</p>
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                  <input className="input-field pl-8 py-1.5 text-sm" placeholder="Search items…"
                    value={gearItemSearch} onChange={e => setGearItemSearch(e.target.value)} />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                {filteredGearItems.map(it => {
                  const a = availability.get(it.id)
                  return (
                    <div key={it.id} draggable
                      onDragStart={e => { draggingItemLibId.current = it.id; e.dataTransfer.effectAllowed = 'copy' }}
                      onDragEnd={() => { draggingItemLibId.current = null; setDropTarget(null) }}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-dark-700 cursor-grab active:cursor-grabbing group transition-colors select-none"
                    >
                      <GripVertical size={12} className="text-white/20 group-hover:text-white/40 shrink-0" />
                      {it.department_color && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: it.department_color }} />}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">{it.name}</div>
                        {a && <div className={`text-xs ${a.available > 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>{a.available}/{a.total} avail</div>}
                      </div>
                    </div>
                  )
                })}
                {filteredGearItems.length === 0 && (
                  <div className="text-center py-8 text-gray-500 text-sm">No items found</div>
                )}
              </div>
            </div>

            {/* RIGHT: Event Gear */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <div className="flex items-center justify-between mb-3 shrink-0">
                <div>
                  <h2 className="text-base font-semibold text-white">Event Gear</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {gearUnits} unit{gearUnits !== 1 ? 's' : ''} · {(event.gear || []).length} type{(event.gear || []).length !== 1 ? 's' : ''}
                    {conflictGear.length > 0 && <span className="text-red-400 ml-2">⚠ {conflictGear.length} conflict{conflictGear.length !== 1 ? 's' : ''}</span>}
                  </p>
                </div>
                <div className="relative">
                  <button onClick={() => { setShowCasePicker(p => !p); setCasePickerSearch('') }} className="btn-secondary text-sm">
                    <Plus size={13} /> Add Case
                  </button>
                  {showCasePicker && (
                    <div className="absolute right-0 top-full mt-1 w-72 bg-dark-700 border border-dark-500 rounded-xl shadow-2xl z-30">
                      <div className="p-2 border-b border-dark-600">
                        <div className="relative">
                          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                          <input autoFocus className="input-field pl-8 py-1.5 text-sm w-full" placeholder="Search cases…"
                            value={casePickerSearch} onChange={e => setCasePickerSearch(e.target.value)} />
                        </div>
                      </div>
                      <div className="max-h-60 overflow-y-auto p-1">
                        {casePickerResults.length === 0 ? (
                          <div className="text-center py-4 text-gray-500 text-sm">
                            {allCases.length === 0 ? 'No cases in library yet' : 'All cases already added'}
                          </div>
                        ) : casePickerResults.map(cs => (
                          <button key={cs.id} onClick={() => addCaseToGear(cs)}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-dark-600 text-left transition-colors">
                            <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: cs.color || '#f59e0b' }} />
                            <span className="text-sm text-white truncate flex-1">{cs.name}</span>
                            {cs.sku && <span className="text-xs text-gray-500 shrink-0">{cs.sku}</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {(event.gear || []).length === 0 && (
                  <div className="card text-center py-10 text-gray-500">
                    <Package size={32} className="mx-auto mb-3 opacity-25" />
                    <p className="text-sm">No gear added yet.</p>
                    <p className="text-xs mt-1 text-gray-600">Click "+ Add Case" to add a case, then drag items from the left panel into it.</p>
                  </div>
                )}

                {/* Cases */}
                {eventCaseGear.map(g => {
                  const gearIdx = g._gearIdx
                  const isDrop = dropTarget?.type === 'case' && dropTarget?.gearIdx === gearIdx
                  const hasConflict = (g.items || []).some(ci => {
                    const a = availability.get(ci.item_id)
                    return a && a.available < (ci.qty || 1) * (g.quantity || 1)
                  })
                  return (
                    <div key={gearIdx}
                      className={`card p-0 overflow-hidden transition-all ${hasConflict ? 'border-red-500/30' : ''} ${isDrop ? 'border-amber-400/60 ring-1 ring-amber-400/20' : ''}`}
                      onDragOver={e => { e.preventDefault(); setDropTarget({ type: 'case', gearIdx }) }}
                      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDropTarget(null) }}
                      onDrop={e => handleDropItemOnCase(e, gearIdx)}
                    >
                      {/* Case header */}
                      <div className="flex items-center gap-2 px-4 py-2.5 bg-dark-800/60 border-b border-dark-600">
                        <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: g.color || '#f59e0b' }} />
                        <span className="text-sm font-semibold text-white flex-1 truncate">{g.name}</span>
                        <span className="text-xs text-gray-500">{g.length}×{g.width}×{g.height}" · {g.weight}lbs</span>
                        {hasConflict && <AlertTriangle size={13} className="text-red-400 shrink-0" />}
                        <span className="text-xs text-gray-500 ml-1">×</span>
                        <input type="number" min="1"
                          className="input-field text-sm py-1 w-14 text-center"
                          value={g.quantity || 1}
                          onChange={e => setGearQty(gearIdx, e.target.value)} />
                        <span className="text-xs text-gray-500">cases</span>
                        <button onClick={() => removeGear(gearIdx)} className="text-gray-600 hover:text-red-400 p-1 transition-colors ml-1"><X size={14} /></button>
                      </div>
                      {/* Items in this case */}
                      <div className="divide-y divide-dark-700">
                        {(g.items || []).map(ci => {
                          const a = availability.get(ci.item_id)
                          const conflict = a && a.available < (ci.qty || 1) * (g.quantity || 1)
                          return (
                            <div key={ci.item_id} className="flex items-center gap-2 px-4 py-2">
                              {ci.department_color && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ci.department_color }} />}
                              <span className={`text-sm flex-1 truncate ${conflict ? 'text-red-300' : 'text-white/80'}`}>{ci.name}</span>
                              {conflict && <span className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle size={10} />{a.available} avail</span>}
                              <span className="text-xs text-gray-500">qty</span>
                              <input type="number" min="1"
                                className="input-field text-sm py-1 w-16 text-center"
                                value={ci.qty || 1}
                                onChange={e => setCaseItemQty(gearIdx, ci.item_id, e.target.value)} />
                              <button onClick={() => removeItemFromCase(gearIdx, ci.item_id)} className="text-gray-600 hover:text-red-400 p-1 transition-colors"><X size={12} /></button>
                            </div>
                          )
                        })}
                        <div className={`px-4 py-2 text-xs transition-colors ${isDrop ? 'text-amber-400 bg-amber-500/10' : 'text-gray-600'}`}>
                          {isDrop ? '↓ Release to add item to this case' : (g.items?.length === 0 ? 'Drag items from the left panel into this case' : '+ drag more items here')}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Standalone Items drop zone + list */}
                <div className={`card p-0 overflow-hidden transition-all ${dropTarget?.type === 'standalone' ? 'border-blue-400/60 ring-1 ring-blue-400/20' : ''}`}
                  onDragOver={e => { e.preventDefault(); setDropTarget({ type: 'standalone' }) }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDropTarget(null) }}
                  onDrop={e => handleDropItemStandalone(e)}
                >
                  <div className="px-4 py-2 border-b border-dark-700 bg-dark-800/40">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Standalone Items</span>
                    <span className="text-xs text-gray-600 ml-2">(not in a case)</span>
                  </div>
                  {standaloneGear.length > 0 && (
                    <div className="divide-y divide-dark-700">
                      {standaloneGear.map(g => {
                        const gearIdx = g._gearIdx
                        const a = availability.get(g.item_id)
                        const conflict = a && a.available < (g.quantity || 1)
                        return (
                          <div key={g.item_id} className="flex items-center gap-2 px-4 py-2">
                            {g.department_color && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: g.department_color }} />}
                            <span className={`text-sm flex-1 truncate ${conflict ? 'text-red-300' : 'text-white/80'}`}>{g.name}</span>
                            {conflict && <span className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle size={10} />{a.available} avail</span>}
                            <span className="text-xs text-gray-500">qty</span>
                            <input type="number" min="1"
                              className="input-field text-sm py-1 w-16 text-center"
                              value={g.quantity || 1}
                              onChange={e => setGearQty(gearIdx, e.target.value)} />
                            <button onClick={() => removeGear(gearIdx)} className="text-gray-600 hover:text-red-400 p-1 transition-colors"><X size={12} /></button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <div className={`px-4 py-3 text-xs transition-colors ${dropTarget?.type === 'standalone' ? 'text-blue-400 bg-blue-500/10' : 'text-gray-600'}`}>
                    {dropTarget?.type === 'standalone' ? '↓ Release to add as standalone item' : 'Drag items here to add them without a case'}
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* FILES */}
        {tab === 'files' && (
          <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-white">Attached Files</h2>
                <p className="text-xs text-gray-500 mt-0.5">{(event.files?.length) || 0} file{(event.files?.length || 0) !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={attachFiles} className="btn-primary"><Paperclip size={14} /> Attach Files</button>
            </div>
            {!event.files?.length ? (
              <div className="card text-center py-12 text-gray-500">
                <FileText size={36} className="mx-auto mb-3 opacity-25" />
                <p>No files attached yet.</p>
                <p className="text-xs mt-1">Riders, stage plots, contracts, hotel confirmations…</p>
                <button onClick={attachFiles} className="btn-secondary mt-4 mx-auto"><Paperclip size={14} /> Attach Files</button>
              </div>
            ) : (
              <div className="space-y-2">
                {event.files.map(file => (
                  <div key={file.name} className="flex items-center gap-3 bg-dark-800 border border-dark-600 rounded-xl px-4 py-3">
                    <FileText size={18} className="text-gray-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{file.name}</div>
                      <div className="text-xs text-gray-500">
                        {file.size ? `${(file.size / 1024).toFixed(0)} KB` : ''}
                        {file.added_at ? ` · ${new Date(file.added_at).toLocaleDateString()}` : ''}
                      </div>
                    </div>
                    <button onClick={() => openFile(file.path)} className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-dark-700">Open</button>
                    <button onClick={() => removeFile(file.name)} className="text-gray-600 hover:text-red-400 p-1 transition-colors"><X size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* LOAD PLAN */}
        {tab === 'pack' && (
          <div className="max-w-lg">
            <div className="card text-center py-10">
              <Truck size={40} className="mx-auto mb-4 text-brand-primary/60" />
              <h3 className="text-lg font-semibold text-white mb-2">3D Load Planner</h3>
              <p className="text-gray-400 text-sm mb-1">
                Opens the Load Planner pre-loaded with this event&apos;s {event.gear.length} gear item type{event.gear.length !== 1 ? 's' : ''}{' '}
                ({gearUnits} unit{gearUnits !== 1 ? 's' : ''}).
              </p>
              {conflictGear.length > 0 && (
                <p className="text-red-400 text-xs mb-4">
                  ⚠ {conflictGear.length} item{conflictGear.length > 1 ? 's' : ''} have inventory conflicts — review Gear tab first.
                </p>
              )}
              {event.gear.length === 0 ? (
                <p className="text-yellow-400 text-xs mt-3">Add gear on the Gear tab first.</p>
              ) : (
                <button onClick={openInPlanner} className="btn-primary mx-auto mt-4">
                  <Truck size={14} /> Open in Load Planner
                </button>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ── Address Book Picker Modal ───────────────────────────────────── */}
      {abPicker && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-700 border border-dark-500 rounded-xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dark-500 shrink-0">
              <h2 className="font-semibold text-white">
                Choose {abPicker.section === 'customer' ? 'Customer' : abPicker.section === 'venue' ? 'Venue' : 'Hotel'}
              </h2>
              <button onClick={() => setAbPicker(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="px-5 pt-3 pb-2 shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                <input className="input-field pl-9" placeholder="Search…" value={abSearch} onChange={e => setAbSearch(e.target.value)} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-4">
              {abFiltered.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No entries found.</div>
              ) : (
                <div className="space-y-1">
                  {abFiltered.map(c => (
                    <button key={c.id} onClick={() => applyContact(c)} className="w-full text-left px-4 py-3 rounded-lg bg-dark-800 border border-dark-600 hover:border-brand-primary/40 hover:bg-dark-700 transition-colors">
                      <div className="font-medium text-white text-sm">{c.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {c.company && <span className="mr-2">{c.company}</span>}
                        {[c.city, c.state].filter(Boolean).join(', ')}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Past Event Import Picker ────────────────────────────────────── */}
      {importPicker && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-700 border border-dark-500 rounded-xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dark-500 shrink-0">
              <h2 className="font-semibold text-white">
                Import {importPicker.section.charAt(0).toUpperCase() + importPicker.section.slice(1)} from Past Event
              </h2>
              <button onClick={() => setImportPicker(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
              {pastEvents.map(ev => (
                <button key={ev.id} onClick={() => applyImport(ev, importPicker.section)} className="w-full text-left px-4 py-3 rounded-lg bg-dark-800 border border-dark-600 hover:border-brand-primary/40 hover:bg-dark-700 transition-colors">
                  <div className="font-medium text-white text-sm">{ev.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {ev.event_date && <span>{fmtDate(ev.event_date)} · </span>}
                    {importPicker.section === 'venue' && ev.venue_name && <span>{ev.venue_name}{ev.venue_city ? `, ${ev.venue_city}` : ''}</span>}
                    {importPicker.section === 'hotel' && ev.hotel_name && <span>{ev.hotel_name}</span>}
                    {importPicker.section === 'crew'  && (ev.crew?.length || 0) > 0 && <span>{ev.crew.length} crew members</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
