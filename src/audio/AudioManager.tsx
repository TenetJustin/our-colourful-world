import { useEffect } from 'react'
import { useGameStore } from '../state/gameStore'
import { getAudioContext, noiseBuffer } from './audioEngine'

type AudioKind = 'tick' | 'locator' | 'bird' | 'bell' | 'steps' | 'leaves' | 'turning' | 'child' | 'conversation' | 'elevator' | 'bike'

export function AudioManager() {
  useEffect(() => {
    const ctx = getAudioContext()
    if (!ctx) return
    let disposed = false
    let eventTimer = 0

    const trafficSource = ctx.createBufferSource()
    const trafficFilter = ctx.createBiquadFilter()
    const trafficGain = ctx.createGain()
    const trafficPan = ctx.createStereoPanner()
    trafficSource.buffer = noiseBuffer(ctx, 4, 0.965)
    trafficSource.loop = true
    trafficFilter.type = 'lowpass'
    trafficFilter.frequency.value = 540
    trafficGain.gain.value = 0.0001
    trafficSource.connect(trafficFilter).connect(trafficGain).connect(trafficPan).connect(ctx.destination)
    trafficSource.start()

    const citySource = ctx.createBufferSource()
    const cityFilter = ctx.createBiquadFilter()
    const cityGain = ctx.createGain()
    citySource.buffer = noiseBuffer(ctx, 3, 0.82)
    citySource.loop = true
    cityFilter.type = 'bandpass'
    cityFilter.frequency.value = 1050
    cityFilter.Q.value = 0.4
    cityGain.gain.value = 0.0001
    citySource.connect(cityFilter).connect(cityGain).connect(ctx.destination)
    citySource.start()

    const makeAmbience = (smooth: number, filterType: BiquadFilterType, frequency: number, pan = 0) => {
      const source = ctx.createBufferSource()
      const filter = ctx.createBiquadFilter()
      const gain = ctx.createGain()
      const panner = ctx.createStereoPanner()
      source.buffer = noiseBuffer(ctx, 4.5, smooth)
      source.loop = true
      filter.type = filterType
      filter.frequency.value = frequency
      filter.Q.value = 0.55
      gain.gain.value = 0.0001
      panner.pan.value = pan
      source.connect(filter).connect(gain).connect(panner).connect(ctx.destination)
      source.start()
      return { source, gain, panner }
    }

    const wind = makeAmbience(0.985, 'highpass', 260, -0.18)
    const crowd = makeAmbience(0.76, 'bandpass', 680, -0.5)
    const residential = makeAmbience(0.9, 'highpass', 1750, 0.3)
    const bakeryVent = makeAmbience(0.975, 'lowpass', 190, 0.55)

    const spatialPan = (source: [number, number]) => {
      const state = useGameStore.getState()
      const [px, , pz] = state.playerPosition
      const angle = Math.atan2(source[0] - px, -(source[1] - pz))
      return Math.max(-1, Math.min(1, Math.sin(angle - state.playerYaw)))
    }

    const tone = (kind: AudioKind, source: [number, number], volume = 0.07) => {
      const state = useGameStore.getState()
      if (state.muted || state.paused || state.endingTriggered || ctx.state !== 'running') return
      const [px, , pz] = state.playerPosition
      const distance = Math.max(1, Math.hypot(source[0] - px, source[1] - pz))
      const attenuation = Math.max(0.22, Math.min(1, 22 / distance))
      const gain = ctx.createGain()
      const panner = ctx.createStereoPanner()
      panner.pan.setValueAtTime(spatialPan(source), ctx.currentTime)
      gain.gain.setValueAtTime(0.0001, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume * attenuation), ctx.currentTime + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (kind === 'leaves' ? 0.8 : 0.42))
      gain.connect(panner).connect(ctx.destination)

      if (kind === 'leaves' || kind === 'steps' || kind === 'turning' || kind === 'conversation') {
        const sourceNode = ctx.createBufferSource()
        const filter = ctx.createBiquadFilter()
        sourceNode.buffer = noiseBuffer(ctx, kind === 'leaves' ? 0.8 : kind === 'conversation' ? 0.7 : 0.45, kind === 'turning' ? 0.92 : 0.7)
        filter.type = kind === 'turning' ? 'lowpass' : 'bandpass'
        filter.frequency.value = kind === 'turning' ? 760 : kind === 'steps' ? 320 : kind === 'conversation' ? 620 : 2200
        sourceNode.connect(filter).connect(gain)
        sourceNode.start()
        return
      }

      const osc = ctx.createOscillator()
      osc.type = kind === 'bird' ? 'sine' : 'square'
      const frequency = kind === 'tick' ? 920
        : kind === 'locator' ? 430
          : kind === 'bell' ? 680
            : kind === 'elevator' ? 790
              : kind === 'bike' ? 1480
                : kind === 'child' ? 1180
                  : 1380
      osc.frequency.setValueAtTime(frequency, ctx.currentTime)
      if (kind === 'bird') osc.frequency.exponentialRampToValueAtTime(1960, ctx.currentTime + 0.12)
      if (kind === 'child') osc.frequency.linearRampToValueAtTime(1480, ctx.currentTime + 0.16)
      if (kind === 'elevator') osc.frequency.exponentialRampToValueAtTime(590, ctx.currentTime + 0.34)
      osc.connect(gain)
      osc.start()
      osc.stop(ctx.currentTime + 0.45)
    }

    const updateAmbience = window.setInterval(() => {
      const state = useGameStore.getState()
      const muted = state.muted || state.paused || state.endingTriggered || ctx.state !== 'running'
      const [x, , z] = state.playerPosition
      const nearRoad = z > -36
      const bakeryDistance = Math.hypot(x - 22, z - 5)
      const nearBusStop = Math.hypot(x + 4.5, z - 18) < 15
      const inResidential = z < -34
      const crossingBoost = state.phase !== 'CROSSING'
        ? 1
        : state.crossingState === 'CROSS_TRAFFIC'
          ? 1.35
          : state.crossingState === 'ALL_RED'
            ? 0.22
            : state.crossingState === 'TURNING_VEHICLE'
              ? 0.5
              : state.crossingState === 'PEDESTRIAN_PHASE'
                ? 0.74
                : 0.34
      trafficGain.gain.setTargetAtTime(muted ? 0.0001 : (nearRoad ? 0.052 : 0.014) * crossingBoost, ctx.currentTime, 0.2)
      cityGain.gain.setTargetAtTime(muted ? 0.0001 : nearRoad ? 0.018 : 0.027, ctx.currentTime, 0.25)
      trafficPan.pan.setTargetAtTime(spatialPan([25, -25]), ctx.currentTime, 0.15)
      wind.gain.gain.setTargetAtTime(muted ? 0.0001 : nearRoad ? 0.014 : 0.008, ctx.currentTime, 0.3)
      crowd.gain.gain.setTargetAtTime(muted ? 0.0001 : nearBusStop ? 0.013 : bakeryDistance < 15 ? 0.008 : 0.0025, ctx.currentTime, 0.3)
      crowd.panner.pan.setTargetAtTime(spatialPan([-4.5, 18]), ctx.currentTime, 0.2)
      residential.gain.gain.setTargetAtTime(muted ? 0.0001 : inResidential ? 0.022 : 0.001, ctx.currentTime, 0.35)
      residential.panner.pan.setTargetAtTime(spatialPan([18, -43]), ctx.currentTime, 0.2)
      bakeryVent.gain.gain.setTargetAtTime(muted ? 0.0001 : bakeryDistance < 12 ? 0.024 * (1 - bakeryDistance / 16) : 0.0001, ctx.currentTime, 0.25)
      bakeryVent.panner.pan.setTargetAtTime(spatialPan([24, 2]), ctx.currentTime, 0.2)
    }, 120)

    const eventTick = () => {
      if (disposed) return
      const state = useGameStore.getState()
      const [, , z] = state.playerPosition
      const nearCrossing = state.phase === 'CROSSING' || (z < -10 && z > -38)
      let delay = 1800

      if (nearCrossing) {
        if (state.crossingState === 'PEDESTRIAN_PHASE') {
          tone('tick', [25, -18.5], 0.105)
          delay = 320
        } else {
          tone('locator', [25, -18.5], 0.04)
          if (state.crossingState === 'TURNING_VEHICLE') tone('turning', [33, -23], 0.095)
          delay = 1000
        }
      } else if (z < -34) {
        tone('leaves', [18, -43], 0.06)
        if (Math.random() > 0.45) tone('bird', [34, -43], 0.04)
        if (z < -46 && Math.random() > 0.72) tone('elevator', [25, -55], 0.065)
        delay = 1450
      } else {
        if (Math.random() > 0.58) tone('steps', [3, 16], 0.05)
        if (Math.random() > 0.76) tone('conversation', [-3, 17], 0.032)
        if (z > 22 && Math.random() > 0.82) tone('bike', [1, 27], 0.035)
        if (z < 8 && z > -12 && Math.random() > 0.78) tone('child', [-25, -4], 0.028)
        if (state.phase === 'BAKERY' && Math.random() > 0.5) tone('bell', [24, 2], 0.075)
      }
      eventTimer = window.setTimeout(eventTick, delay)
    }
    eventTick()

    return () => {
      disposed = true
      window.clearTimeout(eventTimer)
      window.clearInterval(updateAmbience)
      try {
        trafficSource.stop()
        citySource.stop()
        wind.source.stop()
        crowd.source.stop()
        residential.source.stop()
        bakeryVent.source.stop()
      } catch {
        // Sources can already be stopped during development remounts.
      }
    }
  }, [])
  return null
}
