import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { Boxes } from 'lucide-react'
import { buildIfcScene, DISCIPLINE_COLOR, type IfcSceneInput, type Discipline, type SelectedElement } from '@/lib/ifc-model'
import type { IfcMesh } from '@/lib/ifc-geometry'

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')))
  } catch {
    return false
  }
}

/* WebGL viewer for an IFC model. Two render paths share one scene/camera/orbit:
 *  • real geometry — when `meshes` (from web-ifc tessellation) is supplied, draws
 *    the actual triangulated solids, placed by their IFC matrices.
 *  • reconstruction — otherwise builds recognizable boxes from buildIfcScene.
 * Both colour by discipline, honour the `hidden` toggle, and support click-to-
 * inspect: a click raycasts to the element under the cursor, reports it via
 * onSelect, and the matching `selectedKey` is outlined. Falls back to a text
 * summary where WebGL is unavailable. */
const DEFAULT_AZIMUTH = Math.PI * 0.28
const DEFAULT_POLAR = Math.PI * 0.34

export type IfcViewerStyle = 'realistic' | 'shaded' | 'mono' | 'wire' | 'xray'

export function IfcModelViewer({
  input,
  meshes,
  hidden = {},
  hiddenTypes = {},
  styleMode = 'realistic',
  walk = false,
  onWalkEnd,
  selectedKey = null,
  selectedExpressID = null,
  highlightIDs = null,
  isolateStorey = null,
  onSelect,
  explode = 0,
  section = 1,
  resetNonce = 0,
  height = 460,
}: {
  input: IfcSceneInput
  meshes?: IfcMesh[]
  hidden?: Partial<Record<Discipline, boolean>>
  hiddenTypes?: Record<string, boolean> // per-IFC-class layer toggles (IFCWALL, IFCSLAB…)
  styleMode?: IfcViewerStyle // Revit-style visual styles on the real geometry
  walk?: boolean // first-person fly-through (WASD + drag-look, Q/E floors, Esc out)
  onWalkEnd?: () => void
  selectedKey?: string | null
  selectedExpressID?: number | null // highlight every mesh of this IFC product
  highlightIDs?: number[] | null // highlight a set of products (e.g. both sides of a clash)
  isolateStorey?: number | null // expressID of a storey to show alone (real geometry)
  onSelect?: (el: SelectedElement | null) => void
  explode?: number // 0 = assembled; >0 spreads elements apart vertically
  section?: number // 1 = whole model; <1 cuts away everything above that height
  resetNonce?: number // bump to recentre + reframe the camera
  height?: number
}) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const propsRef = useRef({ input, meshes, hidden, hiddenTypes, styleMode, walk, onWalkEnd, selectedKey, selectedExpressID, highlightIDs, isolateStorey, onSelect, explode, section })
  propsRef.current = { input, meshes, hidden, hiddenTypes, styleMode, walk, onWalkEnd, selectedKey, selectedExpressID, highlightIDs, isolateStorey, onSelect, explode, section }

  const rebuildRef = useRef<(() => void) | null>(null)
  useEffect(() => { rebuildRef.current?.() }, [input.entityCounts, input.storeys, meshes, hidden.struct, hidden.arch, hidden.mep, hidden.other, hiddenTypes, isolateStorey])
  const styleFnRef = useRef<(() => void) | null>(null)
  useEffect(() => { styleFnRef.current?.() }, [styleMode])
  const walkFnRef = useRef<(() => void) | null>(null)
  useEffect(() => { walkFnRef.current?.() }, [walk])

  // Highlight, explode and reset are cheap and independent of geometry, so each
  // gets its own effect (no full scene rebuild).
  const highlightRef = useRef<(() => void) | null>(null)
  useEffect(() => { highlightRef.current?.() }, [selectedKey, selectedExpressID, highlightIDs])
  const explodeRef = useRef<((f: number) => void) | null>(null)
  useEffect(() => { explodeRef.current?.(explode) }, [explode])
  const sectionRef = useRef<((f: number) => void) | null>(null)
  useEffect(() => { sectionRef.current?.(section) }, [section])
  const resetRef = useRef<(() => void) | null>(null)
  useEffect(() => { if (resetNonce) resetRef.current?.() }, [resetNonce])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    if (!webglAvailable()) { setFailed(true); return }
    const width = mount.clientWidth || 600

    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }) }
    catch { setFailed(true); return }
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.12

    const scene = new THREE.Scene()
    // sky gradient + a studio environment for real PBR reflections (glass, steel)
    const skyCanvas = document.createElement('canvas'); skyCanvas.width = 2; skyCanvas.height = 256
    const skyCtx = skyCanvas.getContext('2d')
    if (skyCtx) { const gr = skyCtx.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#1b2a4a'); gr.addColorStop(0.55, '#0e1730'); gr.addColorStop(1, '#070b16'); skyCtx.fillStyle = gr; skyCtx.fillRect(0, 0, 2, 256) }
    const skyTex = new THREE.CanvasTexture(skyCanvas)
    scene.background = skyTex
    const pmrem = new THREE.PMREMGenerator(renderer)
    let envTex: THREE.Texture | null = null
    try { envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environment = envTex } catch { /* software GL edge */ }
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 4000)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.localClippingEnabled = true // for the section plane
    mount.appendChild(renderer.domElement)
    renderer.domElement.style.cursor = 'grab'
    renderer.domElement.setAttribute('aria-hidden', 'true')

    scene.add(new THREE.AmbientLight('#94a3b8', 0.6))
    scene.add(new THREE.HemisphereLight('#cbd5e1', '#0a0f1c', 0.5))
    const key = new THREE.DirectionalLight('#ffffff', 1.3)
    key.position.set(20, 36, 22); key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    const sc = key.shadow.camera as THREE.OrthographicCamera
    sc.left = -80; sc.right = 80; sc.top = 80; sc.bottom = -80; sc.far = 240
    scene.add(key)

    const ground = new THREE.Mesh(new THREE.CircleGeometry(120, 64), new THREE.MeshStandardMaterial({ color: '#0e1626', roughness: 1 }))
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true
    scene.add(ground)
    const grid = new THREE.GridHelper(240, 80, '#1e293b', '#16203a')
    ;(grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.4
    scene.add(grid)

    const group = new THREE.Group()
    scene.add(group)

    // Materials styled per IFC class — slabs read as concrete, windows as glass,
    // railings as steel — falling back to the discipline colour for unknown types.
    // (Discipline still drives the toggles/legend; class drives the look.)
    const unitBox = new THREE.BoxGeometry(1, 1, 1)
    type Style = { color: string; roughness?: number; metalness?: number; opacity?: number }
    const CLASS_STYLE: [RegExp, Style][] = [
      [/^IFCSLAB|^IFCROOF/, { color: '#b8c2d0', roughness: 0.85, metalness: 0.05 }],
      [/^IFCCOLUMN/, { color: '#64748b', roughness: 0.6, metalness: 0.15 }],
      [/^IFCBEAM/, { color: '#566173', roughness: 0.5, metalness: 0.25 }],
      [/^IFCWINDOW|^IFCCURTAINWALL|^IFCPLATE/, { color: '#7dd3fc', roughness: 0.06, metalness: 0.5, opacity: 0.34 }],
      [/^IFCDOOR/, { color: '#8a6f4a', roughness: 0.65, metalness: 0.08 }],
      [/^IFCWALL/, { color: '#9aa7b8', roughness: 0.9, metalness: 0.04 }],
      [/^IFCSTAIR|^IFCRAMP/, { color: '#8a93a6', roughness: 0.7, metalness: 0.12 }],
      [/^IFCRAILING/, { color: '#aab4c2', roughness: 0.35, metalness: 0.55 }],
      [/^IFCCOVERING/, { color: '#cab27e', roughness: 0.85, metalness: 0.02 }],
      [/^IFCFOOTING|^IFCPILE/, { color: '#3f4a5c', roughness: 0.95, metalness: 0.02 }],
      [/^IFCMEMBER/, { color: '#2b3647', roughness: 0.4, metalness: 0.5 }],
      [/^IFCBUILDINGELEMENTPROXY/, { color: '#475569', roughness: 0.8, metalness: 0.05 }],
      [/^IFCFURNISHING/, { color: '#9b7c52', roughness: 0.7, metalness: 0.05 }],
    ]
    const mats = new Map<string, THREE.MeshStandardMaterial>()
    const matForType = (ifcType: string | undefined, disc: Discipline) => {
      const t = (ifcType ?? '').toUpperCase()
      const st = CLASS_STYLE.find(([re]) => re.test(t))?.[1]
      const key = st ? st.color : `d:${disc}`
      let m = mats.get(key)
      if (!m) {
        m = st
          ? new THREE.MeshStandardMaterial({ color: new THREE.Color(st.color), roughness: st.roughness ?? 0.7, metalness: st.metalness ?? 0.08, clipShadows: true, ...(st.opacity != null ? { transparent: true, opacity: st.opacity, depthWrite: false, side: THREE.DoubleSide } : {}) })
          : new THREE.MeshStandardMaterial({ color: new THREE.Color(DISCIPLINE_COLOR[disc]), roughness: 0.55, metalness: 0.1, clipShadows: true })
        m.userData.base = { color: m.color.getHex(), transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite }
        mats.set(key, m)
      }
      return m
    }
    const matFor = (disc: Discipline) => matForType(undefined, disc)

    // Revit-style visual styles over every cached material (realistic keeps the
    // class look; mono flattens to white; wire/x-ray strip it back)
    const applyStyle = () => {
      const st = propsRef.current.styleMode ?? 'realistic'
      scene.environment = st === 'realistic' || st === 'shaded' ? envTex : null
      for (const m of mats.values()) {
        const base = m.userData.base as { color: number; transparent: boolean; opacity: number; depthWrite: boolean }
        m.wireframe = st === 'wire'
        if (st === 'xray') { m.transparent = true; m.opacity = 0.16; m.depthWrite = false }
        else { m.transparent = base.transparent; m.opacity = base.opacity; m.depthWrite = base.depthWrite }
        m.color.setHex(st === 'mono' ? 0xe8edf4 : base.color)
        m.needsUpdate = true
      }
      key.castShadow = st === 'realistic' || st === 'shaded'
      ;(mount as HTMLElement & { __viewer?: Record<string, unknown> }).__viewer = { ...((mount as HTMLElement & { __viewer?: Record<string, unknown> }).__viewer ?? {}), style: st }
      needsRender = true
    }
    styleFnRef.current = applyStyle

    // Per-build disposables (real-geometry BufferGeometries) + the live object list.
    let geometries: THREE.BufferGeometry[] = []
    const objects: THREE.Mesh[] = []
    let boxHelper: THREE.BoxHelper | THREE.Box3Helper | null = null
    let minBaseY = 0 // lowest element, for the explode spread
    // Horizontal section: normal points down, so fragments above `constant` are clipped.
    const sectionPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e6)
    let curSection = 1

    const orbit = { azimuth: DEFAULT_AZIMUTH, polar: DEFAULT_POLAR, radius: 60, target: new THREE.Vector3(0, 0, 0) }
    let needsRender = true // on-demand rendering: redraw only when something changed

    // ---- first-person fly-through over the real geometry (units are metres) ----
    const walkS = { active: false, pos: new THREE.Vector3(), yaw: 0, pitch: -0.05, keys: new Set<string>(), run: false, lookDrag: false, last: 0, floors: [0] as number[], floorIdx: 0 }
    const walkHook = () => {
      ;(mount as HTMLElement & { __viewer?: Record<string, unknown> }).__viewer = {
        ...((mount as HTMLElement & { __viewer?: Record<string, unknown> }).__viewer ?? {}),
        walk: walkS.active ? { active: true, x: Math.round(walkS.pos.x * 100) / 100, y: Math.round(walkS.pos.y * 100) / 100, z: Math.round(walkS.pos.z * 100) / 100, floor: walkS.floorIdx } : { active: false },
      }
    }
    const sceneBBox = () => new THREE.Box3().setFromObject(group)
    const computeFloors = (): number[] => {
      const tops: number[] = []
      for (const o of objects) {
        if ((o.userData as { ifcType?: string }).ifcType !== 'IFCSLAB') continue
        const b = new THREE.Box3().setFromObject(o)
        if (b.isEmpty()) continue
        const t = b.max.y
        if (!tops.some((v) => Math.abs(v - t) < 0.4)) tops.push(t)
      }
      tops.sort((a, b) => a - b)
      return tops.length ? tops : [0]
    }
    const stepWalk = () => {
      if (!walkS.active) return
      const now = performance.now()
      const dt = Math.min((now - walkS.last) / 1000, 0.1)
      walkS.last = now
      const k = walkS.keys
      const fwd = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0)
      const str = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0)
      if ((fwd || str) && dt > 0) {
        const speed = walkS.run ? 6 : 2.2 // m/s
        const sy = Math.sin(walkS.yaw), cy = Math.cos(walkS.yaw)
        const nx = walkS.pos.x + (sy * fwd - cy * str) * speed * dt
        const nz = walkS.pos.z + (cy * fwd + sy * str) * speed * dt
        const bb = sceneBBox()
        walkS.pos.x = Math.max(bb.min.x + 0.4, Math.min(bb.max.x - 0.4, nx))
        walkS.pos.z = Math.max(bb.min.z + 0.4, Math.min(bb.max.z - 0.4, nz))
        walkHook()
      }
      camera.position.copy(walkS.pos)
      const cp = Math.cos(walkS.pitch)
      camera.lookAt(walkS.pos.x + Math.sin(walkS.yaw) * cp, walkS.pos.y + Math.sin(walkS.pitch), walkS.pos.z + Math.cos(walkS.yaw) * cp)
      needsRender = true
    }
    const walkFloor = (delta: number) => {
      walkS.floorIdx = Math.max(0, Math.min(walkS.floors.length - 1, walkS.floorIdx + delta))
      walkS.pos.y = walkS.floors[walkS.floorIdx] + 1.6
      walkHook()
    }
    const applyWalkProp = () => {
      const want = !!propsRef.current.walk
      if (want && !walkS.active) {
        walkS.active = true
        walkS.floors = computeFloors()
        walkS.floorIdx = 0
        const bb = sceneBBox()
        const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2
        // spawn in the band between core and façade (the corridor zone), looking
        // down its length — not face-first into a wall
        walkS.pos.set(cx, walkS.floors[0] + 1.6, cz + (bb.max.z - cz) * 0.55)
        walkS.yaw = Math.PI / 2; walkS.pitch = -0.06
        walkS.keys.clear(); walkS.run = false; walkS.last = performance.now()
        scene.fog = new THREE.Fog('#0a0f1c', 30, 220)
      } else if (!want && walkS.active) {
        walkS.active = false; walkS.keys.clear()
        frameToGroupRef?.()
      }
      walkHook(); needsRender = true
    }
    walkFnRef.current = applyWalkProp
    let frameToGroupRef: (() => void) | null = null
    const WALK_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
    const onWalkKeyDown = (e: KeyboardEvent) => {
      if (!walkS.active) return
      if (WALK_KEYS.has(e.code)) { walkS.keys.add(e.code); e.preventDefault() }
      else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') walkS.run = true
      else if (e.code === 'KeyE' || e.code === 'PageUp') { walkFloor(1); e.preventDefault() }
      else if (e.code === 'KeyQ' || e.code === 'PageDown') { walkFloor(-1); e.preventDefault() }
      else if (e.code === 'Escape') propsRef.current.onWalkEnd?.()
    }
    const onWalkKeyUp = (e: KeyboardEvent) => {
      if (WALK_KEYS.has(e.code)) walkS.keys.delete(e.code)
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') walkS.run = false
    }
    const applyCamera = () => {
      const { azimuth, polar, radius, target } = orbit
      camera.position.set(
        target.x + radius * Math.sin(polar) * Math.sin(azimuth),
        target.y + radius * Math.cos(polar),
        target.z + radius * Math.sin(polar) * Math.cos(azimuth),
      )
      camera.lookAt(target)
      needsRender = true
      ;(mount as HTMLElement & { __cam?: { azimuth: number; polar: number; radius: number } }).__cam = { azimuth: orbit.azimuth, polar: orbit.polar, radius: orbit.radius }
    }

    const clearHighlight = () => {
      if (boxHelper) { scene.remove(boxHelper); boxHelper.geometry.dispose(); (boxHelper.material as THREE.Material).dispose(); boxHelper = null }
    }
    // highlight the selected IFC product (every mesh of an expressID, boxed) or, in
    // the BIM tool, a single reconstruction key.
    const applyHighlight = () => {
      needsRender = true
      clearHighlight()
      const { selectedExpressID: sx, selectedKey: sk, highlightIDs: hi } = propsRef.current
      const ids = hi && hi.length ? hi : sx != null ? [sx] : null
      if (ids) {
        const box = new THREE.Box3(); let any = false
        for (const o of objects) if (ids.includes((o.userData as { expressID?: number }).expressID ?? -1)) { box.expandByObject(o); any = true }
        if (any && !box.isEmpty()) { boxHelper = new THREE.Box3Helper(box, new THREE.Color('#fbbf24')); scene.add(boxHelper) }
      } else if (sk) {
        const obj = objects.find((o) => (o.userData as { key?: string }).key === sk)
        if (obj) { boxHelper = new THREE.BoxHelper(obj, new THREE.Color('#e2e8f0')); scene.add(boxHelper) }
      }
    }
    highlightRef.current = applyHighlight

    const clear = () => {
      clearHighlight()
      for (const o of objects) group.remove(o)
      objects.length = 0
      for (const g of geometries) g.dispose()
      geometries = []
      group.position.set(0, 0, 0)
    }

    const frameToGroup = () => {
      const box = new THREE.Box3().setFromObject(group)
      if (!box.isEmpty()) {
        const size = new THREE.Vector3(); box.getSize(size)
        const centre = new THREE.Vector3(); box.getCenter(centre)
        group.position.set(-centre.x, -box.min.y, -centre.z)
        orbit.target.set(0, size.y / 2, 0)
        const span = Math.max(size.x, size.y, size.z)
        orbit.radius = Math.max(20, span * 1.7)
        scene.fog = new THREE.Fog('#0a0f1c', orbit.radius * 0.7, orbit.radius * 2.8)
      }
      applyCamera()
    }
    frameToGroupRef = frameToGroup

    // Spread elements apart vertically (assembled at f=0). baseY is each object's
    // un-exploded height; higher elements travel further so floors separate.
    const applyExplode = (f: number) => {
      needsRender = true
      for (const o of objects) {
        const baseY = (o.userData as { baseY?: number }).baseY ?? o.position.y
        o.position.y = baseY + (baseY - minBaseY) * f
      }
      if (boxHelper instanceof THREE.BoxHelper) boxHelper.update()
      const b = new THREE.Box3().setFromObject(group) // debug hook: current vertical span
      ;(mount as HTMLElement & { __spanY?: number }).__spanY = b.isEmpty() ? 0 : b.max.y - b.min.y
      applySection(curSection) // keep the cut at the right height as the model spreads
    }
    explodeRef.current = applyExplode

    // Cut the model at a fraction of its current height; f≥1 disables the plane.
    const applySection = (f: number) => {
      needsRender = true
      curSection = f
      const enabled = f < 0.999
      const b = new THREE.Box3().setFromObject(group)
      sectionPlane.constant = b.isEmpty() ? 1e6 : b.min.y + f * (b.max.y - b.min.y)
      const planes = enabled ? [sectionPlane] : []
      for (const m of mats.values()) m.clippingPlanes = planes
      ;(mount as HTMLElement & { __sectioned?: boolean }).__sectioned = enabled
    }
    sectionRef.current = applySection

    const resetView = () => { orbit.azimuth = DEFAULT_AZIMUTH; orbit.polar = DEFAULT_POLAR; frameToGroup() }
    resetRef.current = resetView

    const buildReal = (list: IfcMesh[], hid: Partial<Record<Discipline, boolean>>, iso: number | null) => {
      const hidT = propsRef.current.hiddenTypes ?? {}
      list.forEach((m, i) => {
        if (m.ifcTypeName === 'IFCSPACE') return // room volumes are data, not fabric
        if (hid[m.discipline]) return
        if (hidT[m.ifcTypeName]) return
        if (iso != null && m.storey !== iso) return
        const geom = new THREE.BufferGeometry()
        geom.setAttribute('position', new THREE.BufferAttribute(m.positions, 3))
        if (m.normals.length === m.positions.length) geom.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3))
        else geom.computeVertexNormals()
        geom.setIndex(new THREE.BufferAttribute(m.indices, 1))
        const mesh = new THREE.Mesh(geom, matForType(m.ifcTypeName, m.discipline))
        mesh.applyMatrix4(new THREE.Matrix4().fromArray(m.matrix))
        mesh.castShadow = true; mesh.receiveShadow = true
        mesh.userData = { key: `g${i}`, source: 'geometry', expressID: m.expressID, ifcType: m.ifcTypeName, discipline: m.discipline }
        group.add(mesh); objects.push(mesh); geometries.push(geom)
      })
    }

    const buildRecon = (inp: IfcSceneInput, hid: Partial<Record<Discipline, boolean>>) => {
      const built = buildIfcScene(inp)
      const yOffset = built.totalHeight / 2
      for (const e of built.instances) {
        if (hid[e.discipline]) continue
        const mesh = new THREE.Mesh(unitBox, matFor(e.discipline))
        mesh.scale.set(e.hw * 2, e.hh * 2, e.hd * 2)
        mesh.position.set(e.x, e.y - yOffset, e.z)
        mesh.castShadow = true
        if (e.kind === 'slab') mesh.receiveShadow = true
        mesh.userData = { key: e.id, source: 'reconstruction', ifcType: e.ifcType, discipline: e.discipline, storey: e.storey }
        group.add(mesh); objects.push(mesh)
      }
    }

    const build = () => {
      clear()
      const { input: inp, meshes: ms, hidden: hid, explode: ex, section: sec, isolateStorey: iso } = propsRef.current
      if (ms && ms.length) buildReal(ms, hid, iso ?? null)
      else buildRecon(inp, hid)
      for (const o of objects) (o.userData as { baseY?: number }).baseY = o.position.y
      minBaseY = objects.length ? Math.min(...objects.map((o) => o.position.y)) : 0
      applyExplode(ex ?? 0)
      frameToGroup()
      applySection(sec ?? 1)
      applyHighlight()
      ;(mount as HTMLElement & { __meshCount?: number }).__meshCount = objects.length
      ;(mount as HTMLElement & { __viewer?: Record<string, unknown> }).__viewer = { ...((mount as HTMLElement & { __viewer?: Record<string, unknown> }).__viewer ?? {}), meshCount: objects.length }
      needsRender = true
    }
    rebuildRef.current = build

    let dragging = false, lastX = 0, lastY = 0, moved = false
    const onDown = (e: PointerEvent) => {
      if (walkS.active) { walkS.lookDrag = true; lastX = e.clientX; lastY = e.clientY; return }
      dragging = true; moved = false; lastX = e.clientX; lastY = e.clientY; renderer.domElement.style.cursor = 'grabbing'
    }
    const onMove = (e: PointerEvent) => {
      if (walkS.active) {
        if (!walkS.lookDrag) return
        const dx = e.clientX - lastX, dy = e.clientY - lastY
        lastX = e.clientX; lastY = e.clientY
        walkS.yaw -= dx * 0.0034
        walkS.pitch = Math.max(-1.45, Math.min(1.45, walkS.pitch - dy * 0.0028))
        needsRender = true
        return
      }
      if (!dragging) return
      const dx = e.clientX - lastX, dy = e.clientY - lastY
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true
      orbit.azimuth -= dx * 0.01
      orbit.polar = Math.max(0.1, Math.min(Math.PI / 2 - 0.04, orbit.polar - dy * 0.01))
      lastX = e.clientX; lastY = e.clientY; applyCamera()
    }
    const onUp = () => { walkS.lookDrag = false; dragging = false; renderer.domElement.style.cursor = walkS.active ? 'crosshair' : 'grab' }
    const onWheel = (e: WheelEvent) => { e.preventDefault(); if (walkS.active) return; orbit.radius = Math.max(6, Math.min(800, orbit.radius + e.deltaY * 0.08)); applyCamera() }

    // click → raycast → report the element under the cursor (skip if it was a drag)
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const onClick = (e: PointerEvent) => {
      const onSel = propsRef.current.onSelect
      if (moved || !onSel) return
      const rect = renderer.domElement.getBoundingClientRect()
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(ndc, camera)
      const hit = raycaster.intersectObjects(objects)[0]
      if (!hit) { onSel(null); return }
      const o = hit.object as THREE.Mesh
      const ud = o.userData as { key: string; source: 'geometry' | 'reconstruction'; expressID?: number; ifcType: string; discipline: Discipline; storey?: number }
      const sizeV = new THREE.Vector3(); new THREE.Box3().setFromObject(o).getSize(sizeV)
      const tri = ud.source === 'geometry' && o.geometry.index ? o.geometry.index.count / 3 : undefined
      onSel({ key: ud.key, source: ud.source, ifcType: ud.ifcType, discipline: ud.discipline, expressID: ud.expressID, storey: ud.storey, size: { x: sizeV.x, y: sizeV.y, z: sizeV.z }, triangles: tri })
    }

    // keyboard control — the canvas itself is decorative (aria-hidden); the
    // focusable container handles arrow-orbit / +- zoom / Home reset so the model
    // is operable without a mouse.
    const clampPolar = (p: number) => Math.max(0.1, Math.min(Math.PI / 2 - 0.04, p))
    const onKeyDown = (e: KeyboardEvent) => {
      if (walkS.active) return // the fly-through has its own keys (window-level)
      let handled = true
      switch (e.key) {
        case 'ArrowLeft': orbit.azimuth += 0.12; break
        case 'ArrowRight': orbit.azimuth -= 0.12; break
        case 'ArrowUp': orbit.polar = clampPolar(orbit.polar - 0.12); break
        case 'ArrowDown': orbit.polar = clampPolar(orbit.polar + 0.12); break
        case '+': case '=': orbit.radius = Math.max(6, orbit.radius - 4); break
        case '-': case '_': orbit.radius = Math.min(800, orbit.radius + 4); break
        case 'Home': resetView(); break
        default: handled = false
      }
      if (!handled) return
      e.preventDefault(); spin = false; applyCamera()
    }

    const el = renderer.domElement
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('click', onClick)
    mount.addEventListener('keydown', onKeyDown)

    const onResize = () => { const w = mount.clientWidth || 600; camera.aspect = w / height; camera.updateProjectionMatrix(); renderer.setSize(w, height); needsRender = true }
    const ro = new ResizeObserver(onResize); ro.observe(mount)

    window.addEventListener('keydown', onWalkKeyDown); window.addEventListener('keyup', onWalkKeyUp)
    ;(mount as HTMLElement & { __snapshot?: () => string }).__snapshot = () => { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png') }

    build(); applyStyle(); applyWalkProp()
    const walkTimer = window.setInterval(stepWalk, 33) // physics keeps pace even when rAF throttles
    let raf = 0, spin = true
    const spinUntil = performance.now() + 5200 // brief intro spin, then static (efficient on software GL)
    el.addEventListener('pointerdown', () => { spin = false }, { once: true })
    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (walkS.active) stepWalk()
      else if (spin) { if (performance.now() > spinUntil) spin = false; else { orbit.azimuth += 0.0016; applyCamera() } }
      if (needsRender) { needsRender = false; renderer.render(scene, camera) }
    }
    loop()

    return () => {
      cancelAnimationFrame(raf); window.clearInterval(walkTimer); ro.disconnect()
      window.removeEventListener('keydown', onWalkKeyDown); window.removeEventListener('keyup', onWalkKeyUp)
      envTex?.dispose(); pmrem.dispose(); skyTex.dispose()
      el.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp); el.removeEventListener('wheel', onWheel); el.removeEventListener('click', onClick)
      mount.removeEventListener('keydown', onKeyDown)
      clearHighlight()
      for (const g of geometries) g.dispose()
      unitBox.dispose(); for (const m of mats.values()) m.dispose()
      ground.geometry.dispose(); (ground.material as THREE.Material).dispose()
      renderer.dispose(); if (el.parentNode === mount) mount.removeChild(el)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height])

  if (failed) {
    const built = buildIfcScene(input)
    const n = meshes && meshes.length ? meshes.length : built.placed
    return (
      <div style={{ height }} className="flex w-full flex-col items-center justify-center gap-2 rounded-xl bg-base/60 p-4 text-center" role="img" aria-label="IFC element summary (3D unavailable)">
        <Boxes className="h-7 w-7 text-slate-600" />
        <p className="text-sm text-slate-300">{n} elements across {built.storeys} storeys</p>
        <p className="text-[11px] text-slate-500">3D needs WebGL — element data parsed from the file is available in the tables below.</p>
      </div>
    )
  }
  const content = meshes && meshes.length ? 'Tessellated 3D geometry from the IFC file' : 'Reconstructed 3D model from the IFC file'
  return (
    <div className="relative w-full">
      <div
        ref={mountRef}
        style={{ height }}
        tabIndex={0}
        role="application"
        aria-label={`${content}. Use arrow keys to orbit, plus and minus to zoom, Home to reset the view.`}
        className="w-full overflow-hidden rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
      />
      {walk && (
        <>
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 ring-2 ring-black/30" />
          <div className="absolute inset-x-0 top-2 flex justify-center">
            <div className="flex items-center gap-2 rounded-full bg-base/85 px-4 py-1.5 text-[11px] text-slate-200 ring-1 ring-amber-500/40 backdrop-blur-sm">
              <span>Fly-through · <span className="text-slate-300">WASD</span> move · <span className="text-slate-300">drag</span> look · <span className="text-slate-300">Shift</span> fast · <span className="text-slate-300">Q/E</span> floor</span>
              <button onClick={() => onWalkEnd?.()} className="pointer-events-auto ml-1 rounded-full bg-amber-500/20 px-2 py-0.5 font-medium text-amber-100 ring-1 ring-inset ring-amber-500/40 hover:bg-amber-500/30">Exit (Esc)</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
