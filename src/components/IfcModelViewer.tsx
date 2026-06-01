import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Boxes } from 'lucide-react'
import { buildIfcScene, DISCIPLINE_COLOR, type IfcSceneInput, type ElementKind } from '@/lib/ifc-model'

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')))
  } catch {
    return false
  }
}

/* Renders the IFC reconstruction (from ifc-model.buildIfcScene) as a real
 * WebGL scene: instanced-ish boxes per element, coloured by discipline, with
 * orbit/zoom and a graceful fallback where WebGL is unavailable. `hidden` lets
 * the page toggle disciplines on/off. */
export function IfcModelViewer({
  input,
  hidden = {},
  height = 460,
}: {
  input: IfcSceneInput
  hidden?: Partial<Record<'struct' | 'arch' | 'mep' | 'other', boolean>>
  height?: number
}) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const propsRef = useRef({ input, hidden })
  propsRef.current = { input, hidden }

  const rebuildRef = useRef<(() => void) | null>(null)
  useEffect(() => { rebuildRef.current?.() }, [input.entityCounts, input.storeys, hidden.struct, hidden.arch, hidden.mep, hidden.other])

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
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000)
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
    sc.left = -50; sc.right = 50; sc.top = 50; sc.bottom = -50; sc.far = 160
    scene.add(key)

    const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshStandardMaterial({ color: '#0e1626', roughness: 1 }))
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true
    scene.add(ground)
    const grid = new THREE.GridHelper(120, 60, '#1e293b', '#16203a')
    ;(grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.4
    scene.add(grid)

    const group = new THREE.Group()
    scene.add(group)
    const meshes: THREE.Mesh[] = []

    // Reuse one box geometry + per-discipline materials (cheap, many instances).
    const unitBox = new THREE.BoxGeometry(1, 1, 1)
    const mats: Record<string, THREE.MeshStandardMaterial> = {}
    const matFor = (disc: keyof typeof DISCIPLINE_COLOR) =>
      (mats[disc] ??= new THREE.MeshStandardMaterial({ color: new THREE.Color(DISCIPLINE_COLOR[disc]), roughness: 0.55, metalness: 0.1 }))

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

    const build = () => {
      for (const m of meshes) group.remove(m)
      meshes.length = 0
      const { input: inp, hidden: hid } = propsRef.current
      const built = buildIfcScene(inp)
      const yOffset = built.totalHeight / 2
      for (const e of built.instances) {
        if (hid[e.discipline]) continue
        const mesh = new THREE.Mesh(unitBox, matFor(e.discipline))
        mesh.scale.set(e.hw * 2, e.hh * 2, e.hd * 2)
        mesh.position.set(e.x, e.y - yOffset, e.z)
        mesh.castShadow = true
        if (e.kind === 'slab') mesh.receiveShadow = true
        group.add(mesh)
        meshes.push(mesh)
      }
      const span = Math.max(built.totalHeight, built.footprint * 1.4)
      orbit.radius = Math.max(20, span * 1.7)
      scene.fog = new THREE.Fog('#0a0f1c', orbit.radius * 0.7, orbit.radius * 2.6)
      applyCamera()
      ;(mount as HTMLElement & { __meshCount?: number }).__meshCount = meshes.length
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
    const onWheel = (e: WheelEvent) => { e.preventDefault(); orbit.radius = Math.max(8, Math.min(400, orbit.radius + e.deltaY * 0.06)); applyCamera() }
    const el = renderer.domElement
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    el.addEventListener('wheel', onWheel, { passive: false })

    const onResize = () => { const w = mount.clientWidth || 600; camera.aspect = w / height; camera.updateProjectionMatrix(); renderer.setSize(w, height) }
    const ro = new ResizeObserver(onResize); ro.observe(mount)

    build(); applyCamera()
    let raf = 0, spin = true
    el.addEventListener('pointerdown', () => { spin = false }, { once: true })
    const loop = () => { raf = requestAnimationFrame(loop); if (spin) { orbit.azimuth += 0.0016; applyCamera() } renderer.render(scene, camera) }
    loop()

    return () => {
      cancelAnimationFrame(raf); ro.disconnect()
      el.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp); el.removeEventListener('wheel', onWheel)
      unitBox.dispose(); Object.values(mats).forEach((m) => m.dispose())
      ground.geometry.dispose(); (ground.material as THREE.Material).dispose()
      renderer.dispose(); if (el.parentNode === mount) mount.removeChild(el)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height])

  if (failed) {
    const built = buildIfcScene(input)
    return (
      <div style={{ height }} className="flex w-full flex-col items-center justify-center gap-2 rounded-xl bg-base/60 p-4 text-center" role="img" aria-label="IFC element summary (3D unavailable)">
        <Boxes className="h-7 w-7 text-slate-600" />
        <p className="text-sm text-slate-300">{built.placed} elements reconstructed across {built.storeys} storeys</p>
        <p className="text-[11px] text-slate-500">3D needs WebGL — element data parsed from the file is available in the tables below.</p>
      </div>
    )
  }
  return <div ref={mountRef} style={{ height }} className="w-full overflow-hidden rounded-xl" role="img" aria-label="Reconstructed 3D model from the IFC file" />
}
