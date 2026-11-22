import {
  WORLD_GEOMETRY,
  checkCircleVsBoxCollision,
  distanceToSegment,
  evaluateRoadArc,
  type WorldGeography,
} from './WorldGeometry'

export type SurfaceType = 'asphalt' | 'wet_asphalt' | 'grass' | 'gravel' | 'curb'

export interface SurfaceProperties {
  type: SurfaceType
  friction: number          // Coeficiente mu de atrito de Coulomb
  rollingResistance: number // Coeficiente Crr de resistência ao rolamento
  name: string
  color: string
}

export interface CollisionResult {
  isColliding: boolean
  penetrationDepth: number
  normalX: number
  normalY: number
  boundaryName?: string
}

export interface WorldMapQuery {
  surface: SurfaceProperties
  collision: CollisionResult
  zoneName: string
  roadId?: string
}

/**
 * WorldMap — Mapa 2D métrico contínuo e determinístico do HEATZ AUTO.
 *
 * Consumidor físico oficial de WORLD_GEOMETRY (fonte única da verdade compartilhada
 * com DrivingWorldCanvas, WorldMapModal e futuras multimídias).
 *
 * Dimensões: 600m x 600m (X: [-300, 300], Y: [-300, 300]) + corredor oficial 402m.
 */
export class WorldMap {
  public static readonly MAP_HALF_WIDTH = WORLD_GEOMETRY.bounds.halfWidth
  public static readonly MAP_HALF_HEIGHT = WORLD_GEOMETRY.bounds.halfHeight
  public static readonly BOUNDARY_LIMIT = WORLD_GEOMETRY.bounds.boundaryLimit

  // Ponto de spawn seguro na saída norte da Rotatória Central (fora da ilha de raio 16m)
  public static readonly SPAWN_X = WORLD_GEOMETRY.spawn.x
  public static readonly SPAWN_Y = WORLD_GEOMETRY.spawn.y
  public static readonly SPAWN_HEADING_DEG = WORLD_GEOMETRY.spawn.headingDeg

  // Drag Strip Markers (em metros globais)
  public static readonly DRAG_STRIP_START_X = WORLD_GEOMETRY.dragStrip.startX
  public static readonly DRAG_STRIP_60FT_X = WORLD_GEOMETRY.dragStrip.mark60ftX
  public static readonly DRAG_STRIP_201M_X = WORLD_GEOMETRY.dragStrip.mark201mX
  public static readonly DRAG_STRIP_402M_X = WORLD_GEOMETRY.dragStrip.mark402mX
  public static readonly DRAG_STRIP_Y_CENTER = WORLD_GEOMETRY.dragStrip.yCenter
  public static readonly DRAG_STRIP_HALF_WIDTH = WORLD_GEOMETRY.dragStrip.halfWidth

  /**
   * Retorna a definição geográfica única do mundo 2D (vias, curvas, cruzamentos, setores e obstáculos).
   */
  public static getGeometry(): WorldGeography {
    return WORLD_GEOMETRY
  }

  /**
   * Consulta a superfície e colisões em qualquer coordenada métrica (x, y) do mundo.
   */
  public static query(x: number, y: number, isRaining = false, vehicleRadius = 1.2): WorldMapQuery {
    const collision = this.checkCollision(x, y, vehicleRadius)
    const { surface, zoneName, roadId } = this.determineSurface(x, y, isRaining)

    return {
      surface,
      collision,
      zoneName,
      roadId,
    }
  }

  /**
   * Verifica colisões contra defensas perimetrais e todos os obstáculos sólidos de WORLD_GEOMETRY.
   */
  public static checkCollision(x: number, y: number, vehicleRadius = 1.2): CollisionResult {
    const limit = this.BOUNDARY_LIMIT - vehicleRadius

    // 1. Limites externos da cidade (com extensão do corredor oficial da Reta de Arrancada 402m)
    const inDragCorridor =
      x > 0 && Math.abs(y - this.DRAG_STRIP_Y_CENTER) <= this.DRAG_STRIP_HALF_WIDTH + 4
    const eastLimit = inDragCorridor
      ? WORLD_GEOMETRY.dragStrip.eastBoundaryX - vehicleRadius
      : limit

    let deepest: CollisionResult = {
      isColliding: false,
      penetrationDepth: 0,
      normalX: 0,
      normalY: 0,
    }

    const consider = (candidate: CollisionResult) => {
      if (candidate.isColliding && candidate.penetrationDepth > deepest.penetrationDepth) {
        deepest = candidate
      }
    }

    if (x > eastLimit) {
      consider({
        isColliding: true,
        penetrationDepth: x - eastLimit,
        normalX: -1,
        normalY: 0,
        boundaryName: inDragCorridor ? 'Barreira Final da Drag Strip' : 'Defensa Leste',
      })
    }
    if (x < -limit) {
      consider({
        isColliding: true,
        penetrationDepth: -limit - x,
        normalX: 1,
        normalY: 0,
        boundaryName: 'Defensa Oeste',
      })
    }
    if (y > limit) {
      consider({
        isColliding: true,
        penetrationDepth: y - limit,
        normalX: 0,
        normalY: -1,
        boundaryName: 'Defensa Norte',
      })
    }
    if (y < -limit) {
      consider({
        isColliding: true,
        penetrationDepth: -limit - y,
        normalX: 0,
        normalY: 1,
        boundaryName: 'Defensa Sul',
      })
    }

    // Limites laterais do corredor da Drag Strip além do perímetro leste (x > 285)
    if (x > limit && inDragCorridor) {
      const corridorHalf = this.DRAG_STRIP_HALF_WIDTH + 3.5 - vehicleRadius
      const dyDrag = y - this.DRAG_STRIP_Y_CENTER
      if (dyDrag > corridorHalf) {
        consider({
          isColliding: true,
          penetrationDepth: dyDrag - corridorHalf,
          normalX: 0,
          normalY: -1,
          boundaryName: 'Muro Norte da Drag Strip',
        })
      } else if (dyDrag < -corridorHalf) {
        consider({
          isColliding: true,
          penetrationDepth: -corridorHalf - dyDrag,
          normalX: 0,
          normalY: 1,
          boundaryName: 'Muro Sul da Drag Strip',
        })
      }
    }

    // 2. Obstáculos físicos de WORLD_GEOMETRY (Ilha da Rotatória, blocos urbanos, paddock, boxes)
    for (const obs of WORLD_GEOMETRY.obstacles) {
      if (obs.shape === 'circle' && obs.cx !== undefined && obs.cy !== undefined && obs.radius !== undefined) {
        const dx = x - obs.cx
        const dy = y - obs.cy
        const dist = Math.hypot(dx, dy)
        const minDist = obs.radius + vehicleRadius
        if (dist < minDist) {
          const normalX = dist > 0.01 ? dx / dist : 0
          const normalY = dist > 0.01 ? dy / dist : 1
          consider({
            isColliding: true,
            penetrationDepth: minDist - dist,
            normalX,
            normalY,
            boundaryName: obs.name,
          })
        }
      } else if (
        obs.shape === 'box' &&
        obs.minX !== undefined &&
        obs.maxX !== undefined &&
        obs.minY !== undefined &&
        obs.maxY !== undefined
      ) {
        const hit = checkCircleVsBoxCollision(
          x,
          y,
          vehicleRadius,
          obs.minX,
          obs.maxX,
          obs.minY,
          obs.maxY,
        )
        if (hit.isColliding) {
          consider({
            isColliding: true,
            penetrationDepth: hit.penetrationDepth,
            normalX: hit.normalX,
            normalY: hit.normalY,
            boundaryName: obs.name,
          })
        }
      }
    }

    return deepest
  }

  /**
   * Identifica o tipo de superfície e propriedades físicas sob as rodas a partir de WORLD_GEOMETRY.
   */
  private static determineSurface(
    x: number,
    y: number,
    isRaining: boolean,
  ): { surface: SurfaceProperties; zoneName: string; roadId?: string } {
    // 1. Rotatória Central (prioridade no núcleo central r <= 42m)
    const distFromOrigin = Math.hypot(x, y)
    if (distFromOrigin <= 42.0) {
      if (distFromOrigin >= 16.0 && distFromOrigin <= 18.0) {
        return {
          surface: {
            type: 'curb',
            friction: isRaining ? 0.52 : 0.85,
            rollingResistance: 0.025,
            name: isRaining ? 'Zebra da Rotatória (Molhada)' : 'Zebra da Rotatória',
            color: '#dc2626',
          },
          zoneName: 'Rotatória Central',
          roadId: 'rotatoria-central',
        }
      }
      return {
        surface: this.getAsphalt(isRaining),
        zoneName: 'Rotatória Central',
        roadId: 'rotatoria-central',
      }
    }

    // 2. Reta Oficial de Arrancada 402m (VHT Prep)
    const dragSeg = WORLD_GEOMETRY.segments.find((s) => s.surfaceKind === 'drag_vht')
    if (dragSeg) {
      const { dist } = distanceToSegment(x, y, dragSeg.x1, dragSeg.y1, dragSeg.x2, dragSeg.y2)
      if (dist <= dragSeg.width / 2) {
        const dragFriction = isRaining ? 0.70 : 1.18
        return {
          surface: {
            type: 'asphalt',
            friction: dragFriction,
            rollingResistance: 0.012,
            name: 'Drag Strip 402m (VHT Prep)',
            color: '#1e293b',
          },
          zoneName: dragSeg.zoneName,
          roadId: dragSeg.id,
        }
      }
    }

    // 3. Pista útil (asfalto interior) de TODOS os segmentos retos e arcos curvos
    // Avalia o interior asfaltado primeiro para que cruzamentos não tenham guias fantasma.
    let curbMatch: { zoneName: string; roadId: string; isSidewalk: boolean } | null = null

    for (const seg of WORLD_GEOMETRY.segments) {
      if (seg.surfaceKind === 'drag_vht') continue
      const { dist } = distanceToSegment(x, y, seg.x1, seg.y1, seg.x2, seg.y2)
      const halfW = seg.width / 2
      const innerHalfW = Math.max(0, halfW - seg.curbWidth)

      if (dist <= innerHalfW) {
        return {
          surface: this.getAsphalt(isRaining),
          zoneName: seg.zoneName,
          roadId: seg.id,
        }
      }
      if (!curbMatch && dist <= halfW) {
        curbMatch = { zoneName: seg.zoneName, roadId: seg.id, isSidewalk: false }
      } else if (!curbMatch && seg.sidewalkWidth > 0 && dist <= halfW + seg.sidewalkWidth) {
        curbMatch = { zoneName: seg.zoneName, roadId: seg.id, isSidewalk: true }
      }
    }

    for (const arc of WORLD_GEOMETRY.arcs) {
      if (arc.id === 'rotatoria-central') continue
      const evalArc = evaluateRoadArc(x, y, arc)
      if (!evalArc.insideAngle) continue
      const halfW = arc.width / 2
      const innerHalfW = Math.max(0, halfW - arc.curbWidth)

      if (evalArc.radialOffset <= innerHalfW) {
        return {
          surface: this.getAsphalt(isRaining),
          zoneName: arc.zoneName,
          roadId: arc.id,
        }
      }
      if (evalArc.radialOffset <= halfW) {
        curbMatch = { zoneName: arc.zoneName, roadId: arc.id, isSidewalk: false }
      }
    }

    // 4. Zonas Especiais (Skidpad Molhado e Circuito Off-Road 4x4)
    for (const zone of WORLD_GEOMETRY.zones) {
      const dist = Math.hypot(x - zone.cx, y - zone.cy)
      if (dist <= zone.radius) {
        return {
          surface: {
            type: zone.surfaceKind,
            friction: zone.friction,
            rollingResistance: zone.rollingResistance,
            name: zone.surfaceKind === 'wet_asphalt' ? 'Asfalto Molhado / Skidpad' : 'Pista de Cascalho / Terra',
            color: zone.fillColor,
          },
          zoneName: zone.zoneName,
          roadId: zone.id,
        }
      }
    }

    // 5. Guias / Zebras / Calçadas das vias
    if (curbMatch) {
      return {
        surface: {
          type: 'curb',
          friction: isRaining
            ? curbMatch.isSidewalk ? 0.54 : 0.52
            : curbMatch.isSidewalk ? 0.80 : 0.85,
          rollingResistance: curbMatch.isSidewalk ? 0.028 : 0.022,
          name: curbMatch.isSidewalk ? 'Calçada / Passeio' : 'Guia / Meio-fio',
          color: curbMatch.isSidewalk ? '#64748b' : '#e2e8f0',
        },
        zoneName: curbMatch.zoneName,
        roadId: curbMatch.roadId,
      }
    }

    // 6. Calçadas ao redor dos blocos urbanos não dirigíveis
    for (const obs of WORLD_GEOMETRY.obstacles) {
      if (obs.sidewalkMargin <= 0) continue
      if (obs.shape === 'circle' && obs.cx !== undefined && obs.cy !== undefined && obs.radius !== undefined) {
        const dist = Math.hypot(x - obs.cx, y - obs.cy)
        if (dist <= obs.radius + obs.sidewalkMargin) {
          return {
            surface: {
              type: 'curb',
              friction: isRaining ? 0.54 : 0.80,
              rollingResistance: 0.028,
              name: 'Calçada / Passeio',
              color: '#64748b',
            },
            zoneName: `Calçada — ${obs.name}`,
            roadId: obs.id,
          }
        }
      } else if (
        obs.shape === 'box' &&
        obs.minX !== undefined &&
        obs.maxX !== undefined &&
        obs.minY !== undefined &&
        obs.maxY !== undefined
      ) {
        const m = obs.sidewalkMargin
        if (x >= obs.minX - m && x <= obs.maxX + m && y >= obs.minY - m && y <= obs.maxY + m) {
          return {
            surface: {
              type: 'curb',
              friction: isRaining ? 0.54 : 0.80,
              rollingResistance: 0.028,
              name: 'Calçada / Passeio',
              color: '#64748b',
            },
            zoneName: `Calçada — ${obs.name}`,
            roadId: obs.id,
          }
        }
      }
    }

    // 7. Grama / Terreno Natural nos demais espaços
    return {
      surface: {
        type: 'grass',
        friction: 0.35,
        rollingResistance: 0.055,
        name: 'Grama / Fora de Pista',
        color: '#14532d',
      },
      zoneName: 'Área Verde',
    }
  }

  private static getAsphalt(isRaining: boolean): SurfaceProperties {
    return {
      type: isRaining ? 'wet_asphalt' : 'asphalt',
      friction: isRaining ? 0.62 : 0.95,
      rollingResistance: isRaining ? 0.016 : 0.014,
      name: isRaining ? 'Asfalto Molhado (Chuva)' : 'Asfalto Seco',
      color: '#334155',
    }
  }
}
