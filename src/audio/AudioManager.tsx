import { useEffect } from 'react'
import { useGameStore } from '../state/gameStore'
import { getAudioContext, noiseBuffer } from './audioEngine'

type AudioKind = 'tick' | 'locator' | 'bird' | 'bell' | 'steps' | 'leaves' | 'turning' | 'child' | 'conversation' | 'elevator' | 'bike' | 'horn' | 'dog' | 'vendor' | 'scooter' | 'door' | 'keys' | 'bus'

export function AudioManager() {
  useEffect(() => {
    const ctx = getAudioContext()
    if (!ctx) return
    let disposed = false
    let eventTimer = 0

    const wakeAudio = () => {
      if (ctx.state === 'running') {
        useGameStore.getState().setAudioReady(true)
        return
      }
      void ctx.resume().then(() => useGameStore.getState().setAudioReady(ctx.state === 'running')).catch(() => undefined)
    }
    wakeAudio()
    window.addEventListener('pointerdown', wakeAudio)
    window.addEventListener('keydown', wakeAudio)

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
    const tireHiss = makeAmbience(0.7, 'bandpass', 1480, 0.08)
    const manyVoices = makeAmbience(0.67, 'bandpass', 880, -0.12)
    const kitchenVent = makeAmbience(0.94, 'bandpass', 360, -0.62)
    const buildingHum = makeAmbience(0.99, 'lowpass', 120, 0.45)

    const makeEngine = (frequency: number, pan: number) => {
      const oscillator = ctx.createOscillator()
      const filter = ctx.createBiquadFilter()
      const gain = ctx.createGain()
      const panner = ctx.createStereoPanner()
      oscillator.type = 'sawtooth'
      oscillator.frequency.value = frequency
      filter.type = 'lowpass'
      filter.frequency.value = 170
      gain.gain.value = 0.0001
      panner.pan.value = pan
      oscillator.connect(filter).connect(gain).connect(panner).connect(ctx.destination)
      oscillator.start()
      return { oscillator, gain, panner }
    }
    const engineNear = makeEngine(58, -0.35)
    const engineFar = makeEngine(74, 0.42)

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
      const duration = kind === 'leaves' ? 0.8 : kind === 'bus' ? 0.9 : kind === 'dog' ? 0.62 : 0.42
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
      gain.connect(panner).connect(ctx.destination)

      if (kind === 'leaves' || kind === 'steps' || kind === 'turning' || kind === 'conversation' || kind === 'vendor' || kind === 'bus') {
        const sourceNode = ctx.createBufferSource()
        const filter = ctx.createBiquadFilter()
        sourceNode.buffer = noiseBuffer(ctx, duration, kind === 'turning' || kind === 'bus' ? 0.92 : 0.7)
        filter.type = kind === 'turning' || kind === 'bus' ? 'lowpass' : 'bandpass'
        filter.frequency.value = kind === 'turning' ? 760 : kind === 'bus' ? 310 : kind === 'steps' ? 320 : kind === 'conversation' || kind === 'vendor' ? 680 : 2200
        sourceNode.connect(filter).connect(gain)
        sourceNode.start()
        return
      }

      const osc = ctx.createOscillator()
      osc.type = kind === 'bird' || kind === 'dog' ? 'sine' : kind === 'horn' || kind === 'scooter' ? 'sawtooth' : 'square'
      const frequency = kind === 'tick' ? 920
        : kind === 'locator' ? 430
          : kind === 'bell' ? 680
            : kind === 'elevator' ? 790
              : kind === 'bike' ? 1480
                : kind === 'child' ? 1180
                  : kind === 'horn' ? 390
                    : kind === 'dog' ? 510
                      : kind === 'scooter' ? 165
                        : kind === 'door' ? 240
                          : kind === 'keys' ? 1820
                            : 1380
      osc.frequency.setValueAtTime(frequency, ctx.currentTime)
      if (kind === 'bird') osc.frequency.exponentialRampToValueAtTime(1960, ctx.currentTime + 0.12)
      if (kind === 'child') osc.frequency.linearRampToValueAtTime(1480, ctx.currentTime + 0.16)
      if (kind === 'elevator') osc.frequency.exponentialRampToValueAtTime(590, ctx.currentTime + 0.34)
      if (kind === 'horn') osc.frequency.linearRampToValueAtTime(350, ctx.currentTime + 0.32)
      if (kind === 'dog') osc.frequency.exponentialRampToValueAtTime(310, ctx.currentTime + 0.18)
      if (kind === 'scooter') osc.frequency.linearRampToValueAtTime(230, ctx.currentTime + 0.38)
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
      trafficGain.gain.setTargetAtTime(muted ? 0.0001 : (nearRoad ? 0.076 : 0.025) * crossingBoost, ctx.currentTime, 0.2)
      cityGain.gain.setTargetAtTime(muted ? 0.0001 : nearRoad ? 0.03 : 0.038, ctx.currentTime, 0.25)
      trafficPan.pan.setTargetAtTime(spatialPan([25, -25]), ctx.currentTime, 0.15)
      wind.gain.gain.setTargetAtTime(muted ? 0.0001 : nearRoad ? 0.02 : 0.012, ctx.currentTime, 0.3)
      crowd.gain.gain.setTargetAtTime(muted ? 0.0001 : nearBusStop ? 0.026 : bakeryDistance < 15 ? 0.018 : 0.009, ctx.currentTime, 0.3)
      crowd.panner.pan.setTargetAtTime(spatialPan([-4.5, 18]), ctx.currentTime, 0.2)
      residential.gain.gain.setTargetAtTime(muted ? 0.0001 : inResidential ? 0.03 : 0.003, ctx.currentTime, 0.35)
      residential.panner.pan.setTargetAtTime(spatialPan([18, -43]), ctx.currentTime, 0.2)
      bakeryVent.gain.gain.setTargetAtTime(muted ? 0.0001 : bakeryDistance < 12 ? 0.024 * (1 - bakeryDistance / 16) : 0.0001, ctx.currentTime, 0.25)
      bakeryVent.panner.pan.setTargetAtTime(spatialPan([24, 2]), ctx.currentTime, 0.2)
      tireHiss.gain.gain.setTargetAtTime(muted ? 0.0001 : (nearRoad ? 0.042 : 0.008) * crossingBoost, ctx.currentTime, 0.18)
      tireHiss.panner.pan.setTargetAtTime(spatialPan([25, -25]), ctx.currentTime, 0.15)
      manyVoices.gain.gain.setTargetAtTime(muted ? 0.0001 : nearBusStop ? 0.018 : z > -15 ? 0.012 : 0.006, ctx.currentTime, 0.28)
      manyVoices.panner.pan.setTargetAtTime(spatialPan([1, 14]), ctx.currentTime, 0.2)
      kitchenVent.gain.gain.setTargetAtTime(muted ? 0.0001 : Math.hypot(x + 12, z - 4) < 17 ? 0.025 : 0.0001, ctx.currentTime, 0.3)
      kitchenVent.panner.pan.setTargetAtTime(spatialPan([-12, 4]), ctx.currentTime, 0.2)
      buildingHum.gain.gain.setTargetAtTime(muted ? 0.0001 : inResidential ? 0.019 : 0.002, ctx.currentTime, 0.35)
      buildingHum.panner.pan.setTargetAtTime(spatialPan([18, -53]), ctx.currentTime, 0.2)
      engineNear.gain.gain.setTargetAtTime(muted ? 0.0001 : (nearRoad ? 0.026 : 0.004) * crossingBoost, ctx.currentTime, 0.18)
      engineFar.gain.gain.setTargetAtTime(muted ? 0.0001 : (nearRoad ? 0.018 : 0.003) * crossingBoost, ctx.currentTime, 0.18)
      engineNear.panner.pan.setTargetAtTime(spatialPan([12, -27]), ctx.currentTime, 0.12)
      engineFar.panner.pan.setTargetAtTime(spatialPan([39, -22]), ctx.currentTime, 0.12)
    }, 120)

    const eventTick = () => {
      if (disposed) return
      const state = useGameStore.getState()
      const [, , z] = state.playerPosition
      const nearCrossing = state.phase === 'CROSSING' || (z < -10 && z > -38)
      let delay = 900 + Math.random() * 650

      if (nearCrossing) {
        if (state.crossingState === 'PEDESTRIAN_PHASE') {
          tone('tick', [25, -18.5], 0.105)
          delay = 320
        } else {
          tone('locator', [25, -18.5], 0.04)
          if (state.crossingState === 'TURNING_VEHICLE') tone('turning', [33, -23], 0.095)
          if (state.crossingState === 'CROSS_TRAFFIC' && Math.random() > 0.58) tone('horn', [8 + Math.random() * 34, -25], 0.055)
          if (Math.random() > 0.62) tone('bus', [-5 + Math.random() * 45, -27], 0.05)
          delay = 720
        }
      } else if (z < -34) {
        tone('leaves', [18, -43], 0.06)
        if (Math.random() > 0.45) tone('bird', [34, -43], 0.04)
        if (z < -46 && Math.random() > 0.72) tone('elevator', [25, -55], 0.065)
        if (Math.random() > 0.62) tone('dog', [38, -45], 0.035)
        if (Math.random() > 0.72) tone('door', [18, -52], 0.04)
        if (Math.random() > 0.78) tone('keys', [14, -48], 0.025)
        delay = 1050
      } else {
        const pedestrianSources: Array<[number, number]> = [[3, 16], [-8, 5], [14, 11], [-4, 28], [18, -8]]
        const footSource = pedestrianSources[Math.floor(Math.random() * pedestrianSources.length)]
        tone('steps', footSource, 0.05)
        if (Math.random() > 0.48) tone('conversation', [-3 + Math.random() * 18, 12], 0.036)
        if (Math.random() > 0.76) tone('vendor', [-12, 4], 0.034)
        if (z > 18 && Math.random() > 0.68) tone('bike', [1, 27], 0.04)
        if (Math.random() > 0.76) tone('scooter', [8, 20], 0.035)
        if (z < 8 && z > -12 && Math.random() > 0.68) tone('child', [-25, -4], 0.03)
        if (state.phase === 'BAKERY' && Math.random() > 0.5) tone('bell', [24, 2], 0.075)
      }
      eventTimer = window.setTimeout(eventTick, delay)
    }
    eventTick()

    return () => {
      disposed = true
      window.clearTimeout(eventTimer)
      window.clearInterval(updateAmbience)
      window.removeEventListener('pointerdown', wakeAudio)
      window.removeEventListener('keydown', wakeAudio)
      try {
        trafficSource.stop()
        citySource.stop()
        wind.source.stop()
        crowd.source.stop()
        residential.source.stop()
        bakeryVent.source.stop()
        tireHiss.source.stop()
        manyVoices.source.stop()
        kitchenVent.source.stop()
        buildingHum.source.stop()
        engineNear.oscillator.stop()
        engineFar.oscillator.stop()
      } catch {
        // Sources can already be stopped during development remounts.
      }
    }
  }, [])
  return null
}
