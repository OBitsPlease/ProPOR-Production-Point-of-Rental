import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Archive, Truck, Trash2, ChevronDown, ChevronRight, Eye,
  Package, Info
} from 'lucide-react'

export default function RePacks() {
  const navigate = useNavigate()

  // Case repacks
  const [caseRepacks, setCaseRepacks] = useState([])
  const [caseInfoOpen, setCaseInfoOpen] = useState(false)

  // Truck load repacks
  const [truckRepacks, setTruckRepacks] = useState([])
  const [truckInfoOpen, setTruckInfoOpen] = useState(false)

  const [loading, setLoading] = useState(false)

  const loadAll = async () => {
    setLoading(true)
    try {
      if (window.electronAPI?.caseRepacks) {
        const cr = await window.electronAPI.caseRepacks.list()
        setCaseRepacks(cr || [])
      }
      if (window.electronAPI?.repack) {
        const tr = await window.electronAPI.repack.list()
        setTruckRepacks(tr || [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  const deleteCaseRepack = async (id) => {
    if (!confirm('Delete this case repack?')) return
    await window.electronAPI.caseRepacks.delete(id)
    loadAll()
  }

  const deleteTruckRepack = async (filename) => {
    if (!confirm('Delete this truck load repack?')) return
    await window.electronAPI.repack.delete(filename)
    loadAll()
  }

  const previewTruckRepack = async (filename) => {
    try {
      const data = await window.electronAPI.repack.load(filename)
      navigate('/planner', { state: { previewRepack: data } })
    } catch (err) {
      console.error('Preview failed', err)
    }
  }

  const formatDate = (str) => {
    if (!str) return ''
    try { return new Date(str).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }
    catch { return str }
  }

  return (
    <div className="p-6 space-y-8 max-w-4xl">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
          <Archive size={20} className="text-purple-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">RePacks</h1>
          <p className="text-sm text-white/50">Saved packing configurations for reuse</p>
        </div>
      </div>

      {/* ── CASE REPACKS ─────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <Package size={16} className="text-amber-400" />
          </div>
          <div>
            <h2 className="font-semibold text-white">Case Repacks</h2>
            <p className="text-xs text-white/50">Saved item layouts for cases you pack the same way every time</p>
          </div>
        </div>

        {/* Collapsible info banner */}
        <button
          className="w-full flex items-center gap-2 text-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 hover:bg-amber-500/15 transition-colors"
          onClick={() => setCaseInfoOpen(v => !v)}
        >
          {caseInfoOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <Info size={12} />
          <span>Where this is used:</span>
        </button>
        {caseInfoOpen && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 text-xs text-amber-200/80 space-y-1">
            <p>Go to <strong>Items</strong>, open a case, fill its contents, then click <strong>&quot;Save as Case Repack&quot;</strong>.</p>
            <p>Later, when packing the same case, use the <strong>&quot;Apply Case Repack&quot;</strong> dropdown to instantly restore its contents.</p>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-white/30 py-4">Loading&hellip;</p>
        ) : caseRepacks.length === 0 ? (
          <div className="border border-white/10 rounded-xl p-6 text-center bg-white/3">
            <Package size={32} className="mx-auto mb-2 text-white/20" />
            <p className="text-sm text-white/50">No case repacks saved yet.</p>
            <p className="text-xs text-white/30 mt-1">Edit a case in Items, fill its contents, and click &quot;Save as Case Repack&quot;.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {caseRepacks.map(cr => (
              <div key={cr.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-4 py-3">
                <div>
                  <p className="font-medium text-white text-sm">{cr.name}</p>
                  {cr.items?.length > 0 && (
                    <p className="text-xs text-white/40">{cr.items.length} item{cr.items.length !== 1 ? 's' : ''}</p>
                  )}
                </div>
                <button onClick={() => deleteCaseRepack(cr.id)} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── TRUCK LOAD REPACKS ───────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Truck size={16} className="text-blue-400" />
          </div>
          <div>
            <h2 className="font-semibold text-white">Truck Load Repacks</h2>
            <p className="text-xs text-white/50">Saved full truck load configurations — cases and items packed together for a specific truck</p>
          </div>
        </div>

        {/* Collapsible info banner */}
        <button
          className="w-full flex items-center gap-2 text-xs text-blue-300/80 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2 hover:bg-blue-500/15 transition-colors"
          onClick={() => setTruckInfoOpen(v => !v)}
        >
          {truckInfoOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <Info size={12} />
          <span>Where this is used:</span>
        </button>
        {truckInfoOpen && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3 text-xs text-blue-200/80 space-y-1">
            <p>Go to <strong>Events</strong>, open or create an event, and choose <strong>&quot;Apply Truck Repack&quot;</strong> to restore a saved truck load.</p>
            <p>You can also apply a repack when creating a <strong>New Event</strong> — select the repack in the truck assignment step.</p>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-white/30 py-4">Loading&hellip;</p>
        ) : truckRepacks.length === 0 ? (
          <div className="border border-white/10 rounded-xl p-6 text-center bg-white/3">
            <Truck size={32} className="mx-auto mb-2 text-white/20" />
            <p className="text-sm text-white/50">No truck load repacks saved yet.</p>
            <p className="text-xs text-white/30 mt-1">Save a truck load from the Load Planner to reuse it later.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {truckRepacks.map(tr => (
              <div key={tr.filename || tr.name} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <Truck size={14} className="text-green-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-white text-sm truncate">{tr.name || tr.filename}</p>
                    <div className="flex items-center gap-2 text-xs text-white/40">
                      {tr.truckName && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />{tr.truckName}</span>}
                      {tr.savedAt && <span>{formatDate(tr.savedAt)}</span>}
                      <span className="text-white/25">· Apply via Events → New Event</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                  <button
                    onClick={() => previewTruckRepack(tr.filename || tr.name)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg transition-colors"
                  >
                    <Eye size={12} /> Preview
                  </button>
                  <button onClick={() => deleteTruckRepack(tr.filename || tr.name)} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors ml-1">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
