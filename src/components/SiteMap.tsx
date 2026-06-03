import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { boundaryToLatLng, type LatLng } from '@/lib/geo'
import { type Pt } from '@/lib/zoning'

export type Overlay = { points: Pt[]; color: string; fill?: number; dashed?: boolean; label?: string }

/* Views the actual site on a real basemap (Esri satellite / OSM streets) with the
 * parcel, setback and proposed footprint drawn on it — georeferenced via the anchor.
 * View-only (editing stays in the polygon editor); tiles load from the providers at
 * runtime. */
export function SiteMap({ anchor, overlays, height = 420 }: { anchor: LatLng; overlays: Overlay[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const groupRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!ref.current || mapRef.current) return
    const map = L.map(ref.current, { center: [anchor.lat, anchor.lng], zoom: 17, zoomControl: true, attributionControl: true })
    mapRef.current = map
    const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 21, attribution: 'Imagery © Esri' }).addTo(map)
    const streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' })
    L.control.layers({ Satellite: sat, Streets: streets }, undefined, { position: 'topright' }).addTo(map)
    groupRef.current = L.layerGroup().addTo(map)
    return () => { map.remove(); mapRef.current = null; groupRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current, group = groupRef.current
    if (!map || !group) return
    group.clearLayers()
    let firstBounds: L.LatLngBounds | null = null
    for (const ov of overlays) {
      if (ov.points.length < 2) continue
      const latlngs = boundaryToLatLng(ov.points, anchor).map((p) => [p.lat, p.lng] as [number, number])
      const poly = L.polygon(latlngs, { color: ov.color, weight: 2, opacity: 0.95, dashArray: ov.dashed ? '6 5' : undefined, fillColor: ov.color, fillOpacity: ov.fill ?? 0 })
      poly.addTo(group)
      if (!firstBounds) firstBounds = poly.getBounds()
    }
    if (firstBounds && firstBounds.isValid()) map.fitBounds(firstBounds, { padding: [28, 28], maxZoom: 19 })
    else map.setView([anchor.lat, anchor.lng], 17)
    setTimeout(() => map.invalidateSize(), 60)
  }, [overlays, anchor])

  return <div ref={ref} style={{ height }} className="w-full overflow-hidden rounded-xl ring-1 ring-edge/60" role="application" aria-label="Site map on a satellite basemap" />
}
