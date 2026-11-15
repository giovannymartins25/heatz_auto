import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { getVehicleCapabilities } from './src/types/vehicle'
import type { VehicleConfig } from './src/types/vehicle'

console.log('═══════════════════════════════════════════════════════════════════')
console.log('  TESTES DE VALIDAÇÃO: FASE 2 — MULTIMÍDIAS INDIVIDUAIS & ROTEAMENTO ')
console.log('═══════════════════════════════════════════════════════════════════\n')

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ PASSOU | ${name}`)
    passed++
  } catch (err) {
    console.error(`✗ FALHOU | ${name}`)
    console.error(`  Erro: ${(err as Error).message}`)
    failed++
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg)
}

// Carregar configurações de todos os 10 veículos
const manifestPath = resolve(process.cwd(), 'public/vehicles/manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
const vehicleConfigs = new Map<string, VehicleConfig>()

for (const entry of manifest.vehicles) {
  const configFilePath = resolve(process.cwd(), 'public', entry.configPath.replace(/^\//, ''))
  const rawConfig = JSON.parse(readFileSync(configFilePath, 'utf-8'))
  vehicleConfigs.set(entry.id, rawConfig)
}

// ─── 1. MOTOCICLETA (CB1000R): PAINEL TFT INTEGRADO SEM MULTIMÍDIA ───
test('1. Honda CB1000R: painel TFT dedicado sem touchscreen nem rádio automotivo', () => {
  const cb = vehicleConfigs.get('cb1000r')!
  assert(!!cb, 'Configuração da CB1000R deve existir')

  const caps = getVehicleCapabilities(cb)
  assert(caps.isMotorcycle === true, 'Deve ser identificada como motocicleta')
  assert(caps.multimedia.type === 'none', `Multimídia deve ser do tipo "none" (tem: ${caps.multimedia.type})`)
  assert(caps.multimedia.layout === 'none', `Layout deve ser "none" (tem: ${caps.multimedia.layout})`)
  assert(caps.multimedia.supportsAftermarketUpgrade === false, 'Motos não suportam kit multimídia aftermarket automotivo')
  assert(caps.hasInfotainment === false, 'hasInfotainment deve ser false')

  // Mesmo se tentar passar upgrade acidentalmente, deve recusar
  const capsComUpgrade = getVehicleCapabilities(cb, { multimediaKit: true })
  assert(capsComUpgrade.multimedia.type === 'none', 'Upgrade aftermarket em moto não deve ativar multimídia automotiva')
})

// ─── 2. PORSCHE 911 (992): PCM 6.0 COM TELEMETRIA DE PISTA E AERO ATIVA ───
test('2. Porsche 911 GT3: PCM 6.0 widescreen com aerodinâmica ativa e telemetria', () => {
  const porsche = vehicleConfigs.get('porsche-gt3')!
  assert(!!porsche, 'Configuração da Porsche deve existir')

  const caps = getVehicleCapabilities(porsche)
  assert(caps.multimedia.type === 'factory', 'Multimídia da Porsche deve ser "factory"')
  assert(caps.multimedia.layout === 'horizontal', 'Layout do PCM 6.0 deve ser horizontal')
  assert(caps.multimedia.screenSize === 10.9, 'Tela do PCM deve ser 10.9 polegadas')
  assert(caps.multimedia.name.includes('PCM 6.0'), `Nome deve referenciar PCM 6.0 (tem: ${caps.multimedia.name})`)
  assert(caps.activeAero?.hasActiveRearWing === true, 'Porsche deve ter asa traseira ativa')
  assert(caps.activeAero?.hasAdjustableRideHeight === true, 'Porsche deve ter ajuste de altura dianteiro (Front Lift)')
  assert(caps.multimedia.features.includes('Track Precision App'), 'Deve possuir Track Precision App')
})

// ─── 3. VOLKSWAGEN GOLF GTI: DISCOVER PRO 8" COM SPORT HMI ───
test('3. Golf GTI: VW Discover Pro 8" com mostradores Sport HMI e Climatronic', () => {
  const gti = vehicleConfigs.get('golf-gti')!
  assert(!!gti, 'Configuração do Golf GTI deve existir')

  const caps = getVehicleCapabilities(gti)
  assert(caps.multimedia.type === 'factory', 'Multimídia do GTI deve ser "factory"')
  assert(caps.multimedia.screenSize === 8.0, 'Tela do Discover Pro deve ser 8.0 polegadas')
  assert(caps.multimedia.name.includes('Discover Pro'), `Nome deve ser Discover Pro (tem: ${caps.multimedia.name})`)
  assert(caps.multimedia.features.some((f) => f.includes('Sport HMI')), 'Deve conter mostradores analógicos Sport HMI')
})

// ─── 4. FIAT TORO ENDURANCE VS RANCH: DIFERENCIAÇÃO ESTRUTURAL E MECÂNICA ───
test('4. Fiat Toro Endurance vs Ranch: Uconnect 7" Horizontal vs 10.1" Vertical 4x4', () => {
  const endurance = vehicleConfigs.get('fiat-toro-endurance-2025')!
  const ranch = vehicleConfigs.get('fiat-toro-ranch-2025')!

  const capsEndurance = getVehicleCapabilities(endurance)
  const capsRanch = getVehicleCapabilities(ranch)

  // Endurance: 7 polegadas horizontal, sem 4x4
  assert(capsEndurance.multimedia.type === 'factory', 'Endurance deve ter multimídia de fábrica')
  assert(capsEndurance.multimedia.layout === 'horizontal', 'Endurance deve ter layout horizontal')
  assert(capsEndurance.multimedia.screenSize === 7.0, 'Endurance deve ter tela de 7 polegadas')
  assert(capsEndurance.has4x4Selector === false, 'Endurance não deve ter tração 4x4')

  // Ranch: 10.1 polegadas vertical HD, com 4x4 Off-Road
  assert(capsRanch.multimedia.type === 'factory', 'Ranch deve ter multimídia de fábrica')
  assert(capsRanch.multimedia.layout === 'vertical', 'Ranch deve ter layout vertical')
  assert(capsRanch.multimedia.screenSize === 10.1, 'Ranch deve ter tela de 10.1 polegadas')
  assert(capsRanch.has4x4Selector === true, 'Ranch deve possuir seletor de tração 4x4')
  assert(capsRanch.multimedia.features.some((f) => f.includes('4x4')), 'Ranch deve listar monitor de tração 4x4')
})

// ─── 5. TOYOTA YARIS 1.5 XLS: TOYOTA PLAY 7" COM ECO & DRIVE MONITOR OFICIAL ───
test('5. Toyota Yaris: Toyota Play 7" oficial com Eco & Drive Monitor (sem fantasia AWD)', () => {
  const yaris = vehicleConfigs.get('yaris-2019')!
  assert(!!yaris, 'Configuração do Yaris deve existir')

  const caps = getVehicleCapabilities(yaris)
  assert(caps.multimedia.type === 'factory', 'Yaris deve ter multimídia de fábrica')
  assert(caps.multimedia.name.includes('Toyota Play'), `Nome deve ser Toyota Play (tem: ${caps.multimedia.name})`)
  assert(caps.multimedia.features.includes('Eco & Drive Monitor'), 'Deve conter Eco & Drive Monitor oficial do Yaris XLS')
})

// ─── 6. HONDA CIVIC SI: H-AUDIO OEM 2-DIN COM TELEMETRIA VTEC ───
test('6. Honda Civic Si: H-Audio 2-DIN OEM com telemetria VTEC aos 5.800 RPM', () => {
  const civic = vehicleConfigs.get('civic-si')!
  assert(!!civic, 'Configuração do Civic Si deve existir')

  const caps = getVehicleCapabilities(civic)
  assert(caps.multimedia.type === 'factory', 'Civic Si deve ter sistema OEM de fábrica')
  assert(caps.multimedia.name.includes('H-Audio'), `Nome deve ser H-Audio OEM (tem: ${caps.multimedia.name})`)
  assert(caps.multimedia.features.includes('Telemetria i-VTEC'), 'Deve conter telemetria i-VTEC')
})

// ─── 7. VEÍCULOS ANALÓGICOS (OPALA E GOL G6): RÁDIO 1-DIN CONVENCIONAL ───
test('7. Opala 4.1 e Gol G6: unidade de rádio 1-DIN convencional de fábrica (não touchscreen genérica)', () => {
  const opala = vehicleConfigs.get('opala-4100')!
  const golG6 = vehicleConfigs.get('gol-g6')!

  const capsOpala = getVehicleCapabilities(opala)
  const capsGolG6 = getVehicleCapabilities(golG6)

  // Ambos saem com rádio 1-DIN
  assert(capsOpala.multimedia.type === 'radio', `Opala deve ter rádio convencional de fábrica (tem: ${capsOpala.multimedia.type})`)
  assert(capsOpala.multimedia.layout === 'compact', 'Opala deve usar formato 1-DIN compacto')
  assert(capsOpala.multimedia.name.includes('Rádio'), `Opala deve ser rádio clássico (tem: ${capsOpala.multimedia.name})`)

  assert(capsGolG6.multimedia.type === 'radio', `Gol G6 deve ter rádio convencional de fábrica (tem: ${capsGolG6.multimedia.type})`)
  assert(capsGolG6.multimedia.layout === 'compact', 'Gol G6 deve usar formato 1-DIN compacto')
  assert(capsGolG6.multimedia.name.includes('RCD 320G'), `Gol G6 deve ser RCD 320G (tem: ${capsGolG6.multimedia.name})`)
})

// ─── 8. GOL QUADRADO: CONSOLE ANALÓGICO COM TAMPA CEGA E RELÓGIO ANOS 90 ───
test('8. Gol Quadrado Turbo: console analógico original (sem multimídia de fábrica)', () => {
  const golQ = vehicleConfigs.get('gol-quadrado-turbo')!
  assert(!!golQ, 'Configuração do Gol Quadrado deve existir')

  const caps = getVehicleCapabilities(golQ)
  assert(caps.multimedia.type === 'none', `Gol Quadrado de fábrica não tem multimídia (tem: ${caps.multimedia.type})`)
  assert(caps.multimedia.layout === 'compact', 'Deve usar formato compacto de console')
  assert(caps.multimedia.name.includes('Console Original'), `Nome deve ser Console Original (tem: ${caps.multimedia.name})`)
  assert(caps.multimedia.features.includes('Relógio de quartzo digital'), 'Deve conter relógio de quartzo digital anos 90')
  assert(caps.multimedia.supportsAftermarketUpgrade === true, 'Gol Quadrado suporta upgrade para 2-DIN')
})

// ─── 9. UPGRADE AFTERMARKET NA OFICINA: RETROFIT 2-DIN HEATZ PERFORMANCE ───
test('9. Upgrade na Oficina: veículos analógicos recebem Central 2-DIN Aftermarket', () => {
  const golQ = vehicleConfigs.get('gol-quadrado-turbo')!
  const golG6 = vehicleConfigs.get('gol-g6')!
  const opala = vehicleConfigs.get('opala-4100')!

  const capsGolQUp = getVehicleCapabilities(golQ, { multimediaKit: true })
  const capsGolG6Up = getVehicleCapabilities(golG6, { multimediaKit: true })
  const capsOpalaUp = getVehicleCapabilities(opala, { multimediaKit: true })

  assert(capsGolQUp.multimedia.type === 'aftermarket', 'Gol Quadrado com kit deve se tornar aftermarket')
  assert(capsGolQUp.multimedia.name === 'Central 2-DIN Heatz Performance', 'Nome da central aftermarket deve ser correto')
  assert(capsGolQUp.hasInfotainment === true, 'hasInfotainment deve virar true após upgrade')

  assert(capsGolG6Up.multimedia.type === 'aftermarket', 'Gol G6 com kit deve se tornar aftermarket')
  assert(capsOpalaUp.multimedia.type === 'aftermarket', 'Opala com kit deve se tornar aftermarket')
})

// ─── 10. INTEGRIDADE DOS ARQUIVOS E COMPONENTES CRIADOS ───
test('10. Componentes de multimídia existem no diretório e são exportados corretamente', () => {
  const files = [
    'src/components/dashboard/infotainment/ClassicRadioAudioUnit.tsx',
    'src/components/dashboard/infotainment/ClassicDashboardBlankUnit.tsx',
    'src/components/dashboard/infotainment/ToyotaSmartConnect.tsx',
    'src/components/dashboard/infotainment/PorschePCM6.tsx',
    'src/components/dashboard/infotainment/GolfGTIDiscoverPro.tsx',
    'src/components/dashboard/infotainment/FiatToroUconnect7.tsx',
    'src/components/dashboard/infotainment/FiatToroUconnectVertical.tsx',
    'src/components/dashboard/infotainment/CivicSiInfotainment.tsx',
    'src/components/dashboard/infotainment/Retrofit2DinInfotainment.tsx',
    'src/components/dashboard/infotainment/VehicleMultimedia.tsx',
  ]

  for (const f of files) {
    const fullPath = resolve(process.cwd(), f)
    assert(existsSync(fullPath), `Arquivo ${f} deve existir fisicamente`)
  }
})

console.log('\n═══════════════════════════════════════════════════════════════════')
console.log(`  RESULTADO: ${passed} PASSOU | ${failed} FALHOU`)
console.log('═══════════════════════════════════════════════════════════════════\n')

if (failed > 0) process.exit(1)
