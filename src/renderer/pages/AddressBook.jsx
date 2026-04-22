import { useState, useEffect, useCallback } from 'react'
import { BookUser, Plus, Trash2, ChevronDown, ChevronUp, Search, X, MapPin, Building2, BedDouble, Phone, Mail, Globe, Users, User } from 'lucide-react'

const TABS = [
  { id: 'customer', label: 'Customers', Icon: User     },
  { id: 'venue',    label: 'Venues',    Icon: MapPin   },
  { id: 'hotel',    label: 'Hotels',    Icon: BedDouble },
  { id: 'crew',     label: 'Crew',      Icon: Users    },
]

const EMPTY_FORMS = {
  customer: { type: 'customer', name: '', company: '', phone: '', email: '', address: '', city: '', state: '', notes: '' },
  venue:    { type: 'venue',    name: '', address: '', city: '', state: '', contact_name: '', contact_phone: '', contact_email: '', load_in_notes: '', notes: '' },
  hotel:    { type: 'hotel',   name: '', address: '', city: '', state: '', phone: '', website: '', notes: '' },
  crew:     { type: 'crew',    name: '', role: '', phone: '', email: '', notes: '' },
}

const TAB_COLORS = {
  customer: { bg: 'bg-blue-500/15',   icon: 'text-blue-400' },
  venue:    { bg: 'bg-green-500/15',  icon: 'text-green-400' },
  hotel:    { bg: 'bg-purple-500/15', icon: 'text-purple-400' },
  crew:     { bg: 'bg-orange-500/15', icon: 'text-orange-400' },
}

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
    </div>
  )
}

export default function AddressBook() {
  const [entries, setEntries] = useState([])
  const [activeTab, setActiveTab] = useState('customer')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)   // null | 'new' | entry object
  const [form, setForm] = useState({})
  const [expanded, setExpanded] = useState(new Set())

  const load = async () => {
    if (!window.electronAPI?.addressBook) return
    setEntries(await window.electronAPI.addressBook.getAll())
  }

  useEffect(() => { load() }, [])

  const tabEntries = entries.filter(e => e.type === activeTab)
  const filtered = tabEntries.filter(e =>
    !search ||
    (e.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.company || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.city || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.contact_name || '').toLowerCase().includes(search.toLowerCase())
  )

  const openNew = () => { setForm({ ...EMPTY_FORMS[activeTab] }); setEditing('new') }
  const openEdit = (entry) => { setForm({ ...entry }); setEditing(entry) }
  const closeModal = () => setEditing(null)

  const save = useCallback(async () => {
    if (!form.name?.trim()) return
    await window.electronAPI.addressBook.save({ ...form, id: editing !== 'new' ? editing.id : undefined })
    closeModal()
    load()
  }, [form, editing])

  useEffect(() => {
    if (!editing) return
    const handler = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() }
      if (e.key === 'Escape') { e.preventDefault(); closeModal() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [editing, save])

  const del = async (id) => {
    if (!confirm('Delete this entry?')) return
    await window.electronAPI.addressBook.delete(id)
    load()
  }

  const toggleExpand = (id) => setExpanded(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const currentTabCfg = TABS.find(t => t.id === activeTab)
  const colors = TAB_COLORS[activeTab]

  return (
    <div className="p-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <BookUser size={21} className="text-gray-400" /> Address Book
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {tabEntries.length} {currentTabCfg?.label.toLowerCase()}
          </p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus size={14} /> Add {currentTabCfg?.label.slice(0, -1)}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-5 border-b border-dark-600">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => { setActiveTab(id); setSearch('') }}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === id ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'}`}
          >
            <Icon size={14} /> {label}
            <span className="ml-0.5 text-xs text-gray-600">({entries.filter(e => e.type === id).length})</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <input
          className="input-field pl-9"
          placeholder={`Search ${currentTabCfg?.label.toLowerCase()}…`}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <div className="card text-center py-14 text-gray-500">
          {activeTab === 'customer' && <User     size={36} className="mx-auto mb-3 opacity-25" />}
          {activeTab === 'venue'    && <MapPin    size={36} className="mx-auto mb-3 opacity-25" />}
          {activeTab === 'hotel'    && <BedDouble  size={36} className="mx-auto mb-3 opacity-25" />}
          {activeTab === 'crew'     && <Users      size={36} className="mx-auto mb-3 opacity-25" />}
          <p className="text-base">{search ? 'No matching entries.' : `No ${currentTabCfg?.label.toLowerCase()} yet.`}</p>
          <button onClick={openNew} className="btn-primary mt-4 mx-auto">
            <Plus size={14} /> Add {currentTabCfg?.label.slice(0, -1)}
          </button>
        </div>
      )}

      {/* Entries */}
      <div className="space-y-2">
        {filtered.map(entry => {
          const isExpanded = expanded.has(entry.id)
          return (
            <div key={entry.id} className="card overflow-hidden p-0">
              <div className="flex items-center gap-3 px-5 py-3.5">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colors.bg}`}>
                  {activeTab === 'customer' && <User      size={16} className={colors.icon} />}
                  {activeTab === 'venue'    && <MapPin     size={16} className={colors.icon} />}
                  {activeTab === 'hotel'    && <BedDouble  size={16} className={colors.icon} />}
                  {activeTab === 'crew'     && <Users      size={16} className={colors.icon} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white">{entry.name}</span>
                    {entry.company && <span className="text-xs text-gray-500">{entry.company}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
                    {(entry.city || entry.state) && (
                      <span className="flex items-center gap-1">
                        <MapPin size={10} /> {[entry.city, entry.state].filter(Boolean).join(', ')}
                      </span>
                    )}
                    {(entry.phone || entry.contact_phone) && (
                      <span className="flex items-center gap-1">
                        <Phone size={10} /> {entry.phone || entry.contact_phone}
                      </span>
                    )}
                    {(entry.email || entry.contact_email) && (
                      <span className="flex items-center gap-1 truncate max-w-[180px]">
                        <Mail size={10} /> {entry.email || entry.contact_email}
                      </span>
                    )}
                    {entry.role && (
                      <span className="text-orange-400/80">{entry.role}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => toggleExpand(entry.id)} className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-dark-600 transition-colors">
                    {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                  <button onClick={() => openEdit(entry)} className="p-1.5 text-gray-500 hover:text-brand-primary rounded-lg hover:bg-dark-600 transition-colors text-xs font-medium px-2">
                    Edit
                  </button>
                  <button onClick={() => del(entry.id)} className="p-1.5 text-gray-600 hover:text-red-400 rounded-lg hover:bg-dark-600 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-dark-600/50 px-5 py-4 bg-dark-800/40">
                  <div className="grid grid-cols-2 gap-4 text-xs lg:grid-cols-3">
                    {entry.address && <div><span className="text-gray-500">Address: </span><span className="text-gray-200">{entry.address}</span></div>}
                    {(entry.contact_name) && <div><span className="text-gray-500">Contact: </span><span className="text-gray-200">{entry.contact_name}</span></div>}
                    {entry.load_in_notes && <div className="col-span-2"><span className="text-gray-500">Load-in Notes: </span><span className="text-gray-200">{entry.load_in_notes}</span></div>}
                    {entry.website && <div><span className="text-gray-500">Website: </span><a href="#" className="text-brand-primary">{entry.website}</a></div>}
                    {entry.notes && <div className="col-span-2 lg:col-span-3"><span className="text-gray-500">Notes: </span><span className="text-gray-300 italic">{entry.notes}</span></div>}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal */}
      {editing !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-700 border border-dark-500 rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dark-500 shrink-0">
              <h2 className="font-semibold text-white">
                {editing === 'new' ? 'Add' : 'Edit'} {currentTabCfg?.label.slice(0, -1)}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4">
              {/* CUSTOMER fields */}
              {activeTab === 'customer' && (<>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Full Name *"><input className="input-field" value={form.name||''} onChange={e=>set('name',e.target.value)} placeholder="Full name" /></Field>
                  <Field label="Company"><input className="input-field" value={form.company||''} onChange={e=>set('company',e.target.value)} placeholder="Company name" /></Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Phone"><input className="input-field" value={form.phone||''} onChange={e=>set('phone',e.target.value)} /></Field>
                  <Field label="Email"><input className="input-field" value={form.email||''} onChange={e=>set('email',e.target.value)} /></Field>
                </div>
                <Field label="Address"><input className="input-field" value={form.address||''} onChange={e=>set('address',e.target.value)} /></Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="City"><input className="input-field" value={form.city||''} onChange={e=>set('city',e.target.value)} /></Field>
                  <Field label="State"><input className="input-field" value={form.state||''} onChange={e=>set('state',e.target.value)} /></Field>
                </div>
                <Field label="General Notes"><textarea className="input-field min-h-[80px]" value={form.notes||''} onChange={e=>set('notes',e.target.value)} /></Field>
              </>)}

              {/* VENUE fields */}
              {activeTab === 'venue' && (<>
                <Field label="Venue Name *"><input className="input-field" value={form.name||''} onChange={e=>set('name',e.target.value)} placeholder="Venue name" /></Field>
                <Field label="Address"><input className="input-field" value={form.address||''} onChange={e=>set('address',e.target.value)} /></Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="City"><input className="input-field" value={form.city||''} onChange={e=>set('city',e.target.value)} /></Field>
                  <Field label="State"><input className="input-field" value={form.state||''} onChange={e=>set('state',e.target.value)} /></Field>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Contact Name"><input className="input-field" value={form.contact_name||''} onChange={e=>set('contact_name',e.target.value)} /></Field>
                  <Field label="Contact Phone"><input className="input-field" value={form.contact_phone||''} onChange={e=>set('contact_phone',e.target.value)} /></Field>
                  <Field label="Contact Email"><input className="input-field" value={form.contact_email||''} onChange={e=>set('contact_email',e.target.value)} /></Field>
                </div>
                <Field label="Load-in Notes"><textarea className="input-field min-h-[70px]" value={form.load_in_notes||''} onChange={e=>set('load_in_notes',e.target.value)} /></Field>
                <Field label="General Notes"><textarea className="input-field min-h-[70px]" value={form.notes||''} onChange={e=>set('notes',e.target.value)} /></Field>
              </>)}

              {/* HOTEL fields */}
              {activeTab === 'hotel' && (<>
                <Field label="Hotel Name *"><input className="input-field" value={form.name||''} onChange={e=>set('name',e.target.value)} placeholder="Hotel name" /></Field>
                <Field label="Address"><input className="input-field" value={form.address||''} onChange={e=>set('address',e.target.value)} /></Field>
                <div className="grid grid-cols-3 gap-4">
                  <Field label="City"><input className="input-field" value={form.city||''} onChange={e=>set('city',e.target.value)} /></Field>
                  <Field label="State"><input className="input-field" value={form.state||''} onChange={e=>set('state',e.target.value)} /></Field>
                  <Field label="Phone"><input className="input-field" value={form.phone||''} onChange={e=>set('phone',e.target.value)} /></Field>
                </div>
                <Field label="Website"><input className="input-field" value={form.website||''} onChange={e=>set('website',e.target.value)} placeholder="https://..." /></Field>
                <Field label="Notes"><textarea className="input-field min-h-[80px]" value={form.notes||''} onChange={e=>set('notes',e.target.value)} /></Field>
              </>) }

              {/* CREW fields */}
              {activeTab === 'crew' && (<>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Full Name *"><input className="input-field" value={form.name||''} onChange={e=>set('name',e.target.value)} placeholder="Full name" autoFocus /></Field>
                  <Field label="Role"><input className="input-field" value={form.role||''} onChange={e=>set('role',e.target.value)} placeholder="e.g. Audio Engineer" /></Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Phone"><input className="input-field" value={form.phone||''} onChange={e=>set('phone',e.target.value)} /></Field>
                  <Field label="Email"><input className="input-field" value={form.email||''} onChange={e=>set('email',e.target.value)} /></Field>
                </div>
                <Field label="Notes"><textarea className="input-field min-h-[80px]" value={form.notes||''} onChange={e=>set('notes',e.target.value)} placeholder="Optional notes…" /></Field>
              </>)}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-dark-500 shrink-0">
              <button onClick={closeModal} className="btn-secondary">Cancel</button>
              <button onClick={save} className="btn-primary" disabled={!form.name?.trim()}>
                {editing === 'new' ? 'Create' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
