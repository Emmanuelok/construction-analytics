import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Building2 } from 'lucide-react'
import type { BuildingModel, Plate, Quad, Beam } from '@/lib/building'
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
export function ComponentBuildingViewer({
  model,
  hidden = {},
  sun,
  shadows = true,
  isolateLevel = null,
  selected = null,
  onSelect,
  height = 460,
}: {
  model: BuildingModel
  hidden?: { glazing?: boolean; structure?: boolean; slabs?: boolean; facade?: boolean; interior?: boolean }
  sun?: { azimuth: number; altitude: number }
  shadows?: boolean
  isolateLevel?: number | null
  selected?: string | null
  onSelect?: (id: string | null) => void
  height?: number
}) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const propsRef = useRef({ model, hidden, sun, shadows, isolateLevel, selected, onSelect })
  propsRef.current = { model, hidden, sun, shadows, isolateLevel, selected, onSelect }

  const rebuildRef = useRef<(() => void) | null>(null)
  const sunFnRef = useRef<(() => void) | null>(null)
  const highlightRef = useRef<(() => void) | null>(null)
  const frameRef = useRef<(() => void) | null>(null)
  useEffect(() => { rebuildRef.current?.() }, [model, hidden.glazing, hidden.structure, hidden.slabs, hidden.facade, hidden.interior, isolateLevel])
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
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }) }
    catch { setFailed(true); return }

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0a0f1c')
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 4000)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)
    renderer.domElement.style.cursor = 'grab'
    renderer.domElement.setAttribute('aria-hidden', 'true')

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

    const slabMat = new THREE.MeshStandardMaterial({ color: '#b8c2d0', roughness: 0.85, metalness: 0.05 })
    const colMat = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.6, metalness: 0.15 })
    const beamMat = new THREE.MeshStandardMaterial({ color: '#566173', roughness: 0.5, metalness: 0.25 })
    const coreMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.8 })
    const wallMat = new THREE.MeshStandardMaterial({ color: '#9aa7b8', roughness: 0.9, metalness: 0.04, side: THREE.DoubleSide })
    const partMat = new THREE.MeshStandardMaterial({ color: '#7e8aa0', roughness: 0.95, metalness: 0.02, side: THREE.DoubleSide })
    const idoorMat = new THREE.MeshStandardMaterial({ color: '#8a6f4a', roughness: 0.7, metalness: 0.05, side: THREE.DoubleSide })
    const stairMat = new THREE.MeshStandardMaterial({ color: '#8a93a6', roughness: 0.7, metalness: 0.12 })
    const glassMat = new THREE.MeshStandardMaterial({ color: '#7dd3fc', transparent: true, opacity: 0.32, roughness: 0.06, metalness: 0.5, side: THREE.DoubleSide, depthWrite: false })
    const doorMat = new THREE.MeshStandardMaterial({ color: '#1f2a3a', transparent: true, opacity: 0.78, roughness: 0.2, metalness: 0.4, side: THREE.DoubleSide })
    const mullionMat = new THREE.MeshStandardMaterial({ color: '#2b3647', roughness: 0.4, metalness: 0.5 })
    const unitBox = new THREE.BoxGeometry(1, 1, 1)
    const unitPlane = new THREE.PlaneGeometry(1, 1)

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
    const applyCamera = () => {
      camera.position.set(
        orbit.target.x + orbit.radius * Math.sin(orbit.polar) * Math.sin(orbit.az),
        orbit.target.y + orbit.radius * Math.cos(orbit.polar),
        orbit.target.z + orbit.radius * Math.sin(orbit.polar) * Math.cos(orbit.az),
      )
      camera.lookAt(orbit.target)
      ;(mount as HTMLElement & { __view?: object }).__view = { radius: Math.round(orbit.radius * 10) / 10, tx: Math.round(orbit.target.x * 100) / 100, ty: Math.round(orbit.target.y * 100) / 100, tz: Math.round(orbit.target.z * 100) / 100, az: Math.round(orbit.az * 100) / 100, polar: Math.round(orbit.polar * 100) / 100 }
    }
    // Fit the building (or the isolated floor) to the viewport from the current angle.
    const frameView = () => {
      const { model: m, isolateLevel: iso } = propsRef.current
      const storeys = m.counts.storeys
      const tanH = Math.tan((camera.fov * Math.PI) / 180 / 2) || 0.4
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
      if (sun) {
        const dir = sunDirection(sun.azimuth, sun.altitude)
        const dist = span * 2.4
        sunLight.position.set(dir.x * dist, Math.max(dir.y, 0.04) * dist, dir.z * dist)
        const day = sun.altitude > 0
        sunLight.intensity = day ? 0.55 + (Math.min(sun.altitude, 60) / 60) * 1.05 : 0.04
        sunLight.castShadow = shadows !== false && day
        ambient.intensity = day ? 0.5 : 0.22
        hemi.intensity = day ? 0.5 : 0.16
        scene.background = new THREE.Color(day ? '#0a0f1c' : '#05070e')
      } else {
        sunLight.position.set(1.2, 2, 1.4).multiplyScalar(span)
        sunLight.intensity = 1.2
        sunLight.castShadow = shadows !== false
        ambient.intensity = 0.55; hemi.intensity = 0.5
        scene.background = new THREE.Color('#0a0f1c')
      }
      ;(mount as HTMLElement & { __sun?: object }).__sun = {
        castShadow: sunLight.castShadow,
        intensity: Math.round(sunLight.intensity * 100) / 100,
        x: Math.round(sunLight.position.x * 10) / 10,
        y: Math.round(sunLight.position.y * 10) / 10,
        z: Math.round(sunLight.position.z * 10) / 10,
      }
    }
    sunFnRef.current = applySun

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
    const boxInst = (items: { c: { x: number; y: number; z: number; w: number; h: number; d: number }; id?: string }[], mat: THREE.Material) => {
      if (!items.length) return
      const inst = new THREE.InstancedMesh(unitBox, mat, items.length)
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
      const { model: m, hidden: h, isolateLevel: iso } = propsRef.current
      const storeys = m.counts.storeys
      const isolating = iso != null
      const show = (lvl?: number) => !isolating || lvl === iso
      const colIds = idsFor(m.columns, 'col'), panIds = idsFor(m.glazing, 'pan'), wallIds = idsFor(m.walls, 'wall'), doorIds = idsFor(m.doors, 'door'), beamIds = idsFor(m.beams, 'beam'), partIds = idsFor(m.partitions, 'part'), idoorIds = idsFor(m.interiorDoors, 'idoor')

      if (!h.slabs) {
        for (const s of m.slabs) if (show(s.level)) plate(s, slabMat, s.id ?? `floor-${s.level ?? 0}`)
        if (m.roof && (!isolating || iso >= storeys)) plate(m.roof, slabMat, m.roof.id ?? 'roof')
      }
      if (!h.structure) {
        boxInst(m.columns.map((c, i) => ({ c, id: c.id ?? colIds[i] })).filter(({ c }) => show(c.level)), colMat)
        beamInst(m.beams.map((b, i) => ({ b, id: b.id ?? beamIds[i] })).filter(({ b }) => show(b.level)), beamMat)
        if (m.core && !(isolating && iso >= storeys)) {
          let cy = m.core.y, ch = m.core.h
          if (isolating) { const sceneSh = m.totalHeight / Math.max(1, storeys); cy = iso * sceneSh + sceneSh / 2; ch = sceneSh * 0.92 }
          const cm = new THREE.Mesh(unitBox, coreMat); cm.scale.set(m.core.w, ch, m.core.d); cm.position.set(m.core.x, cy, m.core.z); cm.castShadow = true; cm.receiveShadow = true; cm.userData.id = m.core.id ?? 'core'; group.add(cm); objects.push(cm)
        }
      }
      if (!h.facade) {
        planeInst(m.walls.map((g, i) => ({ g, id: g.id ?? wallIds[i] })).filter(({ g }) => show(g.level)), wallMat)
        boxInst(m.mullions.filter((c) => show(c.level)).map((c) => ({ c })), mullionMat) // framing — visual only
      }
      if (!h.glazing) {
        planeInst(m.glazing.map((g, i) => ({ g, id: g.id ?? panIds[i] })).filter(({ g }) => show(g.level)), glassMat, { shadow: false, outset: 0.02 })
        planeInst(m.doors.map((g, i) => ({ g, id: g.id ?? doorIds[i] })).filter(({ g }) => show(g.level)), doorMat, { outset: 0.02 })
      }
      if (!h.interior) {
        planeInst(m.partitions.map((g, i) => ({ g, id: g.id ?? partIds[i] })).filter(({ g }) => show(g.level)), partMat)
        planeInst(m.interiorDoors.map((g, i) => ({ g, id: g.id ?? idoorIds[i] })).filter(({ g }) => show(g.level)), idoorMat, { outset: 0.02 })
        boxInst(m.stairs.flatMap((s) => [...s.treads, ...s.landings, ...s.rails].map((t) => ({ c: t, id: s.id }))).filter(({ c }) => show(c.level)), stairMat)
      }
      applySun(); applyHighlight()
      ;(mount as HTMLElement & { __components?: object }).__components = { columns: m.counts.columns, windows: m.counts.windows, glazing: m.counts.windows, beams: m.counts.beams, doors: m.counts.doors, slabs: m.counts.slabs, partitions: m.counts.partitions, interiorDoors: m.counts.interiorDoors, stairs: m.counts.stairs }
    }
    rebuildRef.current = build

    // selection highlight — a wireframe box sized/oriented to the picked element
    const applyHighlight = () => {
      const { model: m, selected } = propsRef.current
      const g = selected ? findElementGeom(m, selected) : null
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
    let dragging = false, lastX = 0, lastY = 0, spin = true, moved = 0, mode: 'orbit' | 'pan' = 'orbit'
    const onDown = (e: PointerEvent) => {
      dragging = true; spin = false; lastX = e.clientX; lastY = e.clientY; moved = 0
      mode = e.button === 2 || e.button === 1 || e.shiftKey ? 'pan' : 'orbit'
      renderer.domElement.style.cursor = mode === 'pan' ? 'move' : 'grabbing'
    }
    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - lastX, dy = e.clientY - lastY
      moved += Math.abs(dx) + Math.abs(dy)
      if (mode === 'pan') pan(dx, dy)
      else { orbit.az -= dx * 0.01; orbit.polar = clampP(orbit.polar - dy * 0.01) }
      lastX = e.clientX; lastY = e.clientY; applyCamera()
    }
    const onUp = (e: PointerEvent) => { const wasDown = dragging; dragging = false; renderer.domElement.style.cursor = 'grab'; if (wasDown && moved < 6 && mode === 'orbit') pick(e) }
    const onWheel = (e: WheelEvent) => { e.preventDefault(); orbit.radius = Math.max(2, Math.min(4000, orbit.radius * (1 + (e.deltaY > 0 ? 1 : -1) * 0.12))); applyCamera() }
    const onCtx = (e: Event) => e.preventDefault()
    const onKey = (e: KeyboardEvent) => {
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
    const el = renderer.domElement
    el.addEventListener('pointerdown', onDown); window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); el.addEventListener('wheel', onWheel, { passive: false }); el.addEventListener('contextmenu', onCtx); mount.addEventListener('keydown', onKey)
    const ro = new ResizeObserver(() => { const w = mount.clientWidth || 600; camera.aspect = w / height; camera.updateProjectionMatrix(); renderer.setSize(w, height) }); ro.observe(mount)

    build(); frameView()
    let raf = 0
    const loop = () => { raf = requestAnimationFrame(loop); if (spin) { orbit.az += 0.0014; applyCamera() } renderer.render(scene, camera) }
    loop()

    return () => {
      cancelAnimationFrame(raf); ro.disconnect()
      el.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); el.removeEventListener('wheel', onWheel); el.removeEventListener('contextmenu', onCtx); mount.removeEventListener('keydown', onKey)
      clear(); unitBox.dispose(); unitPlane.dispose(); [slabMat, colMat, beamMat, coreMat, wallMat, partMat, idoorMat, stairMat, glassMat, doorMat, mullionMat].forEach((m) => m.dispose())
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
      <div ref={mountRef} style={{ height }} tabIndex={0} role="application" aria-label="3D building model. Drag to orbit, right-drag or Shift-drag to pan, scroll to zoom, F to fit. Click an element to inspect it." className="w-full overflow-hidden rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60" />
      <div aria-hidden className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-base/70 px-3 py-1 text-[11px] text-slate-400 ring-1 ring-edge/50 backdrop-blur-sm">
        Drag <span className="text-slate-300">orbit</span> · Right/Shift-drag <span className="text-slate-300">pan</span> · Scroll <span className="text-slate-300">zoom</span> · <kbd className="rounded bg-elevated/70 px-1 text-slate-300">F</kbd> fit
      </div>
    </div>
  )
}
