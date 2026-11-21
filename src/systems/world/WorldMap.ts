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
}

/**
 * WorldMap — Mapa 2D métrico contínuo e determinístico do HEATZ AUTO.
 *
 * Dimensões: 600m x 600m (X: [-300, 300], Y: [-300, 300]).
 * O ponto central (0, 0) é a Rotatória Central com a Praça da Matriz.
 *
 * Setores:
 * 1. Avenidas Principais (Norte-Sul e Leste-Oeste) com asfalto de alta aderência (mu = 0.95).
 * 2. Rotatória Central (R_ext = 42m, Ilha = 18m).
 * 3. Pista de Arrancada 402m (Drag Strip Oficial) no Setor Leste (Y: [40, 64], X: [40, 480]).
 * 4. Pista de Handling / Circuito Sinuoso no Setor Noroeste (X < -30, Y > 30).
 * 5. Skidpad de Baixa Aderência (Asfalto Molhado) no Setor Sudoeste (X < -30, Y < -30).
 * 6. Setor Off-Road / Terra e Cascalho no Setor Sudeste (X > 30, Y < -30).
 * 7. Áreas verdes / gramado nos quarteirões intermediários.
 * 8. Barreiras de contenção perimetrais com colisão elástica e amortecimento.
 */
export class WorldMap {
  public static readonly MAP_HALF_WIDTH = 300  // metros (-300 a +300)
  public static readonly MAP_HALF_HEIGHT = 300 // metros (-300 a +300)
  public static readonly BOUNDARY_LIMIT = 285   // metros (limite das defensas de concreto)

  // Ponto de spawn seguro na saída norte da Rotatória Central (fora da ilha de raio 16m)
  public static readonly SPAWN_X = 0
  public static readonly SPAWN_Y = 25
  public static readonly SPAWN_HEADING_DEG = 0

  // Drag Strip Markers (em metros globais)
  public static readonly DRAG_STRIP_START_X = 50
  public static readonly DRAG_STRIP_60FT_X = 50 + 18.288  // 60 pés = 18.29m
  public static readonly DRAG_STRIP_201M_X = 50 + 201.168 // 1/8 milha = 201.17m
  public static readonly DRAG_STRIP_402M_X = 50 + 402.336 // 1/4 milha = 402.34m
  public static readonly DRAG_STRIP_Y_CENTER = 52
  public static readonly DRAG_STRIP_HALF_WIDTH = 12

  /**
   * Consulta a superfície e colisões em qualquer coordenada métrica (x, y) do mundo.
   */
  public static query(x: number, y: number, isRaining = false): WorldMapQuery {
    const collision = this.checkCollision(x, y)
    const { surface, zoneName } = this.determineSurface(x, y, isRaining)

    return {
      surface,
      collision,
      zoneName,
    }
  }

  /**
   * Verifica colisões contra defensas e limites perimetrais.
   */
  public static checkCollision(x: number, y: number, vehicleRadius = 1.2): CollisionResult {
    const limit = this.BOUNDARY_LIMIT - vehicleRadius

    // Limites externos da cidade (com extensão do corredor oficial da Reta de Arrancada 402m)
    const inDragCorridor =
      x > 0 && Math.abs(y - this.DRAG_STRIP_Y_CENTER) <= this.DRAG_STRIP_HALF_WIDTH + 4
    const eastLimit = inDragCorridor ? this.DRAG_STRIP_402M_X + 70 - vehicleRadius : limit

    if (x > eastLimit) {
      return {
        isColliding: true,
        penetrationDepth: x - eastLimit,
        normalX: -1,
        normalY: 0,
        boundaryName: inDragCorridor ? 'Barreira Final da Drag Strip' : 'Defensa Leste',
      }
    }
    if (x < -limit) {
      return {
        isColliding: true,
        penetrationDepth: -limit - x,
        normalX: 1,
        normalY: 0,
        boundaryName: 'Defensa Oeste',
      }
    }
    if (y > limit) {
      return {
        isColliding: true,
        penetrationDepth: y - limit,
        normalX: 0,
        normalY: -1,
        boundaryName: 'Defensa Norte',
      }
    }
    if (y < -limit) {
      return {
        isColliding: true,
        penetrationDepth: -limit - y,
        normalX: 0,
        normalY: 1,
        boundaryName: 'Defensa Sul',
      }
    }

    // Ilha central da Rotatória (obstáculo circular com monumento central)
    const distToCenter = Math.hypot(x, y)
    const islandRadius = 16.0
    if (distToCenter < islandRadius + vehicleRadius) {
      const normalX = distToCenter > 0.01 ? x / distToCenter : 0
      const normalY = distToCenter > 0.01 ? y / distToCenter : 1
      return {
        isColliding: true,
        penetrationDepth: islandRadius + vehicleRadius - distToCenter,
        normalX,
        normalY,
        boundaryName: 'Ilha da Rotatória',
      }
    }

    return {
      isColliding: false,
      penetrationDepth: 0,
      normalX: 0,
      normalY: 0,
    }
  }

  /**
   * Identifica o tipo de superfície e propriedades físicas sob as rodas.
   */
  private static determineSurface(
    x: number,
    y: number,
    isRaining: boolean,
  ): { surface: SurfaceProperties; zoneName: string } {
    const distFromOrigin = Math.hypot(x, y)

    // 1. Rotatória Central
    if (distFromOrigin <= 42.0) {
      if (distFromOrigin >= 16.0 && distFromOrigin <= 18.0) {
        return {
          surface: {
            type: 'curb',
            friction: 0.85,
            rollingResistance: 0.025,
            name: 'Zebra da Rotatória',
            color: '#dc2626',
          },
          zoneName: 'Rotatória Central',
        }
      }
      return {
        surface: this.getAsphalt(isRaining),
        zoneName: 'Rotatória Central',
      }
    }

    // 2. Avenidas Principais (Cruciforme 24m de largura)
    const isMainAvenueEW = Math.abs(y) <= 12.0 && Math.abs(x) <= 280
    const isMainAvenueNS = Math.abs(x) <= 12.0 && Math.abs(y) <= 280

    if (isMainAvenueEW || isMainAvenueNS) {
      // Zebras / guias nas bordas
      const nearCurbEW = isMainAvenueEW && Math.abs(y) >= 10.5
      const nearCurbNS = isMainAvenueNS && Math.abs(x) >= 10.5
      if (nearCurbEW || nearCurbNS) {
        return {
          surface: {
            type: 'curb',
            friction: 0.85,
            rollingResistance: 0.022,
            name: 'Guia / Meio-fio',
            color: '#e2e8f0',
          },
          zoneName: isMainAvenueEW ? 'Av. Transversal Leste-Oeste' : 'Av. Central Norte-Sul',
        }
      }

      return {
        surface: this.getAsphalt(isRaining),
        zoneName: isMainAvenueEW ? 'Av. Transversal Leste-Oeste' : 'Av. Central Norte-Sul',
      }
    }

    // 3. Pista de Arrancada Oficial (Drag Strip 402m)
    if (
      x >= this.DRAG_STRIP_START_X - 10 &&
      x <= this.DRAG_STRIP_402M_X + 60 &&
      Math.abs(y - this.DRAG_STRIP_Y_CENTER) <= this.DRAG_STRIP_HALF_WIDTH
    ) {
      // Asfalto emborrachado com VHT de altíssima aderência em arrancada
      const dragFriction = isRaining ? 0.70 : 1.18
      return {
        surface: {
          type: 'asphalt',
          friction: dragFriction,
          rollingResistance: 0.012,
          name: 'Drag Strip 402m (VHT Prep)',
          color: '#1e293b',
        },
        zoneName: 'Reta Oficial de Arrancada',
      }
    }

    // 4. Skidpad Molhado (Setor Sudoeste: X < -40, Y < -40)
    const skidCenter = { x: -140, y: -140 }
    const distToSkid = Math.hypot(x - skidCenter.x, y - skidCenter.y)
    if (distToSkid <= 65) {
      return {
        surface: {
          type: 'wet_asphalt',
          friction: 0.50,
          rollingResistance: 0.018,
          name: 'Asfalto Molhado / Skidpad',
          color: '#0f172a',
        },
        zoneName: 'Área de Teste de Derrapagem (Skidpad)',
      }
    }

    // 5. Setor Off-Road / Cascalho e Terra (Setor Sudeste: X > 40, Y < -40)
    const offroadCenter = { x: 140, y: -140 }
    const distToOffroad = Math.hypot(x - offroadCenter.x, y - offroadCenter.y)
    if (distToOffroad <= 75) {
      return {
        surface: {
          type: 'gravel',
          friction: 0.48,
          rollingResistance: 0.045,
          name: 'Pista de Cascalho / Terra',
          color: '#78350f',
        },
        zoneName: 'Circuito Off-Road 4x4',
      }
    }

    // 6. Circuito de Handling Sinuoso (Setor Noroeste: X < -30, Y > 30)
    // Curva oval e chicane
    const inHandlingArea = x >= -250 && x <= -30 && y >= 30 && y <= 250
    if (inHandlingArea) {
      // Traçado do anel sinuoso
      const rOuter = 95
      const rInner = 65
      const handlingCenter = { x: -140, y: 140 }
      const d = Math.hypot(x - handlingCenter.x, y - handlingCenter.y)
      if (d >= rInner && d <= rOuter) {
        return {
          surface: this.getAsphalt(isRaining),
          zoneName: 'Circuito de Handling (Curva Rápida)',
        }
      }
    }

    // 7. Vias Secundárias Perimetrais (Ruas de ligação)
    const isPerimeterRing =
      (Math.abs(x) >= 220 && Math.abs(x) <= 240 && Math.abs(y) <= 240) ||
      (Math.abs(y) >= 220 && Math.abs(y) <= 240 && Math.abs(x) <= 240)
    if (isPerimeterRing) {
      return {
        surface: this.getAsphalt(isRaining),
        zoneName: 'Anel Viário Perimetral',
      }
    }

    // 8. Grama / Terreno Natural nos demais espaços
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
