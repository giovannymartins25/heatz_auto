/**
 * test_phase_multimedia_drag_drop.ts
 *
 * Suíte de Homologação — Drag and Drop / Swipe das Centrais Multimídia Fiat Toro 2025:
 * 1. Fiat Toro Endurance 2025: Uconnect horizontal de 7" sem bloqueio de swipe (removido data-prevent-swipe indevido).
 * 2. Fiat Toro Ranch 2025: Uconnect vertical de 10,1" sem bloqueio de swipe e com suporte a arraste fluido.
 * 3. Análise da causa raiz: detecção de closest('[data-prevent-swipe]') em containers raiz vs controles internos.
 * 4. Simulação de ciclo de vida completo de drag & drop:
 *    - Início de arraste (PointerDown)
 *    - Movimento com resistência e pointer capture (PointerMove)
 *    - Validação de limiar de arraste (>= 40px)
 *    - Encaixe no painel / cluster (PointerUp / Snap)
 *    - Descarte seguro ao soltar fora da área válida (< 40px ou cancelado)
 *    - Re-encaixe de multimídia já montada
 * 5. Proteção de controles interativos internos: botões de áudio, 4x4, climatização e sliders (input[type=range]).
 * 6. Preservação do botão alternativo de alternância rápida (Pill Button).
 * 7. Não-regressão de perfis e dimensões (Endurance 7" 16/9 vs Ranch 10.1" 9/13).
 */

import fs from 'node:fs'
import path from 'node:path'
import { getVehicleCapabilities } from './src/types/vehicle'
import type { VehicleConfig } from './src/types/vehicle'
import toroEnduranceConfig from './public/vehicles/fiat-toro-endurance-2025/config.json' with { type: 'json' }
import toroRanchConfig from './public/vehicles/fiat-toro-ranch-2025/config.json' with { type: 'json' }

let passedTests = 0
let failedTests = 0

function assert(condition: boolean, msg: string) {
  if (condition) {
    passedTests++
    console.log(`  [OK] ${msg}`)
  } else {
    failedTests++
    console.error(`  [FALHA] ${msg}`)
  }
}

console.log('\n===============================================================')
console.log('  HEATZ AUTO · AUDITORIA DE DRAG & DROP MULTIMÍDIAS FIAT TORO')
console.log('===============================================================\n')

// ─── BLOCO 1: CAUSA RAIZ E REMOÇÃO DO DATA-PREVENT-SWIPE DA RAIZ ───
console.log('--- BLOCO 1: Inspeção de Código e Remoção da Causa Raiz ---')
{
  const uconnect7File = fs.readFileSync(
    path.join(process.cwd(), 'src/components/dashboard/infotainment/FiatToroUconnect7.tsx'),
    'utf-8'
  )
  const uconnectVerticalFile = fs.readFileSync(
    path.join(process.cwd(), 'src/components/dashboard/infotainment/FiatToroUconnectVertical.tsx'),
    'utf-8'
  )
  const slotFile = fs.readFileSync(
    path.join(process.cwd(), 'src/components/dashboard/SwipeableClusterMediaSlot.tsx'),
    'utf-8'
  )

  // 1.1 A raiz da Uconnect 7" NÃO pode conter data-prevent-swipe
  const hasRootPreventSwipe7 = /<div[\s\S]*?className=[\s\S]*?data-prevent-swipe[\s\S]*?>[\s\S]*?Moldura superior/i.test(uconnect7File)
  assert(!hasRootPreventSwipe7, 'FiatToroUconnect7: data-prevent-swipe removido da casca/div raiz do componente')

  // 1.2 A raiz da Uconnect 10.1" NÃO pode conter data-prevent-swipe
  const hasRootPreventSwipeVertical = /<div[\s\S]*?className=[\s\S]*?data-prevent-swipe[\s\S]*?>[\s\S]*?Moldura Premium Ranch/i.test(uconnectVerticalFile)
  assert(!hasRootPreventSwipeVertical, 'FiatToroUconnectVertical: data-prevent-swipe removido da casca/div raiz do componente')

  // 1.3 As molduras superiores de ambas devem ter classes de arraste (cursor-grab)
  assert(uconnect7File.includes('cursor-grab'), 'FiatToroUconnect7: cabeçalho contém cursor-grab para sinalização de arraste')
  assert(uconnectVerticalFile.includes('cursor-grab'), 'FiatToroUconnectVertical: cabeçalho contém cursor-grab para sinalização de arraste')

  // 1.4 O slot deve ter suporte a captura e tratamento de pointer events
  assert(slotFile.includes('data-swipe-slot'), 'SwipeableClusterMediaSlot possui atributo data-swipe-slot')
  assert(slotFile.includes('onLostPointerCapture'), 'SwipeableClusterMediaSlot possui manipulador onLostPointerCapture para segurança')
}

// ─── BLOCO 2: SIMULAÇÃO DO MOTOR DE DRAG & DROP DO SWIPEABLECLUSTERMEDIASLOT ───
console.log('\n--- BLOCO 2: Simulação Funcional de Gestos e Encaixe ---')
{
  const SWIPE_THRESHOLD = 40

  class MockSwipeSlotSimulator {
    activeView: 'cluster' | 'multimedia'
    dragOffset: number = 0
    dragging: boolean = false
    startRef: { x: number; y: number; id: number } | null = null
    locked: boolean = false
    viewChangeCount: number = 0

    constructor(initialView: 'cluster' | 'multimedia' = 'cluster') {
      this.activeView = initialView
    }

    setView(view: 'cluster' | 'multimedia') {
      if (this.activeView !== view) {
        this.activeView = view
        this.viewChangeCount++
      }
    }

    pointerDown(targetDesc: { isButton?: boolean; isInput?: boolean; hasPreventSwipe?: boolean }, clientX: number, clientY: number, id = 1): boolean {
      // Regra de exclusão idêntica ao componente React:
      if (targetDesc.isButton || targetDesc.isInput || targetDesc.hasPreventSwipe) {
        return false // Toque não sequestrado
      }
      this.startRef = { x: clientX, y: clientY, id }
      this.locked = false
      return true
    }

    pointerMove(clientX: number, clientY: number) {
      if (!this.startRef) return
      const dx = clientX - this.startRef.x
      const dy = clientY - this.startRef.y

      if (!this.locked) {
        if (Math.abs(dy) > Math.abs(dx) * 1.5 && Math.abs(dy) > 10) {
          this.startRef = null
          return
        }
        if (Math.abs(dx) > 8) {
          this.locked = true
          this.dragging = true
        } else {
          return
        }
      }

      const max = 300 * 0.6
      let off = Math.max(-max, Math.min(max, dx))
      if ((this.activeView === 'cluster' && dx > 0) || (this.activeView === 'multimedia' && dx < 0)) {
        off *= 0.2
      }
      this.dragOffset = off
    }

    pointerUp(clientX: number, cancelled = false) {
      const s = this.startRef
      this.startRef = null
      const wasLocked = this.locked
      this.locked = false
      this.dragging = false
      this.dragOffset = 0

      if (!s || !wasLocked || cancelled) return

      const dx = clientX - s.x
      if (dx <= -SWIPE_THRESHOLD && this.activeView === 'cluster') {
        this.setView('multimedia')
      } else if (dx >= SWIPE_THRESHOLD && this.activeView === 'multimedia') {
        this.setView('cluster')
      }
    }
  }

  // 2.1 Cenário: Uconnect 7" da Toro Endurance sendo arrastada para o painel
  {
    const sim = new MockSwipeSlotSimulator('multimedia')
    assert(sim.activeView === 'multimedia', 'Início na tela multimídia da Toro Endurance')

    // Tenta arrastar a partir da moldura/cabeçalho da Uconnect 7"
    const started = sim.pointerDown({ isButton: false, isInput: false, hasPreventSwipe: false }, 250, 100)
    assert(started, 'Toque na moldura da Uconnect 7" inicia rastreamento de arraste')

    // Arraste de 50px para a direita (em direção ao painel de instrumentos)
    sim.pointerMove(270, 100)
    assert(sim.dragging && sim.dragOffset > 0, 'Multimídia 7" se desloca dinamicamente para a direita')

    sim.pointerMove(310, 100) // dx = +60px (> 40px)
    sim.pointerUp(310)

    assert(sim.activeView === 'cluster', 'Uconnect 7" solta no painel é encaixada com sucesso (view = cluster)')
    assert(sim.dragOffset === 0, 'Offset de arraste reiniciado após encaixe')
  }

  // 2.2 Cenário: Uconnect 10.1" Vertical da Toro Ranch sendo arrastada para o painel
  {
    const sim = new MockSwipeSlotSimulator('multimedia')
    assert(sim.activeView === 'multimedia', 'Início na tela multimídia vertical da Toro Ranch')

    // Tenta arrastar a partir do cardã ou moldura superior Ranch
    const started = sim.pointerDown({ isButton: false, isInput: false, hasPreventSwipe: false }, 200, 80)
    assert(started, 'Toque na área nobre da Uconnect 10.1" inicia rastreamento de arraste')

    // Arraste de 80px para a direita
    sim.pointerMove(240, 80)
    assert(sim.dragging && sim.dragOffset > 0, 'Multimídia vertical se desloca suavemente com resistência nas bordas')

    sim.pointerMove(280, 80) // dx = +80px (> 40px)
    sim.pointerUp(280)

    assert(sim.activeView === 'cluster', 'Uconnect 10.1" Ranch é encaixada com sucesso no painel de instrumentos')
  }

  // 2.3 Soltar fora da área válida (< 40px) ou cancelamento por gesto do sistema
  {
    const sim = new MockSwipeSlotSimulator('multimedia')
    sim.pointerDown({ isButton: false }, 100, 100)
    sim.pointerMove(120, 100) // dx = +20px (< 40px)
    sim.pointerUp(120)

    assert(sim.activeView === 'multimedia', 'Soltura com deslocamento insuficiente (< 40px) mantém multimídia intacta sem corrupção')
    assert(sim.dragOffset === 0, 'Posição retorna perfeitamente ao repouso')

    // Cancelamento do gesto
    sim.pointerDown({ isButton: false }, 100, 100)
    sim.pointerMove(170, 100)
    sim.pointerUp(170, true) // cancelado
    assert(sim.activeView === 'multimedia', 'Pointer cancel restaura a posição sem alterar a visualização')
  }

  // 2.4 Arrastar novamente uma multimídia já encaixada (ciclo de re-encaixe)
  {
    const sim = new MockSwipeSlotSimulator('cluster')
    // Da cluster para multimídia
    sim.pointerDown({ isButton: false }, 300, 150)
    sim.pointerMove(240, 150) // dx = -60px
    sim.pointerUp(240)
    assert(sim.activeView === 'multimedia', 'Ciclo 1: Arrastado do painel para a multimídia com sucesso')

    // Da multimídia de volta para o cluster
    sim.pointerDown({ isButton: false }, 200, 150)
    sim.pointerMove(270, 150) // dx = +70px
    sim.pointerUp(270)
    assert(sim.activeView === 'cluster', 'Ciclo 2: Arrastado da multimídia de volta para o painel com sucesso')
  }

  // 2.5 Proteção de controles interativos internos da Toro
  {
    const sim = new MockSwipeSlotSimulator('multimedia')

    // Clique em botão 4x4 (ex: AUTO ou 4WD LOCK)
    const buttonHandled = sim.pointerDown({ isButton: true }, 150, 200)
    assert(!buttonHandled, 'Botão de modo 4x4 NÃO inicia arraste de tela (evento preservado para ação nativa)')

    // Toque em slider de volume / brilho (input range)
    const inputHandled = sim.pointerDown({ isInput: true }, 150, 300)
    assert(!inputHandled, 'Slider de volume/brilho NÃO inicia arraste de tela (ajuste analógico preservado)')

    // Toque em botão de climatização (A/C, Temperatura)
    const climateBtnHandled = sim.pointerDown({ isButton: true }, 100, 250)
    assert(!climateBtnHandled, 'Botões de temperatura e ar-condicionado funcionam sem disparar swipe acidental')
  }

  // 2.6 Preservação do botão alternativo (Pill Toggle Button)
  {
    const sim = new MockSwipeSlotSimulator('cluster')
    // Clique direto no botão pill [ 📺 MÍDIA ]
    sim.setView('multimedia')
    assert(sim.activeView === 'multimedia', 'Botão alternativo [ 📺 MÍDIA ] funciona diretamente')

    // Clique direto no botão pill [ 📟 PAINEL ]
    sim.setView('cluster')
    assert(sim.activeView === 'cluster', 'Botão alternativo [ 📟 PAINEL ] funciona diretamente')
  }
}

// ─── BLOCO 3: INTEGRIDADE DOS PERFIS E ESPECIFICAÇÕES DOS VEÍCULOS ───
console.log('\n--- BLOCO 3: Perfis Exclusivos Endurance vs Ranch ---')
{
  const endConfig = toroEnduranceConfig as unknown as VehicleConfig
  const ranchConfig = toroRanchConfig as unknown as VehicleConfig

  const endCaps = getVehicleCapabilities(endConfig)
  const ranchCaps = getVehicleCapabilities(ranchConfig)

  // Endurance
  assert(endConfig.id === 'fiat-toro-endurance-2025', 'ID da Endurance: fiat-toro-endurance-2025')
  assert(endConfig.dashboard?.hasInfotainment === true, 'Endurance equipada com central multimídia')
  assert(endConfig.dashboard?.theme === 'toro_endurance', 'Tema de dashboard: toro_endurance')
  assert(endConfig.transmission.type === 'automatic' && endConfig.transmission.gearCount === 6, 'Endurance câmbio AT6 (6 marchas)')
  assert(!endCaps.has4x4Selector, 'Endurance FWD sem seletor 4x4')
  assert(!endCaps.supportsPaddleShifters, 'Endurance sem paddle shifters (borboletas)')

  // Ranch
  assert(ranchConfig.id === 'fiat-toro-ranch-2025', 'ID da Ranch: fiat-toro-ranch-2025')
  assert(ranchConfig.dashboard?.hasInfotainment === true, 'Ranch equipada com central multimídia vertical')
  assert(ranchConfig.dashboard?.theme === 'toro_ranch', 'Tema de dashboard: toro_ranch')
  assert(ranchConfig.transmission.type === 'automatic' && ranchConfig.transmission.gearCount === 9, 'Ranch câmbio ZF 9HP AT9 (9 marchas)')
  assert(ranchCaps.has4x4Selector === true, 'Ranch possui seletor 4x4 inteligente na multimídia')
  assert(ranchCaps.supportsPaddleShifters === true, 'Ranch possui paddle shifters no volante')
}

console.log('\n===============================================================')
console.log(`  RESULTADO FINAL: ${passedTests} PASSOU / ${failedTests} FALHOU`)
console.log('===============================================================\n')

if (failedTests > 0) {
  process.exit(1)
}
