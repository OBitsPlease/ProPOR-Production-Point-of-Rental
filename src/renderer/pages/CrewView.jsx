import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  MapPin, Calendar, Package, Paperclip, AlertCircle, Shield, BedDouble, Clock,
  ChevronDown, ChevronRight, Truck, Layers, Box,
} from 'lucide-react'

// ── Helpers ────────────────────────────────────────────────────────────────

function gpsUrl(name, address, city, state) {
  const query = [name, address, city, state].filter(Boolean).join(', ')
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}`
}

function fmtDate(d) {
  if (!d) return null
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    })
  } catch { return d }
}

function fmtTime(t) {
  if (!t) return null
  try {
    const [h, m] = t.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = ((h % 12) || 12)
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
  } catch { return t }
}

// ── Watermarked pass image ─────────────────────────────────────────────────

function WatermarkImage({ src, crewName, label }) {
  return (
    <div className="relative rounded-xl overflow-hidden bg-dark-800 border border-dark-600">
      <img src={src} alt={label} className="w-full object-contain max-h-72 block" />
      {/* Diagonal repeating watermark — visible in screenshots */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none select-none"
        aria-hidden="true"
      >
        <div
          style={{
            position: 'absolute',
            top: '-100%', left: '-100%',
            width: '300%', height: '300%',
            display: 'flex',
            flexWrap: 'wrap',
            alignContent: 'center',
            justifyContent: 'center',
            transform: 'rotate(-35deg)',
            gap: '0.75rem 1.5rem',
          }}
        >
          {Array.from({ length: 40 }).map((_, i) => (
            <span
              key={i}
              style={{
                color: 'rgba(255,255,255,0.28)',
                textShadow: '0 0 6px rgba(0,0,0,1), 0 0 2px rgba(0,0,0,1)',
                fontSize: '0.95rem',
                fontWeight: '700',
                whiteSpace: 'nowrap',
                userSelect: 'none',
                letterSpacing: '0.08em',
              }}
            >
              {crewName}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Gear list helpers ─────────────────────────────────────────────────────

function groupGear(gear) {
  // Group by department_name if available, otherwise by color bucket
  const groups = new Map()
  for (const g of gear) {
    const key = g.department_name || g.department_color || g.color || 'Other'
    if (!groups.has(key)) groups.set(key, { label: g.department_name || 'Gear', color: g.department_color || g.color || '#4f8ef7', items: [] })
    groups.get(key).items.push(g)
  }
  return Array.from(groups.values())
}

function CaseRow({ g }) {
  const [open, setOpen] = useState(false)
  const hasItems = g._type === 'case' && (g.items || []).length > 0
  return (
    <div>
      <button
        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
          hasItems ? 'active:bg-dark-700 hover:bg-dark-700/50' : ''
        }`}
        onClick={() => hasItems && setOpen(o => !o)}
        disabled={!hasItems}
      >
        <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: g.color || g.department_color || '#4f8ef7' }} />
        <span className="text-sm text-white flex-1">{g.name}</span>
        {(g.quantity || 1) > 1 && (
          <span className="text-xs text-gray-500 shrink-0">×{g.quantity}</span>
        )}
        {hasItems && (
          open
            ? <ChevronDown size={14} className="text-gray-500 shrink-0" />
            : <ChevronRight size={14} className="text-gray-500 shrink-0" />
        )}
      </button>
      {open && hasItems && (
        <div className="ml-7 mr-4 mb-2 bg-dark-900/50 border border-dark-600 rounded-lg overflow-hidden divide-y divide-dark-700/50">
          {g.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2">
              <span className="text-xs text-gray-300">{item.name}</span>
              {item.qty > 1 && <span className="text-xs text-gray-600">×{item.qty}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function GearGroup({ group, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden mb-3">
      <button
        className="w-full flex items-center gap-2.5 px-4 py-2.5 bg-dark-700/60 hover:bg-dark-700 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="w-3 h-3 rounded-full shrink-0" style={{ background: group.color }} />
        <span className="text-sm font-semibold text-gray-200 flex-1">{group.label}</span>
        <span className="text-xs text-gray-500">{group.items.length} item{group.items.length !== 1 ? 's' : ''}</span>
        {open ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
      </button>
      {open && (
        <div className="divide-y divide-dark-700">
          {group.items.map((g, i) => <CaseRow key={i} g={g} />)}
        </div>
      )}
    </div>
  )
}

// ── Pack order helpers ─────────────────────────────────────────────────────

function PackOrderList({ callSheet }) {
  if (!callSheet || callSheet.length === 0) return null
  // Floor items (stackCount === 1 / z === 0 equivalent: stackedOn === null)
  const floorItems = callSheet.filter(c => !c.stackedOn)
  const stackedItems = callSheet.filter(c => c.stackedOn)

  return (
    <>
      {/* Load order list */}
      <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden mb-3">
        <div className="px-4 py-2.5 bg-dark-700/60 border-b border-dark-600">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Load Order — Back to Front</p>
          <p className="text-xs text-gray-600 mt-0.5">Load these cases in order. Cab end first, door end last.</p>
        </div>
        <div className="divide-y divide-dark-700">
          {callSheet.map((c, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-6 h-6 rounded-full bg-dark-600 border border-dark-500 flex items-center justify-center text-xs font-bold text-gray-300 shrink-0">{c.position}</span>
              <span className="text-sm text-white flex-1">{c.name}</span>
              {c.stackedOn && (
                <span className="text-xs bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded px-1.5 py-0.5 shrink-0">Stacked</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Stacked cases section */}
      {stackedItems.length > 0 && (
        <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-dark-700/60 border-b border-dark-600">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Stacked Cases</p>
            <p className="text-xs text-gray-600 mt-0.5">These cases ride on top of another case.</p>
          </div>
          <div className="divide-y divide-dark-700">
            {stackedItems.map((c, i) => (
              <div key={i} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-0.5">
                  <Layers size={13} className="text-amber-400 shrink-0" />
                  <span className="text-sm text-white font-medium">{c.name}</span>
                </div>
                <p className="text-xs text-gray-500 ml-5">Stacks on: <span className="text-amber-300">{c.stackedOnName || c.stackedOn}</span></p>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function InfoRow({ label, value, valueClass = 'text-white' }) {
  if (!value) return null
  return (
    <div className="px-4 py-3 flex justify-between items-center gap-4">
      <span className="text-sm text-gray-400 shrink-0">{label}</span>
      <span className={`text-sm font-medium text-right ${valueClass}`}>{value}</span>
    </div>
  )
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={15} className="text-brand-primary shrink-0" />
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{title}</h2>
      </div>
      {children}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function CrewView() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Allow body scrolling (global CSS sets overflow:hidden for the Electron app)
  useEffect(() => {
    document.body.style.overflow = 'auto'
    document.documentElement.style.overflow = 'auto'
    return () => {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    fetch(`/api/crew/${token}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) setNotFound(true)
        else setData(d)
        setLoading(false)
      })
      .catch(() => { setNotFound(true); setLoading(false) })
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-gray-400 text-sm animate-pulse">Loading your crew page…</div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center p-6">
        <div className="text-center max-w-xs">
          <AlertCircle size={40} className="mx-auto mb-4 text-red-400" />
          <p className="text-white font-semibold text-lg">Link not found</p>
          <p className="text-gray-400 text-sm mt-2">
            This link may have expired or is invalid. Ask your production manager to resend your crew link.
          </p>
        </div>
      </div>
    )
  }

  const { member, event, eventId } = data
  const hasVenue = event.venue_name || event.venue_address
  const hasHotel = event.hotel_name || event.hotel_address
  const regularFiles = (event.files || [])
  const hasPasses = event.parking_pass || event.backstage_pass
  // packPlan is at data.packPlan (not inside event)

  return (
    <div className="min-h-screen bg-dark-900 text-white">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-b from-dark-800 to-dark-900 border-b border-dark-600 px-5 pt-10 pb-6">
        <div className="max-w-lg mx-auto">
          <p className="text-xs text-brand-primary font-semibold uppercase tracking-widest mb-2">
            ProPOR Crew View
          </p>
          <h1 className="text-2xl font-bold text-white leading-tight">{event.name}</h1>
          {event.client && (
            <p className="text-gray-400 text-sm mt-1">{event.client}</p>
          )}
          <div className="mt-4 inline-flex items-center gap-2 bg-dark-700 border border-dark-500 rounded-full px-4 py-1.5">
            <div className="w-2 h-2 rounded-full bg-brand-primary" />
            <span className="text-sm font-semibold text-brand-primary">{member.name}</span>
            {member.role && (
              <span className="text-sm text-gray-400">&middot; {member.role}</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="max-w-lg mx-auto px-5 py-6">

        {/* Schedule */}
        <Section icon={Calendar} title="Schedule">
          <div className="bg-dark-800 border border-dark-600 rounded-xl divide-y divide-dark-700 overflow-hidden">
            <InfoRow label="Load In" value={event.load_in ? `${fmtDate(event.load_in)}${event.load_in_time ? ' · ' + fmtTime(event.load_in_time) : ''}` : null} />
            <InfoRow label="Show Date" value={fmtDate(event.event_date)} />
            <InfoRow label="Load Out" value={event.load_out ? `${fmtDate(event.load_out)}${event.load_out_time ? ' · ' + fmtTime(event.load_out_time) : ''}` : null} />
            <InfoRow label="Dark Stage" value={event.dark_stage} valueClass="text-amber-300" />
            <InfoRow label="Breaks" value={event.break_times} />
          </div>
        </Section>

        {/* Venue */}
        {hasVenue && (
          <Section icon={MapPin} title="Venue">
            <a
              href={gpsUrl(event.venue_name, event.venue_address, event.venue_city, event.venue_state)}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-dark-800 border border-dark-600 rounded-xl px-4 py-4 active:bg-dark-700 transition-colors hover:border-brand-primary/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  {event.venue_name && (
                    <div className="font-semibold text-white">{event.venue_name}</div>
                  )}
                  {(event.venue_address || event.venue_city) && (
                    <div className="text-sm text-gray-400 mt-0.5">
                      {[event.venue_address, event.venue_city, event.venue_state].filter(Boolean).join(', ')}
                    </div>
                  )}
                </div>
                <MapPin size={18} className="text-brand-primary shrink-0 mt-0.5" />
              </div>
              <div className="mt-2 text-xs text-brand-primary font-medium">Tap to open in Maps →</div>
            </a>
            {event.venue_notes && (
              <div className="mt-2 bg-dark-800/60 border border-dark-700 rounded-xl px-4 py-3 text-sm text-gray-400 whitespace-pre-line">
                {event.venue_notes}
              </div>
            )}
          </Section>
        )}

        {/* Hotel */}
        {hasHotel && (
          <Section icon={BedDouble} title="Hotel">
            <a
              href={gpsUrl(event.hotel_name, event.hotel_address, '', '')}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-dark-800 border border-dark-600 rounded-xl px-4 py-4 active:bg-dark-700 transition-colors hover:border-brand-primary/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  {event.hotel_name && (
                    <div className="font-semibold text-white">{event.hotel_name}</div>
                  )}
                  {event.hotel_address && (
                    <div className="text-sm text-gray-400 mt-0.5">{event.hotel_address}</div>
                  )}
                </div>
                <MapPin size={18} className="text-brand-primary shrink-0 mt-0.5" />
              </div>
              <div className="mt-2 text-xs text-brand-primary font-medium">Tap to open in Maps →</div>
            </a>
            <div className="mt-2 bg-dark-800 border border-dark-600 rounded-xl divide-y divide-dark-700 overflow-hidden">
              <InfoRow label="Check-In" value={fmtDate(event.hotel_checkin)} />
              <InfoRow label="Check-Out" value={fmtDate(event.hotel_checkout)} />
              <InfoRow label="Confirmation" value={event.hotel_confirmation} valueClass="text-green-400 font-mono" />
            </div>
            {event.hotel_notes && (
              <div className="mt-2 bg-dark-800/60 border border-dark-700 rounded-xl px-4 py-3 text-sm text-gray-400 whitespace-pre-line">
                {event.hotel_notes}
              </div>
            )}
          </Section>
        )}

        {/* Gear list — grouped, collapsible */}
        {(event.gear || []).length > 0 && (
          <Section icon={Package} title="Gear List">
            {groupGear(event.gear).map((group, i) => (
              <GearGroup key={i} group={group} defaultOpen={i === 0} />
            ))}
          </Section>
        )}

        {/* Truck Pack Order */}
        {data.packPlan && (
          <Section icon={Truck} title={`Truck Pack Order${data.packPlan.name ? ' — ' + data.packPlan.name : ''}`}>
            <PackOrderList callSheet={data.packPlan.callSheet} />
          </Section>
        )}

        {/* Files */}
        {regularFiles.length > 0 && (
          <Section icon={Paperclip} title="Files">
            <div className="space-y-2">
              {regularFiles.map((file, i) => (
                <a
                  key={i}
                  href={`/api/event-files/${eventId}/${encodeURIComponent(file.name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 active:bg-dark-700 hover:border-brand-primary/50 transition-colors"
                >
                  <Paperclip size={16} className="text-gray-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{file.name}</div>
                    {file.size && (
                      <div className="text-xs text-gray-500">{(file.size / 1024).toFixed(0)} KB</div>
                    )}
                  </div>
                  <span className="text-xs text-brand-primary shrink-0 font-medium">Open →</span>
                </a>
              ))}
            </div>
          </Section>
        )}

        {/* Passes */}
        {hasPasses && (
          <div className="mt-2">
            <div className="flex items-center gap-2 mb-3">
              <Shield size={15} className="text-amber-400 shrink-0" />
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Your Passes</h2>
            </div>

            {/* Watermark warning */}
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-4 text-xs text-amber-300">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>
                These passes are issued to <strong>{member.name}</strong> only.
                Screenshots are watermarked with your name. Do not share or forward — your production manager will know who shared.
              </span>
            </div>

            {event.parking_pass && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide font-semibold">Parking Pass</p>
                <WatermarkImage
                  src={`/api/event-files/${eventId}/${encodeURIComponent(event.parking_pass.name)}`}
                  crewName={member.name}
                  label="Parking Pass"
                />
              </div>
            )}

            {event.backstage_pass && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide font-semibold">Backstage Pass</p>
                <WatermarkImage
                  src={`/api/event-files/${eventId}/${encodeURIComponent(event.backstage_pass.name)}`}
                  crewName={member.name}
                  label="Backstage Pass"
                />
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-dark-700 text-center">
          <p className="text-xs text-gray-600">ProPOR &middot; This page is personal to {member.name}</p>
          <p className="text-xs text-gray-700 mt-1">Do not share this link</p>
        </div>

      </div>
    </div>
  )
}
