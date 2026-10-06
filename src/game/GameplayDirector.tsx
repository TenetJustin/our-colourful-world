import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { useGameStore } from '../state/gameStore'
import { HOME_DOOR } from '../world/worldData'
import type { CrossingState, GamePhase } from './types'

const systemHints: Record<GamePhase, [string, string]> = {
  ARRIVAL: ['先听一听环境，再按 SPACE 用白杖确认脚下；公交并没有把你停在盲道上。', '系统路线提示：先从普通路面向右前方横向试探几步，寻找连续条形凸起。'],
  ORIENTATION: ['按 SPACE 敲击白杖，慢慢扩大试探范围；规律的“嗒嗒”声才表示找到行进盲道。', '系统路线提示：盲道不在脚下，在右前方约四米处。找到后再沿凸起方向前进。'],
  BLIND_PATH: ['盲道可能反复被车辆、箱子或店外设施占用。先用白杖判断材质和宽度，再从侧面绕过，随后重新寻找条形凸起。', '系统路线提示：这一段需要多次短暂离开盲道；每次绕行后都回到原前进方向寻找规律的“嗒嗒”触感。'],
  BUS_STOP: ['附近有人。靠近声音轮廓，按 E 询问可获得可用路线信息。', '系统路线提示：能提供准确方向的人在公交站右侧。'],
  BAKERY: ['留意烘烤气味和门铃；它们能确认 NPC 提到的地标。', '系统路线提示：沿盲道向右，靠近暖色气味区域就是面包店。'],
  CROSSING: ['先用白杖确认警示铺装并对齐过街方向；不要把突然安静当成通行信号。', '系统路线提示：等待近处定位音变成连续急促声，并听见身侧平行车流同时起步，再沿盲道方向直行。'],
  RESIDENTIAL: ['导向盲道会在居民区入口前结束。停下来回想树叶、潮土、砖面回声和电梯声，不要把盲道当成通往家门的线路。', '系统路线提示：在盲道尽头向左前方离开，先靠近树叶和潮土气味，再寻找脚下旧砖的短回声。'],
  HOME: ['盲道已经结束。把记忆里的树叶、旧砖和电梯提示音串起来，再用白杖确认入口。', '系统路线提示：电梯提示音来自左前方住宅；朝声音移动，在楼前向左寻找熟悉的门。'],
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

    if (store.phase === 'ORIENTATION' && store.discoveries['blind-path']) {
      store.setPhase('BLIND_PATH')
      store.showSubtitle('找到了。白杖沿连续条形凸起发出规律的嗒嗒声。')
      store.discover('possible-path', 1, 'touch')
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
    const streetFoodDistance = Math.hypot(x + 12, z - 4)
    if (streetFoodDistance < 10 && !store.discoveries['street-food-smell']) {
      store.showSubtitle('油烟里有葱和胡椒的味道。附近可能有街边餐食，但不是我要找的地标。')
      store.discover('street-food-smell', 0.75, 'smell', '街边热油、葱和胡椒的气味可以帮助区分路段，但不是面包店。')
    }
    if (Math.abs(x - 25) < 8 && z < -10 && z > -35 && store.phase !== 'CROSSING') {
      store.setPhase('CROSSING')
      store.showSubtitle('风声突然变得开阔。横向车流在前方持续掠过。')
      store.discover('crossing-space', 0.6, 'sound')
      store.emitPulse([25, 0.2, -25], 'sound', 14)
    }
    if (z < -35.5 && store.phase !== 'RESIDENTIAL' && store.phase !== 'HOME') {
      store.setPhase('RESIDENTIAL')
      store.showSubtitle('条形凸起在提示圆点后结束了。车流落到身后，左前方的树叶声和潮土气味开始熟悉。', 4800)
      store.discover('path-ended', 1, 'touch', '公共盲道在居民区入口处结束，并不会通到家门。接下来要依靠熟悉的环境线索。')
      store.discover('residential', 0.6, 'memory', '左前方的树叶声、潮土气味和旧砖回声属于我熟悉的住宅区域。')
      store.emitPulse([17, 3, -43], 'sound', 11)
    }
    if (z < -42 && x < 30 && residentialStage.current === 0) {
      residentialStage.current = 1
      store.showSubtitle('脚下旧砖的回声变短。潮湿树皮、落叶和晚饭蒸汽——这些线索我记得。')
      store.discover('familiar-bricks', 0.85, 'memory', '盲道尽头左前方：潮土和树叶之后，会遇到熟悉的旧砖地面。')
    }
    const homeDistance = Math.hypot(x - HOME_DOOR[0], z - HOME_DOOR[2])
    if (homeDistance < 12 && residentialStage.current === 1) {
      residentialStage.current = 2
      store.setPhase('HOME')
      store.showSubtitle('左前方传来一声电梯轻响。树、旧砖、楼道气味……线索连起来了。')
      store.discover('home-building', 0.95, 'memory', '树叶与潮土之后是旧砖；电梯提示音来自左前方那栋楼，家门在楼前偏左。')
      store.emitPulse([HOME_DOOR[0], 3, HOME_DOOR[2]], 'memory', 13)
    }
  })
  return null
}
