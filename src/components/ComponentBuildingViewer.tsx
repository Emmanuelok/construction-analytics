import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { Building2, Footprints } from 'lucide-react'
import type { BuildingModel, Plate, Quad, Beam } from '@/lib/building'
import type { FurnitureItem, RoomPatch } from '@/lib/building-furniture'
import type { SvcItem } from '@/lib/building-services'
import { familyType, type TypeSelections } from '@/lib/families'
import { PLATE_SCALE } from '@/lib/massing'
import { sunDirection } from '@/lib/sun'
import { findElementGeom } from '@/lib/building-explorer'

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')))
  } catch { return false }
}

const DEF_AZ = Math.PI * 0.26, DEF_POLAR = Math.PI * 0.36

/* Renders the componentized building (from buildBuilding): floor slabs + roof,
 * an instanced perimeter column grid, an instanced glass curtain-wall façade and a
 * core — so it reads as an actual building. Trades toggle on/off; orbit/zoom/
 * keyboard; graceful WebGL fallback. */
export type ViewerStyle = 'realistic' | 'shaded' | 'mono' | 'wire' | 'xray'

export type WalkSpawn = { x: number; z: number; level: number }

export function ComponentBuildingViewer({
  model,
  hidden = {},
  cats,
  style = 'realistic',
  clipY = null,
  focus = null,
  furniture = null,
  services = null,
  types = null,
  walk = null,
  onWalkEnd,
  sun,
  shadows = true,
  isolateLevel = null,
  selected = null,
  onSelect,
  height = 460,
}: {
  model: BuildingModel
  hidden?: { glazing?: boolean; structure?: boolean; slabs?: boolean; facade?: boolean; interior?: boolean }
  cats?: Record<string, boolean> // granular per-category hidden map (overrides `hidden` groups)
  style?: ViewerStyle // Revit-style visual style
  clipY?: number | null // horizontal section box: clip everything above this scene height
  focus?: { level: number; minX: number; maxX: number; minZ: number; maxZ: number } | null // isolate + frame one room/floor region
  furniture?: { items: FurnitureItem[]; patches: RoomPatch[] } | null // FF&E layer (from furnitureFor)
  services?: { items: SvcItem[] } | null // MEP layer (from buildingServices)
  types?: TypeSelections | null // family/type selections (colour, section shape, façade system…)
  walk?: WalkSpawn | null // first-person walkthrough: spawn point + level (null = orbit mode)
  onWalkEnd?: () => void
  sun?: { azimuth: number; altitude: number }
  shadows?: boolean
  isolateLevel?: number | null
  selected?: string | null
  onSelect?: (id: string | null) => void
  height?: number
}) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const propsRef = useRef({ model, hidden, cats, style, clipY, focus, furniture, services, types, walk, onWalkEnd, sun, shadows, isolateLevel, selected, onSelect })
  propsRef.current = { model, hidden, cats, style, clipY, focus, furniture, services, types, walk, onWalkEnd, sun, shadows, isolateLevel, selected, onSelect }

  const rebuildRef = useRef<(() => void) | null>(null)
  const sunFnRef = useRef<(() => void) | null>(null)
  const highlightRef = useRef<(() => void) | null>(null)
  const frameRef = useRef<(() => void) | null>(null)
  const styleRef = useRef<(() => void) | null>(null)
  const clipRef = useRef<(() => void) | null>(null)
  const walkFnRef = useRef<(() => void) | null>(null)
  useEffect(() => { rebuildRef.current?.() }, [model, hidden.glazing, hidden.structure, hidden.slabs, hidden.facade, hidden.interior, cats, isolateLevel, furniture, services, types])
  useEffect(() => { styleRef.current?.() }, [style])
  useEffect(() => { clipRef.current?.() }, [clipY])
  useEffect(() => { rebuildRef.current?.(); frameRef.current?.() }, [focus])
  useEffect(() => { walkFnRef.current?.() }, [walk])
  useEffect(() => { sunFnRef.current?.() }, [sun?.azimuth, sun?.altitude, shadows])
  useEffect(() => { highlightRef.current?.() }, [selected, model])
  // re-fit only when the envelope or isolated level changes (not on every element edit)
  useEffect(() => { frameRef.current?.() }, [model.totalHeight, model.footprint, isolateLevel])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    if (!webglAvailable()) { setFailed(true); return }
    const width = mount.clientWidth || 600

    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }) }
    catch { setFailed(true); return }
    renderer.localClippingEnabled = true
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.12

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0a0f1c')
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 4000)
    // software rasterizers (SwiftShader/llvmpipe) pay per pixel — render at 1×
    let softGL = false
    try {
      const gl = renderer.getContext()
      const dbg = gl.getExtension('WEBGL_debug_renderer_info')
      softGL = /swiftshader|llvmpipe|software/i.test(dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '')
    } catch { /* fine */ }
    renderer.setPixelRatio(softGL ? 1 : Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)
    renderer.domElement.style.cursor = 'grab'
    renderer.domElement.setAttribute('aria-hidden', 'true')

    // image-based lighting: a studio environment gives the PBR materials real
    // reflections (glass, metals); ACES tone mapping above keeps highlights filmic
    const pmrem = new THREE.PMREMGenerator(renderer)
    let envTex: THREE.Texture | null = null
    try { envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environment = envTex } catch { /* SwiftShader edge — flat lighting still works */ }

    // procedural material textures (canvas-painted — no asset downloads)
    const makeTex = (size: number, repeat: number, paint: (g: CanvasRenderingContext2D, s: number) => void) => {
      const c = document.createElement('canvas'); c.width = c.height = size
      const g = c.getContext('2d')
      if (g) paint(g, size)
      const t = new THREE.CanvasTexture(c)
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace
      return t
    }
    const concreteTex = makeTex(128, 3, (g, s) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s)
      for (let i = 0; i < 460; i++) { g.fillStyle = i % 2 ? 'rgba(86,98,116,0.16)' : 'rgba(255,255,255,0.12)'; const r = (i % 7) * 0.28 + 0.5; g.fillRect((i * 37.7) % s, (i * 91.3) % s, r, r) }
    })
    const carpetTex = makeTex(128, 8, (g, s) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s)
      for (let i = 0; i < 900; i++) { g.fillStyle = i % 2 ? 'rgba(30,38,52,0.20)' : 'rgba(255,255,255,0.10)'; g.fillRect((i * 53.9) % s, (i * 17.3) % s, 1.4, 1.4) }
    })
    const woodTex = makeTex(128, 2, (g, s) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s)
      for (let x = 0; x < s; x++) { const v = Math.sin(x * 0.55) * 14 + Math.sin(x * 0.13) * 22; g.fillStyle = `rgba(96,62,28,${0.10 + (v + 36) / 360})`; g.fillRect(x, 0, 1, s) }
    })
    const ceilGridTex = makeTex(128, 10, (g, s) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s)
      g.strokeStyle = 'rgba(70,80,96,0.35)'; g.lineWidth = 2
      g.strokeRect(0, 0, s, s)
    })
    const skyTex = makeTex(2, 1, () => {})
    {
      const c = skyTex.image as HTMLCanvasElement; c.width = 2; c.height = 256
      const g = c.getContext('2d')
      if (g) { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#1b2a4a'); gr.addColorStop(0.55, '#0e1730'); gr.addColorStop(1, '#070b16'); g.fillStyle = gr; g.fillRect(0, 0, 2, 256) }
      skyTex.needsUpdate = true; skyTex.wrapS = skyTex.wrapT = THREE.ClampToEdgeWrapping; skyTex.repeat.set(1, 1)
    }

    const ambient = new THREE.AmbientLight('#9fb2cc', 0.55); scene.add(ambient)
    const hemi = new THREE.HemisphereLight('#dbeafe', '#0a0f1c', 0.5); scene.add(hemi)
    // The sun: a directional light positioned from azimuth/altitude, casting real shadows.
    const sunLight = new THREE.DirectionalLight('#fff7e6', 1.2)
    sunLight.position.set(1.2, 2, 1.4)
    sunLight.shadow.mapSize.set(2048, 2048)
    sunLight.shadow.bias = -0.0006
    scene.add(sunLight); scene.add(sunLight.target)
    const fill = new THREE.DirectionalLight('#93c5fd', 0.3); fill.position.set(-1.5, 0.6, -1); scene.add(fill)
    const ground = new THREE.Mesh(new THREE.CircleGeometry(200, 64), new THREE.MeshStandardMaterial({ color: '#0e1626', roughness: 1 }))
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; scene.add(ground)
    const grid = new THREE.GridHelper(400, 80, '#1e293b', '#16203a')
    ;(grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.35; scene.add(grid)

    const slabMat = new THREE.MeshStandardMaterial({ color: '#b8c2d0', roughness: 0.85, metalness: 0.05, map: concreteTex })
    const colMat = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.6, metalness: 0.15, map: concreteTex })
    const beamMat = new THREE.MeshStandardMaterial({ color: '#566173', roughness: 0.5, metalness: 0.25 })
    const coreMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.8, map: concreteTex })
    const wallMat = new THREE.MeshStandardMaterial({ color: '#9aa7b8', roughness: 0.9, metalness: 0.04, side: THREE.DoubleSide })
    const partMat = new THREE.MeshStandardMaterial({ color: '#8e99ac', roughness: 0.95, metalness: 0.02, side: THREE.DoubleSide })
    const idoorMat = new THREE.MeshStandardMaterial({ color: '#8a6f4a', roughness: 0.7, metalness: 0.05, side: THREE.DoubleSide, map: woodTex })
    const stairMat = new THREE.MeshStandardMaterial({ color: '#8a93a6', roughness: 0.7, metalness: 0.12 })
    const glassMat = new THREE.MeshStandardMaterial({ color: '#7dd3fc', transparent: true, opacity: 0.32, roughness: 0.06, metalness: 0.5, side: THREE.DoubleSide, depthWrite: false })
    const doorMat = new THREE.MeshStandardMaterial({ color: '#1f2a3a', transparent: true, opacity: 0.78, roughness: 0.2, metalness: 0.4, side: THREE.DoubleSide })
    const mullionMat = new THREE.MeshStandardMaterial({ color: '#2b3647', roughness: 0.4, metalness: 0.5 })
    const fdnMat = new THREE.MeshStandardMaterial({ color: '#3f4a5c', roughness: 0.95, metalness: 0.02, map: concreteTex })
    const gbMat = new THREE.MeshStandardMaterial({ color: '#46536a', roughness: 0.85, metalness: 0.05 })
    const ceilMat = new THREE.MeshStandardMaterial({ color: '#cfd6e2', roughness: 0.95, metalness: 0, side: THREE.DoubleSide, map: ceilGridTex })
    const finMat = new THREE.MeshStandardMaterial({ color: '#cab27e', roughness: 0.8, metalness: 0.02, map: carpetTex })
    const roofMat = new THREE.MeshStandardMaterial({ color: '#b8c2d0', roughness: 0.9, metalness: 0.03, map: concreteTex })
    const parapetMat = new THREE.MeshStandardMaterial({ color: '#9aa7b8', roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide })
    const allMats: THREE.MeshStandardMaterial[] = []
    // furniture + floor-tint materials, cached per colour (created lazily during build)
    const furMats = new Map<string, THREE.MeshStandardMaterial>()
    const furMat = (color: string, opts: { rough?: number; map?: THREE.Texture | null } = {}) => {
      let mt = furMats.get(color)
      if (!mt) {
        mt = new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.72, metalness: 0.06, map: opts.map ?? null })
        mt.userData.base = { color: mt.color.getHex(), transparent: mt.transparent, opacity: mt.opacity, depthWrite: mt.depthWrite, map: mt.map }
        furMats.set(color, mt); allMats.push(mt)
      }
      return mt
    }
    const unitBox = new THREE.BoxGeometry(1, 1, 1)
    const unitCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 18) // circular sections (scaled like the box)
    const unitPlane = new THREE.PlaneGeometry(1, 1)

    // Family/type selections drive material colours (and glazing opacity, column
    // shape) — written into each material's base so the visual styles respect them.
    const setBase = (mt: THREE.MeshStandardMaterial, color?: string, opacity?: number) => {
      const base = mt.userData.base as { color: number; transparent: boolean; opacity: number } | undefined
      if (!base) return
      if (color) base.color = new THREE.Color(color).getHex()
      if (opacity != null) { base.opacity = opacity; base.transparent = opacity < 1 }
    }
    const applyTypes = () => {
      const sel = propsRef.current.types ?? {}
      const t = (k: string) => familyType(k, sel[k])
      setBase(colMat, t('column').color); setBase(beamMat, t('beam').color)
      setBase(wallMat, t('facade').color)
      const g = t('glazing'); setBase(glassMat, g.color, g.opacity ?? 0.32)
      setBase(doorMat, t('door').color); setBase(idoorMat, t('interiorDoor').color)
      const p = t('partition'); setBase(partMat, p.color, p.opacity ?? 1)
      setBase(finMat, t('floorFinish').color); setBase(ceilMat, t('ceiling').color)
      setBase(roofMat, t('roof').color); setBase(fdnMat, t('foundation').color); setBase(stairMat, t('stair').color)
      setBase(slabMat, t('slab').color); setBase(coreMat, t('core').color); setBase(mullionMat, t('mullion').color); setBase(gbMat, t('groundBeam').color)
      const bal = t('balustrade'); setBase(parapetMat, bal.color, bal.id === 'glass' ? 0.45 : 1)
    }

    // On-demand rendering: the loop only redraws when the scene actually changes
    // (or while walking / auto-spinning). Keeps the main thread idle when static —
    // smooth on software GL, and lets assistive tech / audits run unobstructed.
    let needsRender = true
    const invalidate = () => { needsRender = true }

    const group = new THREE.Group(); scene.add(group)
    let disposables: THREE.BufferGeometry[] = []
    const objects: THREE.Object3D[] = []

    // click-to-inspect: raycast against the parts; a wireframe box highlights the pick
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const hlBox = new THREE.BoxGeometry(1, 1, 1)
    const hlEdgesGeo = new THREE.EdgesGeometry(hlBox)
    const hlFillMat = new THREE.MeshBasicMaterial({ color: '#fbbf24', transparent: true, opacity: 0.16, depthWrite: false })
    const hlLineMat = new THREE.LineBasicMaterial({ color: '#fbbf24' })
    const highlight = new THREE.Group()
    highlight.add(new THREE.Mesh(hlBox, hlFillMat), new THREE.LineSegments(hlEdgesGeo, hlLineMat))
    highlight.visible = false; highlight.renderOrder = 2; scene.add(highlight)

    const orbit = { az: DEF_AZ, polar: DEF_POLAR, radius: 60, target: new THREE.Vector3() }

    // ---- first-person walkthrough state (WASD + mouse-look, clamped to the slab) ----
    const walkS = { active: false, pos: new THREE.Vector3(), yaw: 0, pitch: -0.04, level: 0, keys: new Set<string>(), run: false, lookDrag: false, last: 0 }
    const EYE = 0.45 // eye height as a fraction of the storey (≈1.6 m of 3.6 m)
    const sceneShOf = (m: BuildingModel) => m.totalHeight / Math.max(1, m.counts.storeys)
    const slabTopOf = (m: BuildingModel, lvl: number) => { const s = m.slabs.find((q) => (q.level ?? 0) === lvl); return s ? s.y + s.thickness : lvl * sceneShOf(m) }
    const eyeYOf = (m: BuildingModel, lvl: number) => slabTopOf(m, lvl) + sceneShOf(m) * EYE
    const ptInPoly = (x: number, z: number, poly: { x: number; z: number }[]) => {
      let inside = false
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i], b = poly[j]
        if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside
      }
      return inside
    }
    const onWalkFloor = (m: BuildingModel, x: number, z: number) => {
      const s = m.slabs.find((q) => (q.level ?? 0) === walkS.level)
      if (!s) return true
      return ptInPoly(x, z, s.polygon) && !(s.hole && s.hole.length >= 3 && ptInPoly(x, z, s.hole))
    }
    const walkHook = () => {
      ;(mount as HTMLElement & { __walk?: object }).__walk = walkS.active
        ? { active: true, x: Math.round(walkS.pos.x * 100) / 100, y: Math.round(walkS.pos.y * 100) / 100, z: Math.round(walkS.pos.z * 100) / 100, level: walkS.level, yaw: Math.round(walkS.yaw * 100) / 100 }
        : { active: false }
    }
    const walkLevel = (delta: number) => {
      const m = propsRef.current.model
      const next = Math.max(0, Math.min(m.counts.storeys - 1, walkS.level + delta))
      if (next === walkS.level) return
      walkS.level = next
      walkS.pos.y = eyeYOf(m, next)
      if (!onWalkFloor(m, walkS.pos.x, walkS.pos.z)) { // tapered/courtyard plates: re-centre on the new slab
        const s = m.slabs.find((q) => (q.level ?? 0) === next)
        if (s) { const cx = s.polygon.reduce((a, p) => a + p.x, 0) / s.polygon.length, cz = s.polygon.reduce((a, p) => a + p.z, 0) / s.polygon.length; walkS.pos.x = cx; walkS.pos.z = cz }
      }
      walkHook()
      rebuildRef.current?.() // the FF&E level-of-detail follows the walker
    }
    // One physics step, paced by wall-clock time so it's frame-rate independent —
    // both the render loop and a steady interval call this (whoever fires first
    // consumes the elapsed time; the other sees ~0 dt), which keeps the walk
    // moving even when rAF is throttled (background tabs, software GL).
    const stepWalk = () => {
      if (!walkS.active) return
      const now = performance.now()
      const dt = Math.min((now - walkS.last) / 1000, 0.1)
      walkS.last = now
      const m = propsRef.current.model
      const k = walkS.keys
      const fwd = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0)
      const str = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0)
      if ((fwd || str) && dt > 0) {
        const speed = (walkS.run ? 4.8 : 1.8) * PLATE_SCALE // m/s → scene/s
        const sy = Math.sin(walkS.yaw), cy = Math.cos(walkS.yaw)
        const mx = (sy * fwd - cy * str) * speed * dt
        const mz = (cy * fwd + sy * str) * speed * dt
        const nx = walkS.pos.x + mx, nz = walkS.pos.z + mz
        if (onWalkFloor(m, nx, nz)) { walkS.pos.x = nx; walkS.pos.z = nz }
        else if (onWalkFloor(m, nx, walkS.pos.z)) walkS.pos.x = nx // slide along the edge
        else if (onWalkFloor(m, walkS.pos.x, nz)) walkS.pos.z = nz
        walkHook()
      }
      camera.position.copy(walkS.pos)
      const cp = Math.cos(walkS.pitch)
      camera.lookAt(walkS.pos.x + Math.sin(walkS.yaw) * cp, walkS.pos.y + Math.sin(walkS.pitch), walkS.pos.z + Math.cos(walkS.yaw) * cp)
    }

    const applyCamera = () => {
      camera.position.set(
        orbit.target.x + orbit.radius * Math.sin(orbit.polar) * Math.sin(orbit.az),
        orbit.target.y + orbit.radius * Math.cos(orbit.polar),
        orbit.target.z + orbit.radius * Math.sin(orbit.polar) * Math.cos(orbit.az),
      )
      camera.lookAt(orbit.target)
      needsRender = true
      ;(mount as HTMLElement & { __view?: object }).__view = { radius: Math.round(orbit.radius * 10) / 10, tx: Math.round(orbit.target.x * 100) / 100, ty: Math.round(orbit.target.y * 100) / 100, tz: Math.round(orbit.target.z * 100) / 100, az: Math.round(orbit.az * 100) / 100, polar: Math.round(orbit.polar * 100) / 100 }
    }
    // Fit the building (or the isolated floor) to the viewport from the current angle.
    const frameView = () => {
      if (walkS.active) return // the walkthrough drives the camera
      const { model: m, isolateLevel: iso, focus } = propsRef.current
      const storeys = m.counts.storeys
      const sceneSh0 = m.totalHeight / Math.max(1, storeys)
      const tanH = Math.tan((camera.fov * Math.PI) / 180 / 2) || 0.4
      if (focus) {
        const cx = (focus.minX + focus.maxX) / 2, cz = (focus.minZ + focus.maxZ) / 2
        orbit.target.set(cx, focus.level * sceneSh0 + sceneSh0 / 2, cz)
        const half = Math.max((focus.maxX - focus.minX) / 2, (focus.maxZ - focus.minZ) / 2, sceneSh0 * 0.6)
        orbit.radius = Math.max(half / (tanH * Math.min(camera.aspect, 1.4)), 2.2) * 2.0
        scene.fog = new THREE.Fog('#0a0f1c', orbit.radius * 0.9, orbit.radius * 3.6)
        applyCamera(); return
      }
      if (iso != null && iso < storeys) {
        const sceneSh = m.totalHeight / Math.max(1, storeys)
        orbit.target.set(0, iso * sceneSh + sceneSh / 2, 0)
        const halfW = Math.max(m.footprint / 2, sceneSh)
        orbit.radius = Math.max(halfW / (tanH * Math.min(camera.aspect, 1.4)), 6) * 1.6
      } else {
        orbit.target.set(0, m.totalHeight / 2, 0)
        const rV = (m.totalHeight / 2) / tanH
        const rH = Math.max(m.footprint / 2, 2) / (tanH * camera.aspect)
        orbit.radius = Math.max(rV, rH, 6) * 1.12
      }
      scene.fog = new THREE.Fog('#0a0f1c', orbit.radius * 0.85, orbit.radius * 3.4)
      applyCamera()
    }
    frameRef.current = frameView

    const plate = (p: Plate, mat: THREE.Material, id: string) => {
      const shape = new THREE.Shape()
      p.polygon.forEach((q, i) => (i ? shape.lineTo(q.x, -q.z) : shape.moveTo(q.x, -q.z)))
      shape.closePath()
      if (p.hole && p.hole.length >= 3) { const h = new THREE.Path(); p.hole.forEach((q, i) => (i ? h.lineTo(q.x, -q.z) : h.moveTo(q.x, -q.z))); h.closePath(); shape.holes.push(h) }
      const geo = new THREE.ExtrudeGeometry(shape, { depth: p.thickness, bevelEnabled: false }); geo.rotateX(-Math.PI / 2)
      disposables.push(geo)
      const mesh = new THREE.Mesh(geo, mat); mesh.position.y = p.y; mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.id = id; group.add(mesh); objects.push(mesh)
    }

    const clear = () => {
      for (const o of objects) group.remove(o)
      objects.length = 0
      for (const g of disposables) g.dispose(); disposables = []
    }

    // Position the sun light from azimuth/altitude, size its shadow camera to the
    // building, and dim the scene at night. Runs on build + whenever sun/shadows change.
    const applySun = () => {
      const { model: m, sun, shadows } = propsRef.current
      const span = Math.max(m.totalHeight, m.footprint * 1.5, 8)
      sunLight.target.position.set(0, m.totalHeight * 0.4, 0); sunLight.target.updateMatrixWorld()
      const sc = sunLight.shadow.camera as THREE.OrthographicCamera
      sc.left = -span * 1.7; sc.right = span * 1.7; sc.top = span * 1.7; sc.bottom = -span * 1.7
      sc.near = 0.5; sc.far = span * 8; sc.updateProjectionMatrix()
      const walking = walkS.active
      if (sun) {
        const dir = sunDirection(sun.azimuth, sun.altitude)
        const dist = span * 2.4
        sunLight.position.set(dir.x * dist, Math.max(dir.y, 0.04) * dist, dir.z * dist)
        const day = sun.altitude > 0
        sunLight.intensity = day ? 0.55 + (Math.min(sun.altitude, 60) / 60) * 1.05 : 0.04
        sunLight.castShadow = shadows !== false && day
        ambient.intensity = walking ? 0.95 : day ? 0.5 : 0.22
        hemi.intensity = walking ? 0.8 : day ? 0.5 : 0.16
        scene.background = day ? skyTex : new THREE.Color('#05070e')
      } else {
        sunLight.position.set(1.2, 2, 1.4).multiplyScalar(span)
        sunLight.intensity = 1.2
        sunLight.castShadow = shadows !== false
        ambient.intensity = walking ? 0.95 : 0.55; hemi.intensity = walking ? 0.8 : 0.5
        scene.background = skyTex
      }
      // walking interiors read "lit": the suspended ceiling becomes a soft luminaire
      ceilMat.emissive.set(walking ? '#e8eef8' : '#000000'); ceilMat.emissiveIntensity = walking ? 0.5 : 0
      ;(mount as HTMLElement & { __sun?: object }).__sun = {
        castShadow: sunLight.castShadow,
        intensity: Math.round(sunLight.intensity * 100) / 100,
        x: Math.round(sunLight.position.x * 10) / 10,
        y: Math.round(sunLight.position.y * 10) / 10,
        z: Math.round(sunLight.position.z * 10) / 10,
      }
      needsRender = true
    }
    sunFnRef.current = applySun

    // Enter/leave the walkthrough when the `walk` prop changes. Entering drops the
    // camera to eye height at the spawn point, facing the plan centre; leaving
    // restores the orbit frame and lighting.
    const applyWalkProp = () => {
      const w = propsRef.current.walk
      if (w && !walkS.active) {
        const m = propsRef.current.model
        walkS.active = true
        walkS.level = Math.max(0, Math.min(m.counts.storeys - 1, w.level))
        walkS.pos.set(w.x, eyeYOf(m, walkS.level), w.z)
        walkS.yaw = Math.atan2(-w.x, -w.z); walkS.pitch = -0.04
        walkS.keys.clear(); walkS.run = false; walkS.last = performance.now()
        spin = false
        const sceneSh = sceneShOf(m)
        scene.fog = new THREE.Fog('#0a0f1c', sceneSh * 10, Math.max(m.footprint * 4, sceneSh * 60))
        applySun(); rebuildRef.current?.() // furnish the floor being walked
      } else if (!w && walkS.active) {
        walkS.active = false; walkS.keys.clear()
        try { if (document.pointerLockElement === el) document.exitPointerLock() } catch { /* headless */ }
        applySun(); frameView(); rebuildRef.current?.()
      }
      walkHook()
    }
    walkFnRef.current = applyWalkProp

    // per-level stable ids (match building-explorer) + instancing helpers
    const idsFor = <T extends { level?: number }>(arr: T[], prefix: string) => { const c: Record<number, number> = {}; return arr.map((x) => { const lv = x.level ?? 0; const i = c[lv] ?? 0; c[lv] = i + 1; return `${prefix}-${lv}-${i}` }) }
    const up = new THREE.Vector3(0, 1, 0)
    const planeInst = (items: { g: Quad; id: string }[], mat: THREE.Material, o: { shadow?: boolean; outset?: number } = {}) => {
      if (!items.length) return
      const inst = new THREE.InstancedMesh(unitPlane, mat, items.length)
      if (o.shadow !== false) { inst.castShadow = true; inst.receiveShadow = true }
      const m4 = new THREE.Matrix4(), basis = new THREE.Matrix4(), q = new THREE.Quaternion(), ex = new THREE.Vector3(), ez = new THREE.Vector3(), pos = new THREE.Vector3(), scl = new THREE.Vector3()
      const d = o.outset ?? 0
      items.forEach(({ g }, i) => {
        ex.set(g.b.x - g.a.x, 0, g.b.z - g.a.z); const L = ex.length() || 1; ex.normalize(); ez.crossVectors(ex, up).normalize()
        q.setFromRotationMatrix(basis.makeBasis(ex, up, ez))
        m4.compose(pos.set((g.a.x + g.b.x) / 2 + ez.x * d, g.y + g.h / 2, (g.a.z + g.b.z) / 2 + ez.z * d), q, scl.set(L, g.h, 1))
        inst.setMatrixAt(i, m4)
      })
      inst.instanceMatrix.needsUpdate = true; inst.userData.ids = items.map((x) => x.id); group.add(inst); objects.push(inst)
    }
    const boxInst = (items: { c: { x: number; y: number; z: number; w: number; h: number; d: number }; id?: string }[], mat: THREE.Material, geo: THREE.BufferGeometry = unitBox) => {
      if (!items.length) return
      const inst = new THREE.InstancedMesh(geo, mat, items.length)
      inst.castShadow = true; inst.receiveShadow = true
      const m4 = new THREE.Matrix4(), iq = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3()
      items.forEach(({ c }, i) => { m4.compose(pos.set(c.x, c.y, c.z), iq, scl.set(c.w, c.h, c.d)); inst.setMatrixAt(i, m4) })
      inst.instanceMatrix.needsUpdate = true; if (items[0].id !== undefined) inst.userData.ids = items.map((x) => x.id); group.add(inst); objects.push(inst)
    }
    const beamInst = (items: { b: Beam; id: string }[], mat: THREE.Material) => {
      if (!items.length) return
      const inst = new THREE.InstancedMesh(unitBox, mat, items.length)
      inst.castShadow = true; inst.receiveShadow = true
      const m4 = new THREE.Matrix4(), basis = new THREE.Matrix4(), q = new THREE.Quaternion(), ex = new THREE.Vector3(), ez = new THREE.Vector3(), pos = new THREE.Vector3(), scl = new THREE.Vector3()
      items.forEach(({ b }, i) => {
        ex.set(b.b.x - b.a.x, 0, b.b.z - b.a.z); const L = ex.length() || 1; ex.normalize(); ez.crossVectors(ex, up).normalize()
        q.setFromRotationMatrix(basis.makeBasis(ex, up, ez))
        m4.compose(pos.set((b.a.x + b.b.x) / 2, b.y, (b.a.z + b.b.z) / 2), q, scl.set(L, b.depth, b.width))
        inst.setMatrixAt(i, m4)
      })
      inst.instanceMatrix.needsUpdate = true; inst.userData.ids = items.map((x) => x.id); group.add(inst); objects.push(inst)
    }

    const build = () => {
      clear()
      const { model: m, hidden: h, cats, isolateLevel: iso } = propsRef.current
      const storeys = m.counts.storeys
      const focus = propsRef.current.focus
      const isolating = iso != null || focus != null
      const fLvl = focus ? focus.level : iso
      const show = (lvl?: number) => !isolating || lvl === fLvl
      // focus region (room/floor) — keep vertical elements within the bbox (padded)
      const PAD = 0.4
      const inFocus = (x: number, z: number) => !focus || (x >= focus.minX - PAD && x <= focus.maxX + PAD && z >= focus.minZ - PAD && z <= focus.maxZ + PAD)
      const inFocusQ = (g: { a: { x: number; z: number }; b: { x: number; z: number } }) => inFocus((g.a.x + g.b.x) / 2, (g.a.z + g.b.z) / 2)
      // visibility: granular per-category map when given, else the grouped toggles
      const vis = (cat: string, grp: 'slabs' | 'structure' | 'facade' | 'glazing' | 'interior') => (cats ? !cats[cat] : !h[grp])
      const colIds = idsFor(m.columns, 'col'), panIds = idsFor(m.glazing, 'pan'), wallIds = idsFor(m.walls, 'wall'), doorIds = idsFor(m.doors, 'door'), beamIds = idsFor(m.beams, 'beam'), partIds = idsFor(m.partitions, 'part'), idoorIds = idsFor(m.interiorDoors, 'idoor')

      applyTypes() // family selections → base colours/opacity before materials style
      const colShape = familyType('column', (propsRef.current.types ?? {}).column).shape === 'cylinder' ? unitCyl : unitBox
      if (vis('slabs', 'slabs')) for (const s of m.slabs) if (show(s.level)) plate(s, slabMat, s.id ?? `floor-${s.level ?? 0}`)
      if (vis('roof', 'slabs') && m.roof && (!isolating || (fLvl ?? -1) >= storeys)) plate(m.roof, roofMat, m.roof.id ?? 'roof')
      if (vis('columns', 'structure')) boxInst(m.columns.map((c, i) => ({ c, id: c.id ?? colIds[i] })).filter(({ c }) => show(c.level) && inFocus(c.x, c.z)), colMat, colShape)
      if (vis('beams', 'structure')) beamInst(m.beams.map((b, i) => ({ b, id: b.id ?? beamIds[i] })).filter(({ b }) => show(b.level) && inFocusQ(b)), beamMat)
      if (vis('core', 'structure') && m.core && inFocus(m.core.x, m.core.z) && !(isolating && (fLvl ?? -1) >= storeys)) {
        let cy = m.core.y, ch = m.core.h
        if (isolating) { const sceneSh = m.totalHeight / Math.max(1, storeys); cy = (fLvl ?? 0) * sceneSh + sceneSh / 2; ch = sceneSh * 0.92 }
        const cm = new THREE.Mesh(unitBox, coreMat); cm.scale.set(m.core.w, ch, m.core.d); cm.position.set(m.core.x, cy, m.core.z); cm.castShadow = true; cm.receiveShadow = true; cm.userData.id = m.core.id ?? 'core'; group.add(cm); objects.push(cm)
      }
      // substructure (footings + ground beams) — drop the ground plane to reveal it
      const showFdn = vis('foundations', 'structure') && m.foundations.length > 0 && !isolating
      if (showFdn) {
        boxInst(m.foundations.map((c) => ({ c, id: c.id })), fdnMat)
        beamInst(m.groundBeams.map((b, i) => ({ b, id: b.id ?? `gb-${i}` })), gbMat)
      }
      const fdnBottom = m.foundations.length ? Math.min(...m.foundations.map((c) => c.y - c.h / 2)) : 0
      ground.position.y = showFdn ? fdnBottom - 0.06 : -0.02
      grid.position.y = ground.position.y + 0.01
      if (vis('walls', 'facade')) planeInst(m.walls.map((g, i) => ({ g, id: g.id ?? wallIds[i] })).filter(({ g }) => show(g.level) && inFocusQ(g)), wallMat)
      if (vis('mullions', 'facade')) boxInst(m.mullions.filter((c) => show(c.level) && inFocus(c.x, c.z)).map((c) => ({ c })), mullionMat) // framing — visual only
      if (vis('parapets', 'facade')) planeInst(m.parapets.map((g, i) => ({ g, id: g.id ?? `par-${i}` })).filter(({ g }) => (!isolating || (fLvl ?? -1) >= storeys - 1) && inFocusQ(g)), parapetMat)
      if (vis('windows', 'glazing')) planeInst(m.glazing.map((g, i) => ({ g, id: g.id ?? panIds[i] })).filter(({ g }) => show(g.level) && inFocusQ(g)), glassMat, { shadow: false, outset: 0.02 })
      if (vis('doors', 'glazing')) planeInst(m.doors.map((g, i) => ({ g, id: g.id ?? doorIds[i] })).filter(({ g }) => show(g.level) && inFocusQ(g)), doorMat, { outset: 0.02 })
      if (vis('partitions', 'interior')) planeInst(m.partitions.map((g, i) => ({ g, id: g.id ?? partIds[i] })).filter(({ g }) => show(g.level) && inFocusQ(g)), partMat)
      if (vis('interiorDoors', 'interior')) planeInst(m.interiorDoors.map((g, i) => ({ g, id: g.id ?? idoorIds[i] })).filter(({ g }) => show(g.level) && inFocusQ(g)), idoorMat, { outset: 0.02 })
      if (vis('stairs', 'interior')) boxInst(m.stairs.flatMap((s) => [...s.treads, ...s.landings, ...s.rails].map((t) => ({ c: t, id: s.id }))).filter(({ c }) => show(c.level) && inFocus(c.x, c.z)), stairMat)
      if (vis('ceilings', 'interior')) for (const p of m.ceilings) if (show(p.level)) plate(p, ceilMat, p.id ?? `ceil-${p.level ?? 0}`)
      if (vis('finishes', 'interior')) for (const p of m.floorFinishes) if (show(p.level)) plate(p, finMat, p.id ?? `fin-${p.level ?? 0}`)
      // FF&E layer: per-room floor tints (carpet patches) + instanced furniture.
      // Rendered with a level-of-detail rule (the takeoff data is always full-building):
      // walking → the floor you're on; isolating/focusing → that region; orbiting a
      // small building → everything; orbiting a tower → the ground floor you can see
      // into. Keeps software-GL machines fluid with tens of thousands of parts.
      const fur = propsRef.current.furniture
      const furShow = (lvl: number) => {
        if (isolating) return show(lvl)
        if (walkS.active) return lvl === walkS.level
        return storeys <= 10 || lvl === 0
      }
      if (fur && vis('furniture', 'interior')) {
        const patchGroups = new Map<string, RoomPatch[]>()
        for (const p of fur.patches) {
          if (!furShow(p.level)) continue
          const cx = p.polygon.reduce((s, q) => s + q.x, 0) / p.polygon.length, cz = p.polygon.reduce((s, q) => s + q.z, 0) / p.polygon.length
          if (!inFocus(cx, cz)) continue
          const key = `${p.level}|${p.color}`
          const g0 = patchGroups.get(key) ?? []; g0.push(p); patchGroups.set(key, g0)
        }
        for (const grp of patchGroups.values()) {
          const shapes = grp.map((p) => { const s = new THREE.Shape(); p.polygon.forEach((q, i) => (i ? s.lineTo(q.x, -q.z) : s.moveTo(q.x, -q.z))); s.closePath(); return s })
          const geo = new THREE.ExtrudeGeometry(shapes, { depth: 0.012, bevelEnabled: false }); geo.rotateX(-Math.PI / 2)
          disposables.push(geo)
          const mesh = new THREE.Mesh(geo, furMat(grp[0].color, { rough: 0.9, map: carpetTex }))
          mesh.position.y = grp[0].y; mesh.receiveShadow = true; mesh.userData.id = grp[0].roomId
          group.add(mesh); objects.push(mesh)
        }
        const buckets = new Map<string, { c: { x: number; y: number; z: number; w: number; h: number; d: number }; id: string }[]>()
        for (const it of fur.items) {
          if (!furShow(it.level)) continue
          if (!inFocus(it.parts[0]?.x ?? 0, it.parts[0]?.z ?? 0)) continue
          for (const p of it.parts) { const b = buckets.get(p.color) ?? []; b.push({ c: p, id: it.id }); buckets.set(p.color, b) }
        }
        for (const [color, parts] of buckets) boxInst(parts, furMat(color, { map: /^#a07a4e|^#8a6f4a|^#7a5d46/.test(color) ? woodTex : null }))
      }
      // MEP layer (lighting / hvac / fire / sanitary) — same level-of-detail rule
      const svc = propsRef.current.services
      if (svc) {
        const svcBuckets = new Map<string, { c: { x: number; y: number; z: number; w: number; h: number; d: number }; id: string }[]>()
        for (const it of svc.items) {
          if (!vis(it.system, 'interior') || !furShow(it.level)) continue
          if (!inFocus(it.parts[0]?.x ?? 0, it.parts[0]?.z ?? 0)) continue
          for (const p of it.parts) { const b = svcBuckets.get(p.color) ?? []; b.push({ c: p, id: it.id }); svcBuckets.set(p.color, b) }
        }
        for (const [color, parts] of svcBuckets) boxInst(parts, furMat(color, { rough: 0.45 }))
      }
      applySun(); applyHighlight(); applyStyle(); applyClip(); invalidate()
      const svcCount = (sys: string) => (svc && vis(sys, 'interior') ? svc.items.filter((i) => i.system === sys).length : 0)
      ;(mount as HTMLElement & { __components?: object }).__components = { columns: m.counts.columns, windows: m.counts.windows, glazing: m.counts.windows, beams: m.counts.beams, doors: m.counts.doors, slabs: m.counts.slabs, partitions: m.counts.partitions, interiorDoors: m.counts.interiorDoors, stairs: m.counts.stairs, foundations: m.counts.foundations, ceilings: m.counts.ceilings, finishes: m.counts.finishes, parapets: m.counts.parapets, furniture: fur && vis('furniture', 'interior') ? fur.items.length : 0, lighting: svcCount('lighting'), hvac: svcCount('hvac'), fire: svcCount('fire'), sanitary: svcCount('sanitary') }
      ;(mount as HTMLElement & { __studio?: object }).__studio = { style: propsRef.current.style, clipY: propsRef.current.clipY ?? null, cats: propsRef.current.cats ?? null, focus: propsRef.current.focus ?? null, types: propsRef.current.types ?? null }
    }
    rebuildRef.current = build

    // ---- Revit-style visual styles + section box (shared by every material) ----
    allMats.push(slabMat, colMat, beamMat, coreMat, wallMat, partMat, idoorMat, stairMat, glassMat, doorMat, mullionMat, fdnMat, gbMat, ceilMat, finMat, roofMat, parapetMat)
    for (const mt of allMats) mt.userData.base = { color: mt.color.getHex(), transparent: mt.transparent, opacity: mt.opacity, depthWrite: mt.depthWrite, map: mt.map }
    const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)
    const applyStyle = () => {
      const st = propsRef.current.style ?? 'realistic'
      const textured = st === 'realistic' || st === 'shaded'
      scene.environment = textured ? envTex : null
      for (const mt of allMats) {
        const base = mt.userData.base as { color: number; transparent: boolean; opacity: number; depthWrite: boolean; map: THREE.Texture | null }
        mt.wireframe = st === 'wire'
        if (st === 'xray') { mt.transparent = true; mt.opacity = 0.18; mt.depthWrite = false }
        else { mt.transparent = base.transparent; mt.opacity = base.opacity; mt.depthWrite = base.depthWrite }
        mt.color.setHex(st === 'mono' ? 0xe8edf4 : base.color)
        mt.map = textured ? base.map : null
        mt.needsUpdate = true
      }
      applySun() // restore the sun for the style, then drop shadows on the flat styles
      if (st !== 'realistic' && st !== 'shaded') sunLight.castShadow = false
      ;(mount as HTMLElement & { __studio?: { style?: string } }).__studio = { ...((mount as HTMLElement & { __studio?: object }).__studio ?? {}), style: st }
      needsRender = true
    }
    styleRef.current = applyStyle
    const applyClip = () => {
      const v = propsRef.current.clipY
      if (v == null) { for (const mt of allMats) mt.clippingPlanes = null }
      else { clipPlane.constant = v; for (const mt of allMats) mt.clippingPlanes = [clipPlane] }
      for (const mt of allMats) mt.needsUpdate = true
      ;(mount as HTMLElement & { __studio?: { clipY?: number | null } }).__studio = { ...((mount as HTMLElement & { __studio?: object }).__studio ?? {}), clipY: v ?? null }
      needsRender = true
    }
    clipRef.current = applyClip
    // a render snapshot (PNG data URL) — the studio's "render image" tool
    ;(mount as HTMLElement & { __snapshot?: () => string }).__snapshot = () => { needsRender = false; renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png') }

    // selection highlight — a wireframe box sized/oriented to the picked element
    const applyHighlight = () => {
      const { model: m, selected } = propsRef.current
      const g = selected ? findElementGeom(m, selected) : null
      needsRender = true
      if (!g) { highlight.visible = false; ;(mount as HTMLElement & { __selected?: string | null }).__selected = null; return }
      highlight.visible = true
      highlight.position.set(g.center.x, g.center.y, g.center.z)
      if (g.dir) {
        const ex = new THREE.Vector3(g.dir.x, 0, g.dir.z).normalize(), up = new THREE.Vector3(0, 1, 0)
        const ez = new THREE.Vector3().crossVectors(ex, up).normalize()
        highlight.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ex, up, ez))
      } else highlight.quaternion.identity()
      highlight.scale.set(Math.max(g.size.x, 0.06) * 1.08, Math.max(g.size.y, 0.06) * 1.08, Math.max(g.size.z, 0.06) * 1.08)
      ;(mount as HTMLElement & { __selected?: string | null }).__selected = selected ?? null
    }
    highlightRef.current = applyHighlight

    const pick = (e: PointerEvent) => {
      const { onSelect } = propsRef.current
      if (!onSelect) return
      const rect = el.getBoundingClientRect()
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(ndc, camera)
      for (const hit of raycaster.intersectObjects(group.children, true)) {
        const o = hit.object as THREE.Object3D & { userData: { id?: string; ids?: string[] } }
        if ((o as THREE.InstancedMesh).isInstancedMesh && hit.instanceId != null) { const id = o.userData.ids?.[hit.instanceId]; if (id) { onSelect(id); return } }
        else if (o.userData?.id) { onSelect(o.userData.id); return }
      }
      onSelect(null)
    }

    const clampP = (p: number) => Math.max(0.06, Math.min(Math.PI / 2 - 0.02, p))
    const right = new THREE.Vector3(), camUp = new THREE.Vector3()
    // Pan: slide the orbit target across the camera's screen plane.
    const pan = (dx: number, dy: number) => {
      camera.updateMatrixWorld()
      right.setFromMatrixColumn(camera.matrixWorld, 0)
      camUp.setFromMatrixColumn(camera.matrixWorld, 1)
      const k = (2 * orbit.radius * Math.tan((camera.fov * Math.PI) / 180 / 2)) / (mount.clientHeight || height)
      orbit.target.addScaledVector(right, -dx * k).addScaledVector(camUp, dy * k)
    }
    // gentle intro auto-spin on capable hardware; skip entirely on software GL
    let dragging = false, lastX = 0, lastY = 0, spin = !softGL, moved = 0, mode: 'orbit' | 'pan' = 'orbit'
    const spinUntil = performance.now() + 5200 // auto-spin is a brief reveal, then it settles (static = efficient)
    const onDown = (e: PointerEvent) => {
      if (walkS.active) {
        walkS.lookDrag = true; lastX = e.clientX; lastY = e.clientY
        try { renderer.domElement.requestPointerLock?.() } catch { /* headless / denied — drag-look still works */ }
        return
      }
      dragging = true; spin = false; lastX = e.clientX; lastY = e.clientY; moved = 0
      mode = e.button === 2 || e.button === 1 || e.shiftKey ? 'pan' : 'orbit'
      renderer.domElement.style.cursor = mode === 'pan' ? 'move' : 'grabbing'
    }
    const onMove = (e: PointerEvent) => {
      if (walkS.active) {
        const locked = document.pointerLockElement === renderer.domElement
        if (!locked && !walkS.lookDrag) return
        const dx = locked ? e.movementX : e.clientX - lastX
        const dy = locked ? e.movementY : e.clientY - lastY
        lastX = e.clientX; lastY = e.clientY
        walkS.yaw -= dx * 0.0034
        walkS.pitch = Math.max(-1.45, Math.min(1.45, walkS.pitch - dy * 0.0028))
        return
      }
      if (!dragging) return
      const dx = e.clientX - lastX, dy = e.clientY - lastY
      moved += Math.abs(dx) + Math.abs(dy)
      if (mode === 'pan') pan(dx, dy)
      else { orbit.az -= dx * 0.01; orbit.polar = clampP(orbit.polar - dy * 0.01) }
      lastX = e.clientX; lastY = e.clientY; applyCamera()
    }
    const onUp = (e: PointerEvent) => {
      if (walkS.active) { walkS.lookDrag = false; return }
      const wasDown = dragging; dragging = false; renderer.domElement.style.cursor = 'grab'; if (wasDown && moved < 6 && mode === 'orbit') pick(e)
    }
    const onWheel = (e: WheelEvent) => { if (walkS.active) { e.preventDefault(); return } e.preventDefault(); orbit.radius = Math.max(2, Math.min(4000, orbit.radius * (1 + (e.deltaY > 0 ? 1 : -1) * 0.12))); applyCamera() }
    const onCtx = (e: Event) => e.preventDefault()
    // double-click: focus the orbit on the picked point (zoom to where you aim)
    const onDbl = (e: MouseEvent) => {
      if (walkS.active) return
      const rect = el.getBoundingClientRect()
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(ndc, camera)
      const hit = raycaster.intersectObjects(group.children, true)[0]
      if (!hit) return
      orbit.target.copy(hit.point)
      orbit.radius = Math.max(orbit.radius * 0.45, 2.5)
      spin = false; applyCamera()
    }
    const onKey = (e: KeyboardEvent) => {
      if (walkS.active) return // the walkthrough has its own keys (window-level)
      let h = true
      const panStep = orbit.radius * 0.08
      switch (e.key) {
        case 'ArrowLeft': if (e.shiftKey) pan(-panStep, 0); else orbit.az += 0.12; break
        case 'ArrowRight': if (e.shiftKey) pan(panStep, 0); else orbit.az -= 0.12; break
        case 'ArrowUp': if (e.shiftKey) pan(0, -panStep); else orbit.polar = clampP(orbit.polar - 0.12); break
        case 'ArrowDown': if (e.shiftKey) pan(0, panStep); else orbit.polar = clampP(orbit.polar + 0.12); break
        case '+': case '=': orbit.radius = Math.max(2, orbit.radius * 0.88); break
        case '-': case '_': orbit.radius = Math.min(4000, orbit.radius * 1.12); break
        case 'f': case 'F': case 'Home': frameView(); break
        default: h = false
      }
      if (!h) return; e.preventDefault(); spin = false; applyCamera()
    }
    // walkthrough keys (window-level so focus never strands the walker)
    const WALK_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
    const onWalkKeyDown = (e: KeyboardEvent) => {
      if (!walkS.active) return
      if (WALK_KEYS.has(e.code)) { walkS.keys.add(e.code); e.preventDefault() }
      else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') walkS.run = true
      else if (e.code === 'KeyE' || e.code === 'PageUp') { walkLevel(1); e.preventDefault() }
      else if (e.code === 'KeyQ' || e.code === 'PageDown') { walkLevel(-1); e.preventDefault() }
      else if (e.code === 'Escape') propsRef.current.onWalkEnd?.()
    }
    const onWalkKeyUp = (e: KeyboardEvent) => {
      if (WALK_KEYS.has(e.code)) walkS.keys.delete(e.code)
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') walkS.run = false
    }
    const el = renderer.domElement
    el.addEventListener('pointerdown', onDown); window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); el.addEventListener('wheel', onWheel, { passive: false }); el.addEventListener('contextmenu', onCtx); el.addEventListener('dblclick', onDbl); mount.addEventListener('keydown', onKey)
    window.addEventListener('keydown', onWalkKeyDown); window.addEventListener('keyup', onWalkKeyUp)
    const ro = new ResizeObserver(() => { const w = mount.clientWidth || 600; camera.aspect = w / height; camera.updateProjectionMatrix(); renderer.setSize(w, height); needsRender = true }); ro.observe(mount)

    build(); frameView(); applyWalkProp()
    const walkTimer = window.setInterval(stepWalk, 33) // physics keeps pace even when rAF throttles
    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (walkS.active) { stepWalk(); needsRender = true }
      else if (spin) { if (performance.now() > spinUntil) spin = false; else { orbit.az += 0.0014; applyCamera() } }
      if (needsRender) { needsRender = false; renderer.render(scene, camera) }
    }
    loop()

    return () => {
      cancelAnimationFrame(raf); window.clearInterval(walkTimer); ro.disconnect()
      el.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); el.removeEventListener('wheel', onWheel); el.removeEventListener('contextmenu', onCtx); el.removeEventListener('dblclick', onDbl); mount.removeEventListener('keydown', onKey)
      window.removeEventListener('keydown', onWalkKeyDown); window.removeEventListener('keyup', onWalkKeyUp)
      clear(); unitBox.dispose(); unitCyl.dispose(); unitPlane.dispose(); [slabMat, colMat, beamMat, coreMat, wallMat, partMat, idoorMat, stairMat, glassMat, doorMat, mullionMat, fdnMat, gbMat, ceilMat, finMat, roofMat, parapetMat].forEach((m) => m.dispose())
      for (const mt of furMats.values()) mt.dispose()
      ;[concreteTex, carpetTex, woodTex, ceilGridTex, skyTex].forEach((t) => t.dispose())
      envTex?.dispose(); pmrem.dispose()
      hlBox.dispose(); hlEdgesGeo.dispose(); hlFillMat.dispose(); hlLineMat.dispose()
      ground.geometry.dispose(); (ground.material as THREE.Material).dispose()
      renderer.dispose(); if (el.parentNode === mount) mount.removeChild(el)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height])

  if (failed) {
    return (
      <div style={{ height }} className="flex w-full flex-col items-center justify-center gap-2 rounded-xl bg-base/60 p-4 text-center" role="img" aria-label="Building model (3D unavailable)">
        <Building2 className="h-7 w-7 text-slate-600" />
        <p className="text-sm text-slate-300">{model.counts.storeys} storeys · {model.counts.columns} columns · {model.counts.windows} windows · {model.counts.beams} beams</p>
        <p className="text-[11px] text-slate-500">3D needs WebGL — component counts are computed from the model.</p>
      </div>
    )
  }
  return (
    <div className="relative w-full">
      <div ref={mountRef} style={{ height }} tabIndex={0} role="application" aria-label="3D building model. Drag to orbit, right-drag or Shift-drag to pan, scroll to zoom, double-click to focus, F to fit. Click an element to inspect it." className="w-full overflow-hidden rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60" />
      {walk ? (
        <>
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 ring-2 ring-black/30" />
          <div className="absolute inset-x-0 top-2 flex justify-center">
            <div className="flex items-center gap-2 rounded-full bg-base/85 px-4 py-1.5 text-[11px] text-slate-200 ring-1 ring-amber-500/40 backdrop-blur-sm">
              <Footprints className="h-3.5 w-3.5 text-amber-300" aria-hidden />
              <span>Walkthrough · <span className="text-slate-300">WASD</span> move · <span className="text-slate-300">drag / click</span> look · <span className="text-slate-300">Shift</span> run · <span className="text-slate-300">Q/E</span> floor</span>
              <button onClick={() => onWalkEnd?.()} className="pointer-events-auto ml-1 rounded-full bg-amber-500/20 px-2 py-0.5 font-medium text-amber-100 ring-1 ring-inset ring-amber-500/40 hover:bg-amber-500/30">Exit (Esc)</button>
            </div>
          </div>
        </>
      ) : (
        <div aria-hidden className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-base/70 px-3 py-1 text-[11px] text-slate-400 ring-1 ring-edge/50 backdrop-blur-sm">
          Drag <span className="text-slate-300">orbit</span> · Right/Shift-drag <span className="text-slate-300">pan</span> · Scroll <span className="text-slate-300">zoom</span> · Dbl-click <span className="text-slate-300">focus</span> · <kbd className="rounded bg-elevated/70 px-1 text-slate-300">F</kbd> fit
        </div>
      )}
    </div>
  )
}
