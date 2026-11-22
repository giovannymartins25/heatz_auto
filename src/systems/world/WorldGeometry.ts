export type RoadSurfaceKind = 'asphalt' | 'drag_vht' | 'wet_asphalt' | 'gravel'

export interface WorldPoint {
  x: number
  y: number
}

export interface RoadSegment {
  id: string
  name: string
  zoneName: string
  x1: number
  y1: number
  x2: number
  y2: number
  /** Largura total da pista asfaltada (em metros) */
  width: number
  /** Largura da guia/zebra nas bordas internas da via (em metros) */
  curbWidth: number
  /** Largura da calçada adjacente fora da pista (em metros) */
  sidewalkWidth: number
  surfaceKind: RoadSurfaceKind
  centerLineStyle: 'yellow_dashed' | 'white_dashed' | 'drag_markers' | 'none'
  /** Categoria funcional da via */
  roadClass: 'avenue' | 'perimeter' | 'connector' | 'drag_strip'
}

export interface RoadArc {
  id: string
  name: string
  zoneName: string
  cx: number
  cy: number
  /** Raio central da curva em metros */
  radius: number
  /** Largura da faixa asfaltada em metros */
  width: number
  /** Largura da guia/zebra na borda interna/externa */
  curbWidth: number
  /** Ângulo inicial em radianos (sistema cartesiano padrão: 0 = Leste +X, pi/2 = Norte +Y) */
  startAngle: number
  /** Ângulo final em radianos (sempre >= startAngle) */
  endAngle: number
  /** Se true, trata como anel completo 360° */
  fullCircle?: boolean
  /** Largura de zebra apenas na borda interna (ex: Rotatória) */
  innerCurbOnly?: boolean
  surfaceKind: RoadSurfaceKind
  centerLineStyle: 'yellow_dashed' | 'white_dashed' | 'none'
}

export interface RoadIntersection {
  id: string
  name: string
  x: number
  y: number
  /** Raio da área de cruzamento asfaltada em metros */
  radius: number
  kind: 'roundabout' | 'crossroads' | 't_junction'
}

export interface WorldZone {
  id: string
  name: string
  zoneName: string
  shape: 'circle'
  cx: number
  cy: number
  radius: number
  surfaceKind: 'wet_asphalt' | 'gravel'
  friction: number
  rollingResistance: number
  fillColor: string
  borderColor: string
  labelColor: string
}

export interface WorldObstacle {
  id: string
  name: string
  shape: 'circle' | 'box'
  /** Para circle: centro (cx, cy) e radius */
  cx?: number
  cy?: number
  radius?: number
  /** Para box: limites métricos [minX, maxX] x [minY, maxY] */
  minX?: number
  maxX?: number
  minY?: number
  maxY?: number
  /** Faixa de calçada ao redor do bloco urbano (em metros) */
  sidewalkMargin: number
  fillColor: string
  roofColor: string
  borderColor: string
  category: 'monument' | 'building' | 'grandstand' | 'paddock'
}

export interface SectorLabel {
  text: string
  x: number
  y: number
  color: string
}

export interface WorldGeography {
  bounds: {
    halfWidth: number
    halfHeight: number
    boundaryLimit: number
  }
  spawn: {
    x: number
    y: number
    headingDeg: number
  }
  dragStrip: {
    startX: number
    mark60ftX: number
    mark201mX: number
    mark402mX: number
    yCenter: number
    halfWidth: number
    eastBoundaryX: number
  }
  segments: readonly RoadSegment[]
  arcs: readonly RoadArc[]
  intersections: readonly RoadIntersection[]
  zones: readonly WorldZone[]
  obstacles: readonly WorldObstacle[]
  labels: readonly SectorLabel[]
}

const DRAG_START_X = 50
const DRAG_402M_X = DRAG_START_X + 402.336

/**
 * WORLD_GEOMETRY — Fonte única da verdade geográfica do mundo 2D do HEATZ AUTO.
 *
 * Sistema de coordenadas métrico (1 unidade = 1 metro):
 * - +X = Leste | -X = Oeste
 * - +Y = Norte | -Y = Sul
 * - Rumo 0° = Norte (+Y) | 90° = Leste (+X)
 *
 * Consumido diretamente por:
 * 1. WorldMap (superfícies, atrito, Crr e colisões físicas a 120 Hz)
 * 2. DrivingWorldCanvas (renderização da pista, curvas, cruzamentos, calçadas e blocos)
 * 3. WorldMapModal (visão panorâmica e seguimento sincronizado)
 * 4. Futuras multimídias / GPS
 */
export const WORLD_GEOMETRY: WorldGeography = {
  bounds: {
    halfWidth: 300,
    halfHeight: 300,
    boundaryLimit: 285,
  },
  spawn: {
    x: 0,
    y: 25,
    headingDeg: 0,
  },
  dragStrip: {
    startX: DRAG_START_X,
    mark60ftX: DRAG_START_X + 18.288,
    mark201mX: DRAG_START_X + 201.168,
    mark402mX: DRAG_402M_X,
    yCenter: 52,
    halfWidth: 12,
    eastBoundaryX: DRAG_402M_X + 70,
  },

  segments: [
    // ── Avenidas Principais (Cruciforme de 24m terminando na borda da Rotatória Central em ±40m) ──
    {
      id: 'av-norte',
      name: 'Av. Central Norte',
      zoneName: 'Av. Central Norte-Sul',
      x1: 0,
      y1: 40,
      x2: 0,
      y2: 280,
      width: 24,
      curbWidth: 1.5,
      sidewalkWidth: 3.5,
      surfaceKind: 'asphalt',
      centerLineStyle: 'yellow_dashed',
      roadClass: 'avenue',
    },
    {
      id: 'av-sul',
      name: 'Av. Central Sul',
      zoneName: 'Av. Central Norte-Sul',
      x1: 0,
      y1: -280,
      x2: 0,
      y2: -40,
      width: 24,
      curbWidth: 1.5,
      sidewalkWidth: 3.5,
      surfaceKind: 'asphalt',
      centerLineStyle: 'yellow_dashed',
      roadClass: 'avenue',
    },
    {
      id: 'av-leste',
      name: 'Av. Transversal Leste',
      zoneName: 'Av. Transversal Leste-Oeste',
      x1: 40,
      y1: 0,
      x2: 280,
      y2: 0,
      width: 24,
      curbWidth: 1.5,
      sidewalkWidth: 3.5,
      surfaceKind: 'asphalt',
      centerLineStyle: 'yellow_dashed',
      roadClass: 'avenue',
    },
    {
      id: 'av-oeste',
      name: 'Av. Transversal Oeste',
      zoneName: 'Av. Transversal Leste-Oeste',
      x1: -280,
      y1: 0,
      x2: -40,
      y2: 0,
      width: 24,
      curbWidth: 1.5,
      sidewalkWidth: 3.5,
      surfaceKind: 'asphalt',
      centerLineStyle: 'yellow_dashed',
      roadClass: 'avenue',
    },

    // ── Anel Viário Perimetral (4 trechos conectados em ±230m, largura 20m → [220, 240]) ──
    {
      id: 'anel-norte',
      name: 'Anel Viário Norte',
      zoneName: 'Anel Viário Perimetral',
      x1: -240,
      y1: 230,
      x2: 240,
      y2: 230,
      width: 20,
      curbWidth: 1.2,
      sidewalkWidth: 3.0,
      surfaceKind: 'asphalt',
      centerLineStyle: 'yellow_dashed',
      roadClass: 'perimeter',
    },
    {
      id: 'anel-sul',
      name: 'Anel Viário Sul',
      zoneName: 'Anel Viário Perimetral',
      x1: -240,
      y1: -230,
      x2: 240,
      y2: -230,
      width: 20,
      curbWidth: 1.2,
      sidewalkWidth: 3.0,
      surfaceKind: 'asphalt',
      centerLineStyle: 'yellow_dashed',
      roadClass: 'perimeter',
    },
    {
      id: 'anel-oeste',
      name: 'Anel Viário Oeste',
      zoneName: 'Anel Viário Perimetral',
      x1: -230,
      y1: -240,
      x2: -230,
      y2: 240,
      width: 20,
      curbWidth: 1.2,
      sidewalkWidth: 3.0,
      surfaceKind: 'asphalt',
      centerLineStyle: 'yellow_dashed',
      roadClass: 'perimeter',
    },
    {
      id: 'anel-leste',
      name: 'Anel Viário Leste',
      zoneName: 'Anel Viário Perimetral',
      x1: 230,
      y1: -240,
      x2: 230,
      y2: 240,
      width: 20,
      curbWidth: 1.2,
      sidewalkWidth: 3.0,
      surfaceKind: 'asphalt',
      centerLineStyle: 'yellow_dashed',
      roadClass: 'perimeter',
    },

    // ── Pista de Arrancada Oficial 402m (VHT Prep) + Acesso Direto ──
    {
      id: 'acesso-drag-strip',
      name: 'Acesso à Drag Strip',
      zoneName: 'Acesso à Reta de Arrancada',
      x1: 0,
      y1: 52,
      x2: 42,
      y2: 52,
      width: 16,
      curbWidth: 1.0,
      sidewalkWidth: 2.5,
      surfaceKind: 'asphalt',
      centerLineStyle: 'white_dashed',
      roadClass: 'connector',
    },
    {
      id: 'drag-strip-402m',
      name: 'Reta Oficial de Arrancada 402m',
      zoneName: 'Reta Oficial de Arrancada',
      x1: DRAG_START_X - 10,
      y1: 52,
      x2: DRAG_402M_X + 60,
      y2: 52,
      width: 24,
      curbWidth: 0,
      sidewalkWidth: 0,
      surfaceKind: 'drag_vht',
      centerLineStyle: 'drag_markers',
      roadClass: 'drag_strip',
    },

    // ── Setor Nordeste: S-Curvas Técnicas (R=25m e R=45m) + Acessos ao Anel Viário ──
    {
      id: 'rua-ne-entrada',
      name: 'Rua do Distrito Nordeste',
      zoneName: 'Distrito Nordeste',
      x1: 0,
      y1: 115,
      x2: 70,
      y2: 115,
      width: 16,
      curbWidth: 1.0,
      sidewalkWidth: 2.8,
      surfaceKind: 'asphalt',
      centerLineStyle: 'yellow_dashed',
      roadClass: 'connector',
    },
    {
      id: 'rua-ne-saida-leste',
      name: 'Av. Panorama Nordeste',
      zoneName: 'Distrito Nordeste',
      x1: 140,
      y1: 185,
      x2: 230,
      y2: 185,
      width: 16,
      curbWidth: 1.0,
      sidewalkWidth: 2.8,
      surfaceKind: 'asphalt',
      centerLineStyle: 'yellow_dashed',
      roadClass: 'connector',
    },
    {
      id: 'rua-ne-saida-norte',
      name: 'Ligação Norte Nordeste',
      zoneName: 'Distrito Nordeste',
      x1: 140,
      y1: 185,
      x2: 140,
      y2: 230,
      width: 16,
      curbWidth: 1.0,
      sidewalkWidth: 2.8,
      surfaceKind: 'asphalt',
      centerLineStyle: 'white_dashed',
      roadClass: 'connector',
    },

    // ── Conexões do Circuito de Handling (Setor Noroeste) ──
    {
      id: 'acesso-handling-leste',
      name: 'Ligação Leste Handling',
      zoneName: 'Acesso ao Circuito de Handling',
      x1: -62,
      y1: 140,
      x2: 0,
      y2: 140,
      width: 16,
      curbWidth: 1.0,
      sidewalkWidth: 2.5,
      surfaceKind: 'asphalt',
      centerLineStyle: 'white_dashed',
      roadClass: 'connector',
    },
    {
      id: 'acesso-handling-sul',
      name: 'Ligação Sul Handling',
      zoneName: 'Acesso ao Circuito de Handling',
      x1: -140,
      y1: 0,
      x2: -140,
      y2: 62,
      width: 16,
      curbWidth: 1.0,
      sidewalkWidth: 2.5,
      surfaceKind: 'asphalt',
      centerLineStyle: 'white_dashed',
      roadClass: 'connector',
    },

    // ── Conexões do Skidpad Molhado (Setor Sudoeste) ──
    {
      id: 'acesso-skidpad-norte',
      name: 'Acesso Norte Skidpad',
      zoneName: 'Acesso ao Skidpad',
      x1: -140,
      y1: -80,
      x2: -140,
      y2: 0,
      width: 16,
      curbWidth: 1.0,
      sidewalkWidth: 2.5,
      surfaceKind: 'asphalt',
      centerLineStyle: 'white_dashed',
      roadClass: 'connector',
    },
    {
      id: 'acesso-skidpad-leste',
      name: 'Acesso Leste Skidpad',
      zoneName: 'Acesso ao Skidpad',
      x1: -80,
      y1: -140,
      x2: 0,
      y2: -140,
      width: 16,
      curbWidth: 1.0,
      sidewalkWidth: 2.5,
      surfaceKind: 'asphalt',
      centerLineStyle: 'white_dashed',
      roadClass: 'connector',
    },

    // ── Conexões do Circuito Off-Road 4x4 (Setor Sudeste) ──
    {
      id: 'acesso-offroad-norte',
      name: 'Acesso Norte Off-Road',
      zoneName: 'Acesso ao Circuito Off-Road',
      x1: 140,
      y1: -70,
      x2: 140,
      y2: 0,
      width: 16,
      curbWidth: 1.0,
      sidewalkWidth: 2.5,
      surfaceKind: 'asphalt',
      centerLineStyle: 'white_dashed',
      roadClass: 'connector',
    },
    {
      id: 'acesso-offroad-oeste',
      name: 'Acesso Oeste Off-Road',
      zoneName: 'Acesso ao Circuito Off-Road',
      x1: 0,
      y1: -140,
      x2: 70,
      y2: -140,
      width: 16,
      curbWidth: 1.0,
      sidewalkWidth: 2.5,
      surfaceKind: 'asphalt',
      centerLineStyle: 'white_dashed',
      roadClass: 'connector',
    },
  ],

  arcs: [
    // ── Rotatória Central (Raio médio 29m, pista 16m..42m) ──
    {
      id: 'rotatoria-central',
      name: 'Rotatória Central',
      zoneName: 'Rotatória Central',
      cx: 0,
      cy: 0,
      radius: 29,
      width: 26,
      curbWidth: 2.0,
      startAngle: 0,
      endAngle: Math.PI * 2,
      fullCircle: true,
      innerCurbOnly: true,
      surfaceKind: 'asphalt',
      centerLineStyle: 'white_dashed',
    },

    // ── Circuito de Handling Sinuoso (Raio longo R = 80m, pista 65m..95m) ──
    {
      id: 'circuito-handling',
      name: 'Circuito de Handling (R80m)',
      zoneName: 'Circuito de Handling (Curva Rápida)',
      cx: -140,
      cy: 140,
      radius: 80,
      width: 30,
      curbWidth: 1.5,
      startAngle: 0,
      endAngle: Math.PI * 2,
      fullCircle: true,
      surfaceKind: 'asphalt',
      centerLineStyle: 'white_dashed',
    },

    // ── Curva Fechada Técnica do Distrito Nordeste (R = 25m, tangente em (70,115) e (95,140)) ──
    {
      id: 'curva-fechada-ne',
      name: 'Curva Fechada Nordeste (R25m)',
      zoneName: 'Curva Técnica Nordeste (R25m)',
      cx: 70,
      cy: 140,
      radius: 25,
      width: 16,
      curbWidth: 1.2,
      startAngle: -Math.PI / 2,
      endAngle: 0,
      surfaceKind: 'asphalt',
      centerLineStyle: 'yellow_dashed',
    },

    // ── Curva Média Contínua do Distrito Nordeste (R = 45m, tangente em (95,140) e (140,185)) ──
    {
      id: 'curva-media-ne',
      name: 'Curva Média Nordeste (R45m)',
      zoneName: 'Curva Média Nordeste (R45m)',
      cx: 140,
      cy: 140,
      radius: 45,
      width: 16,
      curbWidth: 1.2,
      startAngle: Math.PI / 2,
      endAngle: Math.PI,
      surfaceKind: 'asphalt',
      centerLineStyle: 'yellow_dashed',
    },
  ],

  intersections: [
    { id: 'int-rotatoria', name: 'Rotatória Central', x: 0, y: 0, radius: 42, kind: 'roundabout' },
    { id: 'int-norte-anel', name: 'Cruzamento Norte', x: 0, y: 230, radius: 16, kind: 'crossroads' },
    { id: 'int-sul-anel', name: 'Cruzamento Sul', x: 0, y: -230, radius: 16, kind: 'crossroads' },
    { id: 'int-oeste-anel', name: 'Cruzamento Oeste', x: -230, y: 0, radius: 16, kind: 'crossroads' },
    { id: 'int-leste-anel', name: 'Cruzamento Leste', x: 230, y: 0, radius: 16, kind: 'crossroads' },
    { id: 'int-acesso-drag', name: 'Acesso Drag Strip', x: 0, y: 52, radius: 13, kind: 't_junction' },
    { id: 'int-acesso-ne', name: 'Entrada Distrito NE', x: 0, y: 115, radius: 13, kind: 't_junction' },
    { id: 'int-ne-anel-leste', name: 'Acesso NE × Anel Leste', x: 230, y: 185, radius: 13, kind: 't_junction' },
    { id: 'int-ne-anel-norte', name: 'Acesso NE × Anel Norte', x: 140, y: 230, radius: 13, kind: 't_junction' },
    { id: 'int-acesso-handling-e', name: 'Acesso Handling Leste', x: 0, y: 140, radius: 13, kind: 't_junction' },
    { id: 'int-cruzamento-oeste', name: 'Cruzamento Handling / Skidpad', x: -140, y: 0, radius: 14, kind: 'crossroads' },
    { id: 'int-cruzamento-sul', name: 'Cruzamento Skidpad / Off-Road', x: 0, y: -140, radius: 14, kind: 'crossroads' },
    { id: 'int-acesso-offroad-n', name: 'Acesso Off-Road Norte', x: 140, y: 0, radius: 13, kind: 't_junction' },
  ],

  zones: [
    {
      id: 'zone-skidpad',
      name: 'Skidpad Molhado',
      zoneName: 'Área de Teste de Derrapagem (Skidpad)',
      shape: 'circle',
      cx: -140,
      cy: -140,
      radius: 65,
      surfaceKind: 'wet_asphalt',
      friction: 0.50,
      rollingResistance: 0.018,
      fillColor: '#09152a',
      borderColor: '#1e3a8a',
      labelColor: 'rgba(96, 165, 250, 0.95)',
    },
    {
      id: 'zone-offroad',
      name: 'Circuito Off-Road 4x4',
      zoneName: 'Circuito Off-Road 4x4',
      shape: 'circle',
      cx: 140,
      cy: -140,
      radius: 75,
      surfaceKind: 'gravel',
      friction: 0.48,
      rollingResistance: 0.045,
      fillColor: '#3f2512',
      borderColor: '#5a341a',
      labelColor: 'rgba(217, 119, 6, 0.95)',
    },
  ],

  obstacles: [
    // Ilha central da Rotatória (monumento central)
    {
      id: 'ilha-rotatoria',
      name: 'Ilha da Rotatória',
      shape: 'circle',
      cx: 0,
      cy: 0,
      radius: 16.0,
      sidewalkMargin: 2.0,
      fillColor: '#14532d',
      roofColor: '#cbd5e1',
      borderColor: '#dc2626',
      category: 'monument',
    },
    // Boxes / Arquibancada da Drag Strip (norte da reta, sul do setor NE)
    {
      id: 'bloco-boxes-drag',
      name: 'Boxes da Drag Strip',
      shape: 'box',
      minX: 125,
      maxX: 195,
      minY: 78,
      maxY: 98,
      sidewalkMargin: 3.5,
      fillColor: '#1e293b',
      roofColor: '#334155',
      borderColor: '#f59e0b',
      category: 'grandstand',
    },
    // Quarteirão Garagem & Oficina Heatz (entre Av. Norte e Curva Fechada NE)
    {
      id: 'bloco-garagem-ne',
      name: 'Oficina Central Heatz',
      shape: 'box',
      minX: 28,
      maxX: 54,
      minY: 142,
      maxY: 196,
      sidewalkMargin: 3.5,
      fillColor: '#172033',
      roofColor: '#293548',
      borderColor: '#38bdf8',
      category: 'building',
    },
    // Centro Comercial Nordeste (sul da saída NE, leste da curva média R45m)
    {
      id: 'bloco-comercial-ne',
      name: 'Bloco Urbano Nordeste',
      shape: 'box',
      minX: 170,
      maxX: 204,
      minY: 118,
      maxY: 158,
      sidewalkMargin: 3.5,
      fillColor: '#182234',
      roofColor: '#273549',
      borderColor: '#64748b',
      category: 'building',
    },
    // Paddock Central do Circuito de Handling (ilha interna com área de escape de 33m)
    {
      id: 'bloco-paddock-nw',
      name: 'Paddock do Handling',
      shape: 'circle',
      cx: -140,
      cy: 140,
      radius: 30,
      sidewalkMargin: 3.0,
      fillColor: '#162132',
      roofColor: '#334155',
      borderColor: '#94a3b8',
      category: 'paddock',
    },
    // Centro de Telemetria Sudoeste (entre Av. Sul e Skidpad)
    {
      id: 'bloco-telemetria-sw',
      name: 'Torre de Telemetria SW',
      shape: 'box',
      minX: -58,
      maxX: -28,
      minY: -92,
      maxY: -36,
      sidewalkMargin: 3.5,
      fillColor: '#172033',
      roofColor: '#293548',
      borderColor: '#3b82f6',
      category: 'building',
    },
    // Base Off-Road Sudeste (entre Av. Sul e Off-Road)
    {
      id: 'bloco-base-se',
      name: 'Base de Apoio Off-Road',
      shape: 'box',
      minX: 28,
      maxX: 58,
      minY: -92,
      maxY: -36,
      sidewalkMargin: 3.5,
      fillColor: '#251a14',
      roofColor: '#3f2c20',
      borderColor: '#d97706',
      category: 'building',
    },
  ],

  labels: [
    { text: 'ROTATÓRIA', x: 0, y: -52, color: 'rgba(226, 232, 240, 0.85)' },
    { text: 'ARRANCADA 402M', x: 220, y: 74, color: 'rgba(251, 191, 36, 0.95)' },
    { text: 'DISTRITO NE (S-CURVAS)', x: 118, y: 204, color: 'rgba(56, 189, 248, 0.92)' },
    { text: 'HANDLING R80M', x: -140, y: 140, color: 'rgba(226, 232, 240, 0.92)' },
    { text: 'SKIDPAD', x: -140, y: -140, color: 'rgba(96, 165, 250, 0.95)' },
    { text: 'OFF-ROAD 4X4', x: 140, y: -140, color: 'rgba(217, 119, 6, 0.95)' },
    { text: 'ANEL VIÁRIO PERIMETRAL', x: 0, y: 252, color: 'rgba(148, 163, 184, 0.8)' },
  ],
}

/**
 * Distância perpendicular e projeção paramétrica de um ponto (px, py) ao segmento (x1, y1)-(x2, y2).
 */
export function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { dist: number; t: number } {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  if (lenSq < 1e-9) {
    return { dist: Math.hypot(px - x1, py - y1), t: 0 }
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq))
  const projX = x1 + t * dx
  const projY = y1 + t * dy
  return { dist: Math.hypot(px - projX, py - projY), t }
}

/**
 * Verifica se um ângulo normalizado pertence ao intervalo [startAngle, endAngle].
 */
export function isAngleWithinArc(angle: number, startAngle: number, endAngle: number): boolean {
  const TWO_PI = Math.PI * 2
  let a = angle
  while (a < startAngle) a += TWO_PI
  while (a > startAngle + TWO_PI) a -= TWO_PI
  return a <= endAngle + 1e-6
}

/**
 * Avalia se um ponto (px, py) está sobre um RoadArc e retorna distância radial ao eixo central.
 */
export function evaluateRoadArc(
  px: number,
  py: number,
  arc: RoadArc,
): { insideAngle: boolean; radialOffset: number; signedRadialOffset: number; distFromCenter: number } {
  const dx = px - arc.cx
  const dy = py - arc.cy
  const distFromCenter = Math.hypot(dx, dy)
  const signedRadialOffset = distFromCenter - arc.radius
  const radialOffset = Math.abs(signedRadialOffset)

  if (arc.fullCircle) {
    return { insideAngle: true, radialOffset, signedRadialOffset, distFromCenter }
  }
  const angle = Math.atan2(dy, dx)
  return {
    insideAngle: isAngleWithinArc(angle, arc.startAngle, arc.endAngle),
    radialOffset,
    signedRadialOffset,
    distFromCenter,
  }
}

/**
 * Verifica colisão de um círculo (veículo) contra uma caixa AABB [minX, maxX] x [minY, maxY].
 */
export function checkCircleVsBoxCollision(
  px: number,
  py: number,
  radius: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
): { isColliding: boolean; penetrationDepth: number; normalX: number; normalY: number } {
  const closestX = Math.max(minX, Math.min(px, maxX))
  const closestY = Math.max(minY, Math.min(py, maxY))
  const dx = px - closestX
  const dy = py - closestY
  const distSq = dx * dx + dy * dy

  if (distSq >= radius * radius) {
    return { isColliding: false, penetrationDepth: 0, normalX: 0, normalY: 0 }
  }

  // Caso especial: centro do veículo já está dentro da caixa
  if (distSq < 1e-8) {
    const distLeft = px - minX
    const distRight = maxX - px
    const distBottom = py - minY
    const distTop = maxY - py
    const minDist = Math.min(distLeft, distRight, distBottom, distTop)
    if (minDist === distLeft) {
      return { isColliding: true, penetrationDepth: distLeft + radius, normalX: -1, normalY: 0 }
    }
    if (minDist === distRight) {
      return { isColliding: true, penetrationDepth: distRight + radius, normalX: 1, normalY: 0 }
    }
    if (minDist === distBottom) {
      return { isColliding: true, penetrationDepth: distBottom + radius, normalX: 0, normalY: -1 }
    }
    return { isColliding: true, penetrationDepth: distTop + radius, normalX: 0, normalY: 1 }
  }

  const dist = Math.sqrt(distSq)
  return {
    isColliding: true,
    penetrationDepth: radius - dist,
    normalX: dx / dist,
    normalY: dy / dist,
  }
}
