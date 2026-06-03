import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Boxes, Loader2 } from 'lucide-react'
import { summarizeModel, type ModelStats, type MeshPart } from '@/lib/model-stats'

export type ModelFormat = 'obj' | 'gltf' | 'glb' | 'stl'

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')))
  } catch { return false }
}

/** Load an uploaded model (bytes) into a Three.Object3D via the right loader. */
async function loadModel(data: ArrayBuffer, format: ModelFormat): Promise<THREE.Object3D> {
  if (format === 'obj') {
    const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js')
    return new OBJLoader().parse(new TextDecoder().decode(data))
  }
  if (format === 'stl') {
    const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js')
    const geo = new STLLoader().parse(data)
    geo.computeVertexNormals()
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#9fb4d4', roughness: 0.6, metalness: 0.05 }))
  }
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
  return await new Promise<THREE.Object3D>((resolve, reject) => {
    new GLTFLoader().parse(data, '', (g) => resolve(g.scene), reject)
  })
}

/* Renders an uploaded mesh model (glTF/GLB/OBJ/STL) in WebGL — recentred, framed,
 * orbit/zoom/keyboard — and extracts its geometry stats (meshes, triangles,
 * vertices, materials, bounding box, per-part list) reported via onStats. Never
 * throws on a bad file; reports an error string instead. */
export function MeshModelViewer({
  data,
  format,
  onStats,
  onError,
  height = 460,
}: {
  data: ArrayBuffer
  format: ModelFormat
  onStats?: (s: ModelStats) => void
  onError?: (msg: string) => void
  height?: number
}) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(true)
  const cbRef = useRef({ onStats, onError })
  cbRef.current = { onStats, onError }

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    if (!webglAvailable()) { setFailed(true); setLoading(false); return }
    const width = mount.clientWidth || 600
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }) }
    catch { setFailed(true); setLoading(false); return }

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0a0f1c')
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 100000)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    mount.appendChild(renderer.domElement)
    renderer.domElement.style.cursor = 'grab'
    renderer.domElement.setAttribute('aria-hidden', 'true')

    scene.add(new THREE.AmbientLight('#cbd5e1', 0.75))
    scene.add(new THREE.HemisphereLight('#e2e8f0', '#0a0f1c', 0.7))
    const key = new THREE.DirectionalLight('#ffffff', 1.1); key.position.set(1, 2, 1.4); scene.add(key)
    const fill = new THREE.DirectionalLight('#93c5fd', 0.4); fill.position.set(-1.5, 0.5, -1); scene.add(fill)
    const grid = new THREE.GridHelper(40, 40, '#1e293b', '#16203a')
    ;(grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.3
    scene.add(grid)

    let root: THREE.Object3D | null = null
    const orbit = { azimuth: Math.PI * 0.25, polar: Math.PI * 0.35, radius: 10, target: new THREE.Vector3() }
    const applyCamera = () => {
      const { azimuth, polar, radius, target } = orbit
      camera.position.set(
        target.x + radius * Math.sin(polar) * Math.sin(azimuth),
        target.y + radius * Math.cos(polar),
        target.z + radius * Math.sin(polar) * Math.cos(azimuth),
      )
      camera.lookAt(target)
    }

    let disposed = false
    loadModel(data, format).then((obj) => {
      if (disposed) return
      root = obj
      // collect stats
      const parts: MeshPart[] = []
      const mats = new Set<string>()
      let i = 0
      obj.traverse((o) => {
        const mesh = o as THREE.Mesh
        if ((mesh as { isMesh?: boolean }).isMesh && mesh.geometry) {
          const g = mesh.geometry as THREE.BufferGeometry
          const pos = g.attributes.position as THREE.BufferAttribute | undefined
          const vtx = pos ? pos.count : 0
          const tri = Math.round(g.index ? g.index.count / 3 : vtx / 3)
          parts.push({ name: mesh.name || `mesh ${i + 1}`, triangles: tri, vertices: vtx })
          const m = mesh.material
          ;(Array.isArray(m) ? m : [m]).forEach((mm) => mm && mats.add((mm as THREE.Material).uuid))
          i++
        }
      })
      const box = new THREE.Box3().setFromObject(obj)
      const size = new THREE.Vector3(); box.getSize(size)
      const centre = new THREE.Vector3(); box.getCenter(centre)
      // recentre on the footprint, rest the base on the grid
      obj.position.set(-centre.x, -box.min.y, -centre.z)
      scene.add(obj)
      const span = Math.max(size.x, size.y, size.z, 0.001)
      orbit.target.set(0, size.y / 2, 0)
      orbit.radius = span * 1.9
      camera.near = span / 1000; camera.far = span * 100; camera.updateProjectionMatrix()
      grid.scale.setScalar(Math.max(1, span / 20))
      applyCamera()
      ;(mount as HTMLElement & { __modelMeshes?: number }).__modelMeshes = parts.length
      setLoading(false)
      cbRef.current.onStats?.(summarizeModel(parts, mats.size, { x: size.x, y: size.y, z: size.z }))
    }).catch((e) => {
      if (disposed) return
      setLoading(false); setFailed(true)
      cbRef.current.onError?.(e instanceof Error ? e.message : 'Could not read this model file.')
    })

    let dragging = false, lastX = 0, lastY = 0, spin = true
    const onDown = (e: PointerEvent) => { dragging = true; spin = false; lastX = e.clientX; lastY = e.clientY; renderer.domElement.style.cursor = 'grabbing' }
    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      orbit.azimuth -= (e.clientX - lastX) * 0.01
      orbit.polar = Math.max(0.05, Math.min(Math.PI - 0.05, orbit.polar - (e.clientY - lastY) * 0.01))
      lastX = e.clientX; lastY = e.clientY; applyCamera()
    }
    const onUp = () => { dragging = false; renderer.domElement.style.cursor = 'grab' }
    const onWheel = (e: WheelEvent) => { e.preventDefault(); orbit.radius = Math.max(0.05, orbit.radius * (1 + e.deltaY * 0.001)); applyCamera() }
    const clampP = (p: number) => Math.max(0.05, Math.min(Math.PI - 0.05, p))
    const onKey = (e: KeyboardEvent) => {
      let h = true
      switch (e.key) {
        case 'ArrowLeft': orbit.azimuth += 0.12; break
        case 'ArrowRight': orbit.azimuth -= 0.12; break
        case 'ArrowUp': orbit.polar = clampP(orbit.polar - 0.12); break
        case 'ArrowDown': orbit.polar = clampP(orbit.polar + 0.12); break
        case '+': case '=': orbit.radius *= 0.9; break
        case '-': case '_': orbit.radius *= 1.1; break
        default: h = false
      }
      if (!h) return
      e.preventDefault(); spin = false; applyCamera()
    }
    const el = renderer.domElement
    el.addEventListener('pointerdown', onDown); window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp); el.addEventListener('wheel', onWheel, { passive: false })
    mount.addEventListener('keydown', onKey)
    const ro = new ResizeObserver(() => { const w = mount.clientWidth || 600; camera.aspect = w / height; camera.updateProjectionMatrix(); renderer.setSize(w, height) })
    ro.observe(mount)

    applyCamera()
    let raf = 0
    const loop = () => { raf = requestAnimationFrame(loop); if (spin && root) { orbit.azimuth += 0.0015; applyCamera() } renderer.render(scene, camera) }
    loop()

    return () => {
      disposed = true; cancelAnimationFrame(raf); ro.disconnect()
      el.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp); el.removeEventListener('wheel', onWheel); mount.removeEventListener('keydown', onKey)
      if (root) scene.remove(root)
      root?.traverse((o) => {
        const mesh = o as THREE.Mesh
        if ((mesh as { isMesh?: boolean }).isMesh) {
          mesh.geometry?.dispose()
          const m = mesh.material
          ;(Array.isArray(m) ? m : [m]).forEach((mm) => (mm as THREE.Material)?.dispose())
        }
      })
      grid.geometry.dispose(); (grid.material as THREE.Material).dispose()
      renderer.dispose(); if (el.parentNode === mount) mount.removeChild(el)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, format, height])

  if (failed) {
    return (
      <div style={{ height }} className="flex w-full flex-col items-center justify-center gap-2 rounded-xl bg-base/60 p-4 text-center" role="img" aria-label="3D model (unavailable)">
        <Boxes className="h-7 w-7 text-slate-600" />
        <p className="text-sm text-slate-300">Could not display this model</p>
        <p className="text-[11px] text-slate-500">3D needs WebGL, or the file may be unsupported — extracted stats (if any) are shown below.</p>
      </div>
    )
  }
  return (
    <div className="relative">
      <div
        ref={mountRef}
        style={{ height }}
        tabIndex={0}
        role="application"
        aria-label="Imported 3D model. Use arrow keys to orbit and plus or minus to zoom."
        className="w-full overflow-hidden rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
      />
      {loading && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-slate-400">
          <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading model…</span>
        </div>
      )}
    </div>
  )
}
