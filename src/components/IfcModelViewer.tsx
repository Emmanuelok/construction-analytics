import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
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
  onSelect?: (el: SelectedElement | null) => void
  explode?: number // 0 = assembled; >0 spreads elements apart vertically
  section?: number // 1 = whole model; <1 cuts away everything above that height
  resetNonce?: number // bump to recentre + reframe the camera
  height?: number
}) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const propsRef = useRef({ input, meshes, hidden, selectedKey, onSelect, explode, section })
  propsRef.current = { input, meshes, hidden, selectedKey, onSelect, explode, section }

  const rebuildRef = useRef<(() => void) | null>(null)
  useEffect(() => { rebuildRef.current?.() }, [input.entityCounts, input.storeys, meshes, hidden.struct, hidden.arch, hidden.mep, hidden.other])

  // Highlight, explode and reset are cheap and independent of geometry, so each
  // gets its own effect (no full scene rebuild).
  const highlightRef = useRef<((key: string | null) => void) | null>(null)
  useEffect(() => { highlightRef.current?.(selectedKey ?? null) }, [selectedKey])
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

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0a0f1c')
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

    // Shared per-discipline materials + a reusable unit box for the reconstruction.
    const unitBox = new THREE.BoxGeometry(1, 1, 1)
    const mats: Partial<Record<Discipline, THREE.MeshStandardMaterial>> = {}
    const matFor = (disc: Discipline) =>
      (mats[disc] ??= new THREE.MeshStandardMaterial({ color: new THREE.Color(DISCIPLINE_COLOR[disc]), roughness: 0.55, metalness: 0.1, clipShadows: true }))

    // Per-build disposables (real-geometry BufferGeometries) + the live object list.
    let geometries: THREE.BufferGeometry[] = []
    const objects: THREE.Mesh[] = []
    let boxHelper: THREE.BoxHelper | null = null
    let minBaseY = 0 // lowest element, for the explode spread
    // Horizontal section: normal points down, so fragments above `constant` are clipped.
    const sectionPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e6)
    let curSection = 1

    const orbit = { azimuth: DEFAULT_AZIMUTH, polar: DEFAULT_POLAR, radius: 60, target: new THREE.Vector3(0, 0, 0) }
    const applyCamera = () => {
      const { azimuth, polar, radius, target } = orbit
      camera.position.set(
        target.x + radius * Math.sin(polar) * Math.sin(azimuth),
        target.y + radius * Math.cos(polar),
        target.z + radius * Math.sin(polar) * Math.cos(azimuth),
      )
      camera.lookAt(target)
    }

    const clearHighlight = () => {
      if (boxHelper) { scene.remove(boxHelper); boxHelper.geometry.dispose(); (boxHelper.material as THREE.Material).dispose(); boxHelper = null }
    }
    const applyHighlight = (k: string | null) => {
      clearHighlight()
      if (!k) return
      const obj = objects.find((o) => (o.userData as { key?: string }).key === k)
      if (obj) { boxHelper = new THREE.BoxHelper(obj, new THREE.Color('#e2e8f0')); scene.add(boxHelper) }
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
      for (const o of objects) {
        const baseY = (o.userData as { baseY?: number }).baseY ?? o.position.y
        o.position.y = baseY + (baseY - minBaseY) * f
      }
      boxHelper?.update()
      const b = new THREE.Box3().setFromObject(group) // debug hook: current vertical span
      ;(mount as HTMLElement & { __spanY?: number }).__spanY = b.isEmpty() ? 0 : b.max.y - b.min.y
      applySection(curSection) // keep the cut at the right height as the model spreads
    }
    explodeRef.current = applyExplode

    // Cut the model at a fraction of its current height; f≥1 disables the plane.
    const applySection = (f: number) => {
      curSection = f
      const enabled = f < 0.999
      const b = new THREE.Box3().setFromObject(group)
      sectionPlane.constant = b.isEmpty() ? 1e6 : b.min.y + f * (b.max.y - b.min.y)
      const planes = enabled ? [sectionPlane] : []
      for (const m of Object.values(mats)) if (m) m.clippingPlanes = planes
      ;(mount as HTMLElement & { __sectioned?: boolean }).__sectioned = enabled
    }
    sectionRef.current = applySection

    const resetView = () => { orbit.azimuth = DEFAULT_AZIMUTH; orbit.polar = DEFAULT_POLAR; frameToGroup() }
    resetRef.current = resetView

    const buildReal = (list: IfcMesh[], hid: Partial<Record<Discipline, boolean>>) => {
      list.forEach((m, i) => {
        if (hid[m.discipline]) return
        const geom = new THREE.BufferGeometry()
        geom.setAttribute('position', new THREE.BufferAttribute(m.positions, 3))
        if (m.normals.length === m.positions.length) geom.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3))
        else geom.computeVertexNormals()
        geom.setIndex(new THREE.BufferAttribute(m.indices, 1))
        const mesh = new THREE.Mesh(geom, matFor(m.discipline))
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
      const { input: inp, meshes: ms, hidden: hid, selectedKey: sk, explode: ex, section: sec } = propsRef.current
      if (ms && ms.length) buildReal(ms, hid)
      else buildRecon(inp, hid)
      for (const o of objects) (o.userData as { baseY?: number }).baseY = o.position.y
      minBaseY = objects.length ? Math.min(...objects.map((o) => o.position.y)) : 0
      applyExplode(ex ?? 0)
      frameToGroup()
      applySection(sec ?? 1)
      applyHighlight(sk ?? null)
      ;(mount as HTMLElement & { __meshCount?: number }).__meshCount = objects.length
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

    const el = renderer.domElement
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('click', onClick)

    const onResize = () => { const w = mount.clientWidth || 600; camera.aspect = w / height; camera.updateProjectionMatrix(); renderer.setSize(w, height) }
    const ro = new ResizeObserver(onResize); ro.observe(mount)

    build()
    let raf = 0, spin = true
    el.addEventListener('pointerdown', () => { spin = false }, { once: true })
    const loop = () => { raf = requestAnimationFrame(loop); if (spin) { orbit.azimuth += 0.0016; applyCamera() } renderer.render(scene, camera) }
    loop()

    return () => {
      cancelAnimationFrame(raf); ro.disconnect()
      el.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp); el.removeEventListener('wheel', onWheel); el.removeEventListener('click', onClick)
      clearHighlight()
      for (const g of geometries) g.dispose()
      unitBox.dispose(); Object.values(mats).forEach((m) => m?.dispose())
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
  const label = meshes && meshes.length ? 'Tessellated 3D geometry from the IFC file' : 'Reconstructed 3D model from the IFC file'
  return <div ref={mountRef} style={{ height }} className="w-full overflow-hidden rounded-xl" role="img" aria-label={label} />
}
