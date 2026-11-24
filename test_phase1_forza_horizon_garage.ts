import { readFileSync } from 'fs'
import { resolve } from 'path'
import { useGarageStore } from './src/stores/useGarageStore'
import { getBrandTheme } from './src/components/ui/ManufacturerSection'
import type { VehicleManifestEntry } from './src/types/vehicle'

console.log('═══════════════════════════════════════════════════════════════════')
console.log('  TESTES DE VALIDAÇÃO: FASE 1 — GARAGEM & CONCESSIONÁRIA FORZA     ')
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

// Carregar catálogo oficial
const manifestPath = resolve(process.cwd(), 'public/vehicles/manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
const vehicleList: VehicleManifestEntry[] = manifest.vehicles

// ─── 1. AGRUPAMENTO DINÂMICO POR FABRICANTE NO CATÁLOGO ───
test('Concessionária: Agrupa veículos por brand dinamicamente sem cadastro duplicado', () => {
  const brandMap = new Map<string, VehicleManifestEntry[]>()
  for (const v of vehicleList) {
    const brand = v.brand || 'Outros'
    if (!brandMap.has(brand)) brandMap.set(brand, [])
    brandMap.get(brand)!.push(v)
  }

  const groups = Array.from(brandMap.entries()).map(([brand, vehicles]) => ({ brand, vehicles }))

  assert(groups.length >= 6, `Deve encontrar pelo menos 6 fabricantes (encontrou ${groups.length})`)

  const vwGroup = groups.find((g) => g.brand === 'Volkswagen')
  assert(!!vwGroup, 'Fabricante Volkswagen deve existir no catálogo')
  assert(vwGroup!.vehicles.length >= 3, `Volkswagen deve conter pelo menos os 3 modelos base (GTI, Gol G6, Gol Quadrado), tem: ${vwGroup!.vehicles.length}`)

  const fiatGroup = groups.find((g) => g.brand === 'Fiat')
  assert(!!fiatGroup, 'Fabricante Fiat deve existir no catálogo')
  assert(fiatGroup!.vehicles.length === 2, `Fiat deve conter 2 modelos (Toro Endurance, Toro Ranch), tem: ${fiatGroup!.vehicles.length}`)

  const porscheGroup = groups.find((g) => g.brand === 'Porsche')
  assert(!!porscheGroup, 'Fabricante Porsche deve existir no catálogo')
  assert(porscheGroup!.vehicles.length === 1, `Porsche deve conter 1 modelo, tem: ${porscheGroup!.vehicles.length}`)
})

// ─── 2. GARAGEM: MARCAS SEM VEÍCULOS ADQUIRIDOS NÃO APARECEM ───
test('Garagem: Fabricantes sem veículos possuídos não geram seções vazias', () => {
  // Simular garagem contendo apenas veículos Honda e Porsche
  const mockOwned = [
    { instanceId: 'inst-1', vehicleId: 'civic-si', customName: 'Civic K20', mileageKm: 12000, acquiredAt: Date.now(), upgrades: {} as any },
    { instanceId: 'inst-2', vehicleId: 'porsche-gt3', customName: 'GT3 RS Track', mileageKm: 3400, acquiredAt: Date.now(), upgrades: {} as any },
  ]

  const brandMap = new Map<string, typeof mockOwned>()
  for (const car of mockOwned) {
    const v = vehicleList.find((item) => item.id === car.vehicleId)
    const brand = v?.brand || 'Outros'
    if (!brandMap.has(brand)) brandMap.set(brand, [])
    brandMap.get(brand)!.push(car)
  }

  const groups = Array.from(brandMap.entries())
    .filter(([_, cars]) => cars.length > 0)
    .map(([brand, cars]) => ({ brand, cars }))

  assert(groups.length === 2, `Apenas as 2 marcas com carros devem aparecer (apareceram: ${groups.length})`)
  assert(groups.some((g) => g.brand === 'Honda'), 'Honda deve estar na garagem')
  assert(groups.some((g) => g.brand === 'Porsche'), 'Porsche deve estar na garagem')
  assert(!groups.some((g) => g.brand === 'Fiat'), 'Fiat NÃO deve aparecer se não há Fiat na garagem')
  assert(!groups.some((g) => g.brand === 'Chevrolet'), 'Chevrolet NÃO deve aparecer se não há Chevrolet na garagem')
})

// ─── 3. GARAGEM: DUPLICIDADE DE VEÍCULOS E PERSONALIZAÇÕES ───
test('Garagem: Preserva múltiplos carros do mesmo modelo na mesma seção de marca', () => {
  // Dois Golfs GTI na garagem com preparações diferentes
  const mockOwned = [
    { instanceId: 'gti-street', vehicleId: 'golf-gti', customName: 'Golf GTI Street', mileageKm: 15000, acquiredAt: 1, upgrades: { tuningStage: 1 } as any },
    { instanceId: 'gti-track', vehicleId: 'golf-gti', customName: 'Golf GTI Track 400cv', mileageKm: 500, acquiredAt: 2, upgrades: { tuningStage: 3, tires: 'semi_slick' } as any },
    { instanceId: 'gol-quadrado', vehicleId: 'gol-quadrado-turbo', customName: 'Gol AP Turbo', mileageKm: 8000, acquiredAt: 3, upgrades: { turboKit: true } as any },
  ]

  const brandMap = new Map<string, typeof mockOwned>()
  for (const car of mockOwned) {
    const v = vehicleList.find((item) => item.id === car.vehicleId)
    const brand = v?.brand || 'Outros'
    if (!brandMap.has(brand)) brandMap.set(brand, [])
    brandMap.get(brand)!.push(car)
  }

  const vwCars = brandMap.get('Volkswagen') || []
  assert(vwCars.length === 3, `Volkswagen deve ter 3 instâncias no total (tem ${vwCars.length})`)

  const gtiCopies = vwCars.filter((c) => c.vehicleId === 'golf-gti')
  assert(gtiCopies.length === 2, `Devem existir 2 Golfs GTI distintos na garagem`)
  assert(gtiCopies[0].customName === 'Golf GTI Street', 'Primeiro Golf GTI preserva seu nome customizado')
  assert(gtiCopies[1].customName === 'Golf GTI Track 400cv', 'Segundo Golf GTI preserva seu nome customizado')
})

// ─── 4. TESTE DE BUSCA E FILTROS DINÂMICOS ───
test('Filtros: Filtro de categoria Moto restringe fabricante para Honda', () => {
  const filteredMotos = vehicleList.filter((v) => v.category === 'motorcycle')
  const brands = Array.from(new Set(filteredMotos.map((v) => v.brand)))

  assert(brands.length === 1 && brands[0] === 'Honda', 'Apenas a Honda possui categoria motorcycle cadastrada')
  assert(filteredMotos[0].id === 'cb1000r', 'A moto é a CB1000R')
})

test('Filtros: Busca textual por "Toro" isola fabricante Fiat com 2 modelos', () => {
  const q = 'toro'
  const filtered = vehicleList.filter(
    (v) => v.name.toLowerCase().includes(q) || v.brand.toLowerCase().includes(q) || v.id.toLowerCase().includes(q)
  )

  const brands = Array.from(new Set(filtered.map((v) => v.brand)))
  assert(brands.length === 1 && brands[0] === 'Fiat', 'A busca "toro" deve retornar somente a marca Fiat')
  assert(filtered.length === 2, 'Deve conter as 2 versões da Toro (Endurance e Ranch)')
})

// ─── 5. PERSISTÊNCIA ZUSTAND / LOCALSTORAGE (COMPRA, VENDA, RENOMEAÇÃO) ───
test('Persistência Zustand: Compra, renomeação, seleção e venda de veículos', () => {
  useGarageStore.getState().resetToDefaults()
  const initialCars = useGarageStore.getState().ownedCars.length
  assert(initialCars > 0, 'Garagem deve iniciar com veículos padrão')

  // 1. Compra de um novo veículo
  const initialCredits = useGarageStore.getState().credits
  const newCar = useGarageStore.getState().buyCar('golf-gti', 'GTI Projeto Track', 145000)
  
  assert(newCar.vehicleId === 'golf-gti', 'Veículo comprado deve ser golf-gti')
  assert(newCar.customName === 'GTI Projeto Track', 'Nome customizado deve ser preservado')
  assert(useGarageStore.getState().ownedCars.length === initialCars + 1, 'Total de carros deve incrementar em 1')

  // 2. Renomeação
  useGarageStore.getState().renameCar(newCar.instanceId, 'GTI Monstro do Nürburgring')
  const renamedCar = useGarageStore.getState().getCarById(newCar.instanceId)
  assert(renamedCar?.customName === 'GTI Monstro do Nürburgring', 'Carro deve ser renomeado com sucesso')

  // 3. Seleção
  useGarageStore.getState().setActiveCar(newCar.instanceId)
  assert(useGarageStore.getState().activeCarInstanceId === newCar.instanceId, 'Carro recém-comprado deve poder ser selecionado')

  // 4. Venda
  useGarageStore.getState().sellCar(newCar.instanceId, 100000)
  assert(useGarageStore.getState().ownedCars.length === initialCars, 'Após venda, quantidade de carros volta ao anterior')
  assert(!useGarageStore.getState().getCarById(newCar.instanceId), 'Carro vendido não deve mais existir na garagem')
})

// ─── 6. IDENTIDADE VISUAL E CORES DOS FABRICANTES (FORZA HORIZON) ───
test('Estilo Forza Horizon: Cores temáticas específicas para cada fabricante', () => {
  const vwTheme = getBrandTheme('Volkswagen')
  assert(vwTheme.accent === '#0ea5e9', 'Volkswagen deve ter azul característico')

  const porscheTheme = getBrandTheme('Porsche')
  assert(porscheTheme.accent === '#d4af37', 'Porsche deve ter dourado motorsport')

  const hondaTheme = getBrandTheme('Honda')
  assert(hondaTheme.accent === '#ef4444', 'Honda deve ter vermelho de corrida')

  const fiatTheme = getBrandTheme('Fiat')
  assert(fiatTheme.accent === '#dc2626', 'Fiat deve ter vermelho italiano')

  const chevroletTheme = getBrandTheme('Chevrolet')
  assert(chevroletTheme.accent === '#f59e0b', 'Chevrolet deve ter âmbar/dourado')

  const toyotaTheme = getBrandTheme('Toyota')
  assert(toyotaTheme.accent === '#e11d48', 'Toyota deve ter carmim Gazoo Racing')

  const unknownTheme = getBrandTheme('FabricanteInedito')
  assert(!!unknownTheme.accent && !!unknownTheme.border, 'Fabricantes futuros recebem fallback elegante automaticamente')
})

console.log('\n═══════════════════════════════════════════════════════════════════')
console.log(` RESULTADO FINAL: ${passed} PASSOU | ${failed} FALHOU`)
console.log('═══════════════════════════════════════════════════════════════════')

if (failed > 0) {
  process.exit(1)
}
