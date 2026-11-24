import { WorldMap } from './WorldMap'
import type { WorldGeography } from './WorldGeometry'

export interface MinimapNavigationHint {
  kind: 'curve' | 'intersection' | 'drag_route' | 'clear'
  label: string
  distanceM: number
  direction?: 'left' | 'right' | 'straight'
  targetX?: number
  targetY?: number
}

/**
 * Calcula em tempo real a próxima instrução de navegação / curva / cruzamento / rota ativa
 * consumindo exclusivamente `WORLD_GEOMETRY` (sem duplicar definições de ruas ou curvas).
 */
export function computeMinimapNavigationHint(
  posX: number,
  posY: number,
  headingDeg: number,
  geo: WorldGeography = WorldMap.getGeometry(),
  dragActive = false,
): MinimapNavigationHint {
  // 1. Rota ativa na Pista de Arrancada 402m quando o veículo está alinhado na Drag Strip ou em prova ativa
  const inDragCorridor =
    Math.abs(posY - geo.dragStrip.yCenter) <= geo.dragStrip.halfWidth + 6 &&
    posX >= geo.dragStrip.startX - 25 &&
    posX <= geo.dragStrip.mark402mX + 20
  if (dragActive || inDragCorridor) {
    const remM = Math.max(0, Math.round(geo.dragStrip.mark402mX - posX))
    return {
      kind: 'drag_route',
      label: remM > 0 ? `🏁 ROTA 402m · ${remM}m` : '🏁 CHEGADA 402m',
      distanceM: remM,
      direction: 'straight',
      targetX: geo.dragStrip.mark402mX,
      targetY: geo.dragStrip.yCenter,
    }
  }

  // Vetor unitário da direção atual do veículo (0° = +Y Norte, 90° = +X Leste)
  const rad = (headingDeg * Math.PI) / 180
  const fwdX = Math.sin(rad)
  const fwdY = Math.cos(rad)
  const rightX = fwdY
  const rightY = -fwdX

  let bestDist = Infinity
  let bestHint: MinimapNavigationHint | null = null

  // 2. Cruzamentos próximos à frente no cone de condução
  for (const inter of geo.intersections) {
    const dx = inter.x - posX
    const dy = inter.y - posY
    const centerDist = Math.hypot(dx, dy)
    const edgeDist = Math.max(0, centerDist - inter.radius)
    if (edgeDist > 150 || centerDist < 1) continue

    const dotFwd = (dx * fwdX + dy * fwdY) / centerDist
    if (dotFwd < 0.45) continue

    if (edgeDist < bestDist) {
      bestDist = edgeDist
      const shortName = inter.kind === 'roundabout' ? 'Rotatória' : 'Cruzamento'
      bestHint = {
        kind: 'intersection',
        label: `⛖ ${shortName} ${Math.round(edgeDist)}m`,
        distanceM: Math.round(edgeDist),
        direction: 'straight',
        targetX: inter.x,
        targetY: inter.y,
      }
    }
  }

  // 3. Curvas (arcs) próximas à frente
  for (const arc of geo.arcs) {
    let sampleX: number
    let sampleY: number
    if (arc.fullCircle) {
      const vx = posX - arc.cx
      const vy = posY - arc.cy
      const vLen = Math.hypot(vx, vy) || 1
      sampleX = arc.cx + (vx / vLen) * arc.radius
      sampleY = arc.cy + (vy / vLen) * arc.radius
    } else {
      const midAngle = (arc.startAngle + arc.endAngle) * 0.5
      sampleX = arc.cx + Math.cos(midAngle) * arc.radius
      sampleY = arc.cy + Math.sin(midAngle) * arc.radius
    }

    const dx = sampleX - posX
    const dy = sampleY - posY
    const dist = Math.hypot(dx, dy)
    if (dist > 165 || dist < 4) continue

    const dotFwd = (dx * fwdX + dy * fwdY) / dist
    if (dotFwd < 0.42) continue

    const centerDx = arc.cx - posX
    const centerDy = arc.cy - posY
    const lateralSign = centerDx * rightX + centerDy * rightY
    const turnDir: 'left' | 'right' = lateralSign >= 0 ? 'right' : 'left'

    if (dist < bestDist) {
      bestDist = dist
      const arrow = turnDir === 'right' ? '↱' : '↰'
      bestHint = {
        kind: 'curve',
        label: `${arrow} Curva ${Math.round(dist)}m`,
        distanceM: Math.round(dist),
        direction: turnDir,
        targetX: sampleX,
        targetY: sampleY,
      }
    }
  }

  if (bestHint) {
    return bestHint
  }

  return {
    kind: 'clear',
    label: '▲ Via Livre',
    distanceM: 0,
    direction: 'straight',
  }
}
