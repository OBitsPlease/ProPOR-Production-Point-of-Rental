import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Wrench, Search, Plus, Trash2, X, Save, ChevronUp, ChevronDown,
  Paperclip, FileImage, FileText, ExternalLink, Calendar, DollarSign,
  User, Package, LayoutList, AlertCircle, AlertTriangle,
} from 'lucide-react'

const EMPTY_FORM = {
  asset_type: 'item',
  asset_id: null,
  asset_name: '',
  asset_sku: '',
  asset_department: '',
  start_date: '',
  end_date: '',
  notes: '',
  technician: '',
  cost: '',
  out_of_service: false,
}

const SORT_OPTIONS = [
  { key: 'start_date', label: 'Start Date' },
  { key: 'end_date',   label: 'End Date' },
  { key: 'technician', label: 'Technician' },
  { key: 'asset_department', label: 'Department' },
  { key: 'asset_name', label: 'Asset Name' },
  { key: 'cost',       label: 'Cost' },
]

function formatDate(d) {
  if (!d) return '—'
  const dt = new Date(d + (d.includes('T') ? '' : 'T00:00:00'))
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCost(c) {
  if (c == null || c === '' || c === 0) return '—'
  return '$' + Number(c).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fileIcon(name) {
  const ext = (name || '').split('.').pop().toLowerCase()
  if (['jpg','jpeg','png','gif','webp','heic'].includes(ext)) return <FileImage size={13} />
  return <FileText size={13} />
}

export default function Repairs() {
  // Data
  const [repairs, setRepairs] = useState([])
  const [items, setItems] = useState([])
  const [cases, setCases] = useState([])

  // Search / asset picker
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const searchRef = useRef(null)

  // Modal state
  const [modal, setModal] = useState(null)  // null | 'new' | repair-object
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Table sort
  const [sortKey, setSortKey] = useState('start_date')
  const [sortDir, setSortDir] = useState('desc')

  // Filter by department/technician
  const [filterTech, setFilterTech] = useState('')
  const [filterDept, setFilterDept] = useState('')

  const load = useCallback(async () => {
    if (!window.electronAPI) return
    const [r, i, c] = await Promise.all([
      window.electronAPI.repairs.getAll(),
      window.electronAPI.getItems(),
      window.electronAPI.cases.getAll(),
    ])
    setRepairs(r || [])
    setItems(i || [])
    setCases(c || [])
  }, [])

  useEffect(() => { load() }, [load])

  // Live search across items + cases
  useEffect(() => {
    const q = search.trim().toLowerCase()
    if (!q) { setSearchResults([]); return }
    const matched = []
    for (const item of items) {
      if (
        item.name?.toLowerCase().includes(q) ||
        item.sku?.toLowerCase().includes(q) ||
        item.serial?.toLowerCase().includes(q) ||
        item.department_name?.toLowerCase().includes(q)
      ) {
        matched.push({ type: 'item', id: item.id, name: item.name, sku: item.sku || '', department: item.department_name || '' })
      }
    }
    for (const c of cases) {
      if (
        c.name?.toLowerCase().includes(q) ||
        c.sku?.toLowerCase().includes(q)
      ) {
        matched.push({ type: 'case', id: c.id, name: c.name, sku: c.sku || '', department: '' })
      }
    }
    setSearchResults(matched.slice(0, 30))
  }, [search, items, cases])

  const selectAsset = (asset) => {
    const assetRecord = asset.type === 'item'
      ? items.find(i => i.id === asset.id)
      : cases.find(c => c.id === asset.id)
    setForm({
      ...EMPTY_FORM,
      asset_type: asset.type,
      asset_id: asset.id,
      asset_name: asset.name,
      asset_sku: asset.sku,
      asset_department: asset.department,
      out_of_service: assetRecord?.out_of_service ? true : false,
      start_date: new Date().toISOString().slice(0, 10),
    })
    setSearch('')
    setSearchResults([])
    setModal('new')
  }

  const openEdit = (repair) => {
    setForm({
      ...repair,
      cost: repair.cost != null ? String(repair.cost) : '',
    })
    setModal(repair)
  }

  const closeModal = () => { setModal(null); setForm(EMPTY_FORM) }

  const saveRepair = async () => {
    if (!form.asset_name) return
    setSaving(true)
    const payload = {
      ...form,
      cost: form.cost !== '' ? parseFloat(form.cost) || 0 : 0,
      id: modal !== 'new' ? modal.id : undefined,
    }
    await window.electronAPI.repairs.save(payload)
    // Sync out_of_service status to the linked asset
    if (form.asset_id) {
      const oos = form.out_of_service ? 1 : 0
      if (form.asset_type === 'item') {
        await window.electronAPI.saveItem({ id: form.asset_id, out_of_service: oos })
      } else {
        await window.electronAPI.cases.save({ id: form.asset_id, out_of_service: oos })
      }
    }
    setSaving(false)
    closeModal()
    load()
  }

  const deleteRepair = async (id) => {
    if (!confirm('Delete this repair record? This cannot be undone.')) return
    await window.electronAPI.repairs.delete(id)
    load()
  }

  const attachFile = async (repairId) => {
    const attached = await window.electronAPI.repairs.attachFile(repairId)
    if (attached) load()
  }

  const removeFile = async (repairId, fileName) => {
    if (!confirm(`Remove "${fileName}"?`)) return
    await window.electronAPI.repairs.removeFile(repairId, fileName)
    load()
  }

  const openFile = (filePath) => window.electronAPI.repairs.openFile(filePath)

  // Attach from inside a modal (unsaved repair — save first, then attach)
  const attachFromModal = async () => {
    if (modal === 'new') {
      // Must save first to get an id
      await saveRepair()
      // After save, the modal closes, so the user can then re-open and attach
      // Better UX: save silently and re-open
      return
    }
    const attached = await window.electronAPI.repairs.attachFile(modal.id)
    if (attached) {
      const updated = repairs.find(r => r.id === modal.id)
      if (updated) {
        const fresh = await window.electronAPI.repairs.getAll()
        setRepairs(fresh || [])
        const r = fresh.find(r => r.id === modal.id)
        if (r) setForm({ ...r, cost: r.cost != null ? String(r.cost) : '' })
      }
    }
  }

  // Sort and filter
  const technicians = [...new Set(repairs.map(r => r.technician).filter(Boolean))].sort()
  const departments = [...new Set(repairs.map(r => r.asset_department).filter(Boolean))].sort()

  const sorted = [...repairs]
    .filter(r => (!filterTech || r.technician === filterTech) && (!filterDept || r.asset_department === filterDept))
    .sort((a, b) => {
      const va = a[sortKey] ?? ''
      const vb = b[sortKey] ?? ''
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const SortIcon = ({ k }) => {
    if (sortKey !== k) return <ChevronUp size={12} className="text-gray-600" />
    return sortDir === 'asc' ? <ChevronUp size={12} className="text-brand-primary" /> : <ChevronDown size={12} className="text-brand-primary" />
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-dark-600 shrink-0">
        <div className="flex items-center gap-3">
          <Wrench size={20} className="text-brand-primary" />
          <h1 className="text-lg font-semibold text-white">Repairs</h1>
          <span className="text-xs text-gray-500 bg-dark-700 px-2 py-0.5 rounded-full">
            {repairs.length} record{repairs.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">

        {/* Search / Asset Picker */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Plus size={15} className="text-brand-primary" />
            <span className="text-sm font-semibold text-white">Log New Repair</span>
            <span className="text-xs text-gray-500">Search for an item or case to begin</span>
          </div>
          <div className="relative" ref={searchRef}>
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              className="input-field pl-9 w-full"
              placeholder="Scan barcode · type item name · case name · serial · SKU..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
            {search && (
              <button
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                onClick={() => { setSearch(''); setSearchResults([]) }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="mt-2 border border-dark-500 rounded-lg overflow-hidden">
              {searchResults.map(asset => (
                <button
                  key={`${asset.type}-${asset.id}`}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-dark-600 transition-colors border-b border-dark-600 last:border-0"
                  onClick={() => selectAsset(asset)}
                >
                  <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${
                    asset.type === 'item'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  }`}>
                    {asset.type === 'item' ? 'Item' : 'Case'}
                  </span>
                  <span className="text-sm text-white font-medium flex-1">{asset.name}</span>
                  {asset.sku && <span className="text-xs font-mono text-gray-500">{asset.sku}</span>}
                  {asset.department && <span className="text-xs text-gray-500">{asset.department}</span>}
                </button>
              ))}
            </div>
          )}

          {search.trim() && searchResults.length === 0 && (
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-500 px-1">
              <AlertCircle size={14} />
              No items or cases match "{search}"
            </div>
          )}
        </div>

        {/* Filters + Sort bar */}
        {repairs.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-gray-500 font-medium">Filter:</span>
            <select
              className="bg-dark-700 border border-dark-500 rounded-lg text-sm text-gray-300 px-3 py-1.5"
              value={filterTech}
              onChange={e => setFilterTech(e.target.value)}
            >
              <option value="">All Technicians</option>
              {technicians.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              className="bg-dark-700 border border-dark-500 rounded-lg text-sm text-gray-300 px-3 py-1.5"
              value={filterDept}
              onChange={e => setFilterDept(e.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            {(filterTech || filterDept) && (
              <button className="text-xs text-gray-500 hover:text-white" onClick={() => { setFilterTech(''); setFilterDept('') }}>
                Clear filters
              </button>
            )}
            <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
              Sort by:
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  className={`px-2 py-1 rounded ${sortKey === opt.key ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/30' : 'hover:text-gray-300'}`}
                  onClick={() => toggleSort(opt.key)}
                >
                  {opt.label}
                  {sortKey === opt.key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Repairs log */}
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-gray-600">
            <Wrench size={40} className="opacity-30" />
            <p className="text-sm">No repair records yet.</p>
            <p className="text-xs">Search for an item or case above to log your first repair.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map(repair => (
              <RepairCard
                key={repair.id}
                repair={repair}
                onEdit={() => openEdit(repair)}
                onDelete={() => deleteRepair(repair.id)}
                onAttach={() => attachFile(repair.id)}
                onRemoveFile={(name) => removeFile(repair.id, name)}
                onOpenFile={openFile}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal !== null && (
        <RepairModal
          form={form}
          setForm={setForm}
          isNew={modal === 'new'}
          onSave={saveRepair}
          onClose={closeModal}
          onAttach={attachFromModal}
          onRemoveFile={(name) => {
            if (modal !== 'new') removeFile(modal.id, name)
          }}
          onOpenFile={openFile}
          saving={saving}
        />
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function RepairCard({ repair, onEdit, onDelete, onAttach, onRemoveFile, onOpenFile }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
      {/* Card header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Asset type badge */}
        <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${
          repair.asset_type === 'item'
            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
        }`}>
          {repair.asset_type === 'item' ? 'Item' : 'Case'}
        </span>

        {/* Asset name */}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-white truncate block">{repair.asset_name}</span>
          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
            {repair.asset_sku && <span className="font-mono">{repair.asset_sku}</span>}
            {repair.asset_department && <span>{repair.asset_department}</span>}
          </div>
        </div>

        {/* Dates */}
        <div className="text-xs text-gray-400 text-right shrink-0">
          <div className="flex items-center gap-1">
            <Calendar size={11} />
            {formatDate(repair.start_date)}
            {repair.end_date && repair.end_date !== repair.start_date && (
              <span className="text-gray-600">→ {formatDate(repair.end_date)}</span>
            )}
          </div>
          {repair.technician && (
            <div className="flex items-center gap-1 mt-0.5 justify-end">
              <User size={11} />
              {repair.technician}
            </div>
          )}
        </div>

        {/* Cost */}
        {repair.cost > 0 && (
          <span className="shrink-0 text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded">
            {formatCost(repair.cost)}
          </span>
        )}

        {/* Out of Service badge */}
        {!!repair.out_of_service && (
          <span className="shrink-0 flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 font-semibold">
            <AlertTriangle size={10} />
            OOS
          </span>
        )}

        {/* Attachment count */}
        {(repair.files || []).length > 0 && (
          <span className="shrink-0 flex items-center gap-1 text-xs text-gray-500">
            <Paperclip size={11} />
            {repair.files.length}
          </span>
        )}

        {/* Actions */}
        <button
          className="shrink-0 p-1.5 rounded hover:bg-dark-600 text-gray-500 hover:text-blue-400 transition-colors"
          title="Edit"
          onClick={onEdit}
        >
          <Wrench size={14} />
        </button>
        <button
          className="shrink-0 p-1.5 rounded hover:bg-dark-600 text-gray-500 hover:text-red-400 transition-colors"
          title="Delete"
          onClick={onDelete}
        >
          <Trash2 size={14} />
        </button>
        <button
          className="shrink-0 p-1.5 rounded hover:bg-dark-600 text-gray-500 hover:text-white transition-colors"
          onClick={() => setExpanded(e => !e)}
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-dark-600 px-4 py-3 space-y-3">
          {repair.notes && (
            <div>
              <div className="text-xs text-gray-500 font-medium mb-1">Notes</div>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{repair.notes}</p>
            </div>
          )}
          {/* Files */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-gray-500 font-medium">Attachments</div>
              <button
                className="flex items-center gap-1.5 text-xs text-brand-primary hover:text-blue-300 transition-colors"
                onClick={onAttach}
              >
                <Paperclip size={12} />
                Add Files
              </button>
            </div>
            {(repair.files || []).length === 0 ? (
              <p className="text-xs text-gray-600">No attachments</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {repair.files.map(f => (
                  <div key={f.name} className="flex items-center gap-1.5 bg-dark-700 border border-dark-500 rounded px-2 py-1 text-xs text-gray-300">
                    {fileIcon(f.name)}
                    <button
                      className="hover:text-white transition-colors max-w-[160px] truncate"
                      onClick={() => onOpenFile(f.path)}
                      title={f.name}
                    >
                      {f.name}
                    </button>
                    <button
                      className="ml-1 text-gray-600 hover:text-red-400 transition-colors"
                      onClick={() => onRemoveFile(f.name)}
                      title="Remove"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function RepairModal({ form, setForm, isNew, onSave, onClose, onAttach, onRemoveFile, onOpenFile, saving }) {
  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-dark-700 border border-dark-500 rounded-xl w-full max-w-2xl shadow-2xl max-h-[92vh] overflow-y-auto flex flex-col">
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-500 shrink-0">
          <div className="flex items-center gap-3">
            <Wrench size={16} className="text-brand-primary" />
            <h2 className="font-semibold text-white">
              {isNew ? 'Log New Repair' : 'Edit Repair Record'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 flex-1">
          {/* Linked asset (read-only) */}
          <div className="bg-dark-800 rounded-lg p-3 flex items-center gap-3 border border-dark-500">
            {form.asset_type === 'item' ? (
              <Package size={15} className="text-blue-400 shrink-0" />
            ) : (
              <LayoutList size={15} className="text-purple-400 shrink-0" />
            )}
            <div>
              <div className="text-sm font-semibold text-white">{form.asset_name}</div>
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                  form.asset_type === 'item'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                }`}>
                  {form.asset_type === 'item' ? 'Item' : 'Case'}
                </span>
                {form.asset_sku && <span className="font-mono">{form.asset_sku}</span>}
                {form.asset_department && <span>{form.asset_department}</span>}
              </div>
            </div>
          </div>

          {/* Dates row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Repair Start Date</label>
              <input
                type="date"
                className="input-field"
                value={form.start_date}
                onChange={e => set('start_date', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Repair End Date</label>
              <input
                type="date"
                className="input-field"
                value={form.end_date}
                onChange={e => set('end_date', e.target.value)}
              />
            </div>
          </div>

          {/* Technician + Cost row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label flex items-center gap-1.5">
                <User size={12} /> Technician Name
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. John Smith"
                value={form.technician}
                onChange={e => set('technician', e.target.value)}
              />
            </div>
            <div>
              <label className="label flex items-center gap-1.5">
                <DollarSign size={12} /> Repair Cost
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input-field pl-7"
                  placeholder="0.00"
                  value={form.cost}
                  onChange={e => set('cost', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Job Notes */}
          <div>
            <label className="label">Repair Job Notes</label>
            <textarea
              className="input-field resize-none"
              rows={5}
              placeholder="Describe the repair work performed, parts replaced, observations..."
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>

          {/* Out of Service */}
          <label className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 cursor-pointer hover:bg-red-500/15 transition-colors select-none">
            <input
              type="checkbox"
              className="mt-0.5 w-4 h-4 accent-red-500 shrink-0"
              checked={!!form.out_of_service}
              onChange={e => set('out_of_service', e.target.checked)}
            />
            <div>
              <div className="text-sm font-semibold text-red-400 flex items-center gap-1.5">
                <AlertTriangle size={14} />
                Mark as Out of Service
              </div>
              <div className="text-xs text-gray-500 mt-0.5">Temporarily removes this asset from usable inventory. Uncheck when repaired to restore availability.</div>
            </div>
          </label>

          {/* File attachments (only for existing repairs) */}
          {!isNew && (
            <div className="border-t border-dark-500 pt-4">
              <div className="flex items-center justify-between mb-3">
                <label className="label mb-0 flex items-center gap-1.5">
                  <Paperclip size={12} /> Images &amp; Receipts
                </label>
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-xs text-brand-primary hover:text-blue-300 transition-colors"
                  onClick={onAttach}
                >
                  <Paperclip size={12} />
                  Attach Files
                </button>
              </div>
              {(form.files || []).length === 0 ? (
                <p className="text-xs text-gray-600">No attachments — click "Attach Files" to add images or receipts.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(form.files || []).map(f => (
                    <div key={f.name} className="flex items-center gap-1.5 bg-dark-800 border border-dark-500 rounded px-2 py-1 text-xs text-gray-300">
                      {fileIcon(f.name)}
                      <button
                        className="hover:text-white transition-colors max-w-[160px] truncate"
                        onClick={() => onOpenFile(f.path)}
                        title={f.name}
                      >
                        {f.name}
                      </button>
                      <ExternalLink size={10} className="text-gray-600" />
                      <button
                        className="ml-1 text-gray-600 hover:text-red-400 transition-colors"
                        onClick={() => onRemoveFile(f.name)}
                        title="Remove"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isNew && (
            <p className="text-xs text-gray-600 flex items-center gap-1.5">
              <Paperclip size={11} />
              You can attach images &amp; receipts after saving this record.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-dark-500 shrink-0">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={onSave}
            className="btn-primary flex items-center gap-1.5"
            disabled={saving || !form.asset_name}
          >
            <Save size={14} />
            {isNew ? 'Save Repair' : 'Update Repair'}
          </button>
        </div>
      </div>
    </div>
  )
}
