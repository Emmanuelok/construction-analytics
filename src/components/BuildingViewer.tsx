import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Boxes } from 'lucide-react'
import { buildMassing, floorColor, type ColorMode, type MassingInput, type FloorSpec } from '@/lib/massing'

/** Probe WebGL support once, so we can render a graceful fallback instead of
 *  letting Three.js throw and blank the page on machines without a GPU/WebGL. */
function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')))
  } catch {
    return false
  }
}

/* A real WebGL 3D building model (Three.js): an orbitable, lit floor stack built
 * from the project's GFA / storeys / % complete, with each floor coloured by the
 * chosen analytics mode and clickable to select. No external controls lib — a
 * small pointer-drag orbit + wheel-zoom is implemented inline so the dependency
 * surface stays minimal. Everything is disposed on unmount. */
export function BuildingViewer({
  input,
  mode,
  metric,
  selected,
  onSelectFloor,
  height = 420,
}: {
  input: MassingInput
  mode: ColorMode
  metric: number
  selected?: number | null
  onSelectFloor?: (index: number) => void
  height?: number
}) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  // Keep the latest props in refs so the imperative scene can read them without
  // re-initialising the renderer on every change.
  const propsRef = useRef({ input, mode, metric, selected, onSelectFloor })
  propsRef.current = { input, mode, metric, selected, onSelectFloor }

  // Rebuild only the floor meshes when the data that changes geometry changes.
  const rebuildRef = useRef<(() => void) | null>(null)
  useEffect(() => { rebuildRef.current?.() }, [input.gfa, input.progress, input.storeys, input.shape, input.customShape, input.towerShape, input.aspect, input.taper, input.podium, input.towerSetback, input.twist, mode, metric, selected])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    if (!webglAvailable()) { setFailed(true); return }
    const width = mount.clientWidth || 600

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    } catch {
      setFailed(true)
      return
    }

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0a0f1c')
    // Fog is set per-build once we know the building height (see buildFloors),
    // so tall towers aren't swallowed by a fixed fog distance.

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)
    renderer.domElement.style.cursor = 'grab'
    renderer.domElement.setAttribute('aria-hidden', 'true')

    // ── lighting ──────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight('#94a3b8', 0.55))
    scene.add(new THREE.HemisphereLight('#cbd5e1', '#0a0f1c', 0.5))
    const key = new THREE.DirectionalLight('#ffffff', 1.4)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    const sc = key.shadow.camera as THREE.OrthographicCamera // position + frustum sized per-build
    scene.add(key)
    scene.add(key.target)

    // ── ground ────────────────────────────────────────────────────────────────
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(34, 64),
      new THREE.MeshStandardMaterial({ color: '#0e1626', roughness: 1, metalness: 0 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.02
    ground.receiveShadow = true
    scene.add(ground)
    const grid = new THREE.GridHelper(60, 60, '#1e293b', '#16203a')
    ;(grid.material as THREE.Material).transparent = true
    ;(grid.material as THREE.Material).opacity = 0.5
    scene.add(grid)

    // ── floor stack (rebuilt on data change) ───────────────────────────────────
    const stack = new THREE.Group()
    scene.add(stack)
    const floorMeshes: { mesh: THREE.Mesh; index: number }[] = []

    const buildFloors = () => {
      // dispose old
      for (const { mesh } of floorMeshes) {
        stack.remove(mesh)
        mesh.geometry.dispose()
        ;(mesh.material as THREE.Material).dispose()
      }
      floorMeshes.length = 0

      const { input: inp, mode: md, metric: mt, selected: sel } = propsRef.current
      const massing = buildMassing(inp)

      for (const f of massing.floors as FloorSpec[]) {
        // extrude the floor's plan polygon (any shape) into a real prism
        const shape = new THREE.Shape()
        f.polygon.forEach((p, i) => (i ? shape.lineTo(p.x, -p.z) : shape.moveTo(p.x, -p.z)))
        shape.closePath()
        if (f.hole && f.hole.length >= 3) { // courtyard / atrium void
          const hp = new THREE.Path()
          f.hole.forEach((p, i) => (i ? hp.lineTo(p.x, -p.z) : hp.moveTo(p.x, -p.z)))
          hp.closePath()
          shape.holes.push(hp)
        }
        const geo = new THREE.ExtrudeGeometry(shape, { depth: f.height, bevelEnabled: false })
        geo.rotateX(-Math.PI / 2) // plan (xy) → ground (xz), extrude up +y
        const isSel = sel === f.index
        const color = new THREE.Color(floorColor(md, f, mt))
        const mat = new THREE.MeshStandardMaterial({
          color,
          roughness: 0.5,
          metalness: 0.1,
          transparent: true,
          opacity: f.built || md !== 'progress' ? 0.96 : 0.32, // planned floors ghosted in 4D mode
          emissive: isSel ? color : new THREE.Color('#000000'),
          emissiveIntensity: isSel ? 0.5 : 0,
        })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.position.y = f.y - f.height / 2 // prism rises from the slab; floor 0 on the ground
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.userData.index = f.index
        stack.add(mesh)
        floorMeshes.push({ mesh, index: f.index })

        if (isSel) {
          const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(geo),
            new THREE.LineBasicMaterial({ color: '#e2e8f0' }),
          )
          mesh.add(edges) // child of mesh → inherits its transform
        }
      }
      // frame the camera + fog to the building's actual size each rebuild, so
      // both short fit-outs and tall towers are fully visible.
      const h = massing.totalHeight
      const span = Math.max(h, massing.footprint * 2)
      const centre = h / 2 // building sits on the ground, so orbit around its mid-height
      orbit.target.set(0, centre, 0)
      orbit.radius = Math.max(14, span * 1.5)
      scene.fog = new THREE.Fog('#0a0f1c', orbit.radius * 0.6, orbit.radius * 2.4)
      ground.scale.setScalar(Math.max(1, span / 24))
      grid.scale.setScalar(Math.max(1, span / 24))
      // size the key light + shadow frustum to the building so tall towers are lit/shadowed
      key.position.set(span * 0.8, h + span * 0.8, span * 0.6)
      key.target.position.set(0, centre, 0)
      sc.left = -span; sc.right = span; sc.top = h + span; sc.bottom = -span; sc.near = 0.1; sc.far = (h + span) * 3
      sc.updateProjectionMatrix()
      applyCamera()
      // debug hooks for tests/automation — floor count + the building's base height
      // (lowest floor's underside; must be ≥0 so nothing dips below the ground)
      const f0 = massing.floors[0]
      ;(mount as HTMLElement & { __floorCount?: number; __baseY?: number; __platePts?: number }).__floorCount = floorMeshes.length
      ;(mount as HTMLElement & { __baseY?: number }).__baseY = f0 ? f0.y - f0.height / 2 : 0
      ;(mount as HTMLElement & { __platePts?: number }).__platePts = f0 ? f0.polygon.length : 0
      ;(mount as HTMLElement & { __hasHole?: boolean }).__hasHole = !!(f0 && f0.hole)
      ;(mount as HTMLElement & { __topPlatePts?: number }).__topPlatePts = massing.floors.length ? massing.floors[massing.floors.length - 1].polygon.length : 0
    }
    rebuildRef.current = buildFloors

    // ── inline orbit controls (azimuth/polar/radius) ───────────────────────────
    const orbit = { azimuth: Math.PI * 0.25, polar: Math.PI * 0.32, radius: 26, target: new THREE.Vector3(0, 0, 0) }
    const applyCamera = () => {
      const { azimuth, polar, radius, target } = orbit
      camera.position.set(
        target.x + radius * Math.sin(polar) * Math.sin(azimuth),
        target.y + radius * Math.cos(polar),
        target.z + radius * Math.sin(polar) * Math.cos(azimuth),
      )
      camera.lookAt(target)
    }

    let dragging = false, lastX = 0, lastY = 0, moved = false
    const onDown = (e: PointerEvent) => { dragging = true; moved = false; lastX = e.clientX; lastY = e.clientY; renderer.domElement.style.cursor = 'grabbing' }
    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - lastX, dy = e.clientY - lastY
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true
      lastX = e.clientX; lastY = e.clientY
      orbit.azimuth -= dx * 0.01
      orbit.polar = Math.max(0.12, Math.min(Math.PI / 2 - 0.05, orbit.polar - dy * 0.01))
      applyCamera()
    }
    const onUp = () => { dragging = false; renderer.domElement.style.cursor = 'grab' }
    const onWheel = (e: WheelEvent) => { e.preventDefault(); orbit.radius = Math.max(6, Math.min(400, orbit.radius + e.deltaY * 0.05)); applyCamera() }

    // click → raycast → select floor (only if it wasn't a drag)
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const onClick = (e: PointerEvent) => {
      if (moved) return
      const rect = renderer.domElement.getBoundingClientRect()
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(ndc, camera)
      const hit = raycaster.intersectObjects(floorMeshes.map((f) => f.mesh))[0]
      if (hit) propsRef.current.onSelectFloor?.(hit.object.userData.index as number)
    }

    const el = renderer.domElement
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('click', onClick)

    const onResize = () => {
      const w = mount.clientWidth || 600
      camera.aspect = w / height
      camera.updateProjectionMatrix()
      renderer.setSize(w, height)
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(mount)

    buildFloors()
    applyCamera()

    let raf = 0
    let autoSpin = true
    const stopSpin = () => { autoSpin = false }
    el.addEventListener('pointerdown', stopSpin, { once: true })
    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (autoSpin) { orbit.azimuth += 0.0015; applyCamera() }
      renderer.render(scene, camera)
    }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('click', onClick)
      for (const { mesh } of floorMeshes) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose() }
      ground.geometry.dispose(); (ground.material as THREE.Material).dispose()
      renderer.dispose()
      if (el.parentNode === mount) mount.removeChild(el)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height])

  if (failed) {
    // Graceful fallback: a CSS floor stack so the page never blanks without WebGL.
    const mass = buildMassing(input)
    const shown = mass.floors.slice().reverse().slice(0, 24)
    return (
      <div style={{ height }} className="flex w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-xl bg-base/60 p-4" role="img" aria-label="Building floor stack (3D unavailable)">
        <div className="flex flex-col items-center gap-px">
          {shown.map((f) => {
            const xs = f.polygon.map((p) => p.x)
            const w = Math.max(...xs) - Math.min(...xs)
            return <div key={f.index} title={f.label} style={{ width: `${Math.max(24, w * 11)}px` }} className={`h-2 rounded-sm ${f.built ? 'bg-emerald-500/80' : 'bg-slate-600/60'}`} />
          })}
          <div className="mt-1.5 h-1 w-32 rounded bg-slate-700/70" />
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-slate-500"><Boxes className="h-3.5 w-3.5" /> {mass.storeys} storeys · {mass.builtPct}% built · 3D needs WebGL</p>
      </div>
    )
  }

  return <div ref={mountRef} style={{ height }} className="w-full overflow-hidden rounded-xl" role="img" aria-label="Interactive 3D building model" />
}
