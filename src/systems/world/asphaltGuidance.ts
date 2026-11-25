/**
 * asphaltGuidance.ts — Cálculo físico-geométrico e rastreador com estado (histerese por trecho)
 * para orientação de velocidade e saídas projetada diretamente sobre o asfalto 2D (Fases 4.4.2.1 / 4.4.2.2).
 *
 * Princípios:
 * - Velocidade recomendada `recommendedSpeedKmh` derivada fisicamente do raio efetivo real (`R_eff`)
 *   e do coeficiente de atrito da superfície (`WorldMap.query(x, y, isRaining).surface.friction`)
 *   segundo `v = sqrt(k_safe * mu * g * R_eff)`.
 * - Setas de direção (`exitArrows`) extraídas exclusivamente da conectividade real de `WORLD_GEOMETRY`.
 * - Distância de antecipação escalonada dinamicamente conforme velocidade atual do veículo, curvatura
 *   e atrito da superfície (`computeAnticipationDistanceM`).
 * - Ciclo de vida com estado por trecho (`AsphaltGuidanceTracker`): uma vez engajada na aproximação,
 *   a marcação mantém coordenadas fixas no asfalto, acompanha toda a aproximação e travessia da entrada
 *   da curva/interseção e desaparece somente DEPOIS que o veículo passa pelo ponto relevante ou desvia
 *   de rota — sem piscar por pequenas oscilações de posição e sem sumir prematuramente antes da curva.
 */

import {
  distanceToSegment,
  WORLD_GEOMETRY,
  type RoadIntersection,
  type RoadSegment,
} from './WorldGeometry'
import { WorldMap } from './WorldMap'

export type WorldGeometryData = typeof WORLD_GEOMETRY

export type AsphaltExitArrow = 'left' | 'straight' | 'right' | 'roundabout'

export interface AsphaltGuidanceResult {
  featureId: string
  featureName: string
  kind: 'intersection' | 'curve'
  paintX: number
  paintY: number
  laneHeadingDeg: number
  laneWidthM: number
  distanceAheadM: number
  recommendedSpeedKmh: number
  effectiveRadiusM: number
  surfaceFriction: number
  exitArrows: AsphaltExitArrow[]
  alpha: number
}

interface InternalGuidanceCandidate extends AsphaltGuidanceResult {
  passRefX: number
  passRefY: number
  approachDirX: number
  approachDirY: number
  clearPastRefM: number
  maxCorridorHalfWidthM: number
  safetyFactorK: number
}

const GRAVITY_MS2 = 9.81
const MIN_STATELESS_DIST_M = -6
const BASE_STATELESS_MAX_DIST_M = 108

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function roundSpeedStep5(kmh: number): number {
  return Math.max(20, Math.min(110, Math.round(kmh / 5) * 5))
}

function vectorToHeadingDeg(dx: number, dy: number): number {
  const deg = (Math.atan2(dx, dy) * 180) / Math.PI
  return ((deg % 360) + 360) % 360
}

/**
 * Calcula a distância de antecipação ideal (em metros antes da entrada do trecho)
 * combinando tempo de leitura/reação + distância física de frenagem confortável
 * conforme velocidade atual, velocidade recomendada da curva, raio efetivo e atrito.
 */
export function computeAnticipationDistanceM(
  currentSpeedKmh: number,
  recommendedSpeedKmh: number,
  effectiveRadiusM: number,
  surfaceFriction: number,
): number {
  const vNowMs = Math.max(0, (Number.isFinite(currentSpeedKmh) ? currentSpeedKmh : 60) / 3.6)
  const vRecMs = Math.max(4, recommendedSpeedKmh / 3.6)
  const mu = clamp(surfaceFriction, 0.25, 1.35)

  // Desaceleração confortável de orientação (~42% do limite de atrito da superfície)
  const comfortableDecelMs2 = Math.max(2.1, 0.42 * mu * GRAVITY_MS2)
  const brakingDistM =
    vNowMs > vRecMs ? (vNowMs * vNowMs - vRecMs * vRecMs) / (2 * comfortableDecelMs2) : 0

  // Margem visual de leitura antecipada + bônus para curvas fechadas
  const perceptionLeadM = Math.max(32, vNowMs * 1.65)
  const tightnessBonusM = clamp((48 - effectiveRadiusM) * 0.35, 0, 14)

  return clamp(perceptionLeadM + brakingDistM + tightnessBonusM, 46, 145)
}

function computeStatelessAlpha(distAheadM: number, maxDistM: number): number {
  // Permanece 1.0 durante toda a aproximação e entrada (-2m..maxDist-16m), decaindo apenas após cruzar
  const fadePast = clamp((distAheadM - MIN_STATELESS_DIST_M) / 5, 0, 1)
  const fadeFar = clamp((maxDistM - distAheadM) / 16, 0, 1)
  return Math.min(fadePast, fadeFar)
}

/**
 * Encontra o segmento viário reto no qual o veículo está trafegando alinhado ao seu rumo.
 */
function findActiveApproachSegment(
  posX: number,
  posY: number,
  fwdX: number,
  fwdY: number,
  geo: WorldGeometryData,
): { seg: RoadSegment; dirX: number; dirY: number; closestX: number; closestY: number } | null {
  let best: {
    seg: RoadSegment
    dirX: number
    dirY: number
    closestX: number
    closestY: number
    score: number
  } | null = null

  for (const seg of geo.segments) {
    if (seg.roadClass === 'drag_strip' && fwdX > 0.6 && posX > 40) {
      continue
    }

    const d = distanceToSegment(posX, posY, seg.x1, seg.y1, seg.x2, seg.y2)
    if (d.dist > seg.width * 0.85) continue

    const sdx = seg.x2 - seg.x1
    const sdy = seg.y2 - seg.y1
    const sLen = Math.hypot(sdx, sdy)
    if (sLen < 1e-3) continue

    const ux = sdx / sLen
    const uy = sdy / sLen
    const dot = ux * fwdX + uy * fwdY
    if (Math.abs(dot) < 0.65) continue

    const sign = dot >= 0 ? 1 : -1
    const score = d.dist - Math.abs(dot) * 4
    if (!best || score < best.score) {
      best = {
        seg,
        dirX: ux * sign,
        dirY: uy * sign,
        closestX: seg.x1 + sdx * d.t,
        closestY: seg.y1 + sdy * d.t,
        score,
      }
    }
  }

  return best
    ? {
        seg: best.seg,
        dirX: best.dirX,
        dirY: best.dirY,
        closestX: best.closestX,
        closestY: best.closestY,
      }
    : null
}

/**
 * Extrai da geometria real (`WORLD_GEOMETRY.segments`) quais ramos saem de uma interseção
 * relativamente ao vetor de aproximação `(appDirX, appDirY)`.
 */
function deriveIntersectionExitArrows(
  inter: RoadIntersection,
  appDirX: number,
  appDirY: number,
  geo: WorldGeometryData,
): AsphaltExitArrow[] {
  if (inter.kind === 'roundabout') {
    return ['roundabout', 'right']
  }

  let hasLeft = false
  let hasStraight = false
  let hasRight = false

  for (const seg of geo.segments) {
    const d = distanceToSegment(inter.x, inter.y, seg.x1, seg.y1, seg.x2, seg.y2)
    if (d.dist > inter.radius + 6) continue

    for (const [ex, ey] of [
      [seg.x1, seg.y1],
      [seg.x2, seg.y2],
    ] as const) {
      const bx = ex - inter.x
      const by = ey - inter.y
      const bLen = Math.hypot(bx, by)
      if (bLen <= inter.radius + 6) continue

      const ux = bx / bLen
      const uy = by / bLen
      const dotFwd = ux * appDirX + uy * appDirY

      if (dotFwd < -0.65) continue

      if (dotFwd > 0.65) {
        hasStraight = true
      } else {
        const dotLeft = ux * -appDirY + uy * appDirX
        if (dotLeft > 0.55) hasLeft = true
        if (dotLeft < -0.55) hasRight = true
      }
    }
  }

  const arrows: AsphaltExitArrow[] = []
  if (hasLeft) arrows.push('left')
  if (hasStraight) arrows.push('straight')
  if (hasRight) arrows.push('right')
  return arrows
}

function findBestUpcomingCandidate(
  posX: number,
  posY: number,
  headingDeg: number,
  currentSpeedKmh: number | undefined,
  isRaining: boolean,
  geo: WorldGeometryData,
): InternalGuidanceCandidate | null {
  if (!Number.isFinite(posX) || !Number.isFinite(posY) || !Number.isFinite(headingDeg)) {
    return null
  }

  const rad = (headingDeg * Math.PI) / 180
  const fwdX = Math.sin(rad)
  const fwdY = Math.cos(rad)

  const activeSeg = findActiveApproachSegment(posX, posY, fwdX, fwdY, geo)
  const refDirX = activeSeg ? activeSeg.dirX : fwdX
  const refDirY = activeSeg ? activeSeg.dirY : fwdY
  const laneHeadingDeg = vectorToHeadingDeg(refDirX, refDirY)
  const hasExplicitSpeed = typeof currentSpeedKmh === 'number' && Number.isFinite(currentSpeedKmh)

  let bestCandidate: InternalGuidanceCandidate | null = null

  // ─── 1. Interseções, entroncamentos em T e rotatória à frente ───
  for (const inter of geo.intersections) {
    const dx = inter.x - posX
    const dy = inter.y - posY
    const distCenter = Math.hypot(dx, dy)
    if (distCenter < 1e-3) continue

    const alongAheadM = dx * refDirX + dy * refDirY
    const distEntry = alongAheadM - inter.radius
    const perpDist = Math.abs(dx * refDirY - dy * refDirX)
    if (perpDist > Math.max(inter.radius + 3, 16)) continue
    if (distCenter > inter.radius && alongAheadM / distCenter < 0.76) continue

    const exitArrows = deriveIntersectionExitArrows(inter, refDirX, refDirY, geo)
    const mu = WorldMap.query(inter.x, inter.y, isRaining).surface.friction

    let effectiveRadiusM: number
    if (inter.kind === 'roundabout') {
      effectiveRadiusM = 28
    } else if (exitArrows.length > 0 && !exitArrows.includes('straight')) {
      effectiveRadiusM = inter.radius + 4
    } else {
      effectiveRadiusM = inter.radius * 2.25
    }

    const safetyFactorK = 0.50
    const vMs = Math.sqrt(safetyFactorK * mu * GRAVITY_MS2 * effectiveRadiusM)
    const recommendedSpeedKmh = roundSpeedStep5(vMs * 3.6)

    const maxTriggerM = hasExplicitSpeed
      ? computeAnticipationDistanceM(currentSpeedKmh!, recommendedSpeedKmh, effectiveRadiusM, mu)
      : BASE_STATELESS_MAX_DIST_M
    if (distEntry < MIN_STATELESS_DIST_M || distEntry > maxTriggerM) continue

    const offsetBeforeCenter = inter.radius + 9.5
    let paintX = inter.x - refDirX * offsetBeforeCenter
    let paintY = inter.y - refDirY * offsetBeforeCenter
    let laneWidthM = inter.radius * 1.15

    if (activeSeg) {
      const proj = distanceToSegment(
        paintX,
        paintY,
        activeSeg.seg.x1,
        activeSeg.seg.y1,
        activeSeg.seg.x2,
        activeSeg.seg.y2,
      )
      if (proj.dist <= activeSeg.seg.width) {
        paintX = activeSeg.seg.x1 + (activeSeg.seg.x2 - activeSeg.seg.x1) * proj.t
        paintY = activeSeg.seg.y1 + (activeSeg.seg.y2 - activeSeg.seg.y1) * proj.t
        laneWidthM = activeSeg.seg.width
      }
    }

    const alpha = computeStatelessAlpha(distEntry, maxTriggerM)
    if (alpha <= 0.01) continue

    if (!bestCandidate || distEntry < bestCandidate.distanceAheadM) {
      bestCandidate = {
        featureId: inter.id,
        featureName: inter.name,
        kind: 'intersection',
        paintX,
        paintY,
        laneHeadingDeg,
        laneWidthM,
        distanceAheadM: distEntry,
        recommendedSpeedKmh,
        effectiveRadiusM,
        surfaceFriction: mu,
        exitArrows,
        alpha,
        passRefX: inter.x,
        passRefY: inter.y,
        approachDirX: refDirX,
        approachDirY: refDirY,
        clearPastRefM: Math.max(4, inter.radius * 0.45),
        maxCorridorHalfWidthM: Math.max(24, inter.radius + 14),
        safetyFactorK,
      }
    }
  }

  // ─── 2. Curvas geométricas (`WORLD_GEOMETRY.arcs`, incluindo anel rápido R=80m) à frente ───
  for (const arc of geo.arcs) {
    if (arc.id === 'rotatoria-central') continue

    if (arc.fullCircle) {
      const distToCenter = Math.hypot(posX - arc.cx, posY - arc.cy)
      if (distToCenter > arc.radius + arc.width * 0.25) {
        const ocX = posX - arc.cx
        const ocY = posY - arc.cy
        const b = ocX * refDirX + ocY * refDirY
        const c = ocX * ocX + ocY * ocY - arc.radius * arc.radius
        const disc = b * b - c
        if (disc > 0) {
          const distEntry = -b - Math.sqrt(disc)
          const hitX = posX + refDirX * Math.max(0, distEntry)
          const hitY = posY + refDirY * Math.max(0, distEntry)
          const mu = WorldMap.query(hitX, hitY, isRaining).surface.friction
          const effectiveRadiusM = arc.radius + arc.width * 0.2
          const safetyFactorK = 0.52
          const vMs = Math.sqrt(safetyFactorK * mu * GRAVITY_MS2 * effectiveRadiusM)
          const recommendedSpeedKmh = roundSpeedStep5(vMs * 3.6)

          const maxTriggerM = hasExplicitSpeed
            ? computeAnticipationDistanceM(currentSpeedKmh!, recommendedSpeedKmh, effectiveRadiusM, mu)
            : BASE_STATELESS_MAX_DIST_M

          if (distEntry >= MIN_STATELESS_DIST_M && distEntry <= maxTriggerM) {
            let paintX = hitX - refDirX * (arc.width * 0.5 + 8.5)
            let paintY = hitY - refDirY * (arc.width * 0.5 + 8.5)
            const laneWidthM = activeSeg ? activeSeg.seg.width : 16
            if (activeSeg) {
              const proj = distanceToSegment(
                paintX,
                paintY,
                activeSeg.seg.x1,
                activeSeg.seg.y1,
                activeSeg.seg.x2,
                activeSeg.seg.y2,
              )
              if (proj.dist <= activeSeg.seg.width) {
                paintX = activeSeg.seg.x1 + (activeSeg.seg.x2 - activeSeg.seg.x1) * proj.t
                paintY = activeSeg.seg.y1 + (activeSeg.seg.y2 - activeSeg.seg.y1) * proj.t
              }
            }

            const alpha = computeStatelessAlpha(distEntry, maxTriggerM)
            if (alpha > 0.01 && (!bestCandidate || distEntry < bestCandidate.distanceAheadM)) {
              bestCandidate = {
                featureId: arc.id,
                featureName: arc.zoneName,
                kind: 'curve',
                paintX,
                paintY,
                laneHeadingDeg,
                laneWidthM,
                distanceAheadM: distEntry,
                recommendedSpeedKmh,
                effectiveRadiusM,
                surfaceFriction: mu,
                exitArrows: ['left', 'right'],
                alpha,
                passRefX: hitX,
                passRefY: hitY,
                approachDirX: refDirX,
                approachDirY: refDirY,
                clearPastRefM: arc.width * 0.65 + 4,
                maxCorridorHalfWidthM: Math.max(26, arc.width * 1.8),
                safetyFactorK,
              }
            }
          }
        }
      }
      continue
    }

    const midAngle = (arc.startAngle + arc.endAngle) * 0.5
    const midX = arc.cx + Math.cos(midAngle) * arc.radius
    const midY = arc.cy + Math.sin(midAngle) * arc.radius

    const endpoints = [
      { x: arc.cx + Math.cos(arc.startAngle) * arc.radius, y: arc.cy + Math.sin(arc.startAngle) * arc.radius },
      { x: arc.cx + Math.cos(arc.endAngle) * arc.radius, y: arc.cy + Math.sin(arc.endAngle) * arc.radius },
    ]

    for (const ep of endpoints) {
      const dx = ep.x - posX
      const dy = ep.y - posY
      const distDirect = Math.hypot(dx, dy)
      const distEntry = dx * refDirX + dy * refDirY
      const perpDist = Math.abs(dx * refDirY - dy * refDirX)
      if (perpDist > arc.width * 1.05) continue
      if (distDirect > 6 && distEntry / distDirect < 0.76) continue

      const toMidFromCarX = midX - posX
      const toMidFromCarY = midY - posY
      if (Math.hypot(toMidFromCarX, toMidFromCarY) <= Math.max(0, distEntry) + 2) continue

      const curveVecX = midX - ep.x
      const curveVecY = midY - ep.y
      const curveLen = Math.hypot(curveVecX, curveVecY)
      const exitArrows: AsphaltExitArrow[] = []
      if (curveLen > 1e-3) {
        const dotLeft = (curveVecX / curveLen) * -refDirY + (curveVecY / curveLen) * refDirX
        if (dotLeft > 0.15) exitArrows.push('left')
        else if (dotLeft < -0.15) exitArrows.push('right')
      }

      const mu = WorldMap.query(midX, midY, isRaining).surface.friction
      const effectiveRadiusM = arc.radius + arc.width * 0.25
      const safetyFactorK = 0.52
      const vMs = Math.sqrt(safetyFactorK * mu * GRAVITY_MS2 * effectiveRadiusM)
      const recommendedSpeedKmh = roundSpeedStep5(vMs * 3.6)

      const maxTriggerM = hasExplicitSpeed
        ? computeAnticipationDistanceM(currentSpeedKmh!, recommendedSpeedKmh, effectiveRadiusM, mu)
        : BASE_STATELESS_MAX_DIST_M
      if (distEntry < MIN_STATELESS_DIST_M || distEntry > maxTriggerM) continue

      let paintX = ep.x - refDirX * 9.5
      let paintY = ep.y - refDirY * 9.5
      let laneWidthM = arc.width

      if (activeSeg) {
        const proj = distanceToSegment(
          paintX,
          paintY,
          activeSeg.seg.x1,
          activeSeg.seg.y1,
          activeSeg.seg.x2,
          activeSeg.seg.y2,
        )
        if (proj.dist <= activeSeg.seg.width) {
          paintX = activeSeg.seg.x1 + (activeSeg.seg.x2 - activeSeg.seg.x1) * proj.t
          paintY = activeSeg.seg.y1 + (activeSeg.seg.y2 - activeSeg.seg.y1) * proj.t
          laneWidthM = activeSeg.seg.width
        }
      }

      const alpha = computeStatelessAlpha(distEntry, maxTriggerM)
      if (alpha <= 0.01) continue

      if (!bestCandidate || distEntry < bestCandidate.distanceAheadM) {
        bestCandidate = {
          featureId: arc.id,
          featureName: arc.zoneName,
          kind: 'curve',
          paintX,
          paintY,
          laneHeadingDeg,
          laneWidthM,
          distanceAheadM: distEntry,
          recommendedSpeedKmh,
          effectiveRadiusM,
          surfaceFriction: mu,
          exitArrows,
          alpha,
          passRefX: ep.x,
          passRefY: ep.y,
          approachDirX: refDirX,
          approachDirY: refDirY,
          clearPastRefM: Math.max(10, Math.min(26, curveLen * 0.45)),
          maxCorridorHalfWidthM: Math.max(26, arc.width * 1.9),
          safetyFactorK,
        }
      }
    }
  }

  // ─── 3. Esquinas de 90° de segmentos conectados (ex.: cantos ±230m do Anel Viário Perimetral) ───
  if (activeSeg && activeSeg.seg.roadClass !== 'drag_strip') {
    const seg = activeSeg.seg
    const d1 = (seg.x1 - posX) * refDirX + (seg.y1 - posY) * refDirY
    const d2 = (seg.x2 - posX) * refDirX + (seg.y2 - posY) * refDirY
    const endPt = d2 >= d1 ? { x: seg.x2, y: seg.y2, d: d2 } : { x: seg.x1, y: seg.y1, d: d1 }
    const distCorner = endPt.d - seg.width * 0.5

    const alreadyCoveredByGeo =
      geo.intersections.some((it) => Math.hypot(it.x - endPt.x, it.y - endPt.y) <= it.radius + 8) ||
      geo.arcs.some((a) => {
        if (a.fullCircle) return false
        const sx = a.cx + Math.cos(a.startAngle) * a.radius
        const sy = a.cy + Math.sin(a.startAngle) * a.radius
        const ex = a.cx + Math.cos(a.endAngle) * a.radius
        const ey = a.cy + Math.sin(a.endAngle) * a.radius
        return Math.hypot(sx - endPt.x, sy - endPt.y) <= 14 || Math.hypot(ex - endPt.x, ey - endPt.y) <= 14
      })

    if (!alreadyCoveredByGeo) {
      const syntheticInter: RoadIntersection = {
        id: `corner-${seg.id}`,
        name: seg.name,
        x: endPt.x,
        y: endPt.y,
        radius: seg.width * 0.65,
        kind: 't_junction',
      }
      const exitArrows = deriveIntersectionExitArrows(syntheticInter, refDirX, refDirY, geo)
      if (exitArrows.length > 0 && !exitArrows.includes('straight')) {
        const mu = WorldMap.query(endPt.x, endPt.y, isRaining).surface.friction
        const effectiveRadiusM = seg.width * 0.95
        const safetyFactorK = 0.50
        const vMs = Math.sqrt(safetyFactorK * mu * GRAVITY_MS2 * effectiveRadiusM)
        const recommendedSpeedKmh = roundSpeedStep5(vMs * 3.6)
        const maxTriggerM = hasExplicitSpeed
          ? computeAnticipationDistanceM(currentSpeedKmh!, recommendedSpeedKmh, effectiveRadiusM, mu)
          : BASE_STATELESS_MAX_DIST_M

        if (distCorner >= MIN_STATELESS_DIST_M && distCorner <= maxTriggerM) {
          const alpha = computeStatelessAlpha(distCorner, maxTriggerM)
          if (alpha > 0.01 && (!bestCandidate || distCorner < bestCandidate.distanceAheadM - 6)) {
            bestCandidate = {
              featureId: syntheticInter.id,
              featureName: seg.name,
              kind: 'curve',
              paintX: endPt.x - refDirX * (seg.width * 0.65 + 9.0),
              paintY: endPt.y - refDirY * (seg.width * 0.65 + 9.0),
              laneHeadingDeg,
              laneWidthM: seg.width,
              distanceAheadM: distCorner,
              recommendedSpeedKmh,
              effectiveRadiusM,
              surfaceFriction: mu,
              exitArrows,
              alpha,
              passRefX: endPt.x,
              passRefY: endPt.y,
              approachDirX: refDirX,
              approachDirY: refDirY,
              clearPastRefM: seg.width * 0.55 + 4,
              maxCorridorHalfWidthM: Math.max(24, seg.width * 1.8),
              safetyFactorK,
            }
          }
        }
      }
    }
  }

  return bestCandidate
}

function stripInternalFields(c: InternalGuidanceCandidate): AsphaltGuidanceResult {
  return {
    featureId: c.featureId,
    featureName: c.featureName,
    kind: c.kind,
    paintX: c.paintX,
    paintY: c.paintY,
    laneHeadingDeg: c.laneHeadingDeg,
    laneWidthM: c.laneWidthM,
    distanceAheadM: c.distanceAheadM,
    recommendedSpeedKmh: c.recommendedSpeedKmh,
    effectiveRadiusM: c.effectiveRadiusM,
    surfaceFriction: c.surfaceFriction,
    exitArrows: c.exitArrows,
    alpha: c.alpha,
  }
}

/**
 * Consulta pura (sem estado) da orientação no asfalto à frente do veículo.
 */
export function computeAsphaltGuidance(
  posX: number,
  posY: number,
  headingDeg: number,
  isRaining: boolean = false,
  geo: WorldGeometryData = WORLD_GEOMETRY,
  currentSpeedKmh?: number,
): AsphaltGuidanceResult | null {
  const best = findBestUpcomingCandidate(posX, posY, headingDeg, currentSpeedKmh, isRaining, geo)
  return best ? stripInternalFields(best) : null
}

/**
 * AsphaltGuidanceTracker — Gerenciador de ciclo de vida com estado e histerese por trecho geométrico (Fase 4.4.2.2).
 *
 * Garante que a marcação de velocidade recomendada:
 * 1. Apareça na distância de antecipação adequada à velocidade atual, curvatura e superfície.
 * 2. Permaneça cravada na mesma coordenada do asfalto durante toda a aproximação (100m -> 50m -> 10m -> 0m).
 * 3. Continue visível enquanto o veículo alcança a marcação e entra/atravessa o ponto relevante da curva/interseção.
 * 4. Desapareça somente DEPOIS que o veículo superar o trecho (`progressPastRef > clearPastRefM`) ou quando
 *    deixar de ser relevante (retorno em sentido oposto ou desvio para outra via).
 * 5. Nunca pisque por pequenas oscilações de posição ou desaceleração durante a frenagem!
 */
export class AsphaltGuidanceTracker {
  private activeLock: InternalGuidanceCandidate | null = null
  private lastClearedFeatureId: string | null = null
  private clearCooldownDistM = 0
  private lastPosX: number | null = null
  private lastPosY: number | null = null

  reset(): void {
    this.activeLock = null
    this.lastClearedFeatureId = null
    this.clearCooldownDistM = 0
    this.lastPosX = null
    this.lastPosY = null
  }

  getActiveFeatureId(): string | null {
    return this.activeLock?.featureId ?? null
  }

  update(
    posX: number,
    posY: number,
    headingDeg: number,
    currentSpeedKmh: number = 60,
    isRaining: boolean = false,
    geo: WorldGeometryData = WORLD_GEOMETRY,
  ): AsphaltGuidanceResult | null {
    if (!Number.isFinite(posX) || !Number.isFinite(posY) || !Number.isFinite(headingDeg)) {
      this.reset()
      return null
    }

    // Se houve teleporte / reposicionamento brusco (> 45m em um passo), reinicia o estado
    if (this.lastPosX !== null && this.lastPosY !== null) {
      const stepDist = Math.hypot(posX - this.lastPosX, posY - this.lastPosY)
      if (stepDist > 45) {
        this.activeLock = null
        this.lastClearedFeatureId = null
        this.clearCooldownDistM = 0
      } else if (this.clearCooldownDistM > 0) {
        this.clearCooldownDistM = Math.max(0, this.clearCooldownDistM - stepDist)
        if (this.clearCooldownDistM === 0) {
          this.lastClearedFeatureId = null
        }
      }
    }
    this.lastPosX = posX
    this.lastPosY = posY

    // ─── 1. Avalia manutenção/travessia do trecho atualmente travado (histerese sem flicker) ───
    if (this.activeLock) {
      const lock = this.activeLock
      const rad = (headingDeg * Math.PI) / 180
      const fwdX = Math.sin(rad)
      const fwdY = Math.cos(rad)

      // Progresso longitudinal assinalado em relação ao ponto de referência da curva/interseção:
      // negativo = ainda se aproximando; 0 = no centro/entrada do trecho; positivo = já atravessando/saindo
      const relX = posX - lock.passRefX
      const relY = posY - lock.passRefY
      const progressPastRefM = relX * lock.approachDirX + relY * lock.approachDirY
      const distanceAheadM = -progressPastRefM
      const lateralOffsetM = Math.abs(relX * lock.approachDirY - relY * lock.approachDirX)
      const headingDot = fwdX * lock.approachDirX + fwdY * lock.approachDirY

      // Condições de encerramento:
      // (a) Veículo concluiu a passagem pelo trecho
      // (b) Motorista fez meia-volta / seguiu em sentido contrário (headingDot < -0.25)
      // (c) Motorista desviou lateralmente para fora do corredor da via/curva
      // (d) Veículo recuou para muito longe (> 165m antes do ponto)
      const hasPassedFeature = progressPastRefM > lock.clearPastRefM
      const hasTurnedAway =
        (distanceAheadM > 14 && headingDot < -0.15) ||
        lateralOffsetM > lock.maxCorridorHalfWidthM ||
        distanceAheadM > 165

      if (hasPassedFeature || hasTurnedAway) {
        this.lastClearedFeatureId = lock.featureId
        this.clearCooldownDistM = 12
        this.activeLock = null
      } else {
        // Atualiza dinamicamente apenas velocidade recomendada se chuva/atrito mudar durante a aproximação
        const mu = WorldMap.query(lock.passRefX, lock.passRefY, isRaining).surface.friction
        if (Math.abs(mu - lock.surfaceFriction) > 1e-3) {
          const vMs = Math.sqrt(lock.safetyFactorK * mu * GRAVITY_MS2 * lock.effectiveRadiusM)
          lock.surfaceFriction = mu
          lock.recommendedSpeedKmh = roundSpeedStep5(vMs * 3.6)
        }

        // Opacidade sólida (1.0) durante toda a aproximação e entrada, suavizando apenas nos metros finais da saída
        const fadeOutAtExit = clamp((lock.clearPastRefM - progressPastRefM) / 5.5, 0, 1)
        const fadeInFar = clamp((155 - distanceAheadM) / 14, 0, 1)
        lock.distanceAheadM = distanceAheadM
        lock.alpha = Math.min(fadeOutAtExit, fadeInFar)

        if (lock.alpha > 0.02) {
          return stripInternalFields(lock)
        }
        this.lastClearedFeatureId = lock.featureId
        this.clearCooldownDistM = 12
        this.activeLock = null
      }
    }

    // ─── 2. Sem trecho travado: adquire próximo candidato relevante à frente ───
    const candidate = findBestUpcomingCandidate(
      posX,
      posY,
      headingDeg,
      currentSpeedKmh,
      isRaining,
      geo,
    )

    if (!candidate) {
      return null
    }

    // Evita reativar imediatamente o mesmo trecho nos primeiros metros após já tê-lo atravessado
    if (
      this.lastClearedFeatureId === candidate.featureId &&
      this.clearCooldownDistM > 0 &&
      candidate.distanceAheadM < 8
    ) {
      return null
    }

    // Só inicia um novo ciclo quando o veículo ainda está antes da entrada do trecho (>= 4m)
    if (candidate.distanceAheadM < 4) {
      return null
    }

    this.activeLock = { ...candidate }
    return stripInternalFields(this.activeLock)
  }
}
