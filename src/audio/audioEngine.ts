import { useGameStore } from '../state/gameStore'

let sharedContext: AudioContext | null = null

export function getAudioContext() {
  if (sharedContext) return sharedContext
  try {
    sharedContext = new AudioContext()
  } catch {
    sharedContext = null
  }
  return sharedContext
}

export function unlockAudio() {
  const ctx = getAudioContext()
  if (!ctx) return
  const markReady = () => useGameStore.getState().setAudioReady(ctx.state === 'running')
  if (ctx.state === 'running') markReady()
  else void ctx.resume().then(markReady).catch(() => undefined)
  try {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    oscillator.connect(gain).connect(ctx.destination)
    oscillator.start()
    oscillator.stop(ctx.currentTime + 0.025)
  } catch {
    // Audio is an enhancement; the game remains playable with subtitles.
  }
}

export function noiseBuffer(ctx: AudioContext, duration: number, smooth = 0.8) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < data.length; i++) {
    last = last * smooth + (Math.random() * 2 - 1) * (1 - smooth)
    data[i] = last
  }
  return buffer
}

export type CaneMaterial = 'ground' | 'tactile' | 'metal' | 'curb' | 'door' | 'plastic' | 'cardboard' | 'ceramic' | 'wood' | 'wall'

export function playCaneTap(material: CaneMaterial) {
  const state = useGameStore.getState()
  const ctx = getAudioContext()
  if (!ctx || state.muted) return
  const frequencies: Record<CaneMaterial, number> = {
    ground: 180, tactile: 460, metal: 1280, curb: 310, door: 220,
    plastic: 720, cardboard: 125, ceramic: 980, wood: 245, wall: 165,
  }
  const durations: Record<CaneMaterial, number> = {
    ground: 0.11, tactile: 0.08, metal: 0.34, curb: 0.16, door: 0.25,
    plastic: 0.13, cardboard: 0.09, ceramic: 0.22, wood: 0.18, wall: 0.12,
  }
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const filter = ctx.createBiquadFilter()
  osc.type = material === 'metal' || material === 'ceramic' ? 'triangle' : material === 'plastic' ? 'square' : 'sine'
  osc.frequency.setValueAtTime(frequencies[material], now)
  if (material === 'metal') osc.frequency.exponentialRampToValueAtTime(760, now + durations[material])
  if (material === 'ceramic') osc.frequency.exponentialRampToValueAtTime(610, now + durations[material])
  filter.type = 'bandpass'
  filter.frequency.value = frequencies[material]
  filter.Q.value = material === 'metal' || material === 'ceramic' ? 8 : material === 'cardboard' ? 0.7 : 2
  gain.gain.setValueAtTime(material === 'metal' ? 0.13 : material === 'cardboard' ? 0.055 : 0.085, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durations[material])
  osc.connect(filter).connect(gain).connect(ctx.destination)
  osc.start(now)
  osc.stop(now + durations[material] + 0.02)

  if (material === 'cardboard' || material === 'plastic' || material === 'ground') {
    const transient = ctx.createBufferSource()
    const transientGain = ctx.createGain()
    const transientFilter = ctx.createBiquadFilter()
    transient.buffer = noiseBuffer(ctx, 0.11, material === 'cardboard' ? 0.45 : 0.72)
    transientFilter.type = 'lowpass'
    transientFilter.frequency.value = material === 'cardboard' ? 520 : material === 'plastic' ? 1800 : 760
    transientGain.gain.setValueAtTime(0.055, now)
    transientGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1)
    transient.connect(transientFilter).connect(transientGain).connect(ctx.destination)
    transient.start(now)
  }
}

export function playImpact(kind: 'person' | 'object' | 'vehicle' | 'fall') {
  const ctx = getAudioContext()
  if (!ctx || useGameStore.getState().muted) return
  const now = ctx.currentTime
  const noise = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  noise.buffer = noiseBuffer(ctx, kind === 'fall' ? 0.75 : 0.38, kind === 'vehicle' ? 0.88 : 0.56)
  filter.type = 'lowpass'
  filter.frequency.value = kind === 'person' ? 520 : kind === 'vehicle' ? 1150 : kind === 'fall' ? 260 : 740
  gain.gain.setValueAtTime(kind === 'vehicle' ? 0.2 : kind === 'fall' ? 0.16 : 0.1, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === 'fall' ? 0.72 : 0.34))
  noise.connect(filter).connect(gain).connect(ctx.destination)
  noise.start(now)

  const tone = ctx.createOscillator()
  const toneGain = ctx.createGain()
  tone.type = kind === 'vehicle' ? 'sawtooth' : 'sine'
  tone.frequency.setValueAtTime(kind === 'vehicle' ? 430 : kind === 'person' ? 150 : 95, now)
  if (kind === 'vehicle') tone.frequency.linearRampToValueAtTime(520, now + 0.28)
  toneGain.gain.setValueAtTime(kind === 'vehicle' ? 0.12 : 0.055, now)
  toneGain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === 'vehicle' ? 0.5 : 0.25))
  tone.connect(toneGain).connect(ctx.destination)
  tone.start(now)
  tone.stop(now + 0.55)
}

export function playOpeningBus() {
  const ctx = getAudioContext()
  if (!ctx || useGameStore.getState().muted) return
  const now = ctx.currentTime
  const source = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  source.buffer = noiseBuffer(ctx, 5.4, 0.94)
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(260, now)
  filter.frequency.linearRampToValueAtTime(620, now + 4.4)
  gain.gain.setValueAtTime(0.12, now)
  gain.gain.setValueAtTime(0.1, now + 3.4)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 5.3)
  source.connect(filter).connect(gain).connect(ctx.destination)
  source.start(now)

  const brake = ctx.createOscillator()
  const brakeGain = ctx.createGain()
  brake.type = 'sine'
  brake.frequency.setValueAtTime(1450, now + 0.7)
  brake.frequency.exponentialRampToValueAtTime(420, now + 1.45)
  brakeGain.gain.setValueAtTime(0.0001, now)
  brakeGain.gain.setValueAtTime(0.045, now + 0.7)
  brakeGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5)
  brake.connect(brakeGain).connect(ctx.destination)
  brake.start(now)
  brake.stop(now + 1.6)
}
