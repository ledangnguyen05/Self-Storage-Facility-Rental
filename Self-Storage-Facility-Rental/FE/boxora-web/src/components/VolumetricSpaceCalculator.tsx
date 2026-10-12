import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import * as THREE from 'three'

// ============================================================================
// ITEM TYPES & SPECIFICATIONS (Real-world storage item dimensions)
// ============================================================================
export interface StorageItemDef {
  id: string
  name: string
  subtitle: string
  width: number // X (meters)
  depth: number // Z (meters)
  height: number // Y (meters)
  volume: number // m³
  weightKg: number
  colorHex: number
  edgeColorHex: number
  icon: string
  badgeText: string
}

export const STORAGE_ITEM_DEFS: StorageItemDef[] = [
  {
    id: 'carton',
    name: 'Thùng Carton Tiêu Chuẩn',
    subtitle: '0.5m × 0.4m × 0.4m',
    width: 0.5,
    depth: 0.4,
    height: 0.4,
    volume: 0.08,
    weightKg: 15,
    colorHex: 0xd97706, // Kraft Amber
    edgeColorHex: 0x92400e,
    icon: 'inventory_2',
    badgeText: '0.08 m³'
  },
  {
    id: 'luggage',
    name: 'Vali Du Lịch Cỡ Lớn',
    subtitle: '0.75m × 0.45m × 0.35m',
    width: 0.75,
    depth: 0.45,
    height: 0.35,
    volume: 0.12,
    weightKg: 25,
    colorHex: 0x0891b2, // Boxora Deep Teal
    edgeColorHex: 0x164e63,
    icon: 'luggage',
    badgeText: '0.12 m³'
  },
  {
    id: 'sofa',
    name: 'Ghế Sofa Băng Đôi',
    subtitle: '1.5m × 0.8m × 0.75m',
    width: 1.5,
    depth: 0.8,
    height: 0.75,
    volume: 0.9,
    weightKg: 45,
    colorHex: 0x475569, // Modern Slate Indigo
    edgeColorHex: 0x1e293b,
    icon: 'chair',
    badgeText: '0.90 m³'
  },
  {
    id: 'bed',
    name: 'Nệm & Khung Giường Đơn',
    subtitle: '1.9m × 1.0m × 0.35m',
    width: 1.9,
    depth: 1.0,
    height: 0.35,
    volume: 0.67,
    weightKg: 35,
    colorHex: 0x94a3b8, // Light Slate / Off-White
    edgeColorHex: 0x475569,
    icon: 'bed',
    badgeText: '0.67 m³'
  },
  {
    id: 'fridge',
    name: 'Tủ Lạnh Mini / Thiết Bị',
    subtitle: '0.55m × 0.55m × 0.9m',
    width: 0.55,
    depth: 0.55,
    height: 0.9,
    volume: 0.27,
    weightKg: 30,
    colorHex: 0x64748b, // Brushed Steel
    edgeColorHex: 0x334155,
    icon: 'kitchen',
    badgeText: '0.27 m³'
  },
  {
    id: 'cabinet',
    name: 'Tủ Hồ Sơ Doanh Nghiệp',
    subtitle: '0.85m × 0.45m × 1.3m',
    width: 0.85,
    depth: 0.45,
    height: 1.3,
    volume: 0.5,
    weightKg: 40,
    colorHex: 0x1e293b, // Dark Charcoal Iron
    edgeColorHex: 0x0f172a,
    icon: 'folder_shared',
    badgeText: '0.50 m³'
  }
]

// Preset scenarios for instant 1-click loading
interface PresetScenario {
  id: string
  label: string
  icon: string
  items: Record<string, number>
}

const PRESET_SCENARIOS: PresetScenario[] = [
  {
    id: 'student',
    label: 'Cá Nhân / Sinh Viên',
    icon: 'school',
    items: { carton: 4, luggage: 2, sofa: 0, bed: 0, fridge: 0, cabinet: 0 }
  },
  {
    id: 'apartment_1br',
    label: 'Căn Hộ 1PN',
    icon: 'apartment',
    items: { carton: 8, luggage: 3, sofa: 1, bed: 0, fridge: 1, cabinet: 0 }
  },
  {
    id: 'family_2br',
    label: 'Gia Đình 2-3PN',
    icon: 'home',
    items: { carton: 14, luggage: 4, sofa: 1, bed: 1, fridge: 1, cabinet: 1 }
  },
  {
    id: 'business',
    label: 'Shop / Doanh Nghiệp',
    icon: 'storefront',
    items: { carton: 22, luggage: 4, sofa: 1, bed: 1, fridge: 2, cabinet: 3 }
  }
]

// Placed 3D item in isometric coordinate system
interface PlacedBox {
  id: string
  typeId: string
  x: number // center X in meters
  y: number // center Y in meters
  z: number // center Z in meters
  w: number
  h: number
  d: number
  colorHex: number
  edgeColorHex: number
}

export const VolumetricSpaceCalculator: React.FC = () => {
  // Quantities for each item
  const [quantities, setQuantities] = useState<Record<string, number>>({
    carton: 8,
    luggage: 3,
    sofa: 1,
    bed: 0,
    fridge: 1,
    cabinet: 0
  })

  // 3D Canvas Mounting Ref
  const canvasContainerRef = useRef<HTMLDivElement>(null)

  // Camera Orbit & View Controls State
  const [autoRotate, setAutoRotate] = useState<boolean>(true)
  const [cameraView, setCameraView] = useState<'iso' | 'front' | 'top'>('iso')

  // Calculate live volume and metrics
  const totalVolume = useMemo(() => {
    return Object.entries(quantities).reduce((acc, [id, count]) => {
      const def = STORAGE_ITEM_DEFS.find((item) => item.id === id)
      return acc + (def ? def.volume * count : 0)
    }, 0)
  }, [quantities])

  const totalItemsCount = useMemo(() => {
    return Object.values(quantities).reduce((acc, count) => acc + count, 0)
  }, [quantities])

  const totalWeightKg = useMemo(() => {
    return Object.entries(quantities).reduce((acc, [id, count]) => {
      const def = STORAGE_ITEM_DEFS.find((item) => item.id === id)
      return acc + (def ? def.weightKg * count : 0)
    }, 0)
  }, [quantities])

  // Determine Vault dimensions dynamically
  const vaultDims = useMemo(() => {
    if (totalVolume > 9.0) {
      return { width: 3.6, depth: 2.4, height: 2.8, name: 'Kho Thương Mại' }
    }
    return { width: 2.4, depth: 2.0, height: 2.5, name: 'Kho Cá Nhân Tiêu Chuẩn' }
  }, [totalVolume])

  const vaultCapacity = vaultDims.width * vaultDims.depth * vaultDims.height
  const fillPercentage = Math.min(100, Math.round((totalVolume / vaultCapacity) * 100))

  // Recommended Boxora Unit Package
  const recommendedUnit = useMemo(() => {
    if (totalVolume <= 1.5) {
      return {
        id: 'BX-101',
        name: 'Locker Mini A1',
        size: '2.5 m²',
        volume: '6.5 m³',
        monthlyPrice: '850.000₫',
        desc: 'Phù hợp vali, sách vở tài liệu và quần áo lưu trữ theo mùa.',
        tag: 'Tiết Kiệm Tối Ưu'
      }
    }
    if (totalVolume <= 5.5) {
      return {
        id: 'BX-102',
        name: 'Kho Cá Nhân B2',
        size: '5.0 m²',
        volume: '13.5 m³',
        monthlyPrice: '1.850.000₫',
        desc: 'Lựa chọn hoàn hảo cho chung cư 1 phòng ngủ, bàn ghế, đồ điện tử.',
        tag: 'Phổ Biến Nhất'
      }
    }
    if (totalVolume <= 11.0) {
      return {
        id: 'BX-103',
        name: 'Kho Tiêu Chuẩn C1',
        size: '7.5 m²',
        volume: '20.0 m³',
        monthlyPrice: '2.450.000₫',
        desc: 'Chứa vừa toàn bộ nội thất gia đình 2-3 phòng ngủ, sofa lớn, tủ lạnh.',
        tag: 'Rộng Rãi & Tiện Lợi'
      }
    }
    return {
      id: 'BX-202',
      name: 'Kho Thương Mại Logistics',
      size: '15.0 m²',
      volume: '38.0 m³',
      monthlyPrice: '3.900.000₫',
      desc: 'Kho pallet thương mại điện tử, tài liệu kế toán doanh nghiệp.',
      tag: 'Chuẩn Doanh Nghiệp'
    }
  }, [totalVolume])

  // Handlers for item steppers
  const updateQuantity = useCallback((id: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[id] || 0
      const next = Math.max(0, Math.min(40, current + delta))
      return { ...prev, [id]: next }
    })
  }, [])

  const applyPreset = useCallback((preset: PresetScenario) => {
    setQuantities(preset.items)
  }, [])

  const resetAllItems = useCallback(() => {
    setQuantities({
      carton: 0,
      luggage: 0,
      sofa: 0,
      bed: 0,
      fridge: 0,
      cabinet: 0
    })
  }, [])

  // ============================================================================
  // THREE.JS 3D ISOMETRIC PACKING ENGINE & ORBIT CONTROLS
  // ============================================================================
  useEffect(() => {
    const container = canvasContainerRef.current
    if (!container) return

    // 1. Scene Setup
    const scene = new THREE.Scene()
    scene.background = null // Transparent for seamless integration

    // 2. Camera Setup (Perspective with telephoto isometric angle)
    const width = container.clientWidth
    const height = container.clientHeight
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100)

    // Camera target center (center of vault)
    const targetY = vaultDims.height / 2
    const cameraTarget = new THREE.Vector3(0, targetY, 0)

    let radius = 7.2
    let theta = -Math.PI / 4 // yaw
    let phi = Math.PI / 5.5 // pitch

    const updateCameraPos = () => {
      camera.position.x = cameraTarget.x + radius * Math.cos(phi) * Math.sin(theta)
      camera.position.y = cameraTarget.y + radius * Math.sin(phi)
      camera.position.z = cameraTarget.z + radius * Math.cos(phi) * Math.cos(theta)
      camera.lookAt(cameraTarget)
    }
    updateCameraPos()

    // 3. Renderer Setup
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    // 4. Lighting System
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2)
    scene.add(ambientLight)

    const mainLight = new THREE.DirectionalLight(0xffffff, 2.0)
    mainLight.position.set(6, 12, 8)
    mainLight.castShadow = true
    mainLight.shadow.mapSize.width = 1024
    mainLight.shadow.mapSize.height = 1024
    mainLight.shadow.camera.near = 0.5
    mainLight.shadow.camera.far = 25
    mainLight.shadow.bias = -0.0005
    scene.add(mainLight)

    const fillLight = new THREE.DirectionalLight(0x0891b2, 1.0)
    fillLight.position.set(-8, 6, -6)
    scene.add(fillLight)

    // 5. Vault Bounding Box & Wireframe Cage
    const vaultGroup = new THREE.Group()
    scene.add(vaultGroup)

    const vW = vaultDims.width
    const vD = vaultDims.depth
    const vH = vaultDims.height

    // Floor Grid with subtle Boxora Cyan lines
    const gridHelper = new THREE.GridHelper(Math.max(vW, vD) * 1.5, 12, 0x0891b2, 0x334155)
    gridHelper.position.y = -0.01
    if (gridHelper.material instanceof THREE.Material) {
      gridHelper.material.opacity = 0.35
      gridHelper.material.transparent = true
    }
    vaultGroup.add(gridHelper)

    // Floor Mesh for receiving shadows
    const floorGeo = new THREE.PlaneGeometry(vW, vD)
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.8,
      metalness: 0.2
    })
    const floorMesh = new THREE.Mesh(floorGeo, floorMat)
    floorMesh.rotation.x = -Math.PI / 2
    floorMesh.receiveShadow = true
    vaultGroup.add(floorMesh)

    // Vault Transparent Glass Enclosure & Edge Outlines
    const cageGeo = new THREE.BoxGeometry(vW, vH, vD)
    const cageEdges = new THREE.EdgesGeometry(cageGeo)
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0x0891b2,
      linewidth: 1.5,
      transparent: true,
      opacity: 0.7
    })
    const cageLines = new THREE.LineSegments(cageEdges, edgeMat)
    cageLines.position.y = vH / 2
    vaultGroup.add(cageLines)

    // Vault Corner Brackets Accent
    const bracketMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    const bracketCorners = [
      [-vW / 2, 0, -vD / 2],
      [vW / 2, 0, -vD / 2],
      [-vW / 2, 0, vD / 2],
      [vW / 2, 0, vD / 2],
      [-vW / 2, vH, -vD / 2],
      [vW / 2, vH, -vD / 2],
      [-vW / 2, vH, vD / 2],
      [vW / 2, vH, vD / 2]
    ]
    bracketCorners.forEach(([cx, cy, cz]) => {
      const bGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08)
      const bMesh = new THREE.Mesh(bGeo, bracketMat)
      bMesh.position.set(cx, cy, cz)
      vaultGroup.add(bMesh)
    })

    // Laser Holographic Scanning Plane
    const laserPlaneGeo = new THREE.PlaneGeometry(vW, vD)
    const laserPlaneMat = new THREE.MeshBasicMaterial({
      color: 0x0891b2,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide
    })
    const laserPlaneMesh = new THREE.Mesh(laserPlaneGeo, laserPlaneMat)
    laserPlaneMesh.rotation.x = -Math.PI / 2
    laserPlaneMesh.position.y = 0.1
    vaultGroup.add(laserPlaneMesh)

    // Laser Line Edge
    const laserEdges = new THREE.EdgesGeometry(laserPlaneGeo)
    const laserLine = new THREE.LineSegments(
      laserEdges,
      new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 })
    )
    laserPlaneMesh.add(laserLine)

    // 6. 3D Bin-Packing Algorithm for Placed Items
    const placedBoxes: PlacedBox[] = []
    
    // Expand current quantities into individual items list
    const itemsToPack: StorageItemDef[] = []
    // Prioritize packing larger items on floor first
    const packingOrder = ['bed', 'sofa', 'cabinet', 'fridge', 'luggage', 'carton']
    packingOrder.forEach((id) => {
      const def = STORAGE_ITEM_DEFS.find((d) => d.id === id)
      const count = quantities[id] || 0
      if (def && count > 0) {
        for (let i = 0; i < count; i++) {
          itemsToPack.push(def)
        }
      }
    })

    // Shelf/Grid packing within vault bounds
    let curX = -vW / 2 + 0.1
    let curZ = -vD / 2 + 0.1
    let curY = 0
    let rowMaxD = 0
    let layerMaxH = 0

    itemsToPack.forEach((item, index) => {
      // Check if item fits in current row along X
      if (curX + item.width > vW / 2 - 0.1) {
        // Move to next row in Z
        curX = -vW / 2 + 0.1
        curZ += rowMaxD + 0.08
        rowMaxD = 0
      }

      // Check if item fits in current layer along Z
      if (curZ + item.depth > vD / 2 - 0.1) {
        // Move to next vertical layer in Y
        curX = -vW / 2 + 0.1
        curZ = -vD / 2 + 0.1
        curY += (layerMaxH > 0 ? layerMaxH : 0.4) + 0.04
        layerMaxH = 0
        rowMaxD = 0
      }

      // Keep inside ceiling height
      const finalY = Math.min(vH - item.height / 2, curY + item.height / 2)
      const centerX = curX + item.width / 2
      const centerZ = curZ + item.depth / 2

      placedBoxes.push({
        id: `${item.id}-${index}`,
        typeId: item.id,
        x: centerX,
        y: finalY,
        z: centerZ,
        w: item.width,
        h: item.height,
        d: item.depth,
        colorHex: item.colorHex,
        edgeColorHex: item.edgeColorHex
      })

      // Update offsets
      curX += item.width + 0.08
      rowMaxD = Math.max(rowMaxD, item.depth)
      layerMaxH = Math.max(layerMaxH, item.height)
    })

    // 7. Render 3D Blocks with Materials and Edges
    const boxesGroup = new THREE.Group()
    vaultGroup.add(boxesGroup)

    placedBoxes.forEach((box) => {
      const boxGeo = new THREE.BoxGeometry(box.w, box.h, box.d)
      const boxMat = new THREE.MeshStandardMaterial({
        color: box.colorHex,
        roughness: 0.65,
        metalness: 0.15
      })
      const mesh = new THREE.Mesh(boxGeo, boxMat)
      mesh.position.set(box.x, box.y, box.z)
      mesh.castShadow = true
      mesh.receiveShadow = true
      boxesGroup.add(mesh)

      // Add crisp chamfered wireframe outline
      const edges = new THREE.EdgesGeometry(boxGeo)
      const wireMat = new THREE.LineBasicMaterial({
        color: box.edgeColorHex,
        linewidth: 1,
        transparent: true,
        opacity: 0.8
      })
      const wireLine = new THREE.LineSegments(edges, wireMat)
      mesh.add(wireLine)

      // Detail accents based on item type
      if (box.typeId === 'carton') {
        // Cardboard tape line on top
        const tapeGeo = new THREE.PlaneGeometry(box.w * 0.98, box.d * 0.22)
        const tapeMat = new THREE.MeshBasicMaterial({ color: 0xfef3c7, side: THREE.DoubleSide })
        const tapeMesh = new THREE.Mesh(tapeGeo, tapeMat)
        tapeMesh.rotation.x = -Math.PI / 2
        tapeMesh.position.y = box.h / 2 + 0.002
        mesh.add(tapeMesh)
      } else if (box.typeId === 'luggage') {
        // Luggage handle bar
        const handleGeo = new THREE.BoxGeometry(box.w * 0.35, 0.04, 0.04)
        const handleMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8 })
        const handleMesh = new THREE.Mesh(handleGeo, handleMat)
        handleMesh.position.set(0, box.h / 2 + 0.02, 0)
        mesh.add(handleMesh)
      }
    })

    // 8. Mouse Drag & Touch Orbit Interaction
    let isDragging = false
    let prevMouseX = 0
    let prevMouseY = 0

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true
      prevMouseX = e.clientX
      prevMouseY = e.clientY
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      const deltaX = e.clientX - prevMouseX
      const deltaY = e.clientY - prevMouseY
      prevMouseX = e.clientX
      prevMouseY = e.clientY

      theta -= deltaX * 0.008
      phi = Math.max(0.12, Math.min(Math.PI / 2.3, phi + deltaY * 0.008))
      updateCameraPos()
    }

    const onMouseUp = () => {
      isDragging = false
    }

    // Touch support for mobile devices
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging = true
        prevMouseX = e.touches[0].clientX
        prevMouseY = e.touches[0].clientY
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return
      const deltaX = e.touches[0].clientX - prevMouseX
      const deltaY = e.touches[0].clientY - prevMouseY
      prevMouseX = e.touches[0].clientX
      prevMouseY = e.touches[0].clientY

      theta -= deltaX * 0.01
      phi = Math.max(0.12, Math.min(Math.PI / 2.3, phi + deltaY * 0.01))
      updateCameraPos()
    }

    const onTouchEnd = () => {
      isDragging = false
    }

    // Wheel zoom
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      radius = Math.max(4.5, Math.min(12, radius + e.deltaY * 0.005))
      updateCameraPos()
    }

    const domElement = renderer.domElement
    domElement.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    domElement.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd)
    domElement.addEventListener('wheel', onWheel, { passive: false })

    // 9. Animation Render Loop (60fps with Laser Scan Wave)
    let animationFrameId: number
    let laserDir = 1

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)

      // Holographic laser scan oscillation
      laserPlaneMesh.position.y += 0.012 * laserDir
      if (laserPlaneMesh.position.y >= vH - 0.05) {
        laserDir = -1
      } else if (laserPlaneMesh.position.y <= 0.05) {
        laserDir = 1
      }

      // Auto-rotation when enabled and user isn't actively dragging
      if (autoRotate && !isDragging) {
        theta += 0.004
        updateCameraPos()
      }

      renderer.render(scene, camera)
    }
    animate()

    // 10. Responsive Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newW = entry.contentRect.width
        const newH = entry.contentRect.height
        if (newW > 0 && newH > 0) {
          camera.aspect = newW / newH
          camera.updateProjectionMatrix()
          renderer.setSize(newW, newH)
        }
      }
    })
    resizeObserver.observe(container)

    // Cleanup resources on unmount
    return () => {
      cancelAnimationFrame(animationFrameId)
      domElement.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      domElement.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      domElement.removeEventListener('wheel', onWheel)
      resizeObserver.disconnect()

      scene.clear()
      renderer.dispose()
      if (container.contains(domElement)) {
        container.removeChild(domElement)
      }
    }
  }, [quantities, vaultDims, autoRotate, cameraView])

  return (
    <div className="w-full space-y-8">
      {/* ============================================================ */}
      {/* A. QUICK PRESET SCENARIO BUTTONS                            */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">
            Gợi ý nhanh:
          </span>
          {PRESET_SCENARIOS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset)}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-[var(--brand-teal,#0891b2)] hover:text-[var(--brand-teal,#0891b2)] text-xs font-medium text-slate-700 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs hover:shadow-xs"
            >
              <span className="material-symbols-outlined text-[16px] text-[var(--brand-teal,#0891b2)]">
                {preset.icon}
              </span>
              <span>{preset.label}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={resetAllItems}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1 cursor-pointer"
          title="Xóa hết để chọn lại từ đầu"
        >
          <span className="material-symbols-outlined text-[16px]">restart_alt</span>
          <span>Đặt lại</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* B. MAIN INTERACTIVE DUAL COLUMN WORKSPACE                    */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: ITEM COUNTERS & QUANTITY CONTROLS (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Danh Mục Đồ Đạc</h3>
                <p className="text-xs text-slate-500">Tùy chỉnh số lượng theo thực tế gia đình bạn</p>
              </div>
              <div className="text-right">
                <span className="font-mono text-xs font-bold text-[var(--brand-teal,#0891b2)] tabular-nums">
                  {totalItemsCount} món đồ
                </span>
                <span className="text-[10px] text-slate-600 block">~{totalWeightKg} kg</span>
              </div>
            </div>

            {/* Stepper item rows */}
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {STORAGE_ITEM_DEFS.map((item) => {
                const count = quantities[item.id] || 0
                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      count > 0
                        ? 'border-slate-300 bg-slate-50/70'
                        : 'border-slate-150 bg-white hover:border-slate-200'
                    }`}
                  >
                    {/* Item info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white shadow-2xs"
                        style={{ backgroundColor: `#${item.colorHex.toString(16).padStart(6, '0')}` }}
                      >
                        <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 truncate">{item.name}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-slate-600">{item.subtitle}</span>
                          <span className="text-[10px] font-mono font-medium text-cyan-800 bg-cyan-50 px-1.5 py-0.2 rounded">
                            {item.badgeText}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Stepper buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, -1)}
                        disabled={count <= 0}
                        aria-label={`Giảm số lượng ${item.name}`}
                        className="w-7 h-7 rounded-md border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
                      >
                        –
                      </button>
                      <span className="w-7 text-center font-mono font-bold text-xs text-slate-900 tabular-nums">
                        {count}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, 1)}
                        aria-label={`Tăng số lượng ${item.name}`}
                        className="w-7 h-7 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Quick Tips */}
          <div className="p-3.5 rounded-xl bg-cyan-50/60 border border-cyan-100 flex items-start gap-2.5 text-xs text-slate-700">
            <span className="material-symbols-outlined text-[18px] text-[var(--brand-teal,#0891b2)] shrink-0 mt-0.5">
              tips_and_updates
            </span>
            <p className="leading-relaxed">
              <strong>Mẹo xếp kho:</strong> Kho Boxora có chiều cao trần <strong>{vaultDims.height}m</strong>. Tận dụng xếp chồng đồ theo phương thẳng đứng sẽ giúp bạn chọn gói kho nhỏ gọn và tiết kiệm hơn đến 35% chi phí!
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: 3D ISOMETRIC VAULT VISUALIZER (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-xl overflow-hidden">
            
            {/* Top HUD Bar */}
            <div className="absolute top-0 inset-x-0 z-10 px-4 py-3 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 flex items-center justify-between text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono text-xs font-semibold tracking-wider text-slate-200">
                  BOXORA 3D VAULT // {vaultDims.name}
                </span>
              </div>

              {/* View Control Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAutoRotate(!autoRotate)}
                  title={autoRotate ? 'Dừng tự động xoay' : 'Bật tự động xoay'}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors flex items-center gap-1 cursor-pointer ${
                    autoRotate
                      ? 'bg-[var(--brand-teal,#0891b2)] text-white font-semibold'
                      : 'bg-slate-800/80 hover:bg-slate-750 text-slate-300'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">rotate_right</span>
                  <span>{autoRotate ? 'Xoay ON' : 'Tĩnh'}</span>
                </button>
              </div>
            </div>

            {/* Canvas 3D Mount Container */}
            <div
              ref={canvasContainerRef}
              className="w-full h-[400px] sm:h-[460px] cursor-grab active:cursor-grabbing focus:outline-none"
              title="Kéo chuột hoặc ngón tay để xoay 360 độ góc nhìn 3D"
            />

            {/* Bottom HUD: Live Physical Telemetry */}
            <div className="absolute bottom-0 inset-x-0 z-10 px-4 py-3 bg-slate-950/85 backdrop-blur-md border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-white">
              
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-[10px] text-slate-400 block font-mono">THỂ TÍCH ĐỒ</span>
                  <span className="font-mono text-lg font-bold text-cyan-400 tabular-nums">
                    {totalVolume.toFixed(2)} m³
                  </span>
                </div>

                <div className="h-6 w-px bg-slate-800" />

                <div>
                  <span className="text-[10px] text-slate-400 block font-mono">DUNG TÍCH KHO</span>
                  <span className="font-mono text-xs font-bold text-slate-200 tabular-nums">
                    {vaultCapacity.toFixed(1)} m³
                  </span>
                </div>

                <div className="h-6 w-px bg-slate-800" />

                <div>
                  <span className="text-[10px] text-slate-400 block font-mono">KÍCH THƯỚC</span>
                  <span className="font-mono text-xs text-slate-300">
                    {vaultDims.width}m × {vaultDims.depth}m × {vaultDims.height}m
                  </span>
                </div>
              </div>

              {/* Capacity Progress Ring / Bar */}
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] text-slate-400 font-mono">ĐỘ LẤP ĐẦY:</span>
                <div className="w-20 bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      fillPercentage > 85 ? 'bg-amber-400' : 'bg-[var(--brand-teal,#0891b2)]'
                    }`}
                    style={{ width: `${Math.min(100, fillPercentage)}%` }}
                  />
                </div>
                <span className="font-mono text-xs font-bold text-emerald-400 tabular-nums">
                  {fillPercentage}%
                </span>
              </div>
            </div>

            {/* Floating Interaction Hint */}
            <div className="absolute top-14 left-4 z-10 pointer-events-none">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/70 backdrop-blur-sm border border-slate-700/60 text-[10px] text-slate-300">
                <span className="material-symbols-outlined text-[13px] text-cyan-400">touch_app</span>
                <span>Kéo để xoay 360° • Lăn chuột phóng to</span>
              </span>
            </div>

          </div>

          {/* ============================================================ */}
          {/* C. DYNAMIC RECOMMENDATION & DIRECT BOOKING CTA CARD          */}
          {/* ============================================================ */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-5 text-left">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-cyan-100 text-[var(--brand-teal,#0891b2)]">
                  {recommendedUnit.tag}
                </span>
                <span className="text-xs text-slate-500 font-mono">MÃ KHO: {recommendedUnit.id}</span>
              </div>

              <h4 className="font-headline text-xl font-extrabold text-slate-900">
                {recommendedUnit.name} — {recommendedUnit.size}
              </h4>
              <p className="text-xs text-slate-600 max-w-md leading-relaxed">
                {recommendedUnit.desc} Sức chứa thể tích tối đa <strong>{recommendedUnit.volume}</strong>, đảm bảo còn lối đi xếp dỡ đồ thoải mái.
              </p>
            </div>

            <div className="flex flex-col sm:items-end gap-3 w-full sm:w-auto shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
              <div className="text-left sm:text-right">
                <span className="text-[11px] text-slate-600 block">Ước tính trọn gói</span>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-2xl font-black text-slate-900 tabular-nums">
                    {recommendedUnit.monthlyPrice}
                  </span>
                  <span className="text-xs text-slate-600">/tháng</span>
                </div>
              </div>

              <Link
                to={`/register?unit=${recommendedUnit.id}`}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[var(--brand-teal,#0891b2)] hover:bg-[var(--brand-teal-hover,#0e7490)] text-white text-xs font-semibold btn-tactile shadow-xs transition-all flex items-center justify-center gap-2"
              >
                <span>Thuê Kích Thước Này</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
export default VolumetricSpaceCalculator
