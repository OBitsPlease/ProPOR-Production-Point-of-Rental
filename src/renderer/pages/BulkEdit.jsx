import { useState, useEffect, useMemo, useCallback } from 'react'
import { Layers } from 'lucide-react'

const BOOL_OPTIONS = [
  { value: '', label: 'No change' },
  { value: '1', label: 'Yes' },
  { value: '0', label: 'No' },
]

const ITEM_DEFAULTS   = { department_id:'', group_id:'', length:'', width:'', height:'', weight:'', quantity:'', can_rotate_lr:'', can_tip_side:'', can_flip:'', can_stack_on_others:'', allow_stacking_on_top:'', max_stack_weight:'', notes:'' }
const CASE_DEFAULTS   = { group_id:'', color:'', length:'', width:'', height:'', weight:'', can_rotate_lr:'', can_tip_side:'', can_flip:'', can_stack_on_others:'', allow_stacking_on_top:'', max_stack_weight:'', max_stack_qty:'', notes:'' }
const TRUCK_DEFAULTS  = { length:'', width:'', height:'', max_weight:'', unit:'', notes:'' }

function normalize(name) { return (name || '').trim().toLowerCase() }

function buildNameList(records) {
  const map = new Map()
  for (const r of records || []) {
    const key = normalize(r.name)
    if (!key) continue
    if (!map.has(key)) map.set(key, { key, label: r.name.trim(), count: 0 })
    map.get(key).count++
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label))
}

function BoolSelect({ label, value, onChange }) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input-field" value={value} onChange={e => onChange(e.target.value)}>
        {BOOL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

export default function BulkEdit() {
  const [items,   setItems]   = useState([])
  const [cases,   setCases]   = useState([])
  const [trucks,  setTrucks]  = useState([])
  const [depts,   setDepts]   = useState([])
  const [groups,  setGroups]  = useState([])
  const [mode,    setMode]    = useState('cases')       // 'items' | 'cases' | 'trucks'
  const [searchN, setSearchN] = useState('')
  const [checked, setChecked] = useState(new Set())
  const [iFields, setIFields] = useState(ITEM_DEFAULTS)
  const [cFields, setCFields] = useState(CASE_DEFAULTS)
  const [tFields, setTFields] = useState(TRUCK_DEFAULTS)
  const [result,  setResult]  = useState(null)
  const [saving,  setSaving]  = useState(false)

  const load = useCallback(async () => {
    if (!window.electronAPI) return
    const [its, css, tks, dps, grps] = await Promise.all([
      window.electronAPI.getItems(),
      window.electronAPI.cases?.getAll() ?? [],
      window.electronAPI.getTrucks(),
      window.electronAPI.getDepartments(),
      window.electronAPI.groups?.getAll() ?? [],
    ])
    setItems(its); setCases(css); setTrucks(tks); setDepts(dps); setGroups(grps)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { setChecked(new Set()); setSearchN(''); setResult(null) }, [mode])

  const records = useMemo(() => mode === 'items' ? items : mode === 'cases' ? cases : trucks, [mode, items, cases, trucks])
  const nameList = useMemo(() => buildNameList(records), [records])
  const filtered = useMemo(() => {
    const q = searchN.trim().toLowerCase()
    return q ? nameList.filter(n => n.label.toLowerCase().includes(q)) : nameList
  }, [nameList, searchN])

  const selectedCount = useMemo(() => {
    if (checked.size === 0) return 0
    return records.filter(r => checked.has(normalize(r.name))).length
  }, [records, checked])

  const toggle = (key) => setChecked(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })

  const toggleAll = () => {
    const keys = filtered.map(n => n.key)
    if (keys.length && keys.every(k => checked.has(k))) { setChecked(new Set()); return }
    setChecked(new Set(keys))
  }

  const buildPatch = () => {
    const source = mode === 'items' ? iFields : mode === 'cases' ? cFields : tFields
    const patch = {}
    const numFields = mode === 'trucks'
      ? ['length','width','height','max_weight']
      : ['length','width','height','weight','quantity','max_stack_weight','max_stack_qty']
    for (const [k, v] of Object.entries(source)) {
      if (v === '') continue
      if (['can_rotate_lr','can_tip_side','can_flip','can_stack_on_others','allow_stacking_on_top'].includes(k)) {
        patch[k] = parseInt(v, 10); continue
      }
      if (['department_id','group_id'].includes(k)) {
        patch[k] = v === 'null' ? null : parseInt(v, 10); continue
      }
      if (numFields.includes(k)) {
        const n = parseFloat(v); if (!isNaN(n)) patch[k] = n; continue
      }
      patch[k] = v
    }
    return patch
  }

  const applyBulk = async () => {
    if (!window.electronAPI || checked.size === 0 || saving) return
    const patch = buildPatch()
    if (Object.keys(patch).length === 0) { setResult({ type: 'error', message: 'Choose at least one field to update.' }); return }
    const targets = records.filter(r => checked.has(normalize(r.name)))
    if (targets.length === 0) { setResult({ type: 'error', message: 'No matching records selected.' }); return }
    setSaving(true); setResult(null)
    try {
      if (mode === 'items')  await Promise.all(targets.map(r => window.electronAPI.saveItem({ ...r, ...patch, id: r.id })))
      if (mode === 'cases')  await Promise.all(targets.map(r => window.electronAPI.cases.save({ ...r, ...patch, id: r.id })))
      if (mode === 'trucks') await Promise.all(targets.map(r => window.electronAPI.saveTruck({ ...r, ...patch, id: r.id })))
      await load()
      setResult({ type: 'success', message: `Updated ${targets.length} ${mode}.` })
    } catch (err) {
      setResult({ type: 'error', message: err?.message || 'Bulk edit failed.' })
    } finally {
      setSaving(false)
    }
  }

  const ModeBtn = ({ id, label }) => (
    <button
      onClick={() => setMode(id)}
      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${mode === id ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/30' : 'bg-dark-600 text-gray-300 border border-dark-500 hover:bg-dark-500'}`}
    >
      {label}
    </button>
  )

  const iSet = (k, v) => setIFields(f => ({ ...f, [k]: v }))
  const cSet = (k, v) => setCFields(f => ({ ...f, [k]: v }))
  const tSet = (k, v) => setTFields(f => ({ ...f, [k]: v }))

  return (
    <div className="p-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Layers size={22} /> Bulk Edit
          </h1>
          <p className="text-gray-400 text-sm mt-1">Select one or more names and apply edits to every matching record.</p>
        </div>
        <div className="flex gap-2">
          <ModeBtn id="cases"  label="Cases" />
          <ModeBtn id="items"  label="Items" />
          <ModeBtn id="trucks" label="Truck Profiles" />
        </div>
      </div>

      {/* Result Banner */}
      {result && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm border ${result.type === 'success' ? 'bg-green-900/30 text-green-300 border-green-700/40' : 'bg-red-900/30 text-red-300 border-red-700/40'}`}>
          {result.message}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-4">
        {/* Name selector */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold">Names</h2>
            <button onClick={toggleAll} className="text-xs text-blue-300 hover:text-blue-200">Toggle all visible</button>
          </div>
          <input className="input-field" value={searchN} onChange={e => setSearchN(e.target.value)} placeholder="Search names..." />
          <div className="text-xs text-gray-500">{filtered.length} names</div>
          <div className="max-h-[58vh] overflow-y-auto pr-1 space-y-1">
            {filtered.map(n => (
              <label key={n.key} className="flex items-center justify-between gap-3 px-2 py-2 rounded hover:bg-dark-600/40 cursor-pointer">
                <span className="flex items-center gap-2 min-w-0">
                  <input type="checkbox" className="accent-blue-500" checked={checked.has(n.key)} onChange={() => toggle(n.key)} />
                  <span className="text-sm text-gray-200 truncate">{n.label}</span>
                </span>
                <span className="text-xs text-gray-500 shrink-0">{n.count}</span>
              </label>
            ))}
            {!filtered.length && <div className="text-sm text-gray-500 py-4 text-center">No matching names.</div>}
          </div>
        </div>

        {/* Fields */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-white font-semibold">Fields to update</h2>
              <p className="text-xs text-gray-500 mt-1">Only fields you fill out will be changed.</p>
            </div>
            <div className="text-sm text-gray-300">
              Selected records: <span className="font-semibold text-white">{selectedCount}</span>
            </div>
          </div>

          {/* ITEMS fields */}
          {mode === 'items' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="label">Department</label>
                  <select className="input-field" value={iFields.department_id} onChange={e => iSet('department_id', e.target.value)}>
                    <option value="">No change</option>
                    <option value="null">Unassigned</option>
                    {depts.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Group</label>
                  <select className="input-field" value={iFields.group_id} onChange={e => iSet('group_id', e.target.value)}>
                    <option value="">No change</option>
                    <option value="null">Unassigned</option>
                    {groups.map(g => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[['Length (in)','length'],['Width (in)','width'],['Height (in)','height'],['Weight (lbs)','weight']].map(([l,k]) => (
                  <div key={k}><label className="label">{l}</label><input className="input-field" type="number" min="0" value={iFields[k]} onChange={e => iSet(k, e.target.value)} placeholder="No change" /></div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div><label className="label">Quantity</label><input className="input-field" type="number" min="1" value={iFields.quantity} onChange={e => iSet('quantity', e.target.value)} placeholder="No change" /></div>
                <div><label className="label">Max Stack Weight</label><input className="input-field" type="number" min="0" value={iFields.max_stack_weight} onChange={e => iSet('max_stack_weight', e.target.value)} placeholder="No change" /></div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <BoolSelect label="Can Rotate"           value={iFields.can_rotate_lr}        onChange={v => iSet('can_rotate_lr', v)} />
                <BoolSelect label="Can Tip Side"         value={iFields.can_tip_side}          onChange={v => iSet('can_tip_side', v)} />
                <BoolSelect label="Can Flip"             value={iFields.can_flip}              onChange={v => iSet('can_flip', v)} />
                <BoolSelect label="Can Stack on Others"  value={iFields.can_stack_on_others}   onChange={v => iSet('can_stack_on_others', v)} />
                <BoolSelect label="Allow Stacking on Top" value={iFields.allow_stacking_on_top} onChange={v => iSet('allow_stacking_on_top', v)} />
              </div>
              <div><label className="label">Notes</label><textarea className="input-field" value={iFields.notes} onChange={e => iSet('notes', e.target.value)} placeholder="No change" /></div>
            </div>
          )}

          {/* CASES fields */}
          {mode === 'cases' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="label">Group</label>
                  <select className="input-field" value={cFields.group_id} onChange={e => cSet('group_id', e.target.value)}>
                    <option value="">No change</option>
                    <option value="null">Unassigned</option>
                    {groups.map(g => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
                  </select>
                </div>
                <div><label className="label">Color</label><input className="input-field" value={cFields.color} onChange={e => cSet('color', e.target.value)} placeholder="No change (e.g. #5b21b6)" /></div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[['Length (in)','length'],['Width (in)','width'],['Height (in)','height'],['Weight (lbs)','weight']].map(([l,k]) => (
                  <div key={k}><label className="label">{l}</label><input className="input-field" type="number" min="0" value={cFields[k]} onChange={e => cSet(k, e.target.value)} placeholder="No change" /></div>
                ))}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div><label className="label">Max Stack Weight</label><input className="input-field" type="number" min="0" value={cFields.max_stack_weight} onChange={e => cSet('max_stack_weight', e.target.value)} placeholder="No change" /></div>
                <div><label className="label">Max Stack Qty</label><input className="input-field" type="number" min="0" value={cFields.max_stack_qty} onChange={e => cSet('max_stack_qty', e.target.value)} placeholder="No change" /></div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <BoolSelect label="Can Rotate"           value={cFields.can_rotate_lr}        onChange={v => cSet('can_rotate_lr', v)} />
                <BoolSelect label="Can Tip Side"         value={cFields.can_tip_side}          onChange={v => cSet('can_tip_side', v)} />
                <BoolSelect label="Can Flip"             value={cFields.can_flip}              onChange={v => cSet('can_flip', v)} />
                <BoolSelect label="Can Stack on Others"  value={cFields.can_stack_on_others}   onChange={v => cSet('can_stack_on_others', v)} />
                <BoolSelect label="Allow Stacking on Top" value={cFields.allow_stacking_on_top} onChange={v => cSet('allow_stacking_on_top', v)} />
              </div>
              <div><label className="label">Notes</label><textarea className="input-field" value={cFields.notes} onChange={e => cSet('notes', e.target.value)} placeholder="No change" /></div>
            </div>
          )}

          {/* TRUCKS fields */}
          {mode === 'trucks' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[['Length (in)','length'],['Width (in)','width'],['Height (in)','height'],['Max Weight (lbs)','max_weight']].map(([l,k]) => (
                  <div key={k}><label className="label">{l}</label><input className="input-field" type="number" min="0" value={tFields[k]} onChange={e => tSet(k, e.target.value)} placeholder="No change" /></div>
                ))}
              </div>
              <div><label className="label">Unit (display)</label><input className="input-field" value={tFields.unit} onChange={e => tSet('unit', e.target.value)} placeholder="No change" /></div>
              <div><label className="label">Notes</label><textarea className="input-field" value={tFields.notes} onChange={e => tSet('notes', e.target.value)} placeholder="No change" /></div>
            </div>
          )}

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={applyBulk}
              disabled={checked.size === 0 || saving}
              className="btn-primary disabled:opacity-40"
            >
              {saving ? 'Applying…' : `Apply to ${selectedCount} record${selectedCount !== 1 ? 's' : ''}`}
            </button>
            <span className="text-xs text-gray-500">Only checked names will be updated.</span>
          </div>
        </div>
      </div>
    </div>
  )
}
