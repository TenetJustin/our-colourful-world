import { useEffect } from 'react'
import { useGameStore } from '../state/gameStore'

type WebMCPTool = {
  name: string
  title: string
  description: string
  inputSchema: object
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }
  execute: (input: unknown) => unknown
}

type ModelContext = {
  registerTool: (tool: WebMCPTool, options?: { signal: AbortSignal }) => void | Promise<void>
}

export function WebMCPBridge() {
  useEffect(() => {
    const modelContext = (document as Document & { modelContext?: ModelContext }).modelContext
    if (!modelContext?.registerTool) return
    const lifecycle = new AbortController()
    const register = async () => {
      await modelContext.registerTool({
        name: 'read_game_progress',
        title: 'Read Our Colourful World progress',
        description: 'Read the current story phase and discovered sensory landmarks without changing the game.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: () => {
          const state = useGameStore.getState()
          return {
            phase: state.phase,
            discoveries: Object.fromEntries(Object.entries(state.discoveries).map(([id, item]) => [id, item.confidence])),
            memoryCount: state.memories.length,
            endingTriggered: state.endingTriggered,
          }
        },
      }, { signal: lifecycle.signal })
      await modelContext.registerTool({
        name: 'start_game',
        title: 'Start Our Colourful World',
        description: 'Start the game from its opening screen, matching the visible Start action.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: () => {
          const state = useGameStore.getState()
          if (!state.started) state.start()
          return { started: true, phase: useGameStore.getState().phase }
        },
      }, { signal: lifecycle.signal })
    }
    void register().catch(() => undefined)
    return () => lifecycle.abort()
  }, [])
  return null
}
