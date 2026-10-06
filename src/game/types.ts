export type SenseType = 'touch' | 'sound' | 'smell' | 'taste' | 'conversation' | 'memory'

export type GamePhase =
  | 'ARRIVAL'
  | 'ORIENTATION'
  | 'BLIND_PATH'
  | 'BUS_STOP'
  | 'BAKERY'
  | 'CROSSING'
  | 'RESIDENTIAL'
  | 'HOME'
  | 'ENDING'

export type DiscoveryState = {
  confidence: number
  sense: SenseType
}

export type MemoryEntry = {
  id: string
  text: string
}

export type DialogueState = {
  id: string
  speaker: string
  lines: string[]
  index: number
}

export type Pulse = {
  id: number
  position: [number, number, number]
  sense: SenseType
  radius: number
}

export type CrossingState =
  | 'CROSS_TRAFFIC'
  | 'ALL_RED'
  | 'TURNING_VEHICLE'
  | 'PEDESTRIAN_PHASE'
  | 'CLEARANCE'

export type SystemHint = {
  title: string
  text: string
}
