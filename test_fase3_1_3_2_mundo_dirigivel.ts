/**
 * Suite funcional real — Fases 3.1 e 3.2 (Mundo 2D Navegável + Veículo Realmente Dirigível a 120 Hz)
 * Protótipo principal: VW Gol Quadrado 1.9 AP Turbo (gol-quadrado-turbo)
 * Valida arquitetura unificada WORLD_GEOMETRY -> WorldMap -> VehiclePhysics -> useSimulationStore -> WorldMapModal.
 */
import fs from 'fs'
import path from 'path'
import { useSimulationStore } from './src/stores/useSimulationStore'
import { useUIStore } from './src/stores/useUIStore'
import { WorldMap } from './src/systems/world/WorldMap'
import { WORLD_GEOMETRY } from './src/systems/world/WorldGeometry'
import { VehiclePhysics } from './src/systems/physics/VehiclePhysics'
import type { VehicleConfig } from './src/types'

let passed = 0
let failed = 0

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    passed++
    console.log(`  ✅ PASS: ${label}${detail ? ` (${detail})` : ''}`)
  } else {
    failed++
    console.error(`  ❌ FAIL: ${label}${detail ? ` (${detail})` : ''}`)
  }
}

function loadVehicle(id: string): VehicleConfig {
  const filePath = path.join(process.cwd(), 'public', 'vehicles', id, 'config.json')
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as VehicleConfig
}

function stepSeconds(seconds: number) {
  const ticks = Math.round(seconds * 120)
  for (let i = 0; i < ticks; i++) {
    useSimulationStore.getState().update(1 / 120)
  }
}

function signedAngleDeltaDeg(fromDeg: number, toDeg: number): number {
  return ((toDeg - fromDeg + 540) % 360) - 180
}

function teleportStoreVehicle(x: number, y: number, headingDeg: number, speedKmh = 0) {
  const st = useSimulationStore.getState()
  if (st._physics) {
    st._physics.setPosition(x, y, headingDeg)
    st._physics.setSpeedKmh(speedKmh)
    st._physics.restoreSnapshot({
      ...st._physics.getStateSnapshot(),
      positionX: x,
      positionY: y,
      headingRad: (headingDeg * Math.PI) / 180,
      speedMs: speedKmh / 3.6,
      wheelSpeedMs: speedKmh / 3.6,
      lateralSpeedMs: 0,
      yawRate: 0,
      slipAngleRad: 0,
      lateralAccelMs2: 0,
    })
  }
  const q = WorldMap.query(x, y, st.isRaining)
  useSimulationStore.setState({
    positionX: x,
    positionY: y,
    headingDeg,
    visualPositionX: x,
    visualPositionY: y,
    visualHeadingDeg: headingDeg,
    speed: speedKmh,
    surfaceType: q.surface.type,
    zoneName: q.zoneName,
    _phys: {
      ...st._phys,
      positionX: x,
      positionY: y,
      headingDeg,
      speedKmh,
      lastPubSpeedKmh: speedKmh,
      lateralSpeedMs: 0,
      slipAngleDeg: 0,
      lateralAccelG: 0,
      surfaceType: q.surface.type,
      zoneName: q.zoneName,
    },
  })
}

function launchGolQuadrado(throttle = 0.75, startPos?: { x: number; y: number; headingDeg: number }) {
  const gol = loadVehicle('gol-quadrado-turbo')
  const sim = useSimulationStore.getState()
  sim.reset()
  sim.init(gol)
  if (startPos) {
    teleportStoreVehicle(startPos.x, startPos.y, startPos.headingDeg, 0)
  }
  sim.startEngine()
  stepSeconds(0.5)
  sim.setClutch(1.0)
  sim.shiftUp() // 1ª marcha
  sim.setThrottle(throttle)
  stepSeconds(0.35) // Sobe giro antes de soltar a embreagem como em um carro manual turbo real
  for (let i = 0; i < 48; i++) {
    useSimulationStore.getState().setClutch(Math.max(0, 0.6 - (i / 48) * 0.6))
    useSimulationStore.getState().update(1 / 120)
  }
  sim.setClutch(0)
  return gol
}

console.log('\n═════════════════════════════════════════════════════════════════════')
console.log(' HEATZ AUTO — TESTE FUNCIONAL FASES 3.1 & 3.2 (GOL QUADRADO 120Hz)')
console.log('═════════════════════════════════════════════════════════════════════\n')

// ─── 1. FASE 3.1: FONTE ÚNICA DA VERDADE GEOGRÁFICA (WORLD_GEOMETRY ↔ WorldMap) ───
console.log('1. Fase 3.1 — Mundo 2D Navegável (Vias, Curvas de Raios Variados, Cruzamentos, Calçadas e Obstáculos)')
{
  const geo = WorldMap.getGeometry()
  assert(geo === WORLD_GEOMETRY, 'WorldMap.getGeometry() expõe a fonte única WORLD_GEOMETRY')

  const uniqueRadii = new Set(geo.arcs.map((a) => a.radius))
  assert(
    uniqueRadii.size >= 4,
    'Mundo possui curvas com pelo menos 4 raios distintos',
    `raios=${Array.from(uniqueRadii).sort((a, b) => a - b).join('m, ')}m`,
  )
  assert(
    geo.intersections.length >= 10,
    'Mundo define cruzamentos e conexões reais entre vias e setores',
    `interseções=${geo.intersections.length}`,
  )
  assert(
    geo.obstacles.length >= 6,
    'Mundo define blocos urbanos / obstáculos não dirigíveis com colisão física',
    `obstáculos=${geo.obstacles.length}`,
  )

  // Verifica que NENHUMA via é apenas decorativa: o ponto médio de cada segmento e arco é asfalto dirigível
  let allRoadsPhysicallyDrivable = true
  let failedRoad = ''
  for (const seg of geo.segments) {
    const mx = (seg.x1 + seg.x2) / 2
    const my = (seg.y1 + seg.y2) / 2
    const q = WorldMap.query(mx, my, false)
    if (q.surface.type !== 'asphalt' || q.collision.isColliding) {
      allRoadsPhysicallyDrivable = false
      failedRoad = `${seg.id} @(${mx},${my}) => ${q.surface.type}, col=${q.collision.isColliding}`
      break
    }
  }
  for (const arc of geo.arcs) {
    const midAngle = (arc.startAngle + arc.endAngle) / 2
    const mx = arc.cx + Math.cos(midAngle) * arc.radius
    const my = arc.cy + Math.sin(midAngle) * arc.radius
    const q = WorldMap.query(mx, my, false)
    if (q.surface.type !== 'asphalt' || q.collision.isColliding) {
      allRoadsPhysicallyDrivable = false
      failedRoad = `${arc.id} @(${mx.toFixed(1)},${my.toFixed(1)}) => ${q.surface.type}, col=${q.collision.isColliding}`
      break
    }
  }
  assert(allRoadsPhysicallyDrivable, '100% dos segmentos e arcos curvos declarados são fisicamente dirigíveis', failedRoad || 'todos válidos')

  // Verifica calçada adjacente ao bloco urbano e colisão dentro do bloco
  const sidewalkQuery = WorldMap.query(26, 170, false) // calçada oeste da Oficina Central Heatz (minX=28, margin=3.5)
  const buildingQuery = WorldMap.query(40, 170, false) // interior da Oficina Central Heatz
  assert(
    sidewalkQuery.surface.type === 'curb' && !sidewalkQuery.collision.isColliding,
    'Calçada ao redor dos blocos urbanos é reconhecida como superfície de guia/calçada sem bloquear tráfego adjacente',
    `zone=${sidewalkQuery.zoneName}, mu=${sidewalkQuery.surface.friction}`,
  )
  assert(
    buildingQuery.collision.isColliding && buildingQuery.collision.boundaryName === 'Oficina Central Heatz',
    'Interior do bloco urbano dispara colisão física real',
    `boundary=${buildingQuery.collision.boundaryName}`,
  )
}

// ─── 2. GOL QUADRADO: PARTIDA, 1ª MARCHA, ACELERAÇÃO E DESLOCAMENTO NO EIXO CORRETO ───
console.log('\n2. Fase 3.2 (Gol Quadrado) — Partida, embreagem, 1ª marcha, aceleração e deslocamento')
{
  launchGolQuadrado(0.8)
  const startY = useSimulationStore.getState().positionY
  stepSeconds(2.2)
  const st = useSimulationStore.getState()

  assert(st.isRunning && !st.isStalled, 'Gol Quadrado liga e arranca sem estolar', `rpm=${Math.round(st.rpm)}`)
  assert(st.currentGear === 1, 'Gol Quadrado engata 1ª marcha manualmente via embreagem', `marcha=${st.currentGear}`)
  assert(st.speed > 35, 'Gol Quadrado acelera de forma consistente em 1ª marcha', `speed=${st.speed.toFixed(1)} km/h`)
  assert(
    st.positionY > startY + 12 && Math.abs(st.positionX) < 0.5,
    'Deslocamento reto avança no eixo Norte (+Y) com X estável',
    `ΔY=+${(st.positionY - startY).toFixed(1)}m, X=${st.positionX.toFixed(2)}m`,
  )
}

// ─── 3. GOL QUADRADO: ESTERÇAMENTO ESQUERDA E DIREITA ───
console.log('\n3. Fase 3.2 (Gol Quadrado) — Esterçamento para esquerda e direita')
{
  launchGolQuadrado(0.55)
  const sim = useSimulationStore.getState()
  stepSeconds(0.8)
  const h0 = useSimulationStore.getState().headingDeg

  // Vira à esquerda
  sim.setSteeringAngle(-0.65, 'keyboard')
  stepSeconds(1.6)
  const afterLeft = useSimulationStore.getState()
  const deltaLeft = signedAngleDeltaDeg(h0, afterLeft.headingDeg)
  assert(
    deltaLeft < -20 && afterLeft.positionX < -2.0,
    'Esterçamento à esquerda gira o rumo no sentido anti-horário e desloca para Oeste (-X)',
    `Δheading=${deltaLeft.toFixed(1)}°, X=${afterLeft.positionX.toFixed(1)}m`,
  )

  // Vira à direita em asfalto seco (iniciando alinhado na Av. Central Norte)
  teleportStoreVehicle(0, 70, 0, 35)
  const hStraight = useSimulationStore.getState().headingDeg
  sim.setSteeringAngle(0.75, 'keyboard')
  stepSeconds(1.8)
  const afterRight = useSimulationStore.getState()
  const deltaRight = signedAngleDeltaDeg(hStraight, afterRight.headingDeg)
  assert(
    deltaRight > 25 && afterRight.positionX > 2.0,
    'Esterçamento à direita gira o rumo no sentido horário e desloca para Leste (+X)',
    `Δheading=+${deltaRight.toFixed(1)}°, X=+${afterRight.positionX.toFixed(1)}m`,
  )
}

// ─── 4. GOL QUADRADO: CURVAS EM BAIXA E ALTA VELOCIDADE (VELOCIDADE LATERAL & ADERÊNCIA) ───
console.log('\n4. Fase 3.2 (Gol Quadrado) — Curvas em baixa vs alta velocidade (deriva lateral e limite de aderência)')
{
  // 4A. Baixa velocidade (~25 km/h)
  launchGolQuadrado(0.35)
  const sim = useSimulationStore.getState()
  teleportStoreVehicle(0, 80, 0, 25)
  sim.setThrottle(0.22)
  sim.setSteeringAngle(0.45, 'keyboard')
  stepSeconds(1.2)
  const lowSpeedState = useSimulationStore.getState()

  // 4B. Alta velocidade (~95 km/h) fazendo curva forte
  launchGolQuadrado(0.5)
  sim.setClutch(1.0)
  sim.shiftUp() // 2ª
  sim.shiftUp() // 3ª
  sim.setClutch(0)
  teleportStoreVehicle(-140, 220, 90, 95) // No topo do circuito de Handling R=80m indo para Leste
  sim.setThrottle(0.75)
  sim.setSteeringAngle(0.65, 'keyboard')

  let peakLateralSpeed = 0
  let peakSlipAngleDeg = 0
  let peakLateralG = 0
  for (let i = 0; i < 180; i++) {
    sim.update(1 / 120)
    const s = useSimulationStore.getState()
    peakLateralSpeed = Math.max(peakLateralSpeed, Math.abs(s.lateralSpeedMs))
    peakSlipAngleDeg = Math.max(peakSlipAngleDeg, Math.abs(s.slipAngleDeg))
    peakLateralG = Math.max(peakLateralG, Math.abs(s.lateralAccelG))
  }

  assert(
    Math.abs(lowSpeedState.lateralAccelG) < 0.75 && Math.abs(lowSpeedState.slipAngleDeg) < 8,
    'Curva em baixa velocidade mantém deriva pequena e controle estável',
    `ay=${Math.abs(lowSpeedState.lateralAccelG).toFixed(2)}G, slip=${Math.abs(lowSpeedState.slipAngleDeg).toFixed(1)}°`,
  )
  assert(
    peakLateralSpeed > 0.4 && peakSlipAngleDeg > 1.5,
    'Curva em alta velocidade gera velocidade lateral real e ângulo de deriva físico',
    `peakVy=${peakLateralSpeed.toFixed(2)} m/s, peakSlip=${peakSlipAngleDeg.toFixed(1)}°`,
  )
  assert(
    peakLateralG > 0.45 && peakLateralG <= 1.25,
    'Aceleração lateral respeita limite físico de aderência dos pneus (sem curva impossível)',
    `peakLateralG=${peakLateralG.toFixed(2)}G`,
  )
}

// ─── 5. GOL QUADRADO: FRENAGEM E PARADA COMPLETA ───
console.log('\n5. Fase 3.2 (Gol Quadrado) — Frenagem e parada completa')
{
  launchGolQuadrado(0.5)
  const sim = useSimulationStore.getState()
  sim.setClutch(1.0)
  sim.shiftUp() // 2ª
  sim.shiftUp() // 3ª
  sim.setClutch(0)
  teleportStoreVehicle(0, 60, 0, 85)
  sim.setThrottle(0)
  sim.setSteeringAngle(0.2, 'keyboard')
  sim.setBrake(1.0)
  stepSeconds(4.0)
  const stopped = useSimulationStore.getState()

  const posStoppedX = stopped.positionX
  const posStoppedY = stopped.positionY
  stepSeconds(0.5)
  const afterHold = useSimulationStore.getState()

  assert(
    stopped.speed === 0 && Math.abs(stopped.lateralSpeedMs) < 0.001,
    'Frenagem forte leva o Gol Quadrado à parada completa (v=0, vy=0)',
    `speed=${stopped.speed.toFixed(2)} km/h, vy=${stopped.lateralSpeedMs.toFixed(3)} m/s`,
  )
  assert(
    Math.hypot(afterHold.positionX - posStoppedX, afterHold.positionY - posStoppedY) < 0.01,
    'Veículo permanece completamente imóvel após a parada (zero drift residual)',
    `Δpos=${Math.hypot(afterHold.positionX - posStoppedX, afterHold.positionY - posStoppedY).toFixed(4)}m`,
  )
}

// ─── 6. GOL QUADRADO: COLISÃO COM LIMITES FÍSICOS E OBSTÁCULOS URBANOS ───
console.log('\n6. Fase 3.2 (Gol Quadrado) — Colisões com limites perimetrais, ilha e bloco urbano')
{
  // 6A. Colisão com Defensa Norte
  launchGolQuadrado(0.5)
  const sim = useSimulationStore.getState()
  teleportStoreVehicle(0, 275, 0, 75)
  sim.setThrottle(0.5)
  sim.setSteeringAngle(0, 'keyboard')
  let hitNorthWall = false
  let wallName = ''
  for (let i = 0; i < 180; i++) {
    sim.update(1 / 120)
    const s = useSimulationStore.getState()
    if (s.isColliding) {
      hitNorthWall = true
      wallName = s.collisionBoundaryName || ''
    }
  }
  const afterNorth = useSimulationStore.getState()
  assert(
    hitNorthWall && afterNorth.positionY <= WorldMap.BOUNDARY_LIMIT + 0.1 && afterNorth.speed < 75,
    'Colisão com Defensa Norte contém o veículo e amortece velocidade sem teleporte ou NaN',
    `boundary=${wallName}, y=${afterNorth.positionY.toFixed(1)}m, speed=${afterNorth.speed.toFixed(1)} km/h`,
  )

  // 6B. Colisão com obstáculo urbano (Oficina Central Heatz: x:[28,54], y:[142,196])
  teleportStoreVehicle(20, 170, 90, 60) // Indo para Leste direto na parede oeste (x=28)
  sim.setThrottle(0.3)
  sim.setSteeringAngle(0, 'keyboard')
  let hitBuilding = false
  let buildingBoundary = ''
  for (let i = 0; i < 120; i++) {
    sim.update(1 / 120)
    const s = useSimulationStore.getState()
    if (s.isColliding) {
      hitBuilding = true
      buildingBoundary = s.collisionBoundaryName || ''
    }
  }
  const afterBuilding = useSimulationStore.getState()
  assert(
    hitBuilding && buildingBoundary === 'Oficina Central Heatz' && afterBuilding.positionX < 28.1,
    'Colisão com bloco urbano não dirigível impede penetração e identifica obstáculo',
    `boundary=${buildingBoundary}, x=${afterBuilding.positionX.toFixed(2)}m`,
  )

  // 6C. Colisão com Ilha da Rotatória (r=16m)
  teleportStoreVehicle(0, 21, 180, 45) // Apontado para Sul direto na ilha central
  sim.setThrottle(0.2)
  let hitIsland = false
  for (let i = 0; i < 120; i++) {
    sim.update(1 / 120)
    if (useSimulationStore.getState().isColliding) hitIsland = true
  }
  const afterIsland = useSimulationStore.getState()
  const distCenter = Math.hypot(afterIsland.positionX, afterIsland.positionY)
  assert(
    hitIsland && distCenter >= 16.0,
    'Colisão com Ilha da Rotatória mantém veículo fora do canteiro central (r >= 16m)',
    `dist=${distCenter.toFixed(2)}m`,
  )
}

// ─── 7. GOL QUADRADO: TRANSIÇÕES DE SUPERFÍCIE SEM RESTRIÇÃO ARTIFICIAL ───
console.log('\n7. Fase 3.2 (Gol Quadrado) — Transições de superfície e atrito real (sem bloqueio artificial)')
{
  const measureAccelOnSurface = (x: number, y: number, headingDeg: number) => {
    launchGolQuadrado(0.85, { x, y, headingDeg })
    const sim = useSimulationStore.getState()
    sim.setThrottle(0.85)
    sim.setSteeringAngle(0, 'keyboard')
    stepSeconds(2.0)
    const st = useSimulationStore.getState()
    return { speed: st.speed, surface: st.surfaceType, zone: st.zoneName }
  }

  const asphaltRun = measureAccelOnSurface(0, 60, 0)
  const skidpadRun = measureAccelOnSurface(-140, -140, 0)
  const gravelRun = measureAccelOnSurface(140, -140, 0)
  const grassRun = measureAccelOnSurface(260, 260, 180)
  // Continua acelerando na grama por mais 1.5s para comprovar ausência de teto artificial de velocidade
  stepSeconds(1.5)
  const grassExtendedSpeed = useSimulationStore.getState().speed

  assert(
    asphaltRun.surface === 'asphalt' && skidpadRun.surface === 'wet_asphalt' && gravelRun.surface === 'gravel' && grassRun.surface === 'grass',
    'Simulação reconhece corretamente asfalto, skidpad molhado, cascalho e grama',
    `${asphaltRun.surface} / ${skidpadRun.surface} / ${gravelRun.surface} / ${grassRun.surface}`,
  )
  assert(
    asphaltRun.speed > gravelRun.speed &&
      gravelRun.speed > grassRun.speed &&
      grassRun.speed > 8 &&
      grassExtendedSpeed > grassRun.speed + 3,
    'Superfícies de menor atrito reduzem tração naturalmente (Coulomb + Crr) sem trava artificial de velocidade',
    `asfalto=${asphaltRun.speed.toFixed(1)}, cascalho=${gravelRun.speed.toFixed(1)}, grama 2s=${grassRun.speed.toFixed(1)} → 3.5s=${grassExtendedSpeed.toFixed(1)} km/h`,
  )
}

// ─── 8 & 9. SINCRONIZAÇÃO COM MAPA + CONTINUIDADE AO ABRIR/FECHAR WorldMapModal ───
console.log('\n8 & 9. Sincronização Estado ↔ Mapa e continuidade ao abrir/fechar WorldMapModal')
{
  launchGolQuadrado(0.6)
  const sim = useSimulationStore.getState()
  const ui = useUIStore.getState()
  sim.setThrottle(0.6)
  sim.setSteeringAngle(0.18, 'keyboard')
  stepSeconds(1.5)

  const beforeModal = useSimulationStore.getState()
  const worldQuery = WorldMap.query(beforeModal.positionX, beforeModal.positionY, beforeModal.isRaining)
  assert(
    beforeModal.zoneName === worldQuery.zoneName &&
      beforeModal.surfaceType === worldQuery.surface.type &&
      Math.hypot(beforeModal.visualPositionX - beforeModal.positionX, beforeModal.visualPositionY - beforeModal.positionY) < 0.6,
    'Estado da simulação, WorldMap e coordenadas visuais do mapa permanecem 100% sincronizados',
    `zone="${beforeModal.zoneName}", Δvis=${Math.hypot(beforeModal.visualPositionX - beforeModal.positionX, beforeModal.visualPositionY - beforeModal.positionY).toFixed(3)}m`,
  )

  // Abre o Mapa do Mundo com o carro em movimento
  ui.openWorldMap()
  assert(useUIStore.getState().isWorldMapOpen === true, 'WorldMapModal abre em tempo real')
  stepSeconds(1.0)
  const duringModal = useSimulationStore.getState()
  const distWhileOpen = Math.hypot(duringModal.positionX - beforeModal.positionX, duringModal.positionY - beforeModal.positionY)

  // Fecha o Mapa do Mundo
  ui.closeWorldMap()
  assert(useUIStore.getState().isWorldMapOpen === false, 'WorldMapModal fecha sem alterar a simulação')
  stepSeconds(1.0)
  const afterModal = useSimulationStore.getState()
  const distAfterClose = Math.hypot(afterModal.positionX - duringModal.positionX, afterModal.positionY - duringModal.positionY)

  assert(
    distWhileOpen > 5 && distAfterClose > 5 && duringModal.speed > 20 && afterModal.speed > 20,
    'Simulação mantém movimento contínuo sem reinício ao abrir e fechar o WorldMapModal',
    `Δaberta=${distWhileOpen.toFixed(1)}m, Δfechada=${distAfterClose.toFixed(1)}m`,
  )
}

// ─── 10. ESTABILIDADE NUMÉRICA EXTREMA + COERÊNCIA MULTI-TRAÇÃO (FWD / RWD / AWD) ───
console.log('\n10. Estabilidade numérica extrema (120Hz) e preparo multi-tração (FWD / RWD / AWD)')
{
  launchGolQuadrado(0.9)
  const sim = useSimulationStore.getState()
  let allFinite = true
  let maxStepJump = 0
  let prevX = useSimulationStore.getState().positionX
  let prevY = useSimulationStore.getState().positionY

  for (let i = 0; i < 600; i++) {
    const steer = Math.sin(i * 0.14) // alternância violenta de esterço
    sim.setSteeringAngle(steer, 'keyboard')
    sim.setBrake(i % 90 > 65 ? 0.95 : 0)
    sim.setHandbrake(i % 150 > 130)
    sim.setThrottle(i % 90 <= 65 ? 0.9 : 0)
    sim.update(1 / 120)

    const s = useSimulationStore.getState()
    const jump = Math.hypot(s.positionX - prevX, s.positionY - prevY)
    maxStepJump = Math.max(maxStepJump, jump)
    prevX = s.positionX
    prevY = s.positionY

    if (
      !Number.isFinite(s.positionX) ||
      !Number.isFinite(s.positionY) ||
      !Number.isFinite(s.headingDeg) ||
      !Number.isFinite(s.speed) ||
      !Number.isFinite(s.lateralSpeedMs) ||
      !Number.isFinite(s.slipAngleDeg) ||
      !Number.isFinite(s.lateralAccelG)
    ) {
      allFinite = false
      break
    }
  }
  sim.setHandbrake(false)

  assert(
    allFinite && maxStepJump < 1.5,
    'Stress test extremo (600 ticks a 120Hz) produz zero NaN/Infinity e deslocamento limitado por tick',
    `maxJump=${maxStepJump.toFixed(3)}m/tick`,
  )

  // Validação comparativa de física planar nas 3 arquiteturas de tração (sem alterar configs)
  const runCornerTest = (vehicleId: string) => {
    const cfg = loadVehicle(vehicleId)
    const phys = new VehiclePhysics({
      weight: cfg.info.weight,
      wheelDiameter: cfg.info.wheelDiameter,
      vehicleId: cfg.id,
      chassis: cfg.chassis,
      initialPositionX: -140,
      initialPositionY: 220,
      initialHeadingDeg: 90,
    })
    phys.setSpeedKmh(75)
    let maxSlip = 0
    let maxLatG = 0
    for (let i = 0; i < 180; i++) {
      const r = phys.tick({
        driveTorqueAtTransmission: cfg.engine.maxTorque * 0.85,
        gearRatio: cfg.transmission.gearRatios[1].ratio,
        finalDrive: cfg.transmission.finalDrive,
        frontFinalDrive: cfg.transmission.frontFinalDrive,
        brake: 0,
        deltaTime: 1 / 120,
        steeringAngleRad: 0.32,
        gear: 2,
        isRaining: false,
      })
      maxSlip = Math.max(maxSlip, Math.abs(r.slipAngleDeg))
      maxLatG = Math.max(maxLatG, Math.abs(r.lateralAccelG))
    }
    return { pos: phys.getPosition(), heading: phys.getHeadingDeg(), maxSlip, maxLatG }
  }

  const fwdGol = runCornerTest('gol-quadrado-turbo')
  const rwdOpala = runCornerTest('opala-4100')
  const awdPorsche = runCornerTest('porsche-gt3')

  assert(
    fwdGol.maxLatG > 0.4 && rwdOpala.maxLatG > 0.4 && awdPorsche.maxLatG > 0.4 && rwdOpala.maxSlip > 0.5,
    'Arquitetura planar 2D opera com coerência em FWD (Gol Quadrado), RWD (Opala 4.1) e AWD (Porsche 911 Turbo S)',
    `Gol=${fwdGol.maxLatG.toFixed(2)}G/${fwdGol.maxSlip.toFixed(1)}°, Opala=${rwdOpala.maxLatG.toFixed(2)}G/${rwdOpala.maxSlip.toFixed(1)}°, Porsche=${awdPorsche.maxLatG.toFixed(2)}G/${awdPorsche.maxSlip.toFixed(1)}°`,
  )
}

console.log('\n═════════════════════════════════════════════════════════════════════')
console.log(` RESULTADO FASES 3.1 & 3.2: ${passed} PASSOU · ${failed} FALHOU`)
console.log('═════════════════════════════════════════════════════════════════════\n')

if (failed > 0) {
  process.exit(1)
}
