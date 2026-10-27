import React from 'react'

export interface StorageSizeVisualProps {
  sizeId: string
  volumeM3: number
  dimensions: string
  isAc?: boolean
  className?: string
  showDimensions?: boolean
}

interface ParsedDims {
  l: number
  w: number
  h: number
  lText: string
  wText: string
  hText: string
}

function parseDimensions(dimensions: string): ParsedDims {
  const matches = dimensions.match(/(\d+(?:\.\d+)?)\s*m/g)
  if (!matches || matches.length < 3) {
    return { l: 2.0, w: 1.5, h: 2.0, lText: '2.0m', wText: '1.5m', hText: '2.0m' }
  }
  const nums = matches.map((m) => parseFloat(m.replace('m', '').trim()))
  return {
    l: nums[0] || 2.0,
    w: nums[1] || 1.5,
    h: nums[2] || 2.0,
    lText: `${nums[0]}m`,
    wText: `${nums[1]}m`,
    hText: `${nums[2]}m`
  }
}

// Isometric projection helper: maps 3D (x, y, z) in normalized room coordinates to 2D SVG (px, py)
// x: front-left axis (width/depth), y: front-right axis (length), z: vertical up (height)
function isoPoint(x: number, y: number, z: number, cx = 200, cy = 212): [number, number] {
  const cos30 = 0.8660254
  const sin30 = 0.5
  const px = cx + (y - x) * cos30
  const py = cy + (x + y) * sin30 - z
  return [Math.round(px * 10) / 10, Math.round(py * 10) / 10]
}

function pts(points: Array<[number, number]>): string {
  return points.map(([x, y]) => `${x},${y}`).join(' ')
}

interface IsoBoxSpec {
  x: number // start along left axis (0 = back corner)
  y: number // start along right axis (0 = back corner)
  z: number // start height from floor (0 = floor)
  dx: number // size along left axis
  dy: number // size along right axis
  dz: number // height
  topColor: string
  leftColor: string
  rightColor: string
  strokeColor?: string
  label?: string
  stripeColor?: string
}

function renderIsoCuboid(box: IsoBoxSpec, cx: number, cy: number, key: string | number) {
  const { x, y, z, dx, dy, dz, topColor, leftColor, rightColor, strokeColor = 'rgba(15,23,42,0.18)', stripeColor } = box

  // 8 vertices of cuboid
  const p001 = isoPoint(x, y, z + dz, cx, cy)
  const p101 = isoPoint(x + dx, y, z + dz, cx, cy)
  const p111 = isoPoint(x + dx, y + dy, z + dz, cx, cy)
  const p011 = isoPoint(x, y + dy, z + dz, cx, cy)

  const p100 = isoPoint(x + dx, y, z, cx, cy)
  const p110 = isoPoint(x + dx, y + dy, z, cx, cy)
  const p010 = isoPoint(x, y + dy, z, cx, cy)

  // Optional packing tape / detail stripe across top
  const tapeMidA = isoPoint(x + dx * 0.5, y + dy * 0.12, z + dz, cx, cy)
  const tapeMidB = isoPoint(x + dx * 0.5, y + dy * 0.88, z + dz, cx, cy)

  return (
    <g key={key}>
      {/* Left visible face (facing front-left, at x + dx) */}
      <polygon
        points={pts([p100, p110, p111, p101])}
        fill={leftColor}
        stroke={strokeColor}
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      {/* Right visible face (facing front-right, at y + dy) */}
      <polygon
        points={pts([p110, p010, p011, p111])}
        fill={rightColor}
        stroke={strokeColor}
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      {/* Top face (at z + dz) */}
      <polygon
        points={pts([p001, p101, p111, p011])}
        fill={topColor}
        stroke={strokeColor}
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      {stripeColor && (
        <line
          x1={tapeMidA[0]}
          y1={tapeMidA[1]}
          x2={tapeMidB[0]}
          y2={tapeMidB[1]}
          stroke={stripeColor}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      )}
    </g>
  )
}

/**
 * Generates a unique, proportional 3D item loadout for each of the 16 storage volumes (1m³ -> 24m³)
 */
function buildItemsForVolume(volumeM3: number, roomX: number, roomY: number, roomZ: number): IsoBoxSpec[] {
  const items: IsoBoxSpec[] = []

  // Palette definitions
  const cardboard = {
    top: '#f6d096',
    left: '#d99b52',
    right: '#b87b33',
    stripe: '#fef3c7'
  }
  const plasticBin = {
    top: '#e0f2fe',
    left: '#7dd3fc',
    right: '#0284c7',
    stripe: '#ffffff'
  }
  const wood = {
    top: '#d6a874',
    left: '#b07d48',
    right: '#8c5d2e'
  }
  const darkWood = {
    top: '#a67b5b',
    left: '#7c5336',
    right: '#5c3a21'
  }
  const mattress = {
    top: '#f8fafc',
    left: '#e2e8f0',
    right: '#cbd5e1',
    stripe: '#94a3b8'
  }
  const sofa = {
    top: '#cbd5e1',
    left: '#94a3b8',
    right: '#64748b'
  }
  const sofaWarm = {
    top: '#e7d3bd',
    left: '#cbb094',
    right: '#a3866a'
  }
  const appliance = {
    top: '#f1f5f9',
    left: '#cbd5e1',
    right: '#94a3b8',
    stripe: '#475569'
  }
  const darkCase = {
    top: '#475569',
    left: '#334155',
    right: '#1e293b',
    stripe: '#94a3b8'
  }
  const tealCase = {
    top: '#2dd4bf',
    left: '#0d9488',
    right: '#115e59',
    stripe: '#ccfbf1'
  }
  const coralCase = {
    top: '#fb7185',
    left: '#e11d48',
    right: '#9f1239',
    stripe: '#ffe4e6'
  }
  const palletWood = {
    top: '#eab308',
    left: '#ca8a04',
    right: '#854d0e'
  }

  // Helper to stack cartons neatly
  const addCartonStack = (
    x: number,
    y: number,
    baseZ: number,
    count: number,
    bx = 16,
    by = 16,
    bz = 13,
    isPlastic = false
  ) => {
    const style = isPlastic ? plasticBin : cardboard
    for (let i = 0; i < count; i++) {
      items.push({
        x,
        y,
        z: baseZ + i * bz,
        dx: bx,
        dy: by,
        dz: bz - 0.5,
        topColor: style.top,
        leftColor: style.left,
        rightColor: style.right,
        stripeColor: style.stripe
      })
    }
  }

  if (volumeM3 <= 1) {
    // 1 m³: Compact locker with armchair, 2 suitcases, 6 stacked boxes
    addCartonStack(4, 4, 0, 3, 18, 18, 13, true)
    addCartonStack(4, 24, 0, 2, 16, 16, 13, false)
    // Armchair (base + backrest + armrests)
    items.push({ x: 24, y: 5, z: 0, dx: 24, dy: 24, dz: 14, topColor: sofaWarm.top, leftColor: sofaWarm.left, rightColor: sofaWarm.right })
    items.push({ x: 24, y: 5, z: 14, dx: 7, dy: 24, dz: 18, topColor: sofaWarm.top, leftColor: sofaWarm.left, rightColor: sofaWarm.right })
    // Suitcases in front
    items.push({ x: 26, y: 31, z: 0, dx: 18, dy: 12, dz: 11, topColor: darkCase.top, leftColor: darkCase.left, rightColor: darkCase.right, stripeColor: darkCase.stripe })
    items.push({ x: 26, y: 31, z: 11, dx: 16, dy: 11, dz: 10, topColor: tealCase.top, leftColor: tealCase.left, rightColor: tealCase.right, stripeColor: tealCase.stripe })
  } else if (volumeM3 === 2) {
    // 2 m³: Shelving unit on left wall, stacked colorful suitcases on right, beanbag/boxes in front
    // Left shelving rack
    items.push({ x: 4, y: 4, z: 0, dx: 16, dy: 28, dz: 48, topColor: mattress.top, leftColor: mattress.left, rightColor: mattress.right })
    addCartonStack(6, 6, 48, 1, 12, 12, 11, true)
    addCartonStack(6, 20, 48, 1, 12, 12, 11, false)
    // Stacked luggage along right wall
    items.push({ x: 6, y: 34, z: 0, dx: 18, dy: 24, dz: 14, topColor: coralCase.top, leftColor: coralCase.left, rightColor: coralCase.right, stripeColor: coralCase.stripe })
    items.push({ x: 6, y: 34, z: 14, dx: 17, dy: 22, dz: 13, topColor: cardboard.top, leftColor: cardboard.left, rightColor: cardboard.right, stripeColor: cardboard.stripe })
    items.push({ x: 6, y: 34, z: 27, dx: 16, dy: 21, dz: 13, topColor: tealCase.top, leftColor: tealCase.left, rightColor: tealCase.right, stripeColor: tealCase.stripe })
    // Front boxes & gear
    addCartonStack(26, 12, 0, 2, 18, 18, 13, false)
    items.push({ x: 26, y: 34, z: 0, dx: 18, dy: 18, dz: 16, topColor: darkCase.top, leftColor: darkCase.left, rightColor: darkCase.right })
  } else if (volumeM3 === 3) {
    // 3 m³: Tall wooden wardrobe, upright mattress against right wall, rolling suitcase & cartons
    items.push({ x: 4, y: 4, z: 0, dx: 24, dy: 22, dz: 58, topColor: wood.top, leftColor: wood.left, rightColor: wood.right })
    // Upright single mattress
    items.push({ x: 4, y: 28, z: 0, dx: 10, dy: 30, dz: 52, topColor: mattress.top, leftColor: mattress.left, rightColor: mattress.right, stripeColor: mattress.stripe })
    // Cartons & upright silver suitcase
    addCartonStack(30, 8, 0, 2, 18, 18, 13, false)
    items.push({ x: 32, y: 30, z: 0, dx: 14, dy: 18, dz: 28, topColor: darkCase.top, leftColor: darkCase.left, rightColor: darkCase.right, stripeColor: darkCase.stripe })
  } else if (volumeM3 === 4) {
    // 4 m³: Wooden panels/shelving on left, large white mattress on back-right, loveseat sofa, stacked dark trunks
    items.push({ x: 4, y: 4, z: 0, dx: 14, dy: 26, dz: 56, topColor: darkWood.top, leftColor: darkWood.left, rightColor: darkWood.right })
    items.push({ x: 4, y: 32, z: 0, dx: 10, dy: 32, dz: 54, topColor: mattress.top, leftColor: mattress.left, rightColor: mattress.right })
    // Loveseat sofa in front of mattress
    items.push({ x: 16, y: 28, z: 0, dx: 20, dy: 32, dz: 14, topColor: sofaWarm.top, leftColor: sofaWarm.left, rightColor: sofaWarm.right })
    items.push({ x: 16, y: 28, z: 14, dx: 6, dy: 32, dz: 14, topColor: sofaWarm.top, leftColor: sofaWarm.left, rightColor: sofaWarm.right })
    // Stacked dark storage trunks in front-left
    items.push({ x: 22, y: 6, z: 0, dx: 20, dy: 18, dz: 12, topColor: darkCase.top, leftColor: darkCase.left, rightColor: darkCase.right })
    items.push({ x: 22, y: 6, z: 12, dx: 19, dy: 17, dz: 11, topColor: darkCase.top, leftColor: darkCase.left, rightColor: darkCase.right })
    items.push({ x: 22, y: 6, z: 23, dx: 18, dy: 16, dz: 11, topColor: darkCase.top, leftColor: darkCase.left, rightColor: darkCase.right })
    addCartonStack(44, 18, 0, 2, 16, 16, 12, false)
  } else if (volumeM3 === 5) {
    // 5 m³: Tall wardrobe, queen mattress with 2 cartons on top, appliance, luggage stack & chair
    items.push({ x: 4, y: 4, z: 0, dx: 22, dy: 20, dz: 58, topColor: wood.top, leftColor: wood.left, rightColor: wood.right })
    items.push({ x: 4, y: 26, z: 0, dx: 12, dy: 34, dz: 48, topColor: mattress.top, leftColor: mattress.left, rightColor: mattress.right })
    addCartonStack(4, 28, 48, 1, 11, 14, 12, false)
    addCartonStack(4, 44, 48, 1, 11, 14, 12, false)
    // Compact fridge / cabinet on right
    items.push({ x: 18, y: 46, z: 0, dx: 16, dy: 18, dz: 42, topColor: appliance.top, leftColor: appliance.left, rightColor: appliance.right })
    // Front luggage stack
    items.push({ x: 28, y: 8, z: 0, dx: 22, dy: 20, dz: 13, topColor: darkCase.top, leftColor: darkCase.left, rightColor: darkCase.right })
    items.push({ x: 30, y: 10, z: 13, dx: 18, dy: 16, dz: 12, topColor: mattress.top, leftColor: mattress.left, rightColor: mattress.right })
    addCartonStack(32, 30, 0, 2, 16, 16, 13, false)
  } else if (volumeM3 === 6) {
    // 6 m³: Tall mattress, high plastic bin tower, wooden wardrobe on right, washing machine & appliances in front
    items.push({ x: 4, y: 4, z: 0, dx: 14, dy: 24, dz: 58, topColor: mattress.top, leftColor: mattress.left, rightColor: mattress.right })
    addCartonStack(4, 30, 0, 4, 16, 16, 13, true)
    // Wardrobe on right wall
    items.push({ x: 6, y: 48, z: 0, dx: 22, dy: 20, dz: 52, topColor: wood.top, leftColor: wood.left, rightColor: wood.right })
    // Washing machine in front-left
    items.push({ x: 26, y: 6, z: 0, dx: 20, dy: 20, dz: 28, topColor: appliance.top, leftColor: appliance.left, rightColor: appliance.right, stripeColor: appliance.stripe })
    addCartonStack(26, 28, 0, 2, 18, 18, 13, false)
  } else if (volumeM3 === 7) {
    // 7 m³: Extended standard unit — Tall wardrobe, queen mattress, work desk, washing machine & 3 stacks of boxes
    items.push({ x: 4, y: 4, z: 0, dx: 22, dy: 22, dz: 60, topColor: darkWood.top, leftColor: darkWood.left, rightColor: darkWood.right })
    items.push({ x: 4, y: 28, z: 0, dx: 11, dy: 38, dz: 54, topColor: mattress.top, leftColor: mattress.left, rightColor: mattress.right })
    // Work desk in middle
    items.push({ x: 18, y: 30, z: 0, dx: 20, dy: 34, dz: 24, topColor: wood.top, leftColor: wood.left, rightColor: wood.right })
    // Washing machine & plastic bins
    items.push({ x: 28, y: 6, z: 0, dx: 20, dy: 20, dz: 30, topColor: appliance.top, leftColor: appliance.left, rightColor: appliance.right })
    addCartonStack(40, 30, 0, 3, 16, 16, 13, false)
    addCartonStack(40, 48, 0, 2, 16, 16, 13, true)
  } else if (volumeM3 === 8) {
    // 8 m³: Tall wardrobe in back corner, wide queen mattress & bedframe on right wall, 3-seat sofa on left, dining table in middle, luggage in front
    items.push({ x: 4, y: 4, z: 0, dx: 22, dy: 22, dz: 60, topColor: darkWood.top, leftColor: darkWood.left, rightColor: darkWood.right })
    items.push({ x: 4, y: 28, z: 0, dx: 10, dy: 42, dz: 52, topColor: mattress.top, leftColor: mattress.left, rightColor: mattress.right })
    // Wooden dining table in middle
    items.push({ x: 18, y: 28, z: 0, dx: 22, dy: 34, dz: 22, topColor: wood.top, leftColor: wood.left, rightColor: wood.right })
    // 3-seat sofa along left wall
    items.push({ x: 28, y: 4, z: 0, dx: 34, dy: 20, dz: 14, topColor: sofaWarm.top, leftColor: sofaWarm.left, rightColor: sofaWarm.right })
    items.push({ x: 28, y: 4, z: 14, dx: 34, dy: 7, dz: 15, topColor: sofaWarm.top, leftColor: sofaWarm.left, rightColor: sofaWarm.right })
    // Suitcases at front corner
    items.push({ x: 46, y: 30, z: 0, dx: 16, dy: 14, dz: 22, topColor: mattress.top, leftColor: mattress.left, rightColor: mattress.right })
    items.push({ x: 48, y: 46, z: 0, dx: 16, dy: 14, dz: 20, topColor: darkWood.top, leftColor: darkWood.left, rightColor: darkWood.right })
  } else if (volumeM3 === 9) {
    // 9 m³: Wardrobe + queen mattress + appliances on desk + 3-seat sofa + stacked dining chairs + luggage
    items.push({ x: 4, y: 4, z: 0, dx: 22, dy: 22, dz: 62, topColor: darkWood.top, leftColor: darkWood.left, rightColor: darkWood.right })
    items.push({ x: 4, y: 28, z: 0, dx: 10, dy: 44, dz: 54, topColor: mattress.top, leftColor: mattress.left, rightColor: mattress.right })
    // Table with microwave/appliances
    items.push({ x: 18, y: 28, z: 0, dx: 22, dy: 34, dz: 22, topColor: plasticBin.top, leftColor: plasticBin.left, rightColor: plasticBin.right })
    items.push({ x: 20, y: 30, z: 22, dx: 14, dy: 18, dz: 12, topColor: darkCase.top, leftColor: darkCase.left, rightColor: darkCase.right })
    // 3-seat sofa along left wall
    items.push({ x: 28, y: 4, z: 0, dx: 36, dy: 20, dz: 14, topColor: sofaWarm.top, leftColor: sofaWarm.left, rightColor: sofaWarm.right })
    items.push({ x: 28, y: 4, z: 14, dx: 36, dy: 7, dz: 15, topColor: sofaWarm.top, leftColor: sofaWarm.left, rightColor: sofaWarm.right })
    // Stacked chairs & suitcases at front-right
    items.push({ x: 24, y: 64, z: 0, dx: 18, dy: 16, dz: 34, topColor: sofaWarm.top, leftColor: sofaWarm.left, rightColor: sofaWarm.right })
    addCartonStack(46, 32, 0, 2, 16, 16, 13, false)
    items.push({ x: 46, y: 50, z: 0, dx: 16, dy: 16, dz: 22, topColor: darkCase.top, leftColor: darkCase.left, rightColor: darkCase.right })
  } else if (volumeM3 === 10) {
    // 10 m³: Large Family Tier — Double-door fridge, tall wardrobe, queen mattress, L-sofa, and 4 carton stacks
    items.push({ x: 4, y: 4, z: 0, dx: 22, dy: 22, dz: 62, topColor: appliance.top, leftColor: appliance.left, rightColor: appliance.right, stripeColor: appliance.stripe })
    items.push({ x: 4, y: 28, z: 0, dx: 22, dy: 24, dz: 60, topColor: darkWood.top, leftColor: darkWood.left, rightColor: darkWood.right })
    items.push({ x: 4, y: 54, z: 0, dx: 11, dy: 34, dz: 54, topColor: mattress.top, leftColor: mattress.left, rightColor: mattress.right })
    // L-shaped sofa along left & center
    items.push({ x: 28, y: 4, z: 0, dx: 36, dy: 20, dz: 15, topColor: sofa.top, leftColor: sofa.left, rightColor: sofa.right })
    items.push({ x: 28, y: 4, z: 15, dx: 36, dy: 7, dz: 15, topColor: sofa.top, leftColor: sofa.left, rightColor: sofa.right })
    items.push({ x: 28, y: 24, z: 0, dx: 18, dy: 20, dz: 15, topColor: sofa.top, leftColor: sofa.left, rightColor: sofa.right })
    // Carton stacks on right
    addCartonStack(20, 56, 0, 3, 16, 16, 13, false)
    addCartonStack(38, 56, 0, 3, 16, 16, 13, false)
    addCartonStack(48, 30, 0, 2, 16, 16, 13, true)
  } else if (volumeM3 === 12) {
    // 12 m³: Full 2BR Apartment — Side-by-side fridge, washer, wardrobe, king mattress, L-sofa, dining table, 5 carton stacks
    items.push({ x: 4, y: 4, z: 0, dx: 22, dy: 24, dz: 62, topColor: appliance.top, leftColor: appliance.left, rightColor: appliance.right, stripeColor: appliance.stripe })
    items.push({ x: 4, y: 30, z: 0, dx: 20, dy: 22, dz: 58, topColor: wood.top, leftColor: wood.left, rightColor: wood.right })
    items.push({ x: 4, y: 54, z: 0, dx: 12, dy: 38, dz: 56, topColor: mattress.top, leftColor: mattress.left, rightColor: mattress.right })
    // Carton wall in front of mattress
    addCartonStack(18, 56, 0, 4, 16, 16, 12, false)
    addCartonStack(18, 74, 0, 4, 16, 16, 12, false)
    // L-sofa + dining table
    items.push({ x: 28, y: 4, z: 0, dx: 38, dy: 20, dz: 15, topColor: sofaWarm.top, leftColor: sofaWarm.left, rightColor: sofaWarm.right })
    items.push({ x: 28, y: 4, z: 15, dx: 38, dy: 7, dz: 15, topColor: sofaWarm.top, leftColor: sofaWarm.left, rightColor: sofaWarm.right })
    items.push({ x: 30, y: 28, z: 0, dx: 22, dy: 26, dz: 22, topColor: darkWood.top, leftColor: darkWood.left, rightColor: darkWood.right })
    // Washer & bins at front
    items.push({ x: 38, y: 58, z: 0, dx: 20, dy: 20, dz: 30, topColor: appliance.top, leftColor: appliance.left, rightColor: appliance.right })
    addCartonStack(54, 30, 0, 2, 16, 16, 13, true)
  } else if (volumeM3 === 14) {
    // 14 m³: Deep apartment + home office — Back wall of 4 high carton columns + fridge + washer + sofa + desk
    addCartonStack(4, 4, 0, 4, 16, 16, 13, false)
    addCartonStack(4, 22, 0, 4, 16, 16, 13, false)
    addCartonStack(4, 40, 0, 4, 16, 16, 13, false)
    items.push({ x: 4, y: 58, z: 0, dx: 12, dy: 36, dz: 56, topColor: mattress.top, leftColor: mattress.left, rightColor: mattress.right })
    // Second row: Side-by-side fridge + wardrobe
    items.push({ x: 22, y: 4, z: 0, dx: 20, dy: 22, dz: 58, topColor: appliance.top, leftColor: appliance.left, rightColor: appliance.right })
    items.push({ x: 22, y: 28, z: 0, dx: 20, dy: 24, dz: 56, topColor: wood.top, leftColor: wood.left, rightColor: wood.right })
    // Sofa & cartons in front
    items.push({ x: 22, y: 56, z: 0, dx: 22, dy: 36, dz: 15, topColor: sofa.top, leftColor: sofa.left, rightColor: sofa.right })
    items.push({ x: 22, y: 56, z: 15, dx: 7, dy: 36, dz: 15, topColor: sofa.top, leftColor: sofa.left, rightColor: sofa.right })
    addCartonStack(46, 8, 0, 3, 18, 18, 13, true)
    addCartonStack(46, 28, 0, 3, 18, 18, 13, false)
    items.push({ x: 46, y: 52, z: 0, dx: 20, dy: 20, dz: 28, topColor: appliance.top, leftColor: appliance.left, rightColor: appliance.right })
  } else if (volumeM3 === 15) {
    // 15 m³: High-ceiling 3BR Villa / E-commerce hybrid
    addCartonStack(4, 4, 0, 5, 16, 16, 12, false)
    addCartonStack(4, 22, 0, 5, 16, 16, 12, false)
    addCartonStack(4, 40, 0, 5, 16, 16, 12, false)
    items.push({ x: 4, y: 58, z: 0, dx: 20, dy: 36, dz: 60, topColor: darkWood.top, leftColor: darkWood.left, rightColor: darkWood.right })
    // Middle furniture zone
    items.push({ x: 24, y: 4, z: 0, dx: 12, dy: 36, dz: 54, topColor: mattress.top, leftColor: mattress.left, rightColor: mattress.right })
    items.push({ x: 26, y: 42, z: 0, dx: 22, dy: 24, dz: 56, topColor: appliance.top, leftColor: appliance.left, rightColor: appliance.right })
    items.push({ x: 26, y: 68, z: 0, dx: 20, dy: 22, dz: 32, topColor: appliance.top, leftColor: appliance.left, rightColor: appliance.right })
    // Front sofa & trunks
    items.push({ x: 40, y: 6, z: 0, dx: 22, dy: 34, dz: 15, topColor: sofaWarm.top, leftColor: sofaWarm.left, rightColor: sofaWarm.right })
    items.push({ x: 40, y: 6, z: 15, dx: 7, dy: 34, dz: 15, topColor: sofaWarm.top, leftColor: sofaWarm.left, rightColor: sofaWarm.right })
    addCartonStack(50, 44, 0, 3, 18, 18, 13, true)
    addCartonStack(50, 64, 0, 2, 18, 18, 13, false)
  } else if (volumeM3 === 16) {
    // 16 m³: Wide dual-door household & studio mega-unit
    addCartonStack(4, 4, 0, 5, 16, 16, 12, false)
    addCartonStack(4, 22, 0, 5, 16, 16, 12, false)
    addCartonStack(4, 40, 0, 5, 16, 16, 12, false)
    addCartonStack(4, 58, 0, 5, 16, 16, 12, false)
    items.push({ x: 4, y: 76, z: 0, dx: 12, dy: 24, dz: 56, topColor: mattress.top, leftColor: mattress.left, rightColor: mattress.right })
    // Second row: Fridge, washer, dining table, 2 sofas
    items.push({ x: 24, y: 4, z: 0, dx: 20, dy: 22, dz: 58, topColor: appliance.top, leftColor: appliance.left, rightColor: appliance.right })
    items.push({ x: 24, y: 28, z: 0, dx: 20, dy: 20, dz: 32, topColor: appliance.top, leftColor: appliance.left, rightColor: appliance.right })
    items.push({ x: 24, y: 50, z: 0, dx: 22, dy: 30, dz: 22, topColor: darkWood.top, leftColor: darkWood.left, rightColor: darkWood.right })
    // Front L-sofa & bins
    items.push({ x: 46, y: 6, z: 0, dx: 20, dy: 38, dz: 15, topColor: sofa.top, leftColor: sofa.left, rightColor: sofa.right })
    items.push({ x: 46, y: 6, z: 15, dx: 7, dy: 38, dz: 15, topColor: sofa.top, leftColor: sofa.left, rightColor: sofa.right })
    addCartonStack(48, 48, 0, 3, 16, 16, 13, true)
    addCartonStack(48, 66, 0, 3, 16, 16, 13, false)
  } else if (volumeM3 === 18) {
    // 18 m³: Enterprise Pallet Warehouse Tier 1 (6 loaded industrial pallets + racking)
    const palletPositions = [
      [4, 4, 3],
      [4, 32, 3],
      [4, 60, 3],
      [32, 4, 2],
      [32, 32, 2],
      [32, 60, 2]
    ]
    palletPositions.forEach(([px, py, stackH], idx) => {
      // Wooden pallet base
      items.push({
        x: px,
        y: py,
        z: 0,
        dx: 22,
        dy: 24,
        dz: 5,
        topColor: palletWood.top,
        leftColor: palletWood.left,
        rightColor: palletWood.right
      })
      addCartonStack(px + 2, py + 2, 5, stackH, 18, 20, 14, idx % 3 === 1)
    })
  } else if (volumeM3 === 20) {
    // 20 m³: Enterprise Pallet Warehouse Tier 2 (8 loaded pallets + high-bay archive stacks)
    const palletPositions = [
      [4, 4, 4],
      [4, 30, 4],
      [4, 56, 4],
      [4, 82, 3],
      [30, 4, 3],
      [30, 30, 3],
      [30, 56, 2],
      [30, 82, 2]
    ]
    palletPositions.forEach(([px, py, stackH], idx) => {
      items.push({
        x: px,
        y: py,
        z: 0,
        dx: 20,
        dy: 22,
        dz: 5,
        topColor: palletWood.top,
        leftColor: palletWood.left,
        rightColor: palletWood.right
      })
      addCartonStack(px + 1, py + 1, 5, stackH, 18, 20, 13, idx % 2 === 1)
    })
  } else {
    // 24 m³: Flagship Commercial Logistics Warehouse (High-bay 3-row pallet grid, 140+ cartons)
    const palletPositions = [
      [4, 4, 4],
      [4, 28, 4],
      [4, 52, 4],
      [4, 76, 4],
      [26, 4, 3],
      [26, 28, 3],
      [26, 52, 3],
      [26, 76, 3],
      [48, 4, 2],
      [48, 28, 2],
      [48, 52, 2]
    ]
    palletPositions.forEach(([px, py, stackH], idx) => {
      items.push({
        x: px,
        y: py,
        z: 0,
        dx: 18,
        dy: 20,
        dz: 5,
        topColor: palletWood.top,
        leftColor: palletWood.left,
        rightColor: palletWood.right
      })
      addCartonStack(px + 1, py + 1, 5, stackH, 16, 18, 13, idx % 3 === 2)
    })
  }

  // Clamp items so none exceed room boundaries
  return items.map((it) => ({
    ...it,
    dx: Math.min(it.dx, Math.max(8, roomX - it.x - 2)),
    dy: Math.min(it.dy, Math.max(8, roomY - it.y - 2)),
    dz: Math.min(it.dz, Math.max(6, roomZ - it.z - 2))
  }))
}

export const StorageSizeIsometric3D: React.FC<StorageSizeVisualProps> = ({
  volumeM3,
  dimensions,
  isAc = true,
  className = '',
  showDimensions = true
}) => {
  const parsed = parseDimensions(dimensions)

  // Proportional room bounding box in isometric space based on volumeM3
  const { roomX, roomY, roomZ, cx, cy } = React.useMemo(() => {
    if (volumeM3 <= 1) return { roomX: 48, roomY: 48, roomZ: 46, cx: 196, cy: 176 }
    if (volumeM3 === 2) return { roomX: 48, roomY: 60, roomZ: 64, cx: 190, cy: 182 }
    if (volumeM3 === 3) return { roomX: 50, roomY: 62, roomZ: 68, cx: 190, cy: 186 }
    if (volumeM3 === 4) return { roomX: 62, roomY: 66, roomZ: 66, cx: 194, cy: 184 }
    if (volumeM3 === 5) return { roomX: 54, roomY: 66, roomZ: 68, cx: 190, cy: 186 }
    if (volumeM3 === 6) return { roomX: 50, roomY: 70, roomZ: 68, cx: 184, cy: 186 }
    if (volumeM3 === 7) return { roomX: 60, roomY: 68, roomZ: 68, cx: 192, cy: 186 }
    if (volumeM3 === 8) return { roomX: 66, roomY: 72, roomZ: 68, cx: 192, cy: 186 }
    if (volumeM3 === 9) return { roomX: 66, roomY: 82, roomZ: 70, cx: 186, cy: 186 }
    if (volumeM3 === 10) return { roomX: 68, roomY: 90, roomZ: 70, cx: 182, cy: 186 }
    if (volumeM3 === 12) return { roomX: 72, roomY: 94, roomZ: 70, cx: 182, cy: 186 }
    if (volumeM3 === 14) return { roomX: 70, roomY: 96, roomZ: 70, cx: 180, cy: 186 }
    if (volumeM3 === 15) return { roomX: 72, roomY: 96, roomZ: 72, cx: 180, cy: 188 }
    if (volumeM3 === 16) return { roomX: 70, roomY: 102, roomZ: 72, cx: 176, cy: 186 }
    if (volumeM3 === 18) return { roomX: 60, roomY: 88, roomZ: 70, cx: 180, cy: 188 }
    if (volumeM3 === 20) return { roomX: 56, roomY: 108, roomZ: 72, cx: 168, cy: 184 }
    return { roomX: 70, roomY: 100, roomZ: 74, cx: 178, cy: 186 }
  }, [volumeM3])

  // Room corners
  const origin000 = isoPoint(0, 0, 0, cx, cy)
  const leftX00 = isoPoint(roomX, 0, 0, cx, cy)
  const right0Y0 = isoPoint(0, roomY, 0, cx, cy)
  const frontXY0 = isoPoint(roomX, roomY, 0, cx, cy)

  const top00Z = isoPoint(0, 0, roomZ, cx, cy)
  const topX0Z = isoPoint(roomX, 0, roomZ, cx, cy)
  const top0YZ = isoPoint(0, roomY, roomZ, cx, cy)

  // Wall Thickness (3.5px outer bevel)
  const wallT = 4
  const outer00Z = isoPoint(-wallT, -wallT, roomZ + 2, cx, cy)
  const outerX0Z = isoPoint(roomX, -wallT, roomZ + 2, cx, cy)
  const outer0YZ = isoPoint(-wallT, roomY, roomZ + 2, cx, cy)
  const outerX00 = isoPoint(roomX, -wallT, 0, cx, cy)
  const outer0Y0 = isoPoint(-wallT, roomY, 0, cx, cy)

  // Corrugation ribs on left wall (along x) and right wall (along y)
  const leftRibs: Array<[[number, number], [number, number]]> = []
  for (let x = 6; x < roomX; x += 6) {
    leftRibs.push([isoPoint(x, 0, 0, cx, cy), isoPoint(x, 0, roomZ, cx, cy)])
  }
  const rightRibs: Array<[[number, number], [number, number]]> = []
  for (let y = 6; y < roomY; y += 6) {
    rightRibs.push([isoPoint(0, y, 0, cx, cy), isoPoint(0, y, roomZ, cx, cy)])
  }

  // Sort items back-to-front using painter's algorithm: (x + y + z)
  const sortedItems = React.useMemo(() => {
    const raw = buildItemsForVolume(volumeM3, roomX, roomY, roomZ)
    return raw.sort((a, b) => {
      const depthA = a.x + a.dx * 0.5 + (a.y + a.dy * 0.5) + (a.z + a.dz * 0.2)
      const depthB = b.x + b.dx * 0.5 + (b.y + b.dy * 0.5) + (b.z + b.dz * 0.2)
      return depthA - depthB
    })
  }, [volumeM3, roomX, roomY, roomZ])

  // Dimension guide lines
  const dimOffset = 10
  // Left-bottom dimension (Width W along X axis)
  const dimWStart = isoPoint(roomX + dimOffset, 0, 0, cx, cy)
  const dimWEnd = isoPoint(roomX + dimOffset, roomY, 0, cx, cy)
  const dimWMid = isoPoint(roomX + dimOffset + 10, roomY * 0.5, 0, cx, cy)

  // Right-bottom dimension (Length L along Y axis)
  const dimLStart = isoPoint(0, roomY + dimOffset, 0, cx, cy)
  const dimLEnd = isoPoint(roomX, roomY + dimOffset, 0, cx, cy)
  const dimLMid = isoPoint(roomX * 0.5, roomY + dimOffset + 12, 0, cx, cy)

  // Vertical height dimension (Height H along Z axis on right edge)
  const dimHStart = isoPoint(0, roomY + dimOffset, 0, cx, cy)
  const dimHEnd = isoPoint(0, roomY + dimOffset, roomZ, cx, cy)
  const dimHMid = isoPoint(0, roomY + dimOffset + 10, roomZ * 0.5, cx, cy)

  // Colors based on Standard vs Climate A/C
  const leftWallFill = isAc ? 'url(#wallLeftAc)' : 'url(#wallLeftStd)'
  const rightWallFill = isAc ? 'url(#wallRightAc)' : 'url(#wallRightStd)'
  const ribStroke = isAc ? 'rgba(224,242,254,0.28)' : 'rgba(191,219,254,0.24)'
  const topCapFill = isAc ? '#bae6fd' : '#93c5fd'
  const accentColor = isAc ? '#0284c7' : '#2563eb'

  // Optional A/C Evaporator unit mounted high on the right interior wall
  const acUnitY = Math.max(10, roomY * 0.36)
  const acUnitZ = Math.max(28, roomZ - 16)

  return (
    <svg
      viewBox={showDimensions ? '0 0 380 260' : '82 72 216 146'}
      className={`w-full h-full select-none overflow-visible ${className}`}
      role="img"
      aria-label={`Mô hình 3D kho ${volumeM3}m³ (${dimensions})`}
    >
      <defs>
        {/* Left interior wall gradient */}
        <linearGradient id="wallLeftStd" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3b66b8" />
          <stop offset="100%" stopColor="#264785" />
        </linearGradient>
        <linearGradient id="wallRightStd" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2d549e" />
          <stop offset="100%" stopColor="#1d386b" />
        </linearGradient>

        {/* A/C Climate-Controlled interior wall gradients */}
        <linearGradient id="wallLeftAc" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="wallRightAc" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1e40af" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </linearGradient>

        {/* Epoxy Floor Gradient */}
        <linearGradient id="epoxyFloor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f1f5f9" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>

        {/* Ambient Floor Drop Shadow */}
        <filter id="roomDropShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="#0f172a" floodOpacity="0.12" />
        </filter>
      </defs>

      {/* Main Isometric Group with soft architectural shadow */}
      <g filter="url(#roomDropShadow)">
        {/* Outer Wall Thickness Bevels */}
        <polygon
          points={pts([outer00Z, outerX0Z, topX0Z, top00Z])}
          fill={topCapFill}
        />
        <polygon
          points={pts([outer00Z, top00Z, top0YZ, outer0YZ])}
          fill={topCapFill}
        />
        <polygon
          points={pts([outerX0Z, outerX00, leftX00, topX0Z])}
          fill="#64748b"
        />
        <polygon
          points={pts([outer0YZ, outer0Y0, right0Y0, top0YZ])}
          fill="#475569"
        />

        {/* Left Corrugated Steel Wall (along X axis) */}
        <polygon
          points={pts([origin000, leftX00, topX0Z, top00Z])}
          fill={leftWallFill}
        />
        {leftRibs.map(([p1, p2], idx) => (
          <line
            key={`lrib-${idx}`}
            x1={p1[0]}
            y1={p1[1]}
            x2={p2[0]}
            y2={p2[1]}
            stroke={ribStroke}
            strokeWidth="1.2"
          />
        ))}

        {/* Right Corrugated Steel Wall (along Y axis) */}
        <polygon
          points={pts([origin000, right0Y0, top0YZ, top00Z])}
          fill={rightWallFill}
        />
        {rightRibs.map(([p1, p2], idx) => (
          <line
            key={`rrib-${idx}`}
            x1={p1[0]}
            y1={p1[1]}
            x2={p2[0]}
            y2={p2[1]}
            stroke={ribStroke}
            strokeWidth="1.2"
          />
        ))}

        {/* Center Corner Seam */}
        <line
          x1={origin000[0]}
          y1={origin000[1]}
          x2={top00Z[0]}
          y2={top00Z[1]}
          stroke="rgba(15,23,42,0.35)"
          strokeWidth="1.5"
        />

        {/* Epoxy Concrete Floor */}
        <polygon
          points={pts([origin000, leftX00, frontXY0, right0Y0])}
          fill="url(#epoxyFloor)"
          stroke="#94a3b8"
          strokeWidth="1"
        />

        {/* Wall-Mounted A/C Evaporator Unit (when isAc is active) */}
        {isAc &&
          renderIsoCuboid(
            {
              x: 1,
              y: acUnitY,
              z: acUnitZ,
              dx: 7,
              dy: Math.min(28, roomY * 0.42),
              dz: 9,
              topColor: '#f8fafc',
              leftColor: '#e0f2fe',
              rightColor: '#bae6fd',
              strokeColor: '#0284c7',
              stripeColor: '#0ea5e9'
            },
            cx,
            cy,
            'ac-evaporator'
          )}

        {/* 3D Stored Furniture, Boxes & Pallets inside the room */}
        {sortedItems.map((box, idx) => renderIsoCuboid(box, cx, cy, idx))}
      </g>

      {/* Architectural Dimension Callout Lines */}
      {showDimensions && (
        <g className="font-mono" fontSize="10" fontWeight="700" fill={accentColor}>
          {/* Front-Left Axis Dimension (L) */}
          <line
            x1={leftX00[0] - 4}
            y1={leftX00[1] + 4}
            x2={frontXY0[0] - 4}
            y2={frontXY0[1] + 4}
            stroke={accentColor}
            strokeWidth="1.2"
            strokeOpacity="0.75"
          />
          <text
            x={dimWEnd[0] - (dimWEnd[0] - dimWStart[0]) * 0.55 - 12}
            y={dimWMid[1] + 8}
            textAnchor="middle"
            fill={accentColor}
            fontSize="9.5"
          >
            {parsed.lText} (D)
          </text>

          {/* Front-Right Axis Dimension (W) */}
          <line
            x1={frontXY0[0] + 4}
            y1={frontXY0[1] + 4}
            x2={right0Y0[0] + 4}
            y2={right0Y0[1] + 4}
            stroke={accentColor}
            strokeWidth="1.2"
            strokeOpacity="0.75"
          />
          <text
            x={dimLEnd[0] + (dimLStart[0] - dimLEnd[0]) * 0.5 + 12}
            y={dimLMid[1] + 6}
            textAnchor="middle"
            fill={accentColor}
            fontSize="9.5"
          >
            {parsed.wText} (R)
          </text>

          {/* Vertical Height Axis Dimension (H) */}
          <line
            x1={dimHStart[0]}
            y1={dimHStart[1]}
            x2={dimHEnd[0]}
            y2={dimHEnd[1]}
            stroke={accentColor}
            strokeWidth="1.2"
            strokeOpacity="0.75"
          />
          <line
            x1={dimHStart[0] - 3}
            y1={dimHStart[1]}
            x2={dimHStart[0] + 3}
            y2={dimHStart[1]}
            stroke={accentColor}
            strokeWidth="1.2"
          />
          <line
            x1={dimHEnd[0] - 3}
            y1={dimHEnd[1]}
            x2={dimHEnd[0] + 3}
            y2={dimHEnd[1]}
            stroke={accentColor}
            strokeWidth="1.2"
          />
          <text
            x={dimHMid[0] + 6}
            y={dimHMid[1] + 3}
            textAnchor="start"
            fill={accentColor}
            fontSize="9.5"
          >
            {parsed.hText} (C)
          </text>
        </g>
      )}
    </svg>
  )
}

/**
 * Returns the real warehouse photograph matching a given storage volume & AC mode
 */
export function getRealPhotoForSize(volumeM3: number, isAc = false): {
  photoUrl: string
  interiorUrl: string
  caption: string
} {
  if (isAc && volumeM3 <= 4) {
    return {
      photoUrl: '/assets/units/unit-front-mini.jpg',
      interiorUrl: '/assets/units/unit-cold.jpg',
      caption: 'Buồng kho Mini kiểm soát nhiệt ẩm A/C 24/7 & khóa thông minh IoT'
    }
  }
  if (volumeM3 <= 2) {
    return {
      photoUrl: '/assets/units/unit-front-mini.jpg',
      interiorUrl: '/assets/units/unit-mini.jpg',
      caption: 'Buồng kho Mini cá nhân — kệ thép 4 tầng, lưu trữ vali & thùng tài liệu'
    }
  }
  if (volumeM3 <= 4) {
    return {
      photoUrl: '/assets/units/unit-mini-alt.jpg',
      interiorUrl: '/assets/units/unit-front-mini.jpg',
      caption: 'Buồng kho cá nhân 3–4m³ — vách thép gợn sóng, đèn LED trần & khóa PIN'
    }
  }
  if (volumeM3 <= 6) {
    return {
      photoUrl: '/assets/units/unit-front-standard.jpg',
      interiorUrl: '/assets/units/unit-standard.jpg',
      caption: 'Buồng kho tiêu chuẩn 5–6m³ — cửa cuốn mở rộng, chứa xe đạp & đồ gia đình'
    }
  }
  if (volumeM3 <= 9) {
    return {
      photoUrl: '/assets/units/unit-capacity-standard.jpg',
      interiorUrl: '/assets/units/unit-standard-door.jpg',
      caption: 'Buồng kho tiêu chuẩn 7–9m³ — chứa sofa, bàn ghế, xe máy & 30+ thùng đồ'
    }
  }
  if (volumeM3 <= 12) {
    return {
      photoUrl: '/assets/units/unit-front-large.jpg',
      interiorUrl: '/assets/units/unit-large.jpg',
      caption: 'Buồng kho lớn 10–12m³ — chứa trọn bộ nội thất căn hộ 2 phòng ngủ'
    }
  }
  if (volumeM3 <= 16) {
    return {
      photoUrl: '/assets/units/unit-capacity-large.jpg',
      interiorUrl: '/assets/units/unit-large.jpg',
      caption: 'Buồng kho lớn 14–16m³ — chứa tủ lạnh Side-by-Side, máy giặt, nệm & 60+ thùng'
    }
  }
  return {
    photoUrl: '/assets/units/unit-capacity-commercial.jpg',
    interiorUrl: '/assets/units/unit-large.jpg',
    caption: 'Kho Thương Mại & Doanh Nghiệp 18–24m³ — hệ thống kệ pallet công nghiệp tải trọng lớn'
  }
}
