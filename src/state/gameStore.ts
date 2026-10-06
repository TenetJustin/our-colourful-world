import { create } from 'zustand'
import type { CrossingState, DialogueState, DiscoveryState, GamePhase, MemoryEntry, Pulse, SenseType, SystemHint } from '../game/types'

type GameStore = {
  started: boolean
  paused: boolean
  muted: boolean
  memoryOpen: boolean
  memorySeen: boolean
  debug: boolean
  phase: GamePhase
  discoveries: Record<string, DiscoveryState>
  memories: MemoryEntry[]
  dialogue: DialogueState | null
  subtitle: string | null
  hint: string | null
  systemHint: SystemHint | null
  pulses: Pulse[]
  crossingState: CrossingState
  endingTriggered: boolean
  playerPosition: [number, number, number]
  playerYaw: number
  pointerLocked: boolean
  audioReady: boolean
  teleportTarget: [number, number, number] | null
  teleportId: number
  start: () => void
  togglePause: () => void
  toggleMute: () => void
  toggleMemory: () => void
  toggleDebug: () => void
  setPhase: (phase: GamePhase) => void
  setCrossingState: (state: CrossingState) => void
  setPlayerPosition: (position: [number, number, number]) => void
  setPlayerYaw: (yaw: number) => void
  setPointerLocked: (locked: boolean) => void
  setAudioReady: (ready: boolean) => void
  requestTeleport: (position: [number, number, number]) => void
  discover: (id: string, confidence: number, sense: SenseType, memory?: string) => void
  showSubtitle: (text: string, duration?: number) => void
  showHint: (text: string | null) => void
  showSystemHint: (title: string, text: string, duration?: number) => void
  emitPulse: (position: [number, number, number], sense: SenseType, radius?: number) => void
  openDialogue: (id: string, speaker: string, lines: string[]) => void
  advanceDialogue: () => void
  closeDialogue: () => void
  triggerEnding: () => void
  restart: () => void
}

const initialMemories: MemoryEntry[] = [
  { id: 'home-area', text: '家应该还在这片区域。' },
  { id: 'lost', text: '我不知道自己现在在哪。' },
]

let subtitleTimer = 0
let pulseId = 0

export const useGameStore = create<GameStore>((set, get) => ({
  started: false,
  paused: false,
  muted: false,
  memoryOpen: false,
  memorySeen: false,
  debug: new URLSearchParams(window.location.search).has('debug'),
  phase: 'ARRIVAL',
  discoveries: {},
  memories: initialMemories,
  dialogue: null,
  subtitle: null,
  hint: null,
  systemHint: null,
  pulses: [],
  crossingState: 'CROSS_TRAFFIC',
  endingTriggered: false,
  playerPosition: [0, 1.05, 51],
  playerYaw: 0,
  pointerLocked: false,
  audioReady: false,
  teleportTarget: null,
  teleportId: 0,
  start: () => set({ started: true, phase: 'ORIENTATION' }),
  togglePause: () => set((s) => ({ paused: !s.paused, memoryOpen: false })),
  toggleMute: () => set((s) => ({ muted: !s.muted })),
  toggleMemory: () => set((s) => ({ memoryOpen: !s.memoryOpen, memorySeen: true, paused: false })),
  toggleDebug: () => set((s) => ({ debug: !s.debug })),
  setPhase: (phase) => set({ phase, systemHint: null }),
  setCrossingState: (crossingState) => set({ crossingState }),
  setPlayerPosition: (playerPosition) => set({ playerPosition }),
  setPlayerYaw: (playerYaw) => set({ playerYaw }),
  setPointerLocked: (pointerLocked) => set({ pointerLocked }),
  setAudioReady: (audioReady) => set({ audioReady }),
  requestTeleport: (teleportTarget) => set((s) => ({ teleportTarget, teleportId: s.teleportId + 1 })),
  discover: (id, confidence, sense, memory) => set((s) => {
    const prior = s.discoveries[id]
    const discoveries = prior?.confidence && prior.confidence >= confidence
      ? s.discoveries
      : { ...s.discoveries, [id]: { confidence, sense } }
    const memories = memory && !s.memories.some((item) => item.id === id)
      ? [...s.memories, { id, text: memory }]
      : s.memories
    return { discoveries, memories }
  }),
  showSubtitle: (subtitle, duration = 2600) => {
    window.clearTimeout(subtitleTimer)
    set({ subtitle })
    subtitleTimer = window.setTimeout(() => {
      if (get().subtitle === subtitle) set({ subtitle: null })
    }, duration)
  },
  showHint: (hint) => set({ hint }),
  showSystemHint: (title, text, duration = 9000) => {
    set({ systemHint: { title, text } })
    window.setTimeout(() => {
      const current = get().systemHint
      if (current?.title === title && current.text === text) set({ systemHint: null })
    }, duration)
  },
  emitPulse: (position, sense, radius = 7) => {
    const id = ++pulseId
    set((s) => ({ pulses: [...s.pulses.slice(-7), { id, position, sense, radius }] }))
    window.setTimeout(() => set((s) => ({ pulses: s.pulses.filter((p) => p.id !== id) })), 1900)
  },
  openDialogue: (id, speaker, lines) => set({ dialogue: { id, speaker, lines, index: 0 } }),
  advanceDialogue: () => set((s) => {
    if (!s.dialogue) return {}
    if (s.dialogue.index >= s.dialogue.lines.length - 1) return { dialogue: null }
    return { dialogue: { ...s.dialogue, index: s.dialogue.index + 1 } }
  }),
  closeDialogue: () => set({ dialogue: null }),
  triggerEnding: () => set({ phase: 'ENDING', endingTriggered: true, memoryOpen: false, paused: false }),
  restart: () => {
    window.location.reload()
  },
}))
