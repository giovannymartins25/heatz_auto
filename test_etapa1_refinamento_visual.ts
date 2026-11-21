import assert from 'assert'
import fs from 'fs'
import path from 'path'

console.log('═══════════════════════════════════════════════════════════════════')
console.log('  TESTES DE VALIDAÇÃO: ETAPA 1 — REFINAMENTO VISUAL E FUNCIONAL   ')
console.log('═══════════════════════════════════════════════════════════════════\n')

let passed = 0
let failed = 0

function test(description: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ PASSOU | ${description}`)
    passed++
  } catch (err: any) {
    console.error(`✗ FALHOU | ${description}`)
    console.error(`  Erro: ${err.message}`)
    failed++
  }
}

const rootDir = process.cwd()

// 1. INDICADORES CIRCULARES E CIRCULAR PROGRESS DIAL
test('CircularProgressDial.tsx existe e está exportado em @/components/gauges', () => {
  const file = path.join(rootDir, 'src/components/gauges/CircularProgressDial.tsx')
  assert(fs.existsSync(file), 'Arquivo CircularProgressDial.tsx não existe')
  const indexFile = fs.readFileSync(path.join(rootDir, 'src/components/gauges/index.ts'), 'utf-8')
  assert(indexFile.includes('CircularProgressDial'), 'CircularProgressDial não está exportado em index.ts')
})

test('CircularProgressDial possui geometria rigorosa com viewBox 0 0 100 100, clipPath e arco 270°', () => {
  const content = fs.readFileSync(path.join(rootDir, 'src/components/gauges/CircularProgressDial.tsx'), 'utf-8')
  assert(content.includes('viewBox="0 0 100 100"'), 'Falta viewBox 0 0 100 100')
  assert(content.includes('clipPath'), 'Falta clipPath anti-vazamento')
  assert(content.includes('overflow-hidden'), 'Falta overflow-hidden')
  assert(content.includes('179.07'), 'Comprimento do arco de 270° com r=38 deve ser 179.07 px')
  assert(content.includes('ratio > 0.005 ? 1 : 0'), 'Deve ocultar o cap a 0% para eliminar ponto residual com carro parado')
})

test('GolfGTIDiscoverPro.tsx utiliza CircularProgressDial sem SVGs desbalanceados', () => {
  const content = fs.readFileSync(path.join(rootDir, 'src/components/dashboard/infotainment/GolfGTIDiscoverPro.tsx'), 'utf-8')
  assert(content.includes('CircularProgressDial'), 'GolfGTIDiscoverPro deve importar CircularProgressDial')
  assert(content.includes('label="LEISTUNG"'), 'Mostrador LEISTUNG deve estar presente')
  assert(content.includes('label="ÖLTEMP"'), 'Mostrador ÖLTEMP deve estar presente')
  assert(!content.includes('strokeDasharray={compact || fill ? 132 : 195}'), 'Não deve mais conter hardcoded strokeDasharray desbalanceado')
})

test('PorschePCM6.tsx utiliza CircularProgressDial para o mostrador Flat-6 Power', () => {
  const content = fs.readFileSync(path.join(rootDir, 'src/components/dashboard/infotainment/PorschePCM6.tsx'), 'utf-8')
  assert(content.includes('CircularProgressDial'), 'PorschePCM6 deve importar CircularProgressDial')
  assert(content.includes('label="FLAT-6 POWER"'), 'Mostrador FLAT-6 POWER deve usar CircularProgressDial')
  assert(!content.includes('strokeDasharray={compact || fill ? 132 : 195}'), 'Não deve conter cálculo desbalanceado')
})

test('ToyotaSmartConnect.tsx utiliza CircularProgressDial para Potência VVT-i', () => {
  const content = fs.readFileSync(path.join(rootDir, 'src/components/dashboard/infotainment/ToyotaSmartConnect.tsx'), 'utf-8')
  assert(content.includes('CircularProgressDial'), 'ToyotaSmartConnect deve importar CircularProgressDial')
  assert(content.includes('label="POTÊNCIA VVT-I"'), 'Mostrador POTÊNCIA VVT-I deve usar CircularProgressDial')
})

test('CivicSiInfotainment.tsx utiliza CircularProgressDial para i-VTEC, Potência e Óleo', () => {
  const content = fs.readFileSync(path.join(rootDir, 'src/components/dashboard/infotainment/CivicSiInfotainment.tsx'), 'utf-8')
  assert(content.includes('CircularProgressDial'), 'CivicSiInfotainment deve importar CircularProgressDial')
  assert(content.includes('label="i-VTEC STATUS"'), 'Mostrador i-VTEC STATUS deve usar CircularProgressDial')
  assert(content.includes('label="POTÊNCIA"'), 'Mostrador POTÊNCIA deve usar CircularProgressDial')
  assert(content.includes('label="ÓLEO"'), 'Mostrador ÓLEO deve usar CircularProgressDial')
})

test('BoostGauge.tsx possui overflow-hidden e rounded-full para evitar qualquer vazamento', () => {
  const content = fs.readFileSync(path.join(rootDir, 'src/components/gauges/BoostGauge.tsx'), 'utf-8')
  assert(content.includes('overflow-hidden rounded-full'), 'BoostGauge deve ter overflow-hidden rounded-full')
})

// 2. SELETOR MANUAL PORSCHE NO MOBILE
test('VerticalGestureShifter.tsx possui dimensões compactas anti-corte (w-9 sm:w-10, h-24 sm:h-28, shrink-0)', () => {
  const content = fs.readFileSync(path.join(rootDir, 'src/components/controls/VerticalGestureShifter.tsx'), 'utf-8')
  assert(content.includes("size === 'compact' ? 'w-9 sm:w-10'"), 'widthClass compact deve ser w-9 sm:w-10')
  assert(content.includes("size === 'compact' ? 'h-24 sm:h-28'"), 'heightClass compact deve ser h-24 sm:h-28')
  assert(content.includes('shrink-0'), 'Deve ter shrink-0 para não ser comprimido')
})

test('MobileLandscapeCockpit.tsx possui aside ampliado para w-[136px] sm:w-[146px] e container do shifter com overflow seguro', () => {
  const content = fs.readFileSync(path.join(rootDir, 'src/components/dashboard/MobileLandscapeCockpit.tsx'), 'utf-8')
  assert(content.includes('w-[136px] sm:w-[146px]'), 'Aside deve ter largura suficiente para GearShift + VerticalGestureShifter')
  assert(content.includes('overflow-hidden') || content.includes('overflow-visible'), 'Container do shifter deve ter controle de overflow')
})

test('GearShift.tsx aplica tamanhos responsivos e compactos para PRNDS/M sem forçar dimensões estáticas', () => {
  const content = fs.readFileSync(path.join(rootDir, 'src/components/controls/GearShift.tsx'), 'utf-8')
  assert(content.includes('selectorBtnSize'), 'Deve usar selectorBtnSize dinâmico baseado em size')
  assert(content.includes("size === 'compact'"), 'Deve tratar modo compact nos seletores')
})

test('MobilePortraitCockpit.tsx suporta acomodação segura do seletor manual sem estourar laterais', () => {
  const content = fs.readFileSync(path.join(rootDir, 'src/components/dashboard/MobilePortraitCockpit.tsx'), 'utf-8')
  assert(content.includes('overflow-x-auto no-scrollbar'), 'Linha do câmbio no mobile portrait deve suportar overflow-x-auto seguro')
  assert(content.includes('shrink-0'), 'Controles de câmbio e shifter devem ter shrink-0')
})

// 3. OFICINA NO MOBILE
test('TuningGarageModal.tsx: botões de abas da oficina possuem min-h-[44px] e área clicável expandida', () => {
  const content = fs.readFileSync(path.join(rootDir, 'src/components/tuning/TuningGarageModal.tsx'), 'utf-8')
  assert(content.includes('min-h-[44px]'), 'Botões das abas da oficina devem atender ao padrão de acessibilidade de toque min-h-[44px]')
  assert(content.includes('px-3.5 py-2'), 'Padding deve ser expandido para toque confortável')
  assert(content.includes('overflow-x-auto'), 'Deve suportar rolagem horizontal no mobile')
  assert(content.includes('snap-x'), 'Deve ter suporte a rolagem snap')
})

// 4. COMPATIBILIDADE DE AEROFÓLIO
test('TuningGarageModal.tsx: bloqueia aerofólio automotivo para motocicletas (CB1000R)', () => {
  const content = fs.readFileSync(path.join(rootDir, 'src/components/tuning/TuningGarageModal.tsx'), 'utf-8')
  assert(content.includes('isMoto ? ('), 'Aba de aerodinâmica deve checar se é moto')
  assert(content.includes('AERODINÂMICA DE CARENAGEM ORIGINAL'), 'Deve exibir mensagem explicativa para motos')
})

test('TuningGarageModal.tsx: bloqueia ajustes de downforce quando activeWingType === none', () => {
  const content = fs.readFileSync(path.join(rootDir, 'src/components/tuning/TuningGarageModal.tsx'), 'utf-8')
  assert(content.includes("activeWingType === 'none'"), 'Deve checar se o veículo está sem aerofólio')
  assert(content.includes('CALIBRAÇÃO DE DOWNFORCE INDISPONÍVEL'), 'Deve exibir aviso de que downforce está indisponível sem aerofólio')
})

test('TuningGarageModal.tsx: diferencia aerofólios fixos (OEM e Aftermarket Ducktail) como GEOMETRIA FIXA', () => {
  const content = fs.readFileSync(path.join(rootDir, 'src/components/tuning/TuningGarageModal.tsx'), 'utf-8')
  assert(content.includes("activeWingType === 'oem' || activeWingType === 'aftermarket'"), 'Deve checar aerofólios fixos OEM e Aftermarket')
  assert(content.includes('AEROFÓLIO DE GEOMETRIA FIXA'), 'Deve exibir aviso de geometria fixa sem regulagem angular manual')
})

test('TuningGarageModal.tsx: permite calibração de ângulo de ataque apenas na Asa Alta Motorsport GT (sport_gt)', () => {
  const content = fs.readFileSync(path.join(rootDir, 'src/components/tuning/TuningGarageModal.tsx'), 'utf-8')
  assert(content.includes('Asa Ajustável Motorsport GT') || content.includes('ASA AJUSTÁVEL'), 'Deve identificar a asa ajustável')
  assert(content.includes('low_drag') && content.includes('high_downforce'), 'Deve disponibilizar low_drag, balanced e high_downforce para asa ajustável')
})

test('TuningGarageModal.tsx: preserva o sistema de aerodinâmica ativa original (Swan-neck) da Porsche 911 GT3 RS', () => {
  const content = fs.readFileSync(path.join(rootDir, 'src/components/tuning/TuningGarageModal.tsx'), 'utf-8')
  assert(content.includes("vehicle.id === 'porsche-gt3'"), 'Deve ter ramo exclusivo para a Porsche 911 GT3 RS')
  assert(content.includes('SWAN-NECK PORSCHE MOTORSPORT'), 'Deve preservar a identificação oficial Porsche Motorsport')
  assert(content.includes('AERODINÂMICA ATIVA OEM'), 'Deve exibir badge oficial de aerodinâmica ativa OEM')
})

console.log('\n═══════════════════════════════════════════════════════════════════')
console.log(` RESULTADO FINAL: ${passed} PASSOU | ${failed} FALHOU`)
console.log('═══════════════════════════════════════════════════════════════════\n')

if (failed > 0) {
  process.exit(1)
}
