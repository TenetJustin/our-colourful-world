import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../state/gameStore'
import type { Pulse } from '../game/types'

const colors = {
  touch: '#F2EEE5',
  sound: '#E6DCCB',
  smell: '#C8AD7F',
  taste: '#A78662',
  conversation: '#8B8378',
  memory: '#A78662',
}

function PulseRing({ pulse }: { pulse: Pulse }) {
  const ref = useRef<THREE.Mesh>(null)
  const age = useRef(0)
  useFrame((_, delta) => {
    age.current += delta
    if (!ref.current) return
    const progress = Math.min(1, age.current / 1.8)
    const s = 0.2 + progress * pulse.radius
    ref.current.scale.setScalar(s)
    const material = ref.current.material as THREE.MeshBasicMaterial
    material.opacity = Math.sin(progress * Math.PI) * 0.48
  })
  return (
    <mesh ref={ref} position={pulse.position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.94, 1, 64]} />
      <meshBasicMaterial color={colors[pulse.sense]} transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

export function PerceptionPulses() {
  const pulses = useGameStore((s) => s.pulses)
  return <>{pulses.map((pulse) => <PulseRing key={pulse.id} pulse={pulse} />)}</>
}
