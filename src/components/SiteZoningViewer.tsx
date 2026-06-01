import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Map as MapIcon } from 'lucide-react'
import { polygonArea, polygonCentroid, scalePolygon, type Pt, type MassingTier } from '@/lib/zoning'

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')))
  } catch {
    return false
  }
}

/* 3D site & zoning viewer: the site boundary on the ground, the setback
 * (buildable) line, the legal massing envelope extruded to the height limit
 * (translucent), and the proposed scheme nested inside — green when it fits the
 * zoning, red when it busts it. Orbit/zoom/keyboard; graceful WebGL fallback. */
export function SiteZoningViewer({
  boundary,
  buildable,
  maxHeight,
  tiers,
  envelopeTiers,
  proposedHeight,
  compliant,
  height = 460,
}: {
  boundary: Pt[]
  buildable: Pt[]
  maxHeight: number
  tiers: MassingTier[] // podium + tower slabs of the proposed scheme
  envelopeTiers: MassingTier[] // legal envelope, stepped at the sky-exposure plane
  proposedHeight: number
  compliant: boolean
  height?: number
}) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const propsRef = useRef({ boundary, buildable, maxHeight, tiers, envelopeTiers, proposedHeight, compliant })
  propsRef.current = { boundary, buildable, maxHeight, tiers, envelopeTiers, proposedHeight, compliant }

  const rebuildRef = useRef<(() => void) | null>(null)
  useEffect(() => { rebuildRef.current?.() }, [boundary, buildable, maxHeight, tiers, envelopeTiers, proposedHeight, compliant])

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
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 6000)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)
    renderer.domElement.style.cursor = 'grab'
    renderer.domElement.setAttribute('aria-hidden', 'true')

    scene.add(new THREE.AmbientLight('#94a3b8', 0.65))
    scene.add(new THREE.HemisphereLight('#cbd5e1', '#0a0f1c', 0.5))
    const key = new THREE.DirectionalLight('#ffffff', 1.2)
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024)
    const sc = key.shadow.camera as THREE.OrthographicCamera
    scene.add(key); scene.add(key.target)

    const ground = new THREE.Mesh(new THREE.CircleGeometry(400, 64), new THREE.MeshStandardMaterial({ color: '#0e1626', roughness: 1 }))
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; ground.receiveShadow = true
    scene.add(ground)
    const grid = new THREE.GridHelper(800, 80, '#1e293b', '#16203a')
    ;(grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.35
    scene.add(grid)

    const group = new THREE.Group()
    scene.add(group)
    const disposables: { dispose: () => void }[] = []
    const track = <T extends { dispose: () => void }>(o: T): T => { disposables.push(o); return o }

    // Build an extruded prism from a plan polygon (shape uses -z so world Z = plan z).
    const extrude = (pts: Pt[], h: number, mat: THREE.Material): THREE.Mesh => {
      const shape = new THREE.Shape()
      pts.forEach((p, i) => (i ? shape.lineTo(p.x, -p.z) : shape.moveTo(p.x, -p.z)))
      shape.closePath()
      const geo = track(new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.01, h), bevelEnabled: false }))
      geo.rotateX(-Math.PI / 2)
      return new THREE.Mesh(geo, mat)
    }
    const lineLoop = (pts: Pt[], y: number, color: string, dashed = false): THREE.Line => {
      const geo = track(new THREE.BufferGeometry().setFromPoints([...pts, pts[0]].map((p) => new THREE.Vector3(p.x, y, p.z))))
      const mat = track(dashed ? new THREE.LineDashedMaterial({ color, dashSize: 2.5, gapSize: 1.8 }) : new THREE.LineBasicMaterial({ color }))
      const line = new THREE.Line(geo, mat)
      if (dashed) line.computeLineDistances()
      return line
    }

    const envMat = track(new THREE.MeshStandardMaterial({ color: '#38bdf8', transparent: true, opacity: 0.1, roughness: 1, side: THREE.DoubleSide, depthWrite: false }))
    const greenMat = track(new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.5, metalness: 0.05 }))
    const redMat = track(new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.5, metalness: 0.05 }))

    const orbit = { azimuth: Math.PI * 0.25, polar: Math.PI * 0.36, radius: 200, target: new THREE.Vector3() }
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
      group.clear()
      for (const d of disposables) d.dispose()
      disposables.length = 0
    }

    const build = () => {
      clear()
      const { boundary: bnd, buildable: bld, maxHeight: mh, tiers: tr, envelopeTiers: env, proposedHeight: ph, compliant: ok } = propsRef.current
      if (bnd.length < 3) return
      const c = polygonCentroid(bnd)

      group.add(lineLoop(bnd, 0.05, '#e2e8f0')) // site boundary — white
      if (bld.length >= 3) group.add(lineLoop(bld, 0.06, '#fbbf24', true)) // setback — dashed amber

      // legal envelope — one translucent prism per tier (stepped at the sky plane)
      const envBase = bld.length >= 3 ? bld : bnd
      const envBaseArea = polygonArea(envBase)
      for (const et of env) {
        const k = envBaseArea > 0 ? Math.sqrt(Math.min(1, et.footprint / envBaseArea)) : 1
        const poly = k < 0.999 ? scalePolygon(envBase, k, c) : envBase
        const eh = et.top - et.base
        if (eh <= 0) continue
        const prism = extrude(poly, eh, envMat)
        prism.position.y = et.base
        group.add(prism)
        group.add(lineLoop(poly, et.top, '#38bdf8')) // roofline of this tier
      }

      // proposed massing — one prism per tier (podium + tower), each sized to its
      // footprint and nested in the setback shape; stacked base→top
      const baseArea = polygonArea(envBase)
      for (const tier of tr) {
        const k = baseArea > 0 ? Math.sqrt(Math.min(1, tier.footprint / baseArea)) : 0
        const th = tier.top - tier.base
        if (k <= 0 || th <= 0) continue
        const massing = extrude(scalePolygon(envBase, k, c), th, ok ? greenMat : redMat)
        massing.position.y = tier.base
        massing.castShadow = true; massing.receiveShadow = true
        group.add(massing)
      }

      // frame camera + light to the site
      const xs = bnd.map((p) => p.x), zs = bnd.map((p) => p.z)
      const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs), mh, 10)
      orbit.target.set(c.x, mh * 0.4, c.z)
      orbit.radius = span * 1.7
      scene.fog = new THREE.Fog('#0a0f1c', orbit.radius * 0.8, orbit.radius * 3)
      key.position.set(c.x + span, mh + span, c.z + span * 0.6)
      key.target.position.set(c.x, mh * 0.4, c.z)
      sc.left = -span; sc.right = span; sc.top = mh + span; sc.bottom = -span; sc.near = 0.1; sc.far = (mh + span) * 4
      sc.updateProjectionMatrix()
      applyCamera()
      ;(mount as HTMLElement & { __zoning?: { envTop: number; massTop: number; compliant: boolean; envTiers: number } }).__zoning = { envTop: mh, massTop: ph, compliant: ok, envTiers: env.length }
    }
    rebuildRef.current = build

    let dragging = false, lastX = 0, lastY = 0
    const onDown = (e: PointerEvent) => { dragging = true; lastX = e.clientX; lastY = e.clientY; renderer.domElement.style.cursor = 'grabbing' }
    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      orbit.azimuth -= (e.clientX - lastX) * 0.01
      orbit.polar = Math.max(0.08, Math.min(Math.PI / 2 - 0.04, orbit.polar - (e.clientY - lastY) * 0.01))
      lastX = e.clientX; lastY = e.clientY; applyCamera()
    }
    const onUp = () => { dragging = false; renderer.domElement.style.cursor = 'grab' }
    const onWheel = (e: WheelEvent) => { e.preventDefault(); orbit.radius = Math.max(10, Math.min(3000, orbit.radius + e.deltaY * 0.4)); applyCamera() }
    const clampP = (p: number) => Math.max(0.08, Math.min(Math.PI / 2 - 0.04, p))
    const onKeyDown = (e: KeyboardEvent) => {
      let h = true
      switch (e.key) {
        case 'ArrowLeft': orbit.azimuth += 0.12; break
        case 'ArrowRight': orbit.azimuth -= 0.12; break
        case 'ArrowUp': orbit.polar = clampP(orbit.polar - 0.12); break
        case 'ArrowDown': orbit.polar = clampP(orbit.polar + 0.12); break
        case '+': case '=': orbit.radius = Math.max(10, orbit.radius - 12); break
        case '-': case '_': orbit.radius = Math.min(3000, orbit.radius + 12); break
        default: h = false
      }
      if (!h) return
      e.preventDefault(); spin = false; applyCamera()
    }

    const el = renderer.domElement
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    mount.addEventListener('keydown', onKeyDown)
    const ro = new ResizeObserver(() => { const w = mount.clientWidth || 600; camera.aspect = w / height; camera.updateProjectionMatrix(); renderer.setSize(w, height) })
    ro.observe(mount)

    build()
    let raf = 0, spin = true
    el.addEventListener('pointerdown', () => { spin = false }, { once: true })
    const loop = () => { raf = requestAnimationFrame(loop); if (spin) { orbit.azimuth += 0.0014; applyCamera() } renderer.render(scene, camera) }
    loop()

    return () => {
      cancelAnimationFrame(raf); ro.disconnect()
      el.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp); el.removeEventListener('wheel', onWheel); mount.removeEventListener('keydown', onKeyDown)
      clear()
      ground.geometry.dispose(); (ground.material as THREE.Material).dispose()
      ;[envMat, greenMat, redMat].forEach((m) => m.dispose())
      renderer.dispose(); if (el.parentNode === mount) mount.removeChild(el)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height])

  if (failed) {
    return (
      <div style={{ height }} className="flex w-full flex-col items-center justify-center gap-2 rounded-xl bg-base/60 p-4 text-center" role="img" aria-label="Site & zoning (3D unavailable)">
        <MapIcon className="h-7 w-7 text-slate-600" />
        <p className="text-sm text-slate-300">Envelope to {Math.round(maxHeight)} m · proposed {Math.round(proposedHeight)} m — {compliant ? 'within zoning' : 'exceeds zoning'}</p>
        <p className="text-[11px] text-slate-500">3D needs WebGL — the plan diagram and metrics below are still available.</p>
      </div>
    )
  }
  return (
    <div
      ref={mountRef}
      style={{ height }}
      tabIndex={0}
      role="application"
      aria-label="3D site and zoning model. Use arrow keys to orbit and plus or minus to zoom."
      className="w-full overflow-hidden rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60"
    />
  )
}
