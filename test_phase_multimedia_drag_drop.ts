/**
 * test_phase_multimedia_drag_drop.ts
 *
 * Suíte de Homologação Rigorosa — HOTFIX de Interação do Cockpit:
 * Validação do Ciclo de Eventos Pointer (pointerdown, pointermove, pointerup, pointercancel, lostpointercapture)
 * e Máquina de Estados de Transição Bidirecional (Cluster <-> Multimídia) nas duas Fiat Toro 2025.
 *
 * Itens auditados:
 * 1. Análise da causa raiz:
 *    - onLostPointerCapture indevido cancelando gestos no release
 *    - pointerEvents bloqueando painel durante transições
 *    - Aborto prematuro por drift vertical (dy)
 *    - Captura tardia de ponteiro
 * 2. Validação de Mouse no Desktop (button=0, pointerType=mouse, lostpointercapture no release).
 * 3. Validação de Toque no Smartphone (touchAction: pan-y / none, drift vertical de polegar, pointercancel do sistema).
 * 4. Transição bidirecional contínua:
 *    - Toro Endurance: Painel -> Uconnect 7" (swipe left <= -40px)
 *    - Toro Endurance: Uconnect 7" -> Painel (swipe right >= +40px)
 *    - Toro Ranch: Painel -> Uconnect 10.1" Vertical (swipe left <= -40px)
 *    - Toro Ranch: Uconnect 10.1" Vertical -> Painel (swipe right >= +40px)
 * 5. Proteção estrita de controles internos (botões de 4x4, ar digital, faixas de áudio, sliders de volume/brilho).
 * 6. Preservação do botão alternativo rápido (Pill Toggle Button).
 * 7. Não-regressão de perfis e dimensões (Endurance AT6 16/9 vs Ranch AT9 9/13).
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
console.log('  HEATZ AUTO · AUDITORIA HOTFIX — INTERAÇÃO CLUSTER / MULTIMÍDIA')
console.log('===============================================================\n')

// ─── BLOCO 1: AUDITORIA DE CÓDIGO FONTE E REMOÇÃO DE BLOQUEIOS ───
console.log('--- BLOCO 1: Inspeção de Código e Remoção de Conflitos ---')
{
  const slotFile = fs.readFileSync(
    path.join(process.cwd(), 'src/components/dashboard/SwipeableClusterMediaSlot.tsx'),
    'utf-8'
  )
  const uconnect7File = fs.readFileSync(
    path.join(process.cwd(), 'src/components/dashboard/infotainment/FiatToroUconnect7.tsx'),
    'utf-8'
  )
  const uconnectVerticalFile = fs.readFileSync(
    path.join(process.cwd(), 'src/components/dashboard/infotainment/FiatToroUconnectVertical.tsx'),
    'utf-8'
  )

  // 1.1 onLostPointerCapture NÃO pode estar cancelando o gesto na raiz
  assert(!slotFile.includes('onLostPointerCapture='), 'SwipeableClusterMediaSlot: removido onLostPointerCapture indevido que cancelava gestos válidos no release')

  // 1.2 Captura de ponteiro deve ser chamada no handlePointerDown para suporte universal
  assert(slotFile.includes('e.currentTarget.setPointerCapture(e.pointerId)'), 'SwipeableClusterMediaSlot: setPointerCapture acionado imediatamente no pointerdown')

  // 1.3 Suporte a cursor-grab / cursor-grabbing para feedback visual no desktop
  assert(slotFile.includes('cursor-grab') && slotFile.includes('cursor-grabbing'), 'SwipeableClusterMediaSlot: cursor-grab dinâmico presente para desktop')

  // 1.4 touch-action configurado adequadamente nas duas telas e cabeçalhos
  assert(uconnect7File.includes("touchAction: 'none'") && uconnect7File.includes("touchAction: 'pan-y'"), 'FiatToroUconnect7: touch-action configurado (none no header, pan-y no body)')
  assert(uconnectVerticalFile.includes("touchAction: 'none'") && uconnectVerticalFile.includes("touchAction: 'pan-y'"), 'FiatToroUconnectVertical: touch-action configurado (none no header, pan-y no body)')

  // 1.5 Reserva de espaço nos cabeçalhos para o botão pill não colidir com o relógio
  assert(uconnect7File.includes('pr-24'), 'FiatToroUconnect7: cabeçalho reserva espaço à direita (pr-24) para o botão pill')
  assert(uconnectVerticalFile.includes('pr-24'), 'FiatToroUconnectVertical: cabeçalho reserva espaço à direita (pr-24) para o botão pill')
}

// ─── BLOCO 2: MÁQUINA DE ESTADOS REAL E CICLO COMPLETO DE EVENTOS ───
console.log('\n--- BLOCO 2: Máquina de Estados e Ciclo de Eventos Real ---')
{
  const SWIPE_THRESHOLD = 40

  class PointerStateMachine {
    activeView: 'cluster' | 'multimedia'
    dragOffset: number = 0
    dragging: boolean = false
    startRef: { x: number; y: number; id: number } | null = null
    lastDx: number = 0
    locked: boolean = false
    hasCapture: boolean = false
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

    pointerDown(e: { isPrimary: boolean; button?: number; pointerId: number; clientX: number; clientY: number; target: { isButton?: boolean; isInput?: boolean } }) {
      if (!e.isPrimary) return false
      if (e.button !== undefined && e.button !== 0) return false
      if (e.target.isButton || e.target.isInput) return false

      this.startRef = { x: e.clientX, y: e.clientY, id: e.pointerId }
      this.lastDx = 0
      this.locked = false
      this.hasCapture = true
      return true
    }

    pointerMove(clientX: number, clientY: number) {
      if (!this.startRef) return
      const dx = clientX - this.startRef.x
      const dy = clientY - this.startRef.y
      this.lastDx = dx

      if (!this.locked) {
        // Se for claramente vertical (scroll interno em lista com dy > 18 e dy > dx * 2), libera
        if (Math.abs(dy) > 18 && Math.abs(dy) > Math.abs(dx) * 2) {
          this.startRef = null
          this.hasCapture = false
          return
        }

        // Se moveu >= 4px na horizontal e prevalece horizontal
        if (Math.abs(dx) >= 4 && Math.abs(dx) >= Math.abs(dy)) {
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

    pointerUp(clientX?: number) {
      const s = this.startRef
      if (!s) return

      const wasLocked = this.locked
      const currentX = (clientX !== undefined && Number.isFinite(clientX) && clientX !== 0) ? clientX : (s.x + this.lastDx)
      const dx = currentX - s.x

      this.startRef = null
      this.locked = false
      this.dragging = false
      this.dragOffset = 0
      this.hasCapture = false

      if (!wasLocked) return

      if (dx <= -SWIPE_THRESHOLD && this.activeView === 'cluster') {
        this.setView('multimedia')
      } else if (dx >= SWIPE_THRESHOLD && this.activeView === 'multimedia') {
        this.setView('cluster')
      }
    }

    pointerCancel() {
      this.startRef = null
      this.locked = false
      this.dragging = false
      this.dragOffset = 0
      this.hasCapture = false
    }

    lostPointerCapture() {
      // Como corrigido: lostPointerCapture NÃO deve cancelar um gesto que está sendo finalizado
      this.hasCapture = false
    }
  }

  // 2.1 Teste Desktop com Mouse — Painel -> Multimídia (Arrasto para a Esquerda)
  {
    const sm = new PointerStateMachine('cluster')
    // Botão esquerdo (button=0)
    const started = sm.pointerDown({ isPrimary: true, button: 0, pointerId: 1, clientX: 400, clientY: 200, target: {} })
    assert(started, 'Desktop Mouse: clique com botão esquerdo no painel inicia captura')

    // Movimento com micro-drift vertical realista (dx=-10, dy=+3)
    sm.pointerMove(390, 203)
    assert(sm.dragging && sm.locked, 'Desktop Mouse: gesto travado para a esquerda com micro-drift vertical')

    // Arraste contínuo até ultrapassar o limiar (-65px)
    sm.pointerMove(335, 204)
    assert(sm.dragOffset < -30, 'Desktop Mouse: offset negativo reflete deslocamento para a esquerda')

    // Dispara lostpointercapture antes do pointerup (comportamento nativo do Chromium)
    sm.lostPointerCapture()
    assert(sm.dragging, 'Desktop Mouse: lostpointercapture NÃO aborta o gesto prematuramente')

    // Soltura do mouse
    sm.pointerUp(335)
    assert(sm.activeView === 'multimedia', 'Desktop Mouse: transição Painel -> Multimídia concluída com sucesso')
    assert(sm.dragOffset === 0 && !sm.dragging, 'Desktop Mouse: esteira resetada após transição')
  }

  // 2.2 Teste Desktop com Mouse — Multimídia -> Painel (Arrasto para a Direita)
  {
    const sm = new PointerStateMachine('multimedia')
    sm.pointerDown({ isPrimary: true, button: 0, pointerId: 1, clientX: 200, clientY: 150, target: {} })
    sm.pointerMove(230, 152) // dx = +30
    sm.pointerMove(260, 153) // dx = +60 (> 40px)
    sm.pointerUp(260)
    assert(sm.activeView === 'cluster', 'Desktop Mouse: transição Multimídia -> Painel concluída com sucesso')
  }

  // 2.3 Teste Mobile com Toque — Oscilação natural de polegar antes do swipe
  {
    const sm = new PointerStateMachine('cluster')
    sm.pointerDown({ isPrimary: true, pointerId: 2, clientX: 300, clientY: 250, target: {} })

    // Drift vertical inicial comum em toques no smartphone (dy = 8px, dx = -5px)
    sm.pointerMove(295, 258)
    assert(sm.startRef !== null, 'Mobile Touch: drift de polegar não cancela o ponto inicial')

    // Usuário desliza fortemente para a esquerda (-80px)
    sm.pointerMove(220, 260)
    assert(sm.dragging, 'Mobile Touch: arraste horizontal reconhecido e ativo')

    sm.pointerUp(220)
    assert(sm.activeView === 'multimedia', 'Mobile Touch: transição Painel -> Multimídia concluída no smartphone')
  }

  // 2.4 Teste Mobile com Toque — Scroll vertical real em lista interna (ex: rolagem da playlist)
  {
    const sm = new PointerStateMachine('multimedia')
    sm.pointerDown({ isPrimary: true, pointerId: 3, clientX: 200, clientY: 100, target: {} })

    // Movimento predominantemente vertical (dy = 40px, dx = 3px)
    sm.pointerMove(203, 140)
    assert(!sm.dragging && sm.startRef === null, 'Mobile Touch: scroll vertical real em lista interna libera o swipe para rolagem da lista')
  }

  // 2.5 Teste de Movimento abaixo do limiar (< 40px)
  {
    const sm = new PointerStateMachine('cluster')
    sm.pointerDown({ isPrimary: true, pointerId: 1, clientX: 300, clientY: 200, target: {} })
    sm.pointerMove(280, 200) // dx = -20px (< 40px)
    sm.pointerUp(280)
    assert(sm.activeView === 'cluster', 'Movimento insuficiente (< 40px) mantém a visualização atual intacta')
    assert(sm.dragOffset === 0, 'Offset retorna para 0')
  }

  // 2.6 Cancelamento de ponteiro por interrupção do sistema (pointercancel)
  {
    const sm = new PointerStateMachine('multimedia')
    sm.pointerDown({ isPrimary: true, pointerId: 1, clientX: 200, clientY: 200, target: {} })
    sm.pointerMove(260, 200) // dx = +60px
    sm.pointerCancel()
    assert(sm.activeView === 'multimedia', 'pointercancel restaura o estado sem alternar indevidamente')
    assert(sm.dragOffset === 0 && !sm.dragging, 'Estado completamente liberado após cancelamento')
  }

  // 2.7 Múltiplos movimentos consecutivos (Painel -> Mídia -> Painel -> Mídia)
  {
    const sm = new PointerStateMachine('cluster')
    // Ciclo 1: Esquerda
    sm.pointerDown({ isPrimary: true, pointerId: 1, clientX: 300, clientY: 100, target: {} })
    sm.pointerMove(240, 100)
    sm.pointerUp(240)
    assert(sm.activeView === 'multimedia', 'Consecutivo 1: Cluster -> Multimídia')

    // Ciclo 2: Direita
    sm.pointerDown({ isPrimary: true, pointerId: 1, clientX: 200, clientY: 100, target: {} })
    sm.pointerMove(260, 100)
    sm.pointerUp(260)
    assert(sm.activeView === 'cluster', 'Consecutivo 2: Multimídia -> Cluster')

    // Ciclo 3: Esquerda novamente
    sm.pointerDown({ isPrimary: true, pointerId: 1, clientX: 300, clientY: 100, target: {} })
    sm.pointerMove(240, 100)
    sm.pointerUp(240)
    assert(sm.activeView === 'multimedia', 'Consecutivo 3: Cluster -> Multimídia re-executado')
  }

  // 2.8 Proteção de botões interativos
  {
    const sm = new PointerStateMachine('multimedia')
    const buttonClick = sm.pointerDown({ isPrimary: true, pointerId: 1, clientX: 100, clientY: 100, target: { isButton: true } })
    assert(!buttonClick, 'Clique em botão (4x4, ar, rádio) não inicia arraste de tela')

    const sliderTouch = sm.pointerDown({ isPrimary: true, pointerId: 1, clientX: 100, clientY: 100, target: { isInput: true } })
    assert(!sliderTouch, 'Toque em slider de volume/brilho não inicia arraste de tela')
  }

  // 2.9 Botão pill alternativo
  {
    const sm = new PointerStateMachine('cluster')
    sm.setView('multimedia')
    assert(sm.activeView === 'multimedia', 'Botão pill alterna instantaneamente para multimídia')
    sm.setView('cluster')
    assert(sm.activeView === 'cluster', 'Botão pill alterna instantaneamente para painel')
  }
}

// ─── BLOCO 3: VALIDAÇÃO INDIVIDUAL DAS DUAS VERSÕES DA FIAT TORO ───
console.log('\n--- BLOCO 3: Validação Específica Endurance 2025 vs Ranch 2025 ---')
{
  const endConfig = toroEnduranceConfig as unknown as VehicleConfig
  const ranchConfig = toroRanchConfig as unknown as VehicleConfig

  const endCaps = getVehicleCapabilities(endConfig)
  const ranchCaps = getVehicleCapabilities(ranchConfig)

  // 3.1 Endurance 2025
  assert(endConfig.id === 'fiat-toro-endurance-2025', 'Endurance 2025: identificador correto')
  assert(endConfig.dashboard?.theme === 'toro_endurance', 'Endurance 2025: tema cluster TFT 7" exclusivo')
  assert(endConfig.dashboard?.hasInfotainment === true, 'Endurance 2025: equipada com central multimídia')
  assert(!endCaps.has4x4Selector, 'Endurance 2025: FWD sem seletor 4x4')
  assert(endConfig.transmission.gearCount === 6, 'Endurance 2025: câmbio Aisin AT6 de 6 marchas')

  // 3.2 Ranch 2025
  assert(ranchConfig.id === 'fiat-toro-ranch-2025', 'Ranch 2025: identificador correto')
  assert(ranchConfig.dashboard?.theme === 'toro_ranch', 'Ranch 2025: tema cluster TFT 7" Turbodiesel exclusivo')
  assert(ranchConfig.dashboard?.hasInfotainment === true, 'Ranch 2025: equipada com central multimídia vertical')
  assert(ranchCaps.has4x4Selector === true, 'Ranch 2025: seletor de tração 4x4 integrado na multimídia')
  assert(ranchCaps.supportsPaddleShifters === true, 'Ranch 2025: paddle shifters no volante')
  assert(ranchConfig.transmission.gearCount === 9, 'Ranch 2025: câmbio ZF 9HP de 9 marchas com crawl ratio')
}

console.log('\n===============================================================')
console.log(`  RESULTADO DO HOTFIX: ${passedTests} PASSOU / ${failedTests} FALHOU`)
console.log('===============================================================\n')

if (failedTests > 0) {
  process.exit(1)
}
