import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Boxes } from 'lucide-react'
import { buildIfcScene, DISCIPLINE_COLOR, type IfcSceneInput, type Discipline } from '@/lib/ifc-model'
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
 * Both colour by discipline and honour the `hidden` toggle; falls back to a text
 * summary where WebGL is unavailable. */
export function IfcModelViewer({
  input,
  meshes,
  hidden = {},
  height = 460,
}: {
  input: IfcSceneInput
  meshes?: IfcMesh[]
  hidden?: Partial<Record<Discipline, boolean>>
  height?: number
}) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const propsRef = useRef({ input, meshes, hidden })
  propsRef.current = { input, meshes, hidden }

  const rebuildRef = useRef<(() => void) | null>(null)
  useEffect(() => { rebuildRef.current?.() }, [input.entityCounts, input.storeys, meshes, hidden.struct, hidden.arch, hidden.mep, hidden.other])

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
      (mats[disc] ??= new THREE.MeshStandardMaterial({ color: new THREE.Color(DISCIPLINE_COLOR[disc]), roughness: 0.55, metalness: 0.1 }))

    // Per-build disposables (real-geometry BufferGeometries) + the live object list.
    let geometries: THREE.BufferGeometry[] = []
    const objects: THREE.Mesh[] = []

    const orbit = { azimuth: Math.PI * 0.28, polar: Math.PI * 0.34, radius: 60, target: new THREE.Vector3(0, 0, 0) }
    const applyCamera = () => {
      const { azimuth, polar, radius, target } = orbit
      camera.position.set(
        target.x + radius * Math.sin(polar) * Math.sin(azimuth),
        target.y + radius * Math.cos(polar),
        target.z + radius * Math.sin(polar) * Math.cos(azimuth),
      )
      camera.lookAt(target)
    }

    const clear = () => {
      for (const o of objects) group.remove(o)
      objects.length = 0
      for (const g of geometries) g.dispose()
      geometries = []
      group.position.set(0, 0, 0)
    }

    const frameToGroup = () => {
      // Recentre on the model's footprint, rest its base on the ground, and pull
      // the camera back to fit the whole bounding box.
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

    const buildReal = (list: IfcMesh[], hid: Partial<Record<Discipline, boolean>>) => {
      for (const m of list) {
        if (hid[m.discipline]) continue
        const geom = new THREE.BufferGeometry()
        geom.setAttribute('position', new THREE.BufferAttribute(m.positions, 3))
        if (m.normals.length === m.positions.length) geom.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3))
        else geom.computeVertexNormals()
        geom.setIndex(new THREE.BufferAttribute(m.indices, 1))
        const mesh = new THREE.Mesh(geom, matFor(m.discipline))
        mesh.applyMatrix4(new THREE.Matrix4().fromArray(m.matrix))
        mesh.castShadow = true; mesh.receiveShadow = true
        group.add(mesh); objects.push(mesh); geometries.push(geom)
      }
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
        group.add(mesh); objects.push(mesh)
      }
    }

    const build = () => {
      clear()
      const { input: inp, meshes: ms, hidden: hid } = propsRef.current
      if (ms && ms.length) buildReal(ms, hid)
      else buildRecon(inp, hid)
      frameToGroup()
      ;(mount as HTMLElement & { __meshCount?: number }).__meshCount = objects.length
    }
    rebuildRef.current = build

    let dragging = false, lastX = 0, lastY = 0
    const onDown = (e: PointerEvent) => { dragging = true; lastX = e.clientX; lastY = e.clientY; renderer.domElement.style.cursor = 'grabbing' }
    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      orbit.azimuth -= (e.clientX - lastX) * 0.01
      orbit.polar = Math.max(0.1, Math.min(Math.PI / 2 - 0.04, orbit.polar - (e.clientY - lastY) * 0.01))
      lastX = e.clientX; lastY = e.clientY; applyCamera()
    }
    const onUp = () => { dragging = false; renderer.domElement.style.cursor = 'grab' }
    const onWheel = (e: WheelEvent) => { e.preventDefault(); orbit.radius = Math.max(6, Math.min(800, orbit.radius + e.deltaY * 0.08)); applyCamera() }
    const el = renderer.domElement
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    el.addEventListener('wheel', onWheel, { passive: false })

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
      window.removeEventListener('pointerup', onUp); el.removeEventListener('wheel', onWheel)
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
