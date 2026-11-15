import fs from 'node:fs'
import path from 'node:path'

console.log('═══════════════════════════════════════════════════════════════════')
console.log('  TESTES DE VALIDAÇÃO: MULTIMÍDIA MOBILE ANTI-CORTE & RESPONSIVA  ')
console.log('═══════════════════════════════════════════════════════════════════\n')

let passed = 0
let failed = 0

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`✓ PASSOU | ${msg}`)
    passed++
  } else {
    console.error(`✗ FALHOU | ${msg}`)
    failed++
  }
}

const baseInfotainmentDir = path.resolve('src/components/dashboard/infotainment')
const slotFile = path.resolve('src/components/dashboard/SwipeableClusterMediaSlot.tsx')

// 1. Verificar SwipeableClusterMediaSlot container para data-pane="multimedia"
const slotSrc = fs.readFileSync(slotFile, 'utf8')
assert(
  slotSrc.includes('data-pane="multimedia"') &&
  slotSrc.includes('absolute inset-0 w-full h-full flex items-center justify-center'),
  'SwipeableClusterMediaSlot envolve data-pane="multimedia" em container delimitado absolute inset-0'
)

// 2. Verificar que nenhum arquivo contém min-h-[175px]
const multimediaFiles = [
  'CivicSiInfotainment.tsx',
  'GolfGTIDiscoverPro.tsx',
  'PorschePCM6.tsx',
  'ToyotaSmartConnect.tsx',
  'FiatToroUconnect7.tsx',
  'FiatToroUconnectVertical.tsx',
  'Retrofit2DinInfotainment.tsx',
  'ClassicRadioAudioUnit.tsx',
  'ClassicDashboardBlankUnit.tsx',
  'VehicleMultimedia.tsx'
]

for (const file of multimediaFiles) {
  const filePath = path.join(baseInfotainmentDir, file)
  const content = fs.readFileSync(filePath, 'utf8')

  assert(
    !content.includes('min-h-[175px]'),
    `${file}: Não possui mais min-h-[175px] rígido que estourava telas mobile`
  )

  assert(
    content.includes('pr-28'),
    `${file}: Reserva pr-28 no cabeçalho superior para não ser sobreposto pelo botão MÍDIA/PAINEL`
  )

  assert(
    content.includes('shrink-0'),
    `${file}: Cabeçalhos e rodapés usam shrink-0 para nunca serem espremidos ou cortados`
  )

  assert(
    content.includes('overflow-y-auto') || content.includes('min-h-0'),
    `${file}: Conteúdo interno flexível com suporte a rolagem/min-h-0 anti-estouro`
  )
}

// 3. Verificar shared panels (ClimateControlPanel e InternetMediaCenter)
const climateFile = path.join(baseInfotainmentDir, 'shared/ClimateControlPanel.tsx')
const climateSrc = fs.readFileSync(climateFile, 'utf8')
assert(
  climateSrc.includes('compact ?') && climateSrc.includes('w-5 h-5 sm:w-6 sm:h-6'),
  'ClimateControlPanel suporta botões compactos responsivos em modo fill/compact'
)

const mediaFile = path.join(baseInfotainmentDir, 'shared/InternetMediaCenter.tsx')
const mediaSrc = fs.readFileSync(mediaFile, 'utf8')
assert(
  mediaSrc.includes('compact ?') && mediaSrc.includes('h-[75px] sm:h-[100px]'),
  'InternetMediaCenter suporta player compacto adaptado para altura reduzida mobile'
)

console.log('\n═══════════════════════════════════════════════════════════════════')
console.log(` RESULTADO FINAL: ${passed} PASSOU | ${failed} FALHOU`)
console.log('═══════════════════════════════════════════════════════════════════\n')

if (failed > 0) {
  process.exit(1)
}
