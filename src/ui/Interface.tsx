import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useGameStore } from '../state/gameStore'
import { requestGamePointerLock } from '../game/pointerLock'
import { playOpeningBus, unlockAudio } from '../audio/audioEngine'

function StartSequence() {
  const started = useGameStore((s) => s.started)
  const start = useGameStore((s) => s.start)
  const [sequence, setSequence] = useState(false)
  const [step, setStep] = useState(0)

  const begin = useCallback(() => {
    // Enter the game before trying optional browser capabilities. GPT's embedded
    // browser may reject audio or pointer-lock requests, but that must never
    // prevent the opening screen from closing.
    start()
    setSequence(true)
    try { unlockAudio() } catch { /* Audio can be enabled again in-game. */ }
    try { playOpeningBus() } catch { /* Keep the visual flow playable. */ }
  }, [start])

  useEffect(() => {
    if (started || sequence) return
    const handleStartKey = (event: KeyboardEvent) => {
      if (event.code !== 'Enter' && event.code !== 'Space') return
      event.preventDefault()
      begin()
    }
    window.addEventListener('keydown', handleStartKey)
    return () => window.removeEventListener('keydown', handleStartKey)
  }, [begin, sequence, started])

  useEffect(() => {
    if (!sequence) return
    const timings = [700, 1750, 3100, 4300, 5400]
    const timers = timings.map((time, index) => window.setTimeout(() => setStep(index + 1), time))
    const complete = window.setTimeout(() => setSequence(false), 5800)
    return () => { timers.forEach(window.clearTimeout); window.clearTimeout(complete) }
  }, [sequence])

  if (started && !sequence) return null
  if (sequence) {
    const lines = ['公交发动机在身后低鸣。', '刹车。车门嘶——地打开。', '司机：“前面施工，今天只能停这儿了。”', '车门合上。公交驶离。', '车流声留了下来。']
    return (
      <div className="arrival-sequence" aria-live="polite">
        <p className="sequence-kicker">榆安路 · 傍晚　{String(Math.min(step + 1, 5)).padStart(2, '0')} / 05</p>
        <p className="opening-line">{lines[Math.min(step, lines.length - 1)]}</p>
        <button className="skip-intro" onClick={() => setSequence(false)}>跳过开场</button>
      </div>
    )
  }
  return (
    <div className="opening">
      <div className="opening-mark" aria-hidden="true"><span /><span /><span /></div>
      <p className="eyebrow">A SENSORY JOURNEY</p>
      <h1>OUR COLOURFUL WORLD</h1>
      <p className="opening-copy">一段关于感知、判断与归途的第一人称体验</p>
      <button
        type="button"
        className="primary-action"
        data-testid="start-game"
        onClick={begin}
      >开始</button>
      <p className="start-alternative">也可按 Enter / Space 开始</p>
      <p className="headphone-note">建议佩戴耳机 · 空间声音是导航的一部分</p>
      <div className="controls-preview">
        <span><b>WASD</b> 移动</span>
        <span><b>鼠标</b> 环顾</span>
        <span><b>SPACE</b> 白杖</span>
        <span><b>E</b> 询问</span>
        <span><b>TAB</b> 回想</span>
      </div>
    </div>
  )
}

function MemoryPanel() {
  const open = useGameStore((s) => s.memoryOpen)
  const toggle = useGameStore((s) => s.toggleMemory)
  const memories = useGameStore((s) => s.memories)
  const discoveries = useGameStore((s) => s.discoveries)
  if (!open) return null
  const bakery = discoveries.bakery?.confidence ?? 0
  const crossing = discoveries.crossing?.confidence ?? discoveries['crossing-space']?.confidence ?? 0
  const home = discoveries['home-building']?.confidence ?? 0
  return (
    <section className="memory-panel" aria-label="我知道的信息">
      <button className="close-button" onClick={toggle}>关闭 <kbd>Tab</kbd></button>
      <div className="memory-layout">
        <div>
          <p className="eyebrow">WHAT I KNOW</p>
          <h2>我知道的</h2>
          <ol className="memory-list">
            {memories.map((memory) => <li key={memory.id}>{memory.text}</li>)}
          </ol>
        </div>
        <div className="mental-map" aria-label="不完整的认知地图">
          <p className="map-caption">认知地图 · 不是实时位置</p>
          <div className="map-route">
            <div className="map-node confirmed"><span>起点</span><small>公交临时停靠</small></div>
            <div className="map-line" />
            <div className={`map-node ${bakery >= 1 ? 'confirmed' : bakery > 0 ? 'suspected' : 'unknown'}`}><span>{bakery >= 1 ? '面包店' : '面包店？'}</span><small>烘烤气味</small></div>
            <div className="map-line" />
            <div className={`map-node ${crossing > 0.5 ? 'confirmed' : crossing > 0 ? 'suspected' : 'unknown'}`}><span>十字路口{crossing > 0.5 ? '' : '？'}</span><small>车流与提示音</small></div>
            <div className="map-line" />
            <div className={`map-node ${home > 0.8 ? 'confirmed' : 'unknown'}`}><span>家{home > 0.8 ? '' : '？'}</span><small>树叶 · 砖面 · 电梯</small></div>
          </div>
          <div className="map-legend"><i className="legend-confirmed" />确认 <i className="legend-suspected" />推测 <i />未知</div>
        </div>
      </div>
    </section>
  )
}

function Dialogue() {
  const dialogue = useGameStore((s) => s.dialogue)
  const advance = useGameStore((s) => s.advanceDialogue)
  if (!dialogue) return null
  return (
    <button className="dialogue" onClick={advance} aria-label="继续对话">
      <span className="dialogue-speaker">{dialogue.speaker}</span>
      <span className="dialogue-line">{dialogue.lines[dialogue.index]}</span>
      <span className="dialogue-continue">E / Enter · 继续</span>
    </button>
  )
}

function Pause() {
  const paused = useGameStore((s) => s.paused)
  const togglePause = useGameStore((s) => s.togglePause)
  const muted = useGameStore((s) => s.muted)
  const toggleMute = useGameStore((s) => s.toggleMute)
  const restart = useGameStore((s) => s.restart)
  if (!paused) return null
  const resume = () => {
    unlockAudio()
    togglePause()
    requestGamePointerLock()
  }
  return (
    <section className="pause-panel">
      <p className="eyebrow">PAUSED</p>
      <h2>OUR COLOURFUL WORLD</h2>
      <button onClick={resume}>继续</button>
      <button onClick={() => {
        if (muted) unlockAudio()
        toggleMute()
      }}>声音 · {muted ? '关闭' : '开启'}</button>
      <button onClick={restart}>重新开始</button>
    </section>
  )
}

function VisionVeil() {
  const started = useGameStore((s) => s.started)
  const ending = useGameStore((s) => s.endingTriggered)
  const lastTouch = useGameStore((s) => [...s.pulses].reverse().find((pulse) => pulse.sense === 'touch'))
  if (!started || ending) return null
  return <div key={lastTouch?.id ?? 0} className={`vision-veil ${lastTouch ? 'is-revealing' : ''}`} aria-hidden="true" />
}

function SystemAssistance() {
  const hint = useGameStore((s) => s.systemHint)
  if (!hint) return null
  return (
    <aside className="system-assistance" aria-live="polite">
      <span>{hint.title}</span>
      <p>{hint.text}</p>
    </aside>
  )
}

function SoundStatus() {
  const started = useGameStore((s) => s.started)
  const ready = useGameStore((s) => s.audioReady)
  const muted = useGameStore((s) => s.muted)
  const toggleMute = useGameStore((s) => s.toggleMute)
  if (!started) return null
  return (
    <button className={`sound-status ${ready && !muted ? 'is-ready' : ''}`} onClick={() => {
      if (muted) toggleMute()
      unlockAudio()
    }}>
      {muted ? '声音已关闭' : ready ? '声音已开启' : '点击开启声音'}
    </button>
  )
}

function ContinuousSenses() {
  const started = useGameStore((s) => s.started)
  const ending = useGameStore((s) => s.endingTriggered)
  const paused = useGameStore((s) => s.paused)
  const phase = useGameStore((s) => s.phase)
  const [x, , z] = useGameStore((s) => s.playerPosition)
  if (!started || ending || paused) return null

  const bakeryDistance = Math.hypot(x - 22, z - 5)
  const smellStrength = Math.max(0, Math.min(1, 1 - bakeryDistance / 18))
  const tasteMemory = bakeryDistance < 6.5
  const nearCrossing = Math.abs(x - 25) < 11 && z < -10 && z > -38
  const nearBusStop = Math.hypot(x + 4.5, z - 18) < 15
  const ambient = nearCrossing
    ? '横向车流 · 定位音 · 转弯车辆'
    : z < -34 || phase === 'HOME'
      ? '树叶摩擦 · 鸟鸣 · 远处楼道声'
      : bakeryDistance < 18
        ? '街面风声 · 排风机 · 偶尔的门铃'
        : nearBusStop
          ? '公交怠速 · 候车脚步 · 远处交谈'
          : '持续车流 · 楼间风声 · 行人脚步'

  return (
    <div className="continuous-senses" style={{ '--smell-strength': smellStrength } as CSSProperties}>
      {smellStrength > 0 && <div className="smell-aura" aria-hidden="true" />}
      <aside className="sense-readout" aria-label="持续感官信息">
        <div><span>环境音</span><b>{ambient}</b></div>
        {smellStrength > 0 && <div className="is-smell"><span>嗅觉</span><b>{smellStrength > 0.62 ? '温热而清晰的烘烤甜味' : '风里持续有淡淡的烘烤气味'}</b></div>}
        {tasteMemory && <div className="is-taste"><span>味觉联想</span><b>奶油、焦糖和烤面包边的余味</b></div>}
      </aside>
    </div>
  )
}

function Ending() {
  const ending = useGameStore((s) => s.endingTriggered)
  const restart = useGameStore((s) => s.restart)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!ending) return
    document.exitPointerLock?.()
    const timer = window.setTimeout(() => setVisible(true), 700)
    return () => window.clearTimeout(timer)
  }, [ending])
  if (!ending) return null
  return (
    <section className={`ending ${visible ? 'is-visible' : ''}`}>
      <div className="home-outline" aria-hidden="true"><span /></div>
      <p className="ending-quote">熟悉一个地方，<br />从来不只是因为看见过它。</p>
      <h2>OUR COLOURFUL WORLD</h2>
      <button className="primary-action" onClick={restart}>重新开始</button>
    </section>
  )
}

function DebugPanel() {
  const debug = useGameStore((s) => s.debug)
  const phase = useGameStore((s) => s.phase)
  const position = useGameStore((s) => s.playerPosition)
  const crossing = useGameStore((s) => s.crossingState)
  const teleport = useGameStore((s) => s.requestTeleport)
  if (!debug) return null
  const checkpoints: Array<[string, [number, number, number]]> = [
    ['PATH', [0, 1.65, 36]],
    ['BUS', [2, 1.65, 17]],
    ['BAKERY', [21, 1.65, 4]],
    ['CROSS', [25, 1.65, -17]],
    ['SOUTH', [25, 1.65, -38]],
    ['HOME', [25, 1.65, -51]],
  ]
  return (
    <div className="debug-panel">
      PHASE {phase}<br />POS {position[0].toFixed(1)} / {position[2].toFixed(1)}<br />SIGNAL {crossing}
      <div className="debug-actions">
        {checkpoints.map(([label, target]) => <button key={label} onClick={() => teleport(target)}>TP {label}</button>)}
      </div>
    </div>
  )
}

export function Interface() {
  const started = useGameStore((s) => s.started)
  const subtitle = useGameStore((s) => s.subtitle)
  const hint = useGameStore((s) => s.hint)
  const caneUsed = useGameStore((s) => Boolean(s.discoveries['cane-used']))
  const memories = useGameStore((s) => s.memories.length)
  const memorySeen = useGameStore((s) => s.memorySeen)
  const phase = useGameStore((s) => s.phase)
  const pointerLocked = useGameStore((s) => s.pointerLocked)
  const paused = useGameStore((s) => s.paused)
  const ending = useGameStore((s) => s.endingTriggered)
  return (
    <div className="interface">
      <VisionVeil />
      <StartSequence />
      {started && <div className="phase-label">{phase.replace('_', ' ')}</div>}
      {started && !pointerLocked && !paused && !ending && <div className="mouse-look-hint">点击画面锁定鼠标 · 或按住拖动环顾</div>}
      {started && !caneUsed && <div className="context-hint tutorial-hint"><kbd>SPACE</kbd> · 用白杖探路</div>}
      {started && memories > 2 && !memorySeen && <div className="memory-hint"><kbd>TAB</kbd> · 回想已知信息</div>}
      {hint && <div className="context-hint">{hint}</div>}
      {subtitle && <div className="subtitle" role="status">{subtitle}</div>}
      <Dialogue />
      <MemoryPanel />
      <Pause />
      <Ending />
      <DebugPanel />
      <SystemAssistance />
      <SoundStatus />
      <ContinuousSenses />
      {started && <div className="reticle" aria-hidden="true" />}
    </div>
  )
}
