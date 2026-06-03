import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, Move, Spline, PenLine, Search, Check, X, Loader2 } from 'lucide-react'
import { boundaryToLatLng, toLatLng, fromLatLng, type LatLng } from '@/lib/geo'
import { polygonCentroid, type Pt } from '@/lib/zoning'
import { cn } from '@/lib/cn'

export type Overlay = { points: Pt[]; color: string; fill?: number; dashed?: boolean; label?: string }
type Mode = 'move' | 'edit' | 'draw'

const dot = (color: string, size = 12) => L.divIcon({ className: 'site-vertex', html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid #0a0f1c;box-shadow:0 0 0 1px ${color}88"></div>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2] })

/* The actual site on a real basemap (Esri satellite / OSM streets) — and editable on
 * it. Search an address or click to place the parcel, drag its vertices to reshape it
 * on the imagery, or draw a brand-new boundary by clicking. Context overlays (setback,
 * footprint) are drawn read-only. Boundary edits convert map lat/lng back to the local
 * metre coordinate system (fromLatLng), so the survey, plan & 3D stay in sync. Tiles +
 * address search need runtime network. */
export function SiteMap({ anchor, overlays, height = 420, editable = false, boundary = [], onBoundaryChange, onAnchorChange }: {
  anchor: LatLng
  overlays: Overlay[]
  height?: number
  editable?: boolean
  boundary?: Pt[]
  onBoundaryChange?: (pts: Pt[]) => void
  onAnchorChange?: (a: LatLng) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const ctxRef = useRef<L.LayerGroup | null>(null)
  const editRef = useRef<L.LayerGroup | null>(null)
  const rebuildRef = useRef<(() => void) | null>(null)
  const drawRef = useRef<LatLng[]>([])
  const fittedRef = useRef(false)

  const [mode, setMode] = useState<Mode>('move')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [drawCount, setDrawCount] = useState(0)

  // latest values for the imperative map handlers
  const propsRef = useRef({ anchor, boundary, overlays, editable, mode, onBoundaryChange, onAnchorChange })
  propsRef.current = { anchor, boundary, overlays, editable, mode, onBoundaryChange, onAnchorChange }

  // init once
  useEffect(() => {
    if (!ref.current || mapRef.current) return
    const map = L.map(ref.current, { center: [anchor.lat, anchor.lng], zoom: 17, zoomControl: true, attributionControl: true })
    mapRef.current = map
    const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 21, attribution: 'Imagery © Esri' }).addTo(map)
    const streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' })
    L.control.layers({ Satellite: sat, Streets: streets }, undefined, { position: 'topright' }).addTo(map)
    ctxRef.current = L.layerGroup().addTo(map)
    editRef.current = L.layerGroup().addTo(map)

    map.on('click', (e: L.LeafletMouseEvent) => {
      const p = propsRef.current
      if (!p.editable) return
      if (p.mode === 'draw') { drawRef.current = [...drawRef.current, { lat: e.latlng.lat, lng: e.latlng.lng }]; setDrawCount(drawRef.current.length); rebuildRef.current?.() }
      else if (p.mode === 'move') commitMove({ lat: e.latlng.lat, lng: e.latlng.lng })
    })
    return () => { map.remove(); mapRef.current = null; ctxRef.current = null; editRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // move the whole parcel so its centroid lands at `target`
  const commitMove = (target: LatLng) => {
    const { boundary, anchor, onAnchorChange } = propsRef.current
    if (!onAnchorChange) return
    const cw = boundary.length >= 3 ? toLatLng(polygonCentroid(boundary), anchor) : anchor
    onAnchorChange({ lat: Math.round((anchor.lat + (target.lat - cw.lat)) * 1e6) / 1e6, lng: Math.round((anchor.lng + (target.lng - cw.lng)) * 1e6) / 1e6 })
  }
  const commitVertex = (i: number, ll: LatLng) => {
    const { boundary, anchor, onBoundaryChange } = propsRef.current
    if (!onBoundaryChange) return
    const next = boundary.slice(); next[i] = fromLatLng(ll, anchor); onBoundaryChange(next)
  }
  const finishDraw = () => {
    const pts = drawRef.current
    const { onBoundaryChange, onAnchorChange } = propsRef.current
    if (pts.length >= 3 && onBoundaryChange && onAnchorChange) {
      const newAnchor = { lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length, lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length }
      onAnchorChange(newAnchor)
      onBoundaryChange(pts.map((ll) => fromLatLng(ll, newAnchor)))
    }
    drawRef.current = []; setDrawCount(0); setMode('edit')
  }
  const cancelDraw = () => { drawRef.current = []; setDrawCount(0); setMode('move') }

  // rebuild the editable layer (boundary polygon + handles, or the in-progress drawing)
  rebuildRef.current = () => {
    const g = editRef.current; if (!g) return
    g.clearLayers()
    const { boundary, anchor, editable, mode } = propsRef.current
    if (ref.current) (ref.current as HTMLDivElement & { __sitemap?: object }).__sitemap = { mode, vertices: boundary.length, draw: drawRef.current.length }
    if (!editable) return
    if (mode === 'draw') {
      const pts = drawRef.current
      if (pts.length) {
        if (pts.length >= 2) L.polyline(pts.map((p) => [p.lat, p.lng]), { color: '#22d3ee', weight: 2, dashArray: '5 5' }).addTo(g)
        pts.forEach((ll, i) => L.marker([ll.lat, ll.lng], { icon: dot(i === 0 ? '#22c55e' : '#22d3ee', 11), interactive: false }).addTo(g))
      }
      return
    }
    if (boundary.length >= 3) {
      const lls = boundaryToLatLng(boundary, anchor).map((p) => [p.lat, p.lng] as [number, number])
      L.polygon(lls, { color: '#e2e8f0', weight: 2, fillColor: '#e2e8f0', fillOpacity: 0.06 }).addTo(g)
      if (mode === 'edit') {
        boundary.forEach((p, i) => {
          const ll = toLatLng(p, anchor)
          const m = L.marker([ll.lat, ll.lng], { draggable: true, icon: dot('#38bdf8', 13), title: `V${i + 1} — drag to reshape` })
          m.on('dragend', (e) => commitVertex(i, (e.target as L.Marker).getLatLng()))
          m.addTo(g)
        })
      } else if (mode === 'move') {
        const c = toLatLng(polygonCentroid(boundary), anchor)
        const h = L.marker([c.lat, c.lng], { draggable: true, icon: dot('#f59e0b', 16), title: 'Drag to move the whole parcel' })
        h.on('dragend', (e) => commitMove((e.target as L.Marker).getLatLng()))
        h.addTo(g)
      }
    }
  }

  // context overlays (read-only)
  useEffect(() => {
    const map = mapRef.current, group = ctxRef.current
    if (!map || !group) return
    group.clearLayers()
    let first: L.LatLngBounds | null = null
    for (const ov of overlays) {
      if (ov.points.length < 2) continue
      const latlngs = boundaryToLatLng(ov.points, anchor).map((p) => [p.lat, p.lng] as [number, number])
      const poly = L.polygon(latlngs, { color: ov.color, weight: 2, opacity: 0.95, dashArray: ov.dashed ? '6 5' : undefined, fillColor: ov.color, fillOpacity: ov.fill ?? 0, interactive: false })
      poly.addTo(group)
      if (!first) first = poly.getBounds()
    }
    if (!fittedRef.current && first && first.isValid()) { map.fitBounds(first, { padding: [28, 28], maxZoom: 19 }); fittedRef.current = true }
    setTimeout(() => map.invalidateSize(), 60)
  }, [overlays, anchor])

  // rebuild editable layer when inputs change
  useEffect(() => { rebuildRef.current?.() }, [boundary, anchor, mode, editable])

  async function search(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim(); if (!q || !onAnchorChange) return
    setSearching(true); setNote(null)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, { headers: { Accept: 'application/json' } })
      const data = (await res.json()) as { lat: string; lon: string; display_name: string }[]
      if (data[0]) { const a = { lat: Math.round(+data[0].lat * 1e6) / 1e6, lng: Math.round(+data[0].lon * 1e6) / 1e6 }; onAnchorChange(a); mapRef.current?.setView([a.lat, a.lng], 18); setNote(data[0].display_name.split(',').slice(0, 3).join(', ')) }
      else setNote('No match found for that address.')
    } catch { setNote('Address search needs a network connection — type lat/lng below instead.') }
    setSearching(false)
  }

  const btn = (m: Mode, Icon: typeof Move, label: string) => (
    <button type="button" onClick={() => { if (m !== 'draw') { drawRef.current = []; setDrawCount(0) } setMode(m) }} aria-pressed={mode === m}
      className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors', mode === m ? 'bg-emerald-500/20 text-emerald-100 ring-emerald-500/40' : 'bg-base/70 text-slate-300 ring-edge/60 hover:bg-elevated/70')}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  )

  return (
    <div className="space-y-2">
      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={search} className="flex min-w-[220px] flex-1 items-center gap-1.5">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search an address or place…" aria-label="Search address" className="w-full rounded-lg border border-edge/60 bg-elevated/40 py-1.5 pl-8 pr-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30" />
            </div>
            <button type="submit" disabled={searching} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-elevated/60 disabled:opacity-60">{searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />} Go</button>
          </form>
          <div className="flex flex-wrap items-center gap-1.5">
            {btn('move', Move, 'Move')}
            {btn('edit', Spline, 'Edit vertices')}
            {btn('draw', PenLine, 'Draw new')}
            {mode === 'draw' && (
              <>
                <button type="button" onClick={finishDraw} disabled={drawCount < 3} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-2.5 py-1.5 text-xs font-medium text-emerald-100 ring-1 ring-inset ring-emerald-500/40 disabled:opacity-50"><Check className="h-3.5 w-3.5" /> Finish ({drawCount})</button>
                <button type="button" onClick={cancelDraw} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:text-slate-200"><X className="h-3.5 w-3.5" /></button>
              </>
            )}
          </div>
        </div>
      )}
      {editable && (
        <p className="text-[11px] text-slate-500">
          {mode === 'move' && 'Move mode — drag the amber handle, or click the map, to reposition the whole parcel.'}
          {mode === 'edit' && 'Edit mode — drag any blue vertex to reshape the boundary on the imagery.'}
          {mode === 'draw' && 'Draw mode — click the map to drop boundary corners, then Finish (≥3 points).'}
          {note && <span className="ml-1 text-emerald-300/90">· {note}</span>}
        </p>
      )}
      <div ref={ref} style={{ height }} className="w-full overflow-hidden rounded-xl ring-1 ring-edge/60" role="application" aria-label="Editable site map on a satellite basemap" />
    </div>
  )
}
