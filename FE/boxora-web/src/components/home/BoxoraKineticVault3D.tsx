import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'

export const BoxoraKineticVault3D: React.FC = () => {
  const mountRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    let width = container.clientWidth || window.innerWidth || 1280
    let height = container.clientHeight || window.innerHeight || 720

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene()

    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100)
    // Frame the vault and track prominently on the right
    camera.position.set(5.2, 4.0, 8.2)
    camera.lookAt(1.4, 0.1, 0)

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    container.appendChild(renderer.domElement)

    // 2. Studio Lighting (Balanced key, fill & cyan rim light)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2)
    scene.add(ambientLight)

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4)
    keyLight.position.set(6, 12, 8)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.width = 1024
    keyLight.shadow.mapSize.height = 1024
    keyLight.shadow.bias = -0.0005
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 1.1)
    fillLight.position.set(-6, 6, 4)
    scene.add(fillLight)

    // Cyan Vault Glow PointLight inside portal
    const vaultPointLight = new THREE.PointLight(0x00e5ff, 4.5, 6)
    vaultPointLight.position.set(3.2, 0.3, 0.6)
    scene.add(vaultPointLight)

    // 3. Ground Ambient Occlusion Shadow Plane
    const createShadowTexture = () => {
      const shadowCanvas = document.createElement('canvas')
      shadowCanvas.width = 256
      shadowCanvas.height = 256
      const ctx = shadowCanvas.getContext('2d')
      if (ctx) {
        const gradient = ctx.createRadialGradient(128, 128, 10, 128, 128, 120)
        gradient.addColorStop(0, 'rgba(15, 23, 42, 0.32)')
        gradient.addColorStop(0.45, 'rgba(15, 23, 42, 0.15)')
        gradient.addColorStop(1, 'rgba(15, 23, 42, 0)')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, 256, 256)
      }
      const texture = new THREE.CanvasTexture(shadowCanvas)
      return texture
    }

    const groundShadowGeo = new THREE.PlaneGeometry(8, 6)
    const groundShadowMat = new THREE.MeshBasicMaterial({
      map: createShadowTexture(),
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    })
    const groundShadow = new THREE.Mesh(groundShadowGeo, groundShadowMat)
    groundShadow.rotation.x = -Math.PI / 2
    groundShadow.position.set(1.5, -1.82, 0.5)
    scene.add(groundShadow)

    // 4. Materials with High-Tech Contrast
    const whiteCasingMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.18,
      metalness: 0.05
    })

    const darkPanelMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a, // Deep Cyber Slate
      roughness: 0.35,
      metalness: 0.3
    })

    const metalBevelMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1, // Silver Accent
      roughness: 0.2,
      metalness: 0.6
    })

    const cyanNeonMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x0891b2,
      emissiveIntensity: 1.6,
      roughness: 0.1
    })

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xbae6fd,
      transmission: 0.88,
      opacity: 0.7,
      transparent: true,
      roughness: 0.08,
      ior: 1.45
    })

    // 5. The Smart Vault Machine (Right side: x ≈ 3.2)
    const vaultGroup = new THREE.Group()
    vaultGroup.position.set(3.2, 0, 0)

    // Main Vault Tower Body
    const vaultBodyGeo = new THREE.BoxGeometry(2.3, 3.4, 2.1)
    const vaultBody = new THREE.Mesh(vaultBodyGeo, whiteCasingMat)
    vaultBody.position.y = 0.4
    vaultBody.castShadow = true
    vaultBody.receiveShadow = true
    vaultGroup.add(vaultBody)

    // Vault Base Pedestal (Dark Obsidian with Cyan Trim)
    const baseGeo = new THREE.BoxGeometry(2.6, 0.35, 2.4)
    const baseMesh = new THREE.Mesh(baseGeo, darkPanelMat)
    baseMesh.position.y = -1.45
    baseMesh.castShadow = true
    vaultGroup.add(baseMesh)

    const baseTrimGeo = new THREE.BoxGeometry(2.64, 0.05, 2.44)
    const baseTrimMesh = new THREE.Mesh(baseTrimGeo, cyanNeonMat)
    baseTrimMesh.position.y = -1.25
    vaultGroup.add(baseTrimMesh)

    // Recessed Side Panels (Front & Left)
    const sidePanelGeo = new THREE.BoxGeometry(0.04, 2.8, 1.6)
    const sidePanelMesh = new THREE.Mesh(sidePanelGeo, darkPanelMat)
    sidePanelMesh.position.set(-1.16, 0.4, 0.0)
    vaultGroup.add(sidePanelMesh)

    // Intake Portal Tunnel (where packages slide in)
    const portalGeo = new THREE.BoxGeometry(0.95, 0.95, 1.4)
    const portalMesh = new THREE.Mesh(portalGeo, darkPanelMat)
    portalMesh.position.set(-0.95, -0.2, 0.45)
    vaultGroup.add(portalMesh)

    // Glowing Cyan Laser Ring at the Portal Intake
    const laserRingGeo = new THREE.TorusGeometry(0.52, 0.045, 16, 32)
    const laserRing = new THREE.Mesh(laserRingGeo, cyanNeonMat)
    laserRing.rotation.y = Math.PI / 2
    laserRing.position.set(-1.44, -0.2, 0.45)
    vaultGroup.add(laserRing)

    // Transparent Chute Cylinder on Top of Vault
    const chuteGeo = new THREE.CylinderGeometry(0.52, 0.52, 2.2, 32)
    const chuteMesh = new THREE.Mesh(chuteGeo, glassMat)
    chuteMesh.position.set(0.1, 2.5, 0.1)
    vaultGroup.add(chuteMesh)

    // Chute Intake Rings
    for (let r = 0; r < 3; r++) {
      const ringGeo = new THREE.TorusGeometry(0.54, 0.035, 16, 32)
      const ringMesh = new THREE.Mesh(ringGeo, cyanNeonMat)
      ringMesh.rotation.x = Math.PI / 2
      ringMesh.position.set(0.1, 1.7 + r * 0.7, 0.1)
      vaultGroup.add(ringMesh)
    }

    // Smart Locker Compartment Grooves (Glowing LED rows)
    for (let row = 0; row < 4; row++) {
      const ledRowGeo = new THREE.BoxGeometry(0.06, 0.14, 1.3)
      const ledRowMesh = new THREE.Mesh(ledRowGeo, cyanNeonMat)
      ledRowMesh.position.set(-1.17, 0.6 + row * 0.45, 0.1)
      vaultGroup.add(ledRowMesh)
    }

    // Digital Status Screen on Vault Left Side
    const screenGeo = new THREE.BoxGeometry(0.05, 0.55, 0.75)
    const screenMesh = new THREE.Mesh(screenGeo, cyanNeonMat)
    screenMesh.position.set(-1.17, -0.3, -0.5)
    vaultGroup.add(screenMesh)

    scene.add(vaultGroup)

    // 6. Curved Kinetic Slide Track (Smooth S-Curve entering the Portal)
    const curvePoints = [
      new THREE.Vector3(-4.2, -2.1, 2.8),
      new THREE.Vector3(-2.6, -1.7, 2.3),
      new THREE.Vector3(-1.0, -1.1, 1.6),
      new THREE.Vector3(0.6, -0.6, 1.1),
      new THREE.Vector3(1.9, -0.2, 0.45)
    ]
    const trackCurve = new THREE.CatmullRomCurve3(curvePoints)
    trackCurve.curveType = 'centripetal'

    // Extruded Track Bed
    const trackGeo = new THREE.TubeGeometry(trackCurve, 80, 0.4, 12, false)
    const trackMesh = new THREE.Mesh(trackGeo, metalBevelMat)
    trackMesh.receiveShadow = true
    scene.add(trackMesh)

    // Dual Glowing Cyan Guide Rails
    const railGeo = new THREE.TubeGeometry(trackCurve, 80, 0.04, 8, false)
    const rail1 = new THREE.Mesh(railGeo, cyanNeonMat)
    rail1.position.y += 0.2
    rail1.position.z -= 0.2
    scene.add(rail1)

    const rail2 = new THREE.Mesh(railGeo, cyanNeonMat)
    rail2.position.y += 0.2
    rail2.position.z += 0.2
    scene.add(rail2)

    // Track Support Struts
    const strutPositions = [-3.2, -1.6, 0.1]
    strutPositions.forEach((sx) => {
      const strutGeo = new THREE.CylinderGeometry(0.07, 0.09, 1.8, 16)
      const strutMesh = new THREE.Mesh(strutGeo, metalBevelMat)
      const samplePoint = trackCurve.getPointAt((sx + 4.2) / 6.1)
      strutMesh.position.set(samplePoint.x, samplePoint.y - 0.9, samplePoint.z)
      scene.add(strutMesh)
    })

    // 7. Kinetic Smart Storage Boxes (Continuous Flowing Loop)
    const boxCount = 5
    const boxPalette = [
      { color: 0x0891b2, emissive: 0x06b6d4 }, // Boxora Cyan-Teal
      0x0f172a,                               // Cyber Slate
      0x10b981,                               // Emerald IoT
      0x0284c7,                               // Sky Electric
      0xf59e0b                                // Amber Priority
    ]

    const boxMeshes: THREE.Mesh[] = []

    for (let i = 0; i < boxCount; i++) {
      const bGeo = new THREE.BoxGeometry(0.54, 0.48, 0.48)
      const pal = boxPalette[i % boxPalette.length]
      const colorVal = typeof pal === 'object' ? pal.color : pal

      const bMat = new THREE.MeshStandardMaterial({
        color: colorVal,
        roughness: 0.2,
        metalness: 0.15
      })

      const box = new THREE.Mesh(bGeo, bMat)
      box.castShadow = true

      // Glowing Accent Lock Stripe on top of each box
      const stripeGeo = new THREE.BoxGeometry(0.56, 0.09, 0.5)
      const stripeMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x00e5ff,
        emissiveIntensity: 0.8
      })
      const stripe = new THREE.Mesh(stripeGeo, stripeMat)
      box.add(stripe)

      scene.add(box)
      boxMeshes.push(box)
    }

    // Chute descending parcel (simulates new box feeding into chute)
    const chuteBoxGeo = new THREE.BoxGeometry(0.44, 0.44, 0.44)
    const chuteBoxMat = new THREE.MeshStandardMaterial({
      color: 0x0891b2,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.6,
      roughness: 0.2
    })
    const chuteBox = new THREE.Mesh(chuteBoxGeo, chuteBoxMat)
    scene.add(chuteBox)

    // 8. Interactive Parallax Mouse Listener
    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 }
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const isInside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom
      mouse.targetX = isInside ? ((e.clientX - rect.left) / rect.width - 0.5) * 2 : 0
      mouse.targetY = isInside ? ((e.clientY - rect.top) / rect.height - 0.5) * 2 : 0
    }
    window.addEventListener('mousemove', handleMouseMove)

    // 9. Resize Handler
    const handleResize = () => {
      if (!container) return
      width = container.clientWidth || window.innerWidth || 1280
      height = container.clientHeight || window.innerHeight || 720
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }
    window.addEventListener('resize', handleResize)

    // 10. Animation Render Loop
    let animationFrameId: number
    let isVisible = true
    const startTime = performance.now()

    const handleVisibility = () => {
      isVisible = !document.hidden
    }
    document.addEventListener('visibilitychange', handleVisibility)

    const baseCameraX = 5.2
    const baseCameraY = 4.0

    const render = () => {
      if (!isVisible) {
        animationFrameId = requestAnimationFrame(render)
        return
      }

      const elapsedTime = (performance.now() - startTime) * 0.001

      // Smooth Mouse Parallax
      mouse.x += (mouse.targetX - mouse.x) * 0.05
      mouse.y += (mouse.targetY - mouse.y) * 0.05

      camera.position.x = baseCameraX + mouse.x * 0.6
      camera.position.y = baseCameraY - mouse.y * 0.35
      camera.lookAt(1.4, 0.1, 0)

      // Move Boxes continuously along the track spline
      const speed = 0.14
      for (let i = 0; i < boxCount; i++) {
        const offset = i / boxCount
        const t = (elapsedTime * speed + offset) % 1

        const pos = trackCurve.getPointAt(t)
        const tangent = trackCurve.getTangentAt(t)

        boxMeshes[i].position.set(pos.x, pos.y + 0.36, pos.z)

        // Orient box along the direction of travel
        const lookTarget = pos.clone().add(tangent)
        boxMeshes[i].lookAt(lookTarget)

        // Entrance animation: Scale down smoothly when entering the portal
        if (t > 0.88) {
          const shrink = Math.max(0.01, (1 - t) / 0.12)
          boxMeshes[i].scale.set(shrink, shrink, shrink)
        } else if (t < 0.08) {
          const grow = Math.min(1, t / 0.08)
          boxMeshes[i].scale.set(grow, grow, grow)
        } else {
          boxMeshes[i].scale.set(1, 1, 1)
        }
      }

      // Chute Box descending cycle
      const chuteT = (elapsedTime * 0.36) % 1
      chuteBox.position.set(3.3, 3.4 - chuteT * 1.5, 0.1)
      chuteBox.rotation.y = elapsedTime * 1.6

      // Pulse Laser Ring
      laserRing.scale.setScalar(1 + Math.sin(elapsedTime * 6) * 0.06)
      vaultPointLight.intensity = 4.0 + Math.sin(elapsedTime * 5) * 1.0

      renderer.render(scene, camera)
      animationFrameId = requestAnimationFrame(render)
    }

    render()

    // 11. Clean Safe Disposal
    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('visibilitychange', handleVisibility)

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose()
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose())
          } else if (obj.material) {
            obj.material.dispose()
          }
        }
      })

      renderer.dispose()
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 w-full h-full pointer-events-none select-none z-0 overflow-hidden"
      aria-hidden="true"
    />
  )
}
