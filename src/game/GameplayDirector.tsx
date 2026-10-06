import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { useGameStore } from '../state/gameStore'
import type { CrossingState, GamePhase } from './types'

const systemHints: Record<GamePhase, [string, string]> = {
  ARRIVAL: ['先听一听环境，再按 SPACE 用白杖确认脚下。', '系统路线提示：面向前方沿盲道直行。'],
  ORIENTATION: ['按 SPACE 敲击白杖；规律的“嗒嗒”声表示脚下是盲道。', '系统路线提示：盲道就在你的脚下，沿当前朝向前进。'],
  BLIND_PATH: ['盲道可能反复被车辆、箱子或店外设施占用。先用白杖判断材质和宽度，再从侧面绕过，随后重新寻找条形凸起。', '系统路线提示：这一段需要多次短暂离开盲道；每次绕行后都回到原前进方向寻找规律的“嗒嗒”触感。'],
  BUS_STOP: ['附近有人。靠近声音轮廓，按 E 询问可获得可用路线信息。', '系统路线提示：能提供准确方向的人在公交站右侧。'],
  BAKERY: ['留意烘烤气味和门铃；它们能确认 NPC 提到的地标。', '系统路线提示：沿盲道向右，靠近暖色气味区域就是面包店。'],
  CROSSING: ['先用白杖确认警示铺装并对齐过街方向；不要把突然安静当成通行信号。', '系统路线提示：等待近处定位音变成连续急促声，并听见身侧平行车流同时起步，再沿盲道方向直行。'],
  RESIDENTIAL: ['车流已在身后。继续寻找砖面回声、树叶和导向盲道。', '系统路线提示：沿当前盲道继续直行，熟悉的住宅入口在前方。'],
  HOME: ['用白杖继续确认入口；熟悉的门是最后一个地标。', '系统路线提示：家门就在正前方，靠近后按 SPACE。'],
  ENDING: ['', ''],
}

export function GameplayDirector() {
  const elapsed = useRef(0)
  const crossingClock = useRef(0)
  const smellStage = useRef(0)
  const residentialStage = useRef(0)
  const lastPhase = useRef<GamePhase>('ARRIVAL')
  const lastDiscoveryCount = useRef(0)
  const stuckTime = useRef(0)
  const hintStage = useRef(0)

  useFrame((_, delta) => {
    elapsed.current += delta
    crossingClock.current = (crossingClock.current + delta) % 26
    const store = useGameStore.getState()
    if (!store.started || store.paused || store.memoryOpen || store.dialogue || store.endingTriggered) return
    const [x, , z] = store.playerPosition

    const discoveryCount = Object.keys(store.discoveries).length
    if (store.phase !== lastPhase.current || discoveryCount !== lastDiscoveryCount.current) {
      lastPhase.current = store.phase
      lastDiscoveryCount.current = discoveryCount
      stuckTime.current = 0
      hintStage.current = 0
    } else {
      stuckTime.current += delta
      const [gentle, direct] = systemHints[store.phase]
      if (stuckTime.current > 32 && hintStage.current === 0 && gentle) {
        hintStage.current = 1
        store.showSystemHint('辅助提示 · 感知方法', gentle)
      } else if (stuckTime.current > 68 && hintStage.current === 1 && direct) {
        hintStage.current = 2
        store.showSystemHint('辅助提示 · 系统路线', direct, 12000)
      }
    }

    const nextCrossing: CrossingState = crossingClock.current < 7
      ? 'CROSS_TRAFFIC'
      : crossingClock.current < 9
        ? 'ALL_RED'
        : crossingClock.current < 11
          ? 'TURNING_VEHICLE'
          : crossingClock.current < 20
            ? 'PEDESTRIAN_PHASE'
            : 'CLEARANCE'
    if (nextCrossing !== store.crossingState) {
      store.setCrossingState(nextCrossing)
      if (Math.abs(x - 25) < 10 && z < -10 && z > -38) {
        if (nextCrossing === 'PEDESTRIAN_PHASE') {
          store.showSubtitle('【近处】定位音变成急促连续声。身侧与过街方向平行的直行车流同时起步。', 4200)
          store.emitPulse([25, 1, -30], 'sound', 13)
        } else if (nextCrossing === 'ALL_RED') {
          store.showSubtitle('车流突然停了。这里只是短暂的全红清空期；安静本身不是通行信号。', 3800)
        } else if (nextCrossing === 'TURNING_VEHICLE') {
          store.showSubtitle('【右前方】一辆低速转弯车从路口绕过。继续在警示铺装后等待。', 3600)
          store.emitPulse([34, 0.7, -23], 'sound', 8)
        } else if (nextCrossing === 'CLEARANCE') {
          store.showSubtitle('急促声停止，定位音恢复。如果已经在路中，保持方向继续走到对面。', 4200)
        } else {
          store.showSubtitle('【左右两侧】横向车流重新变得密集。站在警示铺装后等待下一轮。')
        }
      }
    }

    if (z < 47 && store.phase === 'ORIENTATION') {
      store.setPhase('BLIND_PATH')
      store.showSubtitle('脚下似乎有一条略微凸起的路面。')
      store.discover('possible-path', 0.25, 'touch')
    }
    if (Math.hypot(x, z - 33) < 6 && !store.discoveries['bike-near']) {
      store.discover('bike-near', 0.25, 'sound')
      store.showSubtitle('【前方】有金属轻轻晃动了一下。')
      store.emitPulse([0, 0.8, 33], 'sound', 5)
    }
    if (Math.hypot(x + 4.5, z - 18) < 8 && store.phase === 'BLIND_PATH') {
      store.setPhase('BUS_STOP')
      store.showSubtitle('【左前方】一辆公交车靠站，雨棚下有人等候。')
      store.emitPulse([-4.5, 1, 18], 'sound', 10)
      store.discover('bus-stop-sound', 0.5, 'sound')
    }
    const bakeryDistance = Math.hypot(x - 22, z - 5)
    if (bakeryDistance < 13 && smellStage.current === 0) {
      smellStage.current = 1
      store.setPhase('BAKERY')
      store.showSubtitle('空气里有一点烘烤后的甜味。')
      store.emitPulse([22, 1, 5], 'smell', 10)
      store.discover('bakery', Math.max(0.5, store.discoveries.bakery?.confidence ?? 0), 'smell', '空气里的烘烤气味，可能来自那家面包店。')
    }
    if (bakeryDistance < 6 && smellStage.current < 2) {
      smellStage.current = 2
      store.showSubtitle('门铃轻响。面包。就是这里。')
      store.emitPulse([24, 1.5, 2], 'sound', 6)
      store.discover('bakery', 1, 'smell', '面包店已经确认。')
      store.discover('bakery-taste-memory', 0.6, 'taste', '持续的烘烤气味让我想起奶油、焦糖和烤面包边的味道。')
      store.emitPulse([23, 1.2, 3], 'taste', 5)
    }
    if (Math.abs(x - 25) < 8 && z < -10 && z > -35 && store.phase !== 'CROSSING') {
      store.setPhase('CROSSING')
      store.showSubtitle('风声突然变得开阔。横向车流在前方持续掠过。')
      store.discover('crossing-space', 0.6, 'sound')
      store.emitPulse([25, 0.2, -25], 'sound', 14)
    }
    if (z < -34 && store.phase !== 'RESIDENTIAL' && store.phase !== 'HOME') {
      store.setPhase('RESIDENTIAL')
      store.showSubtitle('车流声落到身后。树叶与鸟鸣近了。')
      store.discover('residential', 0.5, 'memory', '这边的声音开始熟悉起来。')
      store.emitPulse([25, 3, -42], 'sound', 11)
    }
    if (z < -42 && residentialStage.current === 0) {
      residentialStage.current = 1
      store.showSubtitle('脚下砖面的回声变了。沙沙的树叶声，我记得。')
      store.discover('familiar-bricks', 0.75, 'memory')
    }
    if (z < -48 && residentialStage.current === 1) {
      residentialStage.current = 2
      store.setPhase('HOME')
      store.showSubtitle('远处传来一声电梯轻响。……这个声音。我知道这里。')
      store.discover('home-building', 0.9, 'memory', '熟悉的树、砖面和电梯声：家就在前面。')
      store.emitPulse([25, 3, -55], 'memory', 13)
    }
  })
  return null
}
