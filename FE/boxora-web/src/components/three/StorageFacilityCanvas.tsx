import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'

interface StorageFacilityCanvasProps {
  scrollProgress: number // 0.0 to 1.0
  timeOfDay?: 'day' | 'sunset' | 'night'
}

export const StorageFacilityCanvas: React.FC<StorageFacilityCanvasProps> = ({
  scrollProgress = 0,
  timeOfDay = 'night'
}) => {
  const mountRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef(scrollProgress)
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 })

  // Keep progressRef updated with prop
  useEffect(() => {
    progressRef.current = scrollProgress
  }, [scrollProgress])

  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    // 1. Scene Setup
    const scene = new THREE.Scene()
    scene.background = null // Transparent so CSS gradients blend perfectly

    // 2. Camera Setup (Full Window)
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    )
    camera.position.set(7.5, 5.5, 11)

    // 3. Renderer Setup
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)

    // 4. Lighting System
    const ambientLight = new THREE.AmbientLight(0x0f172a, 1.4)
    scene.add(ambientLight)

    const dirLight = new THREE.DirectionalLight(0x38bdf8, 2.8)
    dirLight.position.set(12, 18, 10)
    dirLight.castShadow = true
    scene.add(dirLight)

    // Vivid Cyan Point Light
    const cyanPointLight = new THREE.PointLight(0x06b6d4, 4.0, 22)
    cyanPointLight.position.set(0, 3.5, 2.5)
    scene.add(cyanPointLight)

    // Deep Teal Accent Light
    const tealPointLight = new THREE.PointLight(0x0891b2, 3.0, 18)
    tealPointLight.position.set(-4, 2, -1)
    scene.add(tealPointLight)

    // 5. Construct 3D Miniature Self-Storage Facility
    const facilityGroup = new THREE.Group()
    scene.add(facilityGroup)

    // A. Foundation / Polished Reflective Cyber Floor
    const floorGeo = new THREE.BoxGeometry(22, 0.4, 18)
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x060910,
      roughness: 0.2,
      metalness: 0.85
    })
    const floorMesh = new THREE.Mesh(floorGeo, floorMat)
    floorMesh.position.y = -0.2
    floorMesh.receiveShadow = true
    facilityGroup.add(floorMesh)

    // Cyan Grid Helper
    const gridHelper = new THREE.GridHelper(22, 22, 0x0891b2, 0x1e293b)
    gridHelper.position.y = 0.01
    facilityGroup.add(gridHelper)

    // B. Build Multi-tier Storage Units (2 floors x 5 columns)
    const unitWidth = 2.4
    const unitHeight = 2.4
    const unitDepth = 2.2
    const rows = 2
    const cols = 5

    const unitStatuses = [
      { id: 'BX-101', color: 0x10b981 }, // Green (Available)
      { id: 'BX-102', color: 0x06b6d4 }, // Cyan (Occupied)
      { id: 'BX-103', color: 0x0891b2 }, // Teal (Occupied)
      { id: 'BX-104', color: 0x3b82f6 }, // Blue (Reserved)
      { id: 'BX-105', color: 0x10b981 }, // Green (Available)
      { id: 'BX-201', color: 0x8b5cf6 }, // Purple (Occupied)
      { id: 'BX-202', color: 0x10b981 }, // Green (Available)
      { id: 'BX-203', color: 0xf59e0b }, // Amber (Maintenance)
      { id: 'BX-204', color: 0x06b6d4 }, // Cyan (Occupied - Spotlight)
      { id: 'BX-205', color: 0x0891b2 }  // Teal (Occupied)
    ]

    const doors: { mesh: THREE.Mesh; baseY: number; openY: number; unitIdx: number }[] = []
    const innerItems: THREE.Mesh[] = []

    let uIdx = 0
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const statusData = unitStatuses[uIdx % unitStatuses.length]
        const unitGroup = new THREE.Group()

        const posX = (c - (cols - 1) / 2) * (unitWidth + 0.35)
        const posY = r * (unitHeight + 0.25) + unitHeight / 2
        const posZ = 0

        unitGroup.position.set(posX, posY, posZ)

        // Outer Metallic Frame
        const frameGeo = new THREE.BoxGeometry(unitWidth, unitHeight, unitDepth)
        const frameMat = new THREE.MeshStandardMaterial({
          color: 0x0f172a,
          metalness: 0.7,
          roughness: 0.35
        })
        const frame = new THREE.Mesh(frameGeo, frameMat)
        frame.castShadow = true
        frame.receiveShadow = true
        unitGroup.add(frame)

        // LED Strip on Door Header
        const ledGeo = new THREE.BoxGeometry(unitWidth * 0.85, 0.08, 0.08)
        const ledMat = new THREE.MeshBasicMaterial({ color: statusData.color })
        const led = new THREE.Mesh(ledGeo, ledMat)
        led.position.set(0, unitHeight / 2 - 0.1, unitDepth / 2 + 0.05)
        unitGroup.add(led)

        // Sliding Front Door
        const doorGeo = new THREE.BoxGeometry(unitWidth * 0.88, unitHeight * 0.84, 0.06)
        const doorMat = new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          metalness: 0.85,
          roughness: 0.25
        })
        const door = new THREE.Mesh(doorGeo, doorMat)
        door.position.set(0, -0.05, unitDepth / 2 + 0.02)
        door.castShadow = true
        unitGroup.add(door)

        doors.push({
          mesh: door,
          baseY: -0.05,
          openY: 1.6,
          unitIdx: uIdx
        })

        // Stored Objects Inside Unit
        const boxGeo = new THREE.BoxGeometry(0.7, 0.65, 0.7)
        const boxMat = new THREE.MeshStandardMaterial({
          color: uIdx % 2 === 0 ? 0x0284c7 : 0x64748b,
          roughness: 0.45,
          metalness: 0.2
        })
        const box = new THREE.Mesh(boxGeo, boxMat)
        box.position.set(-0.35, -unitHeight / 2 + 0.35, 0)
        unitGroup.add(box)
        innerItems.push(box)

        const box2 = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 0.45, 0.5),
          new THREE.MeshStandardMaterial({ color: 0x0891b2, roughness: 0.35 })
        )
        box2.position.set(0.35, -unitHeight / 2 + 0.28, -0.2)
        unitGroup.add(box2)
        innerItems.push(box2)

        facilityGroup.add(unitGroup)
        uIdx++
      }
    }

    // C. Glowing Data Pulses Travelling in Curves
    const pulses: { mesh: THREE.Mesh; progress: number; path: THREE.Vector3[] }[] = []
    const pulseMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 })

    for (let i = 0; i < 6; i++) {
      const pMesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), pulseMat)
      const pStart = new THREE.Vector3(-7, 0.1, 5)
      const pMid = new THREE.Vector3((i - 2.5) * 2.8, 1.5 + (i % 3) * 0.8, 1.8)
      const pEnd = new THREE.Vector3(7, 4.5, -2)
      scene.add(pMesh)
      pulses.push({
        mesh: pMesh,
        progress: (i * 0.18) % 1,
        path: [pStart, pMid, pEnd]
      })
    }

    // D. Ambient Cyan Dust Particles (Stars / Sensor Nodes)
    const pCount = 140
    const pGeo = new THREE.BufferGeometry()
    const pPositions = new Float32Array(pCount * 3)

    for (let i = 0; i < pCount * 3; i += 3) {
      pPositions[i] = (Math.random() - 0.5) * 26
      pPositions[i + 1] = Math.random() * 12
      pPositions[i + 2] = (Math.random() - 0.5) * 22
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3))
    const pMat = new THREE.PointsMaterial({
      size: 0.08,
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending
    })
    const particleCloud = new THREE.Points(pGeo, pMat)
    scene.add(particleCloud)

    // 6. Mouse Parallax Listener
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = (e.clientX / window.innerWidth) * 2 - 1
      mouseRef.current.targetY = -(e.clientY / window.innerHeight) * 2 + 1
    }
    window.addEventListener('mousemove', handleMouseMove)

    // 7. Window Resize Listener
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', handleResize)

    // 8. Render & Animation Loop
    const clock = new THREE.Clock()
    let animId: number

    // Camera Keyframe Waypoints mapped to scrollProgress (0.0 to 1.0)
    const getCameraTargets = (p: number) => {
      // 0.00 - 0.20: Hero
      if (p < 0.20) {
        const t = p / 0.20
        return {
          pos: new THREE.Vector3(
            THREE.MathUtils.lerp(7.5, 4.5, t),
            THREE.MathUtils.lerp(5.5, 3.8, t),
            THREE.MathUtils.lerp(11, 8.5, t)
          ),
          lookAt: new THREE.Vector3(0, 1.2, 0)
        }
      }
      // 0.20 - 0.45: Smart Access Zoom to Door
      else if (p < 0.45) {
        const t = (p - 0.20) / 0.25
        return {
          pos: new THREE.Vector3(
            THREE.MathUtils.lerp(4.5, 2.2, t),
            THREE.MathUtils.lerp(3.8, 2.4, t),
            THREE.MathUtils.lerp(8.5, 5.0, t)
          ),
          lookAt: new THREE.Vector3(1.2, 1.4, 0)
        }
      }
      // 0.45 - 0.70: Occupancy Grid Overhead Angle
      else if (p < 0.70) {
        const t = (p - 0.45) / 0.25
        return {
          pos: new THREE.Vector3(
            THREE.MathUtils.lerp(2.2, 0.0, t),
            THREE.MathUtils.lerp(2.4, 8.0, t),
            THREE.MathUtils.lerp(5.0, 9.0, t)
          ),
          lookAt: new THREE.Vector3(0, 1.0, 0)
        }
      }
      // 0.70 - 0.88: Inventory & Search Angle
      else if (p < 0.88) {
        const t = (p - 0.70) / 0.18
        return {
          pos: new THREE.Vector3(
            THREE.MathUtils.lerp(0.0, -3.5, t),
            THREE.MathUtils.lerp(8.0, 3.2, t),
            THREE.MathUtils.lerp(9.0, 6.5, t)
          ),
          lookAt: new THREE.Vector3(-0.5, 1.2, 0)
        }
      }
      // 0.88 - 1.00: Final CTA Deep Perspective
      else {
        const t = (p - 0.88) / 0.12
        return {
          pos: new THREE.Vector3(
            THREE.MathUtils.lerp(-3.5, 9.0, t),
            THREE.MathUtils.lerp(3.2, 6.8, t),
            THREE.MathUtils.lerp(6.5, 13.0, t)
          ),
          lookAt: new THREE.Vector3(0, 1.5, 0)
        }
      }
    }

    const currentCamPos = new THREE.Vector3().copy(camera.position)
    const currentLookAt = new THREE.Vector3(0, 1.2, 0)

    const renderLoop = () => {
      const delta = clock.getDelta()
      const elapsed = clock.getElapsedTime()

      // Smooth mouse lerp
      mouseRef.current.x = THREE.MathUtils.lerp(mouseRef.current.x, mouseRef.current.targetX, 0.05)
      mouseRef.current.y = THREE.MathUtils.lerp(mouseRef.current.y, mouseRef.current.targetY, 0.05)

      // Calculate camera target based on scroll progress
      const currentProgress = progressRef.current
      const targets = getCameraTargets(currentProgress)

      // Add subtle mouse parallax offset
      const parallaxX = mouseRef.current.x * 0.9
      const parallaxY = mouseRef.current.y * 0.6
      targets.pos.x += parallaxX
      targets.pos.y += parallaxY

      // Smooth camera interpolation
      currentCamPos.lerp(targets.pos, 0.06)
      currentLookAt.lerp(targets.lookAt, 0.06)
      camera.position.copy(currentCamPos)
      camera.lookAt(currentLookAt)

      // Gentle building breathing sway
      facilityGroup.position.y = Math.sin(elapsed * 1.4) * 0.06
      particleCloud.rotation.y = elapsed * 0.03

      // Animate Stored Boxes Floating Gently
      innerItems.forEach((b, i) => {
        b.position.y += Math.sin(elapsed * 2 + i) * 0.0015
      })

      // Doors animation driven by scroll progression
      // Around Smart Access section (p: 0.25 -> 0.45), highlight unit BX-204 door opens!
      doors.forEach(d => {
        const isSpotlight = d.unitIdx === 8 // BX-204
        let targetY = d.baseY

        if (isSpotlight && currentProgress >= 0.22 && currentProgress <= 0.65) {
          targetY = d.openY
        } else if (currentProgress > 0.85) {
          // Open multiple doors in final CTA
          targetY = (d.unitIdx % 3 === 0) ? d.openY : d.baseY
        }

        d.mesh.position.y = THREE.MathUtils.lerp(d.mesh.position.y, targetY, 0.08)
      })

      // Animate Data Pulses along Bezier curves
      pulses.forEach(p => {
        p.progress += delta * 0.45
        if (p.progress > 1) p.progress = 0

        const [p0, p1, p2] = p.path
        const t = p.progress
        const x = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x
        const y = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y
        const z = (1 - t) * (1 - t) * p0.z + 2 * (1 - t) * t * p1.z + t * t * p2.z
        p.mesh.position.set(x, y, z)
      })

      renderer.render(scene, camera)
      animId = requestAnimationFrame(renderLoop)
    }

    renderLoop()

    // Cleanup
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animId)
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0 overflow-hidden"
      style={{
        maskImage: 'radial-gradient(ellipse 90% 85% at 50% 50%, #000 65%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 90% 85% at 50% 50%, #000 65%, transparent 100%)'
      }}
    />
  )
}
