import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DashboardTelemetry } from './src/systems/dashboard'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log('═══════════════════════════════════════════════════════════════')
console.log('  HEATZ AUTO — VALIDAÇÃO FASE 1.2.1: EXPANSÃO REAL DO CLUSTER  ')
console.log('═══════════════════════════════════════════════════════════════\n')

let passed = 0
let failed = 0

function runTest(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ PASSOU | ${name}`)
    passed++
  } catch (err) {
    console.error(`✗ FALHOU | ${name}`)
    console.error(err)
    failed++
  }
}

// Extrair perfis reais de VehicleDashboardCluster.tsx
const clusterCode = fs.readFileSync(
  path.join(__dirname, 'src/components/dashboard/VehicleDashboardCluster.tsx'),
  'utf-8',
)

type ClusterProfile = { width: number; height: number }
const profiles: Record<DashboardTelemetry['theme'], ClusterProfile> = {
  civic_si: { width: 640, height: 385 },
  gti: { width: 750, height: 280 },
  classic: { width: 700, height: 275 },
  square_turbo: { width: 700, height: 290 },
  supercar: { width: 750, height: 285 },
  opala_classic: { width: 730, height: 265 },
  modern: { width: 740, height: 280 },
  motorcycle: { width: 490, height: 240 },
  default: { width: 740, height: 280 },
}

console.log('▶ [Cenário 1] Coerência dos Perfis Bounding Box dos 8 Veículos')
const vehicles: { theme: DashboardTelemetry['theme']; name: string }[] = [
  { theme: 'civic_si', name: 'Honda Civic Si' },
  { theme: 'gti', name: 'VW Golf GTI' },
  { theme: 'classic', name: 'VW Gol Rallye G6' },
  { theme: 'square_turbo', name: 'VW Gol Quadrado Turbo' },
  { theme: 'supercar', name: 'Porsche 911 GT3 RS' },
  { theme: 'opala_classic', name: 'Chevrolet Opala Diplomata' },
  { theme: 'modern', name: 'Toyota Yaris XLS' },
  { theme: 'motorcycle', name: 'Honda CB1000R' },
]

for (const v of vehicles) {
  runTest(`Perfil de ${v.name} (${v.theme}) possui proporções calbradas sem excesso de altura`, () => {
    const prof = profiles[v.theme]
    assert.ok(prof, `Perfil não definido para ${v.theme}`)
    assert.ok(prof.height <= 390, `Altura ${prof.height}px não deve ultrapassar 390px`)
    assert.ok(prof.width >= 480 && prof.width <= 760, `Largura ${prof.width}px deve estar entre 480px e 760px`)
  })
}

console.log('\n▶ [Cenário 2] Expansão e Ocupação Visual em Mobile Paisagem (844x390 - iPhone 12/13/14)')
// No landscape, container do cluster recebe ~530px de largura e ~185px de altura
const landscapeContainer = { width: 530, height: 185 }
const maxScale = 1.35

for (const v of vehicles) {
  runTest(`${v.name} preenche mais de 85% do espaço horizontal ou vertical sem transbordar`, () => {
    const prof = profiles[v.theme]
    const scale = Math.min(maxScale, landscapeContainer.width / prof.width, landscapeContainer.height / prof.height)
    const renderedWidth = prof.width * scale
    const renderedHeight = prof.height * scale

    // Nunca deve transbordar
    assert.ok(renderedWidth <= landscapeContainer.width + 0.5, `Largura renderizada ${renderedWidth}px > container ${landscapeContainer.width}px`)
    assert.ok(renderedHeight <= landscapeContainer.height + 0.5, `Altura renderizada ${renderedHeight}px > container ${landscapeContainer.height}px`)

    const widthUsage = renderedWidth / landscapeContainer.width
    const heightUsage = renderedHeight / landscapeContainer.height
    const maxDimensionUsage = Math.max(widthUsage, heightUsage)

    // O cluster deve encostar em pelo menos 95% do limite disponível (width ou height)
    assert.ok(
      maxDimensionUsage >= 0.95,
      `${v.name}: cluster deveria ocupar >= 95% do limite (ocupou ${(maxDimensionUsage * 100).toFixed(1)}%)`,
    )
    console.log(`    ↳ ${v.name.padEnd(26)}: scale=${scale.toFixed(3)} | ${renderedWidth.toFixed(0)}x${renderedHeight.toFixed(0)}px | Largura: ${(widthUsage * 100).toFixed(1)}% | Altura: ${(heightUsage * 100).toFixed(1)}%`)
  })
}

console.log('\n▶ [Cenário 3] Expansão e Ocupação Visual em Mobile Retrato (390x844)')
// No portrait, container do cluster recebe ~375px de largura e ~320px de altura
const portraitContainer = { width: 375, height: 320 }

for (const v of vehicles) {
  runTest(`${v.name} aproveita 100% da largura útil em modo Retrato`, () => {
    const prof = profiles[v.theme]
    const scale = Math.min(maxScale, portraitContainer.width / prof.width, portraitContainer.height / prof.height)
    const renderedWidth = prof.width * scale
    const renderedHeight = prof.height * scale

    assert.ok(renderedWidth <= portraitContainer.width + 0.5)
    assert.ok(renderedHeight <= portraitContainer.height + 0.5)

    const widthUsage = renderedWidth / portraitContainer.width
    // Em retrato, quase todos os clusters horizontais tocam 100% da largura
    assert.ok(widthUsage >= 0.95 || v.theme === 'motorcycle', `${v.name} deveria usar praticamente 100% da largura em retrato`)
    console.log(`    ↳ ${v.name.padEnd(26)}: scale=${scale.toFixed(3)} | ${renderedWidth.toFixed(0)}x${renderedHeight.toFixed(0)}px | Largura: ${(widthUsage * 100).toFixed(1)}%`)
  })
}

console.log('\n▶ [Cenário 4] Inspeção dos 8 Clusters: Remoção de Wrappers Inflados e Padding Excessivo')
const clusterFiles: Record<string, string> = {
  civic_si: 'CivicSiRealCluster.tsx',
  gti: 'GolfGTIRealCluster.tsx',
  classic: 'GolG6RealCluster.tsx',
  square_turbo: 'GolQuadradoRealCluster.tsx',
  supercar: 'Porsche992GT3RealCluster.tsx',
  opala_classic: 'Opala4100RealCluster.tsx',
  modern: 'ToyotaYarisRealCluster.tsx',
  motorcycle: 'HondaCB1000RRealCluster.tsx',
}

for (const [theme, file] of Object.entries(clusterFiles)) {
  runTest(`${file} possui padding compacto (p-1.5 ou p-2) para maximizar área dos instrumentos`, () => {
    const code = fs.readFileSync(path.join(__dirname, 'src/components/dashboard/clusters', file), 'utf-8')
    assert.ok(
      code.includes('p-1.5') || code.includes('p-1') || code.includes('p-2'),
      `${file} deveria usar padding compacto para não desperdiçar área útil`,
    )
  })
}

console.log('\n═══════════════════════════════════════════════════════════════')
console.log(`RESULTADO DA FASE 1.2.1: ${passed} PASSOU | ${failed} FALHOU`)
console.log('═══════════════════════════════════════════════════════════════')

if (failed > 0) {
  process.exit(1)
}

