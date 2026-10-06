import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../state/gameStore'
import { BLOCKERS, NPCS, PALETTE, STREET_OBSTACLES } from '../world/worldData'
import { requestGamePointerLock } from './pointerLock'
import { playCaneTap, playImpact } from '../audio/audioEngine'

const MOVE_SPEED = 3.05
const PLAYER_RADIUS = 0.42

function blocked(x: number, z: number) {
  return BLOCKERS.some((b) =>
    x > b.x - b.w / 2 - PLAYER_RADIUS &&
    x < b.x + b.w / 2 + PLAYER_RADIUS &&
    z > b.z - b.d / 2 - PLAYER_RADIUS &&
    z < b.z + b.d / 2 + PLAYER_RADIUS,
  )
}

function streetObstacleAt(x: number, z: number) {
  return STREET_OBSTACLES.find((obstacle) =>
    x > obstacle.x - obstacle.w / 2 - PLAYER_RADIUS &&
    x < obstacle.x + obstacle.w / 2 + PLAYER_RADIUS &&
    z > obstacle.z - obstacle.d / 2 - PLAYER_RADIUS &&
    z < obstacle.z + obstacle.d / 2 + PLAYER_RADIUS,
  )
}

export function Player() {
  const { camera, gl, scene } = useThree()
  const position = useRef(new THREE.Vector3(0, 1.65, 51))
  const velocity = useRef(new THREE.Vector3())
  const yaw = useRef(0)
  const pitch = useRef(-0.04)
  const keys = useRef<Record<string, boolean>>({})
  const cane = useRef<THREE.Group>(null)
  const caneTime = useRef(0)
  const lastStoreUpdate = useRef(0)
  const lastTeleport = useRef(0)
  const dragLooking = useRef(false)
  const wasPointerLocked = useRef(false)
  const crossingCommitted = useRef(false)
  const lastImpactAt = useRef(0)
  const stumbleTime = useRef(0)
  const unsafeAttempts = useRef(0)
  const roadIncidentAt = useRef(0)
  const started = useGameStore((s) => s.started)
  const paused = useGameStore((s) => s.paused)
  const memoryOpen = useGameStore((s) => s.memoryOpen)
  const dialogue = useGameStore((s) => s.dialogue)
  const ending = useGameStore((s) => s.endingTriggered)
  const crossingState = useGameStore((s) => s.crossingState)
  const showSubtitle = useGameStore((s) => s.showSubtitle)
  const showHint = useGameStore((s) => s.showHint)
  const emitPulse = useGameStore((s) => s.emitPulse)
  const discover = useGameStore((s) => s.discover)
  const openDialogue = useGameStore((s) => s.openDialogue)
  const advanceDialogue = useGameStore((s) => s.advanceDialogue)
  const toggleMemory = useGameStore((s) => s.toggleMemory)
  const togglePause = useGameStore((s) => s.togglePause)
  const toggleDebug = useGameStore((s) => s.toggleDebug)
  const triggerEnding = useGameStore((s) => s.triggerEnding)
  const setPointerLocked = useGameStore((s) => s.setPointerLocked)

  const forward = useMemo(() => new THREE.Vector3(), [])
  const right = useMemo(() => new THREE.Vector3(), [])
  const raycaster = useMemo(() => new THREE.Raycaster(), [])

  const sensoryMaterial = (object: THREE.Object3D) => {
    let current: THREE.Object3D | null = object
    while (current) {
      const material = current.userData?.material
      if (typeof material === 'string') return material
      current = current.parent
    }
    return null
  }

  useEffect(() => {
    camera.rotation.order = 'YXZ'
    const keydown = (event: KeyboardEvent) => {
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'Tab'].includes(event.code)) event.preventDefault()
      keys.current[event.code] = true

      if (event.code === 'F3') toggleDebug()
      if (event.code === 'Tab' && started && !ending && !dialogue) toggleMemory()
      if (event.code === 'Escape' && started && !ending && !memoryOpen && !dialogue && document.pointerLockElement) {
        document.exitPointerLock()
      }
      if (event.code === 'KeyE' || event.code === 'Enter') {
        if (dialogue) {
          advanceDialogue()
          return
        }
        if (memoryOpen || paused || ending) return
        interact()
      }
      if (event.code === 'Space' && started && !paused && !memoryOpen && !dialogue && !ending) useCane()
    }
    const keyup = (event: KeyboardEvent) => { keys.current[event.code] = false }
    const mousemove = (event: MouseEvent) => {
      const canLook = document.pointerLockElement === gl.domElement || dragLooking.current
      if (!canLook || paused || memoryOpen || dialogue || ending) return
      yaw.current -= event.movementX * 0.0018
      pitch.current -= event.movementY * 0.00155
      pitch.current = THREE.MathUtils.clamp(pitch.current, -1.25, 1.25)
    }
    const mousedown = () => {
      if (started && !paused && !memoryOpen && !dialogue && !ending) dragLooking.current = true
    }
    const mouseup = () => { dragLooking.current = false }
    const click = () => {
      if (started && !paused && !memoryOpen && !dialogue && !ending && document.pointerLockElement !== gl.domElement) {
        requestGamePointerLock()
      }
    }
    const lockchange = () => {
      const locked = document.pointerLockElement === gl.domElement
      setPointerLocked(locked)
      if (wasPointerLocked.current && !locked && started && !ending && !memoryOpen && !dialogue && !useGameStore.getState().paused) {
        togglePause()
      }
      wasPointerLocked.current = locked
    }
    window.addEventListener('keydown', keydown)
    window.addEventListener('keyup', keyup)
    document.addEventListener('mousemove', mousemove)
    gl.domElement.addEventListener('mousedown', mousedown)
    window.addEventListener('mouseup', mouseup)
    document.addEventListener('pointerlockchange', lockchange)
    gl.domElement.addEventListener('click', click)
    return () => {
      window.removeEventListener('keydown', keydown)
      window.removeEventListener('keyup', keyup)
      document.removeEventListener('mousemove', mousemove)
      gl.domElement.removeEventListener('mousedown', mousedown)
      window.removeEventListener('mouseup', mouseup)
      document.removeEventListener('pointerlockchange', lockchange)
      gl.domElement.removeEventListener('click', click)
    }
  // Handlers read current state from Zustand where timing matters.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl, started, paused, memoryOpen, dialogue, ending])

  function interact() {
    const p = position.current
    let nearest: (typeof NPCS)[number] | null = null
    let nearestDistance = Infinity
    for (const npc of NPCS) {
      const d = Math.hypot(p.x - npc.position[0], p.z - npc.position[2])
      if (d < 3.4 && d < nearestDistance) {
        nearest = npc
        nearestDistance = d
      }
    }
    if (!nearest) {
      showSubtitle('没有人回应。', 1400)
      return
    }
    emitPulse([nearest.position[0], 1, nearest.position[2]], 'conversation', 5)
    if (nearest.id === 'helpful') {
      openDialogue('helpful', '路人', [
        '“不好意思，请问槐树路怎么走？”',
        '“你现在在榆安路这边。沿着盲道往前走。”',
        '“你会经过一家面包店。”',
        '“过了面包店后，在第二个路口右转。”',
        '“前面的十字路口车比较多，你注意听信号。”',
      ])
      discover('location', 0.75, 'conversation', '我现在在榆安路。')
      discover('route', 0.65, 'conversation', '沿着盲道，经过面包店，在第二个路口右转。')
      discover('bakery', 0.25, 'conversation', '路上会经过一家面包店。')
      discover('crossing', 0.35, 'conversation', '前面的十字路口车很多，要听信号。')
    } else if (nearest.id === 'vague') {
      openDialogue('vague', '路人', [
        '“槐树路？就前面啊。”',
        '“大概多远？”',
        '“不远，就那边。”',
        '他的语气很自然。这个方向对我来说还不够。',
      ])
      discover('vague-direction', 0.25, 'conversation', '有人说槐树路“就在前面”，但这不足以定位。')
    } else {
      openDialogue('busy', '路人', ['“你好，请问——”', '“不好意思，我赶时间。”', '脚步声很快离开了。'])
      discover('busy-person', 0.25, 'conversation')
    }
  }

  function useCane() {
    caneTime.current = 0.52
    const p = position.current
    discover('cane-used', 1, 'touch')
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, yaw.current, 0))
    const hit = p.clone().addScaledVector(dir, 1.45)
    emitPulse([hit.x, 0.08, hit.z], 'touch', 3.2)

    const obstacle = STREET_OBSTACLES
      .map((item) => {
        const delta = new THREE.Vector3(item.x - p.x, 0, item.z - p.z)
        return { item, distance: delta.length(), facing: delta.normalize().dot(dir) }
      })
      .filter(({ distance, facing }) => distance < 3.2 && facing > 0.15)
      .sort((a, b) => a.distance - b.distance)[0]?.item
    if (obstacle) {
      playCaneTap(obstacle.material)
      const feedback = obstacle.material === 'metal'
        ? '铛——杖尖碰到金属。'
        : obstacle.material === 'cardboard'
          ? '噗。杖尖陷进轻而空的纸箱表面。'
          : '笃。坚硬的盆体挡在前方。'
      showSubtitle(`${feedback}${obstacle.description}占住了盲道，需要离开盲道绕行。`)
      discover(`obstacle-${obstacle.id}`, 1, 'touch', `${obstacle.description}占住盲道；绕开后需要重新寻找导向条。`)
      discover('blocked-path', 1, 'touch')
      return
    }
    const atHome = Math.abs(p.x - 25) < 3.4 && p.z < -50.5
    if (atHome) {
      playCaneTap('door')
      showSubtitle('杖尖碰到一扇很熟悉的门。')
      discover('home', 1, 'touch', '我回到家了。')
      window.setTimeout(triggerEnding, 1450)
      return
    }
    raycaster.set(new THREE.Vector3(p.x, 0.82, p.z), dir.clone().setY(-0.06).normalize())
    raycaster.far = 2.15
    const objectHit = raycaster.intersectObjects(scene.children, true)
      .map((intersection) => ({ intersection, material: sensoryMaterial(intersection.object) }))
      .find(({ material }) => material && !['ground', 'tactile paving', 'warning paving'].includes(material))
    if (objectHit?.material) {
      const material = objectHit.material
      const feedback = material === 'tree'
        ? { sound: 'wood' as const, text: '笃。杖尖碰到粗糙、有弹性的树干。' }
        : material === 'wall'
          ? { sound: 'wall' as const, text: '嗒。前方是连续而坚硬的墙面。' }
          : material === 'person'
            ? { sound: 'cardboard' as const, text: '杖尖轻触到衣料。对方停下脚步，让出了一点空间。' }
            : material.includes('door')
              ? { sound: 'door' as const, text: '咚。杖尖碰到一扇门。' }
              : material === 'cardboard'
                ? { sound: 'cardboard' as const, text: '噗。前方是轻而空的纸箱。' }
                : material === 'ceramic'
                  ? { sound: 'ceramic' as const, text: '叮。前方有坚硬的陶质物体。' }
                  : { sound: 'metal' as const, text: '铛。前方是中空或细长的金属物体。' }
      playCaneTap(feedback.sound)
      showSubtitle(feedback.text, 2200)
      emitPulse([objectHit.intersection.point.x, objectHit.intersection.point.y, objectHit.intersection.point.z], 'touch', 2.4)
      return
    }
    if (Math.abs(p.x - 25) < 3 && (Math.abs(p.z + 18.5) < 3 || Math.abs(p.z + 31.5) < 3)) {
      playCaneTap('curb')
      showSubtitle('哒、哒、哒。杖尖连续越过圆点凸起。这里是提示盲道，前方环境将发生变化。')
      discover('warning-paving', 1, 'touch', '圆点形提示盲道表示起止、转弯或危险位置；这里接近路口边缘。')
      return
    }
    const onTactile = (Math.abs(p.x) < 1.05 && p.z > 6 && p.z < 53)
      || (Math.abs(p.z - 7) < 1.05 && p.x > -1 && p.x < 27)
      || (Math.abs(p.x - 25) < 1.05 && ((p.z < 8 && p.z > -19) || (p.z < -31 && p.z > -54)))
    if (onTactile) {
      playCaneTap('tactile')
      showSubtitle('嗒—嗒—嗒。杖尖顺着条形凸起移动，方向稳定。')
      discover('blind-path', 0.85, 'touch', '条形凸起是行进盲道，用来维持前进方向。')
      return
    }
    if (Math.hypot(p.x + 4.5, p.z - 18) < 5) {
      playCaneTap('metal')
      showSubtitle('杖尖碰到中空的金属支柱。')
      discover('bus-stop', 0.75, 'touch', '这里有站牌、长椅和金属雨棚，像是公交站。')
      return
    }
    playCaneTap('ground')
    showSubtitle('杖尖划过普通路面。前方暂时平坦。', 1500)
  }

  function registerObjectImpact(x: number, z: number, speed: number) {
    const now = performance.now()
    if (now - lastImpactAt.current < 1300) return
    lastImpactAt.current = now
    const obstacle = streetObstacleAt(x, z)
    playImpact('object')
    emitPulse([x, 0.7, z], 'touch', 3.8)
    if (obstacle?.fallRisk && speed > 2.05) {
      stumbleTime.current = 1.25
      playImpact('fall')
      showSubtitle(`小腿撞上${obstacle.description}。身体失去平衡，我用手和白杖撑住地面，慢慢站起来。`, 4200)
    } else {
      showSubtitle(obstacle ? `身体碰到了${obstacle.description}。我停下来重新确认位置。` : '肩膀碰到坚硬的墙面。我停下来重新确认方向。', 2800)
    }
  }

  useFrame((_, delta) => {
    const teleportState = useGameStore.getState()
    if (teleportState.teleportId !== lastTeleport.current && teleportState.teleportTarget) {
      lastTeleport.current = teleportState.teleportId
      position.current.set(...teleportState.teleportTarget)
      velocity.current.set(0, 0, 0)
      stumbleTime.current = 0
    }
    camera.rotation.set(pitch.current, yaw.current, 0)
    if (!started || paused || memoryOpen || dialogue || ending) {
      velocity.current.multiplyScalar(0.78)
    } else {
      forward.set(-Math.sin(yaw.current), 0, -Math.cos(yaw.current))
      right.set(Math.cos(yaw.current), 0, -Math.sin(yaw.current))
      const input = new THREE.Vector3()
      if (keys.current.KeyW) input.add(forward)
      if (keys.current.KeyS) input.sub(forward)
      if (keys.current.KeyD) input.add(right)
      if (keys.current.KeyA) input.sub(right)
      if (stumbleTime.current > 0) input.set(0, 0, 0)
      else if (input.lengthSq() > 0) input.normalize().multiplyScalar(MOVE_SPEED)
      velocity.current.lerp(input, 1 - Math.exp(-delta * (input.lengthSq() ? 8 : 11)))

      const impactSpeed = velocity.current.length()
      const nextX = position.current.x + velocity.current.x * delta
      if (!blocked(nextX, position.current.z)) position.current.x = nextX
      else {
        registerObjectImpact(nextX, position.current.z, impactSpeed)
        velocity.current.x = 0
      }
      const nextZ = position.current.z + velocity.current.z * delta
      if (!blocked(position.current.x, nextZ)) position.current.z = nextZ
      else {
        registerObjectImpact(position.current.x, nextZ, impactSpeed)
        velocity.current.z = 0
      }

      for (const npc of NPCS) {
        const dx = position.current.x - npc.position[0]
        const dz = position.current.z - npc.position[2]
        const distance = Math.hypot(dx, dz)
        if (distance < 0.62 && impactSpeed > 0.65 && performance.now() - lastImpactAt.current > 1300) {
          lastImpactAt.current = performance.now()
          const length = Math.max(0.01, distance)
          position.current.x += (dx / length) * 0.48
          position.current.z += (dz / length) * 0.48
          velocity.current.set(0, 0, 0)
          playImpact('person')
          emitPulse([npc.position[0], 1, npc.position[2]], 'touch', 3.5)
          showSubtitle('我和迎面的人撞了一下。我们都停住脚步，道歉后各自重新找方向。', 3400)
        }
      }

      const inCrosswalk = position.current.z < -19.2 && position.current.z > -30.8 && Math.abs(position.current.x - 25) < 4
      if (inCrosswalk && crossingState === 'PEDESTRIAN_PHASE') crossingCommitted.current = true
      const mayFinishCrossing = crossingCommitted.current && crossingState === 'CLEARANCE'
      if (inCrosswalk && crossingState !== 'PEDESTRIAN_PHASE' && !mayFinishCrossing) {
        const returnTo = position.current.z < -25 ? -31.8 : -18.2
        position.current.z = returnTo
        velocity.current.set(0, 0, 0)
        if (performance.now() - roadIncidentAt.current > 1800) {
          roadIncidentAt.current = performance.now()
          unsafeAttempts.current += 1
          const struck = unsafeAttempts.current > 1 && crossingState === 'CROSS_TRAFFIC'
          if (struck) {
            playImpact('vehicle')
            window.setTimeout(() => playImpact('fall'), 220)
            stumbleTime.current = 1.25
            showSubtitle('喇叭声贴得太近。车辆擦到白杖和手臂，我摔在路边。没有严重受伤，但必须重新等待并确认通行信号。', 5200)
          } else {
            playImpact('vehicle')
            const warning = crossingState === 'ALL_RED'
              ? '短暂安静不等于可以通行。我退回路沿，继续等平行车流起步或无障碍提示音。'
              : crossingState === 'TURNING_VEHICLE'
                ? '转弯车从近处切过，白杖差点被带走。我退回警示铺装后。'
                : '横向车流仍在通行。喇叭和急刹逼近，我退回了路沿。'
            showSubtitle(warning)
          }
        }
        emitPulse([25, 0.4, -25], 'sound', 12)
      }
      if (position.current.z <= -31.2 || position.current.z >= -18.8) crossingCommitted.current = false
    }

    if (stumbleTime.current > 0) {
      stumbleTime.current = Math.max(0, stumbleTime.current - delta)
      const progress = 1 - stumbleTime.current / 1.25
      position.current.y = 1.65 - Math.sin(progress * Math.PI) * 0.92
    } else {
      position.current.y = THREE.MathUtils.lerp(position.current.y, 1.65, 1 - Math.exp(-delta * 8))
    }
    camera.position.copy(position.current)
    if (cane.current) {
      cane.current.position.copy(position.current)
      cane.current.quaternion.copy(camera.quaternion)
      if (caneTime.current > 0) caneTime.current = Math.max(0, caneTime.current - delta)
      const sweep = caneTime.current > 0 ? Math.sin((0.52 - caneTime.current) / 0.52 * Math.PI) : 0
      cane.current.rotation.z = -0.12 + sweep * 0.55
    }
    lastStoreUpdate.current += delta
    if (lastStoreUpdate.current > 0.09) {
      lastStoreUpdate.current = 0
      useGameStore.getState().setPlayerPosition([position.current.x, position.current.y, position.current.z])
      useGameStore.getState().setPlayerYaw(yaw.current)
      let nearby = false
      for (const npc of NPCS) {
        if (Math.hypot(position.current.x - npc.position[0], position.current.z - npc.position[2]) < 3.4) nearby = true
      }
      showHint(nearby ? 'E · 询问' : null)
    }
  })

  return (
    <group ref={cane}>
      <mesh position={[0.44, -0.52, -0.74]} rotation={[1.12, 0, 0.18]} castShadow>
        <cylinderGeometry args={[0.018, 0.022, 1.45, 10]} />
        <meshStandardMaterial color={PALETTE.cream} roughness={0.55} metalness={0.2} />
      </mesh>
      <mesh position={[0.44, -1.16, -1.31]} rotation={[1.12, 0, 0.18]}>
        <cylinderGeometry args={[0.026, 0.026, 0.22, 10]} />
        <meshStandardMaterial color={PALETTE.camel} roughness={0.5} />
      </mesh>
    </group>
  )
}
