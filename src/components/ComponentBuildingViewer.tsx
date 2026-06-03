import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Building2 } from 'lucide-react'
import type { BuildingModel, Plate } from '@/lib/building'

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
  height = 460,
}: {
  model: BuildingModel
  hidden?: { glazing?: boolean; structure?: boolean; slabs?: boolean }
  height?: number
}) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const propsRef = useRef({ model, hidden })
  propsRef.current = { model, hidden }

  const rebuildRef = useRef<(() => void) | null>(null)
  useEffect(() => { rebuildRef.current?.() }, [model, hidden.glazing, hidden.structure, hidden.slabs])

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
    mount.appendChild(renderer.domElement)
    renderer.domElement.style.cursor = 'grab'
    renderer.domElement.setAttribute('aria-hidden', 'true')

    scene.add(new THREE.AmbientLight('#9fb2cc', 0.7))
    scene.add(new THREE.HemisphereLight('#dbeafe', '#0a0f1c', 0.6))
    const key = new THREE.DirectionalLight('#ffffff', 1.15); key.position.set(1.2, 2, 1.4); scene.add(key)
    const fill = new THREE.DirectionalLight('#93c5fd', 0.35); fill.position.set(-1.5, 0.6, -1); scene.add(fill)
    const ground = new THREE.Mesh(new THREE.CircleGeometry(200, 64), new THREE.MeshStandardMaterial({ color: '#0e1626', roughness: 1 }))
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; scene.add(ground)
    const grid = new THREE.GridHelper(400, 80, '#1e293b', '#16203a')
    ;(grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.35; scene.add(grid)

    const slabMat = new THREE.MeshStandardMaterial({ color: '#b8c2d0', roughness: 0.85, metalness: 0.05 })
    const colMat = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.6, metalness: 0.15 })
    const coreMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.8 })
    const glassMat = new THREE.MeshStandardMaterial({ color: '#7dd3fc', transparent: true, opacity: 0.24, roughness: 0.08, metalness: 0.4, side: THREE.DoubleSide, depthWrite: false })
    const unitBox = new THREE.BoxGeometry(1, 1, 1)
    const unitPlane = new THREE.PlaneGeometry(1, 1)

    const group = new THREE.Group(); scene.add(group)
    let disposables: THREE.BufferGeometry[] = []
    const objects: THREE.Object3D[] = []

    const orbit = { az: DEF_AZ, polar: DEF_POLAR, radius: 60, target: new THREE.Vector3() }
    const applyCamera = () => {
      camera.position.set(
        orbit.target.x + orbit.radius * Math.sin(orbit.polar) * Math.sin(orbit.az),
        orbit.target.y + orbit.radius * Math.cos(orbit.polar),
        orbit.target.z + orbit.radius * Math.sin(orbit.polar) * Math.cos(orbit.az),
      )
      camera.lookAt(orbit.target)
    }

    const plate = (p: Plate, mat: THREE.Material) => {
      const shape = new THREE.Shape()
      p.polygon.forEach((q, i) => (i ? shape.lineTo(q.x, -q.z) : shape.moveTo(q.x, -q.z)))
      shape.closePath()
      if (p.hole && p.hole.length >= 3) { const h = new THREE.Path(); p.hole.forEach((q, i) => (i ? h.lineTo(q.x, -q.z) : h.moveTo(q.x, -q.z))); h.closePath(); shape.holes.push(h) }
      const geo = new THREE.ExtrudeGeometry(shape, { depth: p.thickness, bevelEnabled: false }); geo.rotateX(-Math.PI / 2)
      disposables.push(geo)
      const mesh = new THREE.Mesh(geo, mat); mesh.position.y = p.y; group.add(mesh); objects.push(mesh)
    }

    const clear = () => {
      for (const o of objects) group.remove(o)
      objects.length = 0
      for (const g of disposables) g.dispose(); disposables = []
    }

    const build = () => {
      clear()
      const { model: m, hidden: h } = propsRef.current
      if (!h.slabs) { for (const s of m.slabs) plate(s, slabMat); if (m.roof) plate(m.roof, slabMat) }
      if (!h.structure) {
        if (m.columns.length) {
          const inst = new THREE.InstancedMesh(unitBox, colMat, m.columns.length)
          const mat = new THREE.Matrix4()
          m.columns.forEach((c, i) => { mat.compose(new THREE.Vector3(c.x, c.y, c.z), new THREE.Quaternion(), new THREE.Vector3(c.w, c.h, c.d)); inst.setMatrixAt(i, mat) })
          inst.instanceMatrix.needsUpdate = true; group.add(inst); objects.push(inst)
        }
        if (m.core) { const cm = new THREE.Mesh(unitBox, coreMat); cm.scale.set(m.core.w, m.core.h, m.core.d); cm.position.set(m.core.x, m.core.y, m.core.z); group.add(cm); objects.push(cm) }
      }
      if (!h.glazing && m.glazing.length) {
        const inst = new THREE.InstancedMesh(unitPlane, glassMat, m.glazing.length)
        const mat = new THREE.Matrix4(); const q = new THREE.Quaternion(); const up = new THREE.Vector3(0, 1, 0)
        const ex = new THREE.Vector3(), ez = new THREE.Vector3()
        m.glazing.forEach((g, i) => {
          ex.set(g.b.x - g.a.x, 0, g.b.z - g.a.z); const L = ex.length() || 1; ex.normalize()
          ez.crossVectors(ex, up).normalize()
          q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ex, up, ez))
          mat.compose(new THREE.Vector3((g.a.x + g.b.x) / 2, g.y + g.h / 2, (g.a.z + g.b.z) / 2), q, new THREE.Vector3(L, g.h, 1))
          inst.setMatrixAt(i, mat)
        })
        inst.instanceMatrix.needsUpdate = true; group.add(inst); objects.push(inst)
      }
      const span = Math.max(m.totalHeight, m.footprint * 1.5, 8)
      orbit.target.set(0, m.totalHeight / 2, 0); orbit.radius = span * 1.7
      scene.fog = new THREE.Fog('#0a0f1c', orbit.radius * 0.7, orbit.radius * 3)
      applyCamera()
      ;(mount as HTMLElement & { __components?: object }).__components = { columns: m.counts.columns, glazing: m.counts.glazingPanels, slabs: m.counts.slabs }
    }
    rebuildRef.current = build

    let dragging = false, lastX = 0, lastY = 0, spin = true
    const onDown = (e: PointerEvent) => { dragging = true; spin = false; lastX = e.clientX; lastY = e.clientY; renderer.domElement.style.cursor = 'grabbing' }
    const onMove = (e: PointerEvent) => { if (!dragging) return; orbit.az -= (e.clientX - lastX) * 0.01; orbit.polar = Math.max(0.08, Math.min(Math.PI / 2 - 0.03, orbit.polar - (e.clientY - lastY) * 0.01)); lastX = e.clientX; lastY = e.clientY; applyCamera() }
    const onUp = () => { dragging = false; renderer.domElement.style.cursor = 'grab' }
    const onWheel = (e: WheelEvent) => { e.preventDefault(); orbit.radius = Math.max(6, Math.min(800, orbit.radius + e.deltaY * 0.07)); applyCamera() }
    const clampP = (p: number) => Math.max(0.08, Math.min(Math.PI / 2 - 0.03, p))
    const onKey = (e: KeyboardEvent) => {
      let h = true
      switch (e.key) { case 'ArrowLeft': orbit.az += 0.12; break; case 'ArrowRight': orbit.az -= 0.12; break; case 'ArrowUp': orbit.polar = clampP(orbit.polar - 0.12); break; case 'ArrowDown': orbit.polar = clampP(orbit.polar + 0.12); break; case '+': case '=': orbit.radius = Math.max(6, orbit.radius - 4); break; case '-': case '_': orbit.radius = Math.min(800, orbit.radius + 4); break; default: h = false }
      if (!h) return; e.preventDefault(); spin = false; applyCamera()
    }
    const el = renderer.domElement
    el.addEventListener('pointerdown', onDown); window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); el.addEventListener('wheel', onWheel, { passive: false }); mount.addEventListener('keydown', onKey)
    const ro = new ResizeObserver(() => { const w = mount.clientWidth || 600; camera.aspect = w / height; camera.updateProjectionMatrix(); renderer.setSize(w, height) }); ro.observe(mount)

    build()
    let raf = 0
    const loop = () => { raf = requestAnimationFrame(loop); if (spin) { orbit.az += 0.0014; applyCamera() } renderer.render(scene, camera) }
    loop()

    return () => {
      cancelAnimationFrame(raf); ro.disconnect()
      el.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); el.removeEventListener('wheel', onWheel); mount.removeEventListener('keydown', onKey)
      clear(); unitBox.dispose(); unitPlane.dispose(); [slabMat, colMat, coreMat, glassMat].forEach((m) => m.dispose())
      ground.geometry.dispose(); (ground.material as THREE.Material).dispose()
      renderer.dispose(); if (el.parentNode === mount) mount.removeChild(el)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height])

  if (failed) {
    return (
      <div style={{ height }} className="flex w-full flex-col items-center justify-center gap-2 rounded-xl bg-base/60 p-4 text-center" role="img" aria-label="Building model (3D unavailable)">
        <Building2 className="h-7 w-7 text-slate-600" />
        <p className="text-sm text-slate-300">{model.counts.storeys} storeys · {model.counts.columns} columns · {model.counts.glazingPanels} façade panels</p>
        <p className="text-[11px] text-slate-500">3D needs WebGL — component counts are computed from the model.</p>
      </div>
    )
  }
  return (
    <div ref={mountRef} style={{ height }} tabIndex={0} role="application" aria-label="3D building model with components. Arrow keys orbit, +/- zoom." className="w-full overflow-hidden rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60" />
  )
}
