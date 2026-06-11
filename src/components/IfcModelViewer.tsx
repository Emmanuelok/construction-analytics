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

export function IfcModelViewer({
  input,
  meshes,
  hidden = {},
  selectedKey = null,
  selectedExpressID = null,
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
  selectedKey?: string | null
  selectedExpressID?: number | null // highlight every mesh of this IFC product
  isolateStorey?: number | null // expressID of a storey to show alone (real geometry)
  onSelect?: (el: SelectedElement | null) => void
  explode?: number // 0 = assembled; >0 spreads elements apart vertically
  section?: number // 1 = whole model; <1 cuts away everything above that height
  resetNonce?: number // bump to recentre + reframe the camera
  height?: number
}) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const propsRef = useRef({ input, meshes, hidden, selectedKey, selectedExpressID, isolateStorey, onSelect, explode, section })
  propsRef.current = { input, meshes, hidden, selectedKey, selectedExpressID, isolateStorey, onSelect, explode, section }

  const rebuildRef = useRef<(() => void) | null>(null)
  useEffect(() => { rebuildRef.current?.() }, [input.entityCounts, input.storeys, meshes, hidden.struct, hidden.arch, hidden.mep, hidden.other, isolateStorey])

  // Highlight, explode and reset are cheap and independent of geometry, so each
  // gets its own effect (no full scene rebuild).
  const highlightRef = useRef<(() => void) | null>(null)
  useEffect(() => { highlightRef.current?.() }, [selectedKey, selectedExpressID])
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
        mats.set(key, m)
      }
      return m
    }
    const matFor = (disc: Discipline) => matForType(undefined, disc)

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
      const { selectedExpressID: sx, selectedKey: sk } = propsRef.current
      if (sx != null) {
        const box = new THREE.Box3(); let any = false
        for (const o of objects) if ((o.userData as { expressID?: number }).expressID === sx) { box.expandByObject(o); any = true }
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
      list.forEach((m, i) => {
        if (m.ifcTypeName === 'IFCSPACE') return // room volumes are data, not fabric
        if (hid[m.discipline]) return
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
      needsRender = true
    }
    rebuildRef.current = build

    let dragging = false, lastX = 0, lastY = 0, moved = false
    const onDown = (e: PointerEvent) => { dragging = true; moved = false; lastX = e.clientX; lastY = e.clientY; renderer.domElement.style.cursor = 'grabbing' }
    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - lastX, dy = e.clientY - lastY
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true
      orbit.azimuth -= dx * 0.01
      orbit.polar = Math.max(0.1, Math.min(Math.PI / 2 - 0.04, orbit.polar - dy * 0.01))
      lastX = e.clientX; lastY = e.clientY; applyCamera()
    }
    const onUp = () => { dragging = false; renderer.domElement.style.cursor = 'grab' }
    const onWheel = (e: WheelEvent) => { e.preventDefault(); orbit.radius = Math.max(6, Math.min(800, orbit.radius + e.deltaY * 0.08)); applyCamera() }

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

    build()
    let raf = 0, spin = true
    const spinUntil = performance.now() + 5200 // brief intro spin, then static (efficient on software GL)
    el.addEventListener('pointerdown', () => { spin = false }, { once: true })
    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (spin) { if (performance.now() > spinUntil) spin = false; else { orbit.azimuth += 0.0016; applyCamera() } }
      if (needsRender) { needsRender = false; renderer.render(scene, camera) }
    }
    loop()

    return () => {
      cancelAnimationFrame(raf); ro.disconnect()
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
    <div
      ref={mountRef}
      style={{ height }}
      tabIndex={0}
      role="application"
      aria-label={`${content}. Use arrow keys to orbit, plus and minus to zoom, Home to reset the view.`}
      className="w-full overflow-hidden rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
    />
  )
}
