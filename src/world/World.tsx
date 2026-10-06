import { Edges } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../state/gameStore'
import { BLOCKERS, NPCS, PALETTE, SMELL_SOURCES, STREET_OBSTACLES } from './worldData'

type BoxProps = {
  position: [number, number, number]
  size: [number, number, number]
  color?: string
  edge?: boolean
  userData?: Record<string, string>
}

function Box({ position, size, color = PALETTE.charcoal, edge = true, userData }: BoxProps) {
  return (
    <mesh position={position} castShadow receiveShadow userData={userData}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.93} metalness={0.02} />
      {edge && <Edges color={PALETTE.cream} threshold={24} opacity={0.17} transparent />}
    </mesh>
  )
}

function Building({ x, z, w, d, h, accent = PALETTE.stone }: { x: number; z: number; w: number; d: number; h: number; accent?: string }) {
  const columns = Math.max(2, Math.floor(w / 4.8))
  const floors = Math.max(1, Math.floor((h - 2.4) / 2.7))
  const windows = useMemo(() => Array.from({ length: columns * floors }), [columns, floors])
  return (
    <group userData={{ material: 'wall' }}>
      <Box position={[x, h / 2, z]} size={[w, h, d]} userData={{ material: 'wall' }} />
      <Box position={[x, 0.22, z + d / 2 + 0.12]} size={[w + 0.25, 0.44, 0.28]} color="#37332d" />
      <Box position={[x, h + 0.24, z]} size={[w + 0.5, 0.48, d + 0.5]} color={PALETTE.charcoal} />
      {windows.map((_, index) => (
        <group key={index} position={[
          x - w / 2 + 2.2 + (index % columns) * ((w - 4.4) / Math.max(1, columns - 1)),
          2.15 + Math.floor(index / columns) * 2.65,
          z + d / 2 + 0.035,
        ]}>
          <Box position={[0, 0, 0]} size={[1.72, 1.75, 0.13]} color="#181716" edge={false} />
          <mesh position={[0, 0, 0.075]}><planeGeometry args={[1.48, 1.5]} /><meshBasicMaterial color={accent} transparent opacity={0.18} /></mesh>
          <Box position={[0, -1.03, 0.13]} size={[1.95, 0.14, 0.38]} color="#454039" edge={false} />
        </group>
      ))}
      <Box position={[x, 1.35, z + d / 2 + 0.14]} size={[1.75, 2.7, 0.18]} color={PALETTE.camel} userData={{ material: 'door' }} />
      <Box position={[x, 2.95, z + d / 2 + 0.55]} size={[3.1, 0.18, 1.15]} color={PALETTE.stone} />
      {Array.from({ length: Math.max(1, floors - 1) }).map((_, floor) => (
        <Box key={floor} position={[x, 3.7 + floor * 2.7, z + d / 2 + 0.2]} size={[w + 0.18, 0.1, 0.42]} color="#3b3731" edge={false} />
      ))}
    </group>
  )
}

function TactilePath() {
  const tiles = useMemo(() => {
    const result: Array<{ x: number; z: number; axis: 'x' | 'z' }> = []
    for (let z = 51; z >= 7; z -= 0.62) result.push({ x: 0, z, axis: 'z' })
    for (let x = 0.62; x <= 25; x += 0.62) result.push({ x, z: 7, axis: 'x' })
    for (let z = 6.38; z >= -18; z -= 0.62) result.push({ x: 25, z, axis: 'z' })
    // The public tactile route ends inside the residential block. It is a
    // navigation aid, not a private line leading to the player's front door.
    for (let z = -32; z >= -38.3; z -= 0.62) result.push({ x: 25, z, axis: 'z' })
    return result
  }, [])
  const base = useRef<THREE.InstancedMesh>(null)
  const ribs = useRef<THREE.InstancedMesh>(null)
  const warningBase = useRef<THREE.InstancedMesh>(null)
  const domes = useRef<THREE.InstancedMesh>(null)
  const warningPads = useMemo(() => [
    [0, 51], [0, 7], [25, 7], [25, -18.45], [25, -31.55], [25, -38.5],
  ] as Array<[number, number]>, [])

  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3(1, 1, 1)
    tiles.forEach((tile, index) => {
      quaternion.setFromEuler(new THREE.Euler(0, tile.axis === 'x' ? Math.PI / 2 : 0, 0))
      matrix.compose(new THREE.Vector3(tile.x, 0.025, tile.z), quaternion, scale)
      base.current?.setMatrixAt(index, matrix)
      for (let rib = 0; rib < 4; rib++) {
        const offset = (rib - 1.5) * 0.105
        const x = tile.axis === 'z' ? tile.x + offset : tile.x
        const z = tile.axis === 'x' ? tile.z + offset : tile.z
        matrix.compose(new THREE.Vector3(x, 0.07, z), quaternion, scale)
        ribs.current?.setMatrixAt(index * 4 + rib, matrix)
      }
    })
    let domeIndex = 0
    warningPads.forEach(([x, z], padIndex) => {
      matrix.compose(new THREE.Vector3(x, 0.03, z), new THREE.Quaternion(), scale)
      warningBase.current?.setMatrixAt(padIndex, matrix)
      for (let ix = 0; ix < 5; ix++) {
        for (let iz = 0; iz < 5; iz++) {
          matrix.compose(new THREE.Vector3(x + (ix - 2) * 0.13, 0.085, z + (iz - 2) * 0.13), new THREE.Quaternion(), new THREE.Vector3(1, 0.45, 1))
          domes.current?.setMatrixAt(domeIndex++, matrix)
        }
      }
    })
    for (const mesh of [base.current, ribs.current, warningBase.current, domes.current]) {
      if (mesh) mesh.instanceMatrix.needsUpdate = true
    }
  }, [tiles, warningPads])

  return (
    <group userData={{ material: 'tactile paving' }}>
      <instancedMesh ref={base} args={[undefined, undefined, tiles.length]} receiveShadow>
        <boxGeometry args={[0.56, 0.035, 0.59]} />
        <meshStandardMaterial color="#b39768" roughness={0.94} />
      </instancedMesh>
      <instancedMesh ref={ribs} args={[undefined, undefined, tiles.length * 4]} receiveShadow>
        <boxGeometry args={[0.062, 0.07, 0.48]} />
        <meshStandardMaterial color={PALETTE.wheat} roughness={0.82} />
      </instancedMesh>
      <instancedMesh ref={warningBase} args={[undefined, undefined, warningPads.length]} receiveShadow userData={{ material: 'warning paving' }}>
        <boxGeometry args={[0.72, 0.04, 0.72]} />
        <meshStandardMaterial color="#ad8b5e" roughness={0.94} />
      </instancedMesh>
      <instancedMesh ref={domes} args={[undefined, undefined, warningPads.length * 25]} receiveShadow userData={{ material: 'warning paving' }}>
        <sphereGeometry args={[0.045, 8, 6]} />
        <meshStandardMaterial color={PALETTE.camel} roughness={0.82} />
      </instancedMesh>
    </group>
  )
}

function Tube({ from, to, radius = 0.035, color = PALETTE.stone }: { from: [number, number, number]; to: [number, number, number]; radius?: number; color?: string }) {
  const { midpoint, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from)
    const b = new THREE.Vector3(...to)
    const direction = b.clone().sub(a)
    return {
      midpoint: a.clone().add(b).multiplyScalar(0.5),
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize()),
      length: direction.length(),
    }
  }, [from, to])
  return (
    <mesh position={midpoint} quaternion={quaternion} castShadow>
      <cylinderGeometry args={[radius, radius, length, 8]} />
      <meshStandardMaterial color={color} metalness={0.55} roughness={0.42} />
    </mesh>
  )
}

function Tree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} receiveShadow>
        <ringGeometry args={[0.56, 0.9, 16]} />
        <meshStandardMaterial color={PALETTE.stone} roughness={1} />
      </mesh>
      <mesh castShadow userData={{ material: 'tree' }} position={[0, 2.2, 0]}>
        <cylinderGeometry args={[0.19, 0.38, 4.4, 10]} />
        <meshStandardMaterial color="#39342c" roughness={1} />
      </mesh>
      <Tube from={[0, 3.2, 0]} to={[-1.15, 4.25, 0.15]} radius={0.12} color="#39342c" />
      <Tube from={[0, 3.45, 0]} to={[1.05, 4.45, -0.25]} radius={0.11} color="#39342c" />
      {[[-1.05, 5, 0.1, 1.42], [0.7, 5.45, -0.25, 1.65], [0.05, 6.15, 0.3, 1.35]].map(([x, y, z, size], i) => (
        <mesh key={i} castShadow position={[x, y, z]}>
          <icosahedronGeometry args={[size, 1]} />
          <meshStandardMaterial color={i === 1 ? '#45483d' : '#3e4339'} roughness={1} />
          <Edges color={PALETTE.cream} opacity={0.07} transparent />
        </mesh>
      ))}
    </group>
  )
}

function Bicycle({ electric = false }: { electric?: boolean }) {
  return (
    <group rotation={[0, Math.PI / 2, 0]} userData={{ material: electric ? 'electric bike' : 'bike' }}>
      {[-0.74, 0.74].map((x) => (
        <group key={x} position={[x, 0.55, 0]}>
          <mesh castShadow>
            <torusGeometry args={[0.46, 0.048, 10, 28]} />
            <meshStandardMaterial color={PALETTE.stone} metalness={0.65} roughness={0.42} />
          </mesh>
          {Array.from({ length: 8 }).map((_, i) => (
            <mesh key={i} rotation={[0, 0, i * Math.PI / 4]}>
              <boxGeometry args={[0.82, 0.012, 0.012]} />
              <meshStandardMaterial color={PALETTE.stone} metalness={0.72} />
            </mesh>
          ))}
        </group>
      ))}
      <Tube from={[-0.74, 0.55, 0]} to={[-0.15, 1.14, 0]} radius={0.045} color={PALETTE.camel} />
      <Tube from={[-0.74, 0.55, 0]} to={[0.32, 0.55, 0]} radius={0.045} color={PALETTE.camel} />
      <Tube from={[-0.15, 1.14, 0]} to={[0.32, 0.55, 0]} radius={0.045} color={PALETTE.camel} />
      <Tube from={[-0.15, 1.14, 0]} to={[-0.08, 0.55, 0]} radius={0.045} color={PALETTE.camel} />
      <Tube from={[0.32, 0.55, 0]} to={[0.74, 1.25, 0]} radius={0.043} />
      <Tube from={[0.74, 1.25, 0]} to={[0.74, 0.55, 0]} radius={0.038} />
      <Tube from={[0.58, 1.25, -0.25]} to={[0.9, 1.25, 0.25]} radius={0.028} />
      <mesh position={[-0.2, 1.18, 0]}><boxGeometry args={[0.38, 0.07, 0.2]} /><meshStandardMaterial color={PALETTE.charcoal} /></mesh>
      {electric && <mesh position={[-0.08, 0.72, 0]}><boxGeometry args={[0.48, 0.42, 0.22]} /><meshStandardMaterial color="#393632" roughness={0.5} /></mesh>}
      <mesh position={[0.92, 1.05, 0]}><boxGeometry args={[0.34, 0.34, 0.48]} /><meshStandardMaterial color={PALETTE.stone} wireframe opacity={0.7} transparent /></mesh>
    </group>
  )
}

function StreetObstacleModel({ kind }: { kind: (typeof STREET_OBSTACLES)[number]['kind'] }) {
  if (kind === 'bike' || kind === 'ebike') return <Bicycle electric={kind === 'ebike'} />
  if (kind === 'parcels') return (
    <group userData={{ material: 'cardboard' }}>
      <Box position={[-0.46, 0.38, 0]} size={[0.88, 0.76, 0.82]} color="#6f5b43" />
      <Box position={[0.44, 0.3, 0.18]} size={[0.72, 0.6, 0.62]} color="#806a4d" />
      <Box position={[0.18, 0.82, -0.18]} size={[0.68, 0.72, 0.56]} color="#756047" />
    </group>
  )
  if (kind === 'table') return (
    <group userData={{ material: 'metal' }}>
      <mesh position={[0, 0.92, 0]} castShadow><cylinderGeometry args={[0.78, 0.78, 0.1, 20]} /><meshStandardMaterial color={PALETTE.camel} roughness={0.7} /></mesh>
      <Tube from={[0, 0.08, 0]} to={[0, 0.9, 0]} radius={0.055} />
      {[-0.58, 0.58].map((x) => <Box key={x} position={[x, 0.42, 0.68]} size={[0.5, 0.84, 0.5]} color={PALETTE.stone} />)}
    </group>
  )
  return (
    <group userData={{ material: 'ceramic' }}>
      <mesh position={[0, 0.42, 0]} castShadow><cylinderGeometry args={[0.48, 0.36, 0.82, 16]} /><meshStandardMaterial color={PALETTE.stone} roughness={0.86} /></mesh>
      <mesh position={[0, 1.15, 0]} castShadow><dodecahedronGeometry args={[0.62, 0]} /><meshStandardMaterial color="#40483b" roughness={1} /></mesh>
    </group>
  )
}

function BusStop() {
  return (
    <group position={[-4.5, 0, 18]} userData={{ material: 'metal' }}>
      <Box position={[0, 2.4, 0]} size={[0.14, 4.8, 0.14]} color={PALETTE.stone} />
      <Box position={[0, 4.55, 0]} size={[4.8, 0.18, 2.3]} color={PALETTE.stone} />
      <Box position={[-2.25, 2.3, 0]} size={[0.12, 4.6, 2.15]} color={PALETTE.stone} />
      <mesh position={[-1.1, 1.15, 0]}>
        <boxGeometry args={[1.9, 0.18, 0.7]} />
        <meshStandardMaterial color={PALETTE.camel} roughness={0.72} />
      </mesh>
      <Box position={[2.3, 2.3, 0]} size={[0.12, 4.4, 0.12]} color={PALETTE.stone} />
      <Box position={[2.3, 3.7, 0]} size={[1.25, 1.2, 0.12]} color={PALETTE.wheat} />
    </group>
  )
}

function NPC({ id, position }: { id: string; position: readonly [number, number, number] }) {
  const colors: Record<string, string> = { helpful: PALETTE.cream, vague: PALETTE.stone, busy: PALETTE.camel }
  return (
    <group position={position as [number, number, number]} userData={{ material: 'person', npc: id }}>
      <mesh position={[0, 1.78, 0]} castShadow>
        <sphereGeometry args={[0.25, 16, 12]} />
        <meshStandardMaterial color={colors[id]} roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.18, 0]} castShadow>
        <capsuleGeometry args={[0.3, 0.72, 8, 12]} />
        <meshStandardMaterial color={colors[id]} roughness={0.95} />
        <Edges color={PALETTE.warm} opacity={0.2} transparent />
      </mesh>
      <mesh position={[-0.17, 0.42, 0]} castShadow><capsuleGeometry args={[0.105, 0.62, 6, 10]} /><meshStandardMaterial color={PALETTE.charcoal} /></mesh>
      <mesh position={[0.17, 0.42, 0]} castShadow><capsuleGeometry args={[0.105, 0.62, 6, 10]} /><meshStandardMaterial color={PALETTE.charcoal} /></mesh>
      <mesh position={[-0.4, 1.18, 0]} rotation={[0, 0, -0.16]} castShadow><capsuleGeometry args={[0.085, 0.58, 6, 10]} /><meshStandardMaterial color={colors[id]} /></mesh>
      <mesh position={[0.4, 1.18, 0]} rotation={[0, 0, 0.16]} castShadow><capsuleGeometry args={[0.085, 0.58, 6, 10]} /><meshStandardMaterial color={colors[id]} /></mesh>
    </group>
  )
}

const pedestrianRoutes = [
  { from: [-18, 17], to: [17, 17], speed: 0.75, phase: 0.08, color: PALETTE.cream },
  { from: [18, 14], to: [-16, 14], speed: 0.62, phase: 0.55, color: PALETTE.stone },
  { from: [-8, 2], to: [20, 2], speed: 0.58, phase: 0.32, color: PALETTE.camel },
  { from: [21, 10], to: [2, 10], speed: 0.72, phase: 0.82, color: '#6f6a62' },
  { from: [-17, -13], to: [19, -13], speed: 0.86, phase: 0.18, color: '#aaa196' },
  { from: [44, -14], to: [28, -14], speed: 0.54, phase: 0.68, color: PALETTE.wheat },
  { from: [10, -36], to: [42, -36], speed: 0.64, phase: 0.42, color: '#7d786f' },
  { from: [41, -40], to: [12, -40], speed: 0.48, phase: 0.9, color: '#b3a892' },
  { from: [13, -48], to: [34, -48], speed: 0.44, phase: 0.25, color: PALETTE.cream },
  { from: [34, -51], to: [16, -51], speed: 0.52, phase: 0.73, color: PALETTE.stone },
  { from: [-18, 23], to: [18, 23], speed: 0.8, phase: 0.47, color: '#91877b' },
  { from: [20, 29], to: [-12, 29], speed: 0.67, phase: 0.15, color: '#c1b7a5' },
  { from: [-14, 43], to: [10, 43], speed: 0.46, phase: 0.6, color: PALETTE.camel },
  { from: [9, 39], to: [-15, 39], speed: 0.56, phase: 0.36, color: '#878077' },
] as const

function AmbientPedestrian({ route, index }: { route: (typeof pedestrianRoutes)[number]; index: number }) {
  const ref = useRef<THREE.Group>(null)
  const clock = useRef<number>(route.phase)
  useFrame((_, delta) => {
    clock.current = (clock.current + delta * route.speed * 0.035) % 1
    const progress = clock.current < 0.5 ? clock.current * 2 : 2 - clock.current * 2
    const x = THREE.MathUtils.lerp(route.from[0], route.to[0], progress)
    const z = THREE.MathUtils.lerp(route.from[1], route.to[1], progress)
    if (!ref.current) return
    ref.current.position.set(x, Math.abs(Math.sin(clock.current * Math.PI * 18)) * 0.025, z)
    ref.current.rotation.y = clock.current < 0.5
      ? Math.atan2(route.to[0] - route.from[0], route.to[1] - route.from[1])
      : Math.atan2(route.from[0] - route.to[0], route.from[1] - route.to[1])
  })
  const scale = 0.88 + (index % 4) * 0.045
  return (
    <group ref={ref} scale={scale} userData={{ material: 'person' }}>
      <mesh position={[0, 1.77, 0]} castShadow><sphereGeometry args={[0.23, 12, 9]} /><meshStandardMaterial color={route.color} roughness={0.92} /></mesh>
      <mesh position={[0, 1.16, 0]} castShadow><capsuleGeometry args={[0.27, 0.7, 6, 10]} /><meshStandardMaterial color={route.color} roughness={0.96} /></mesh>
      <mesh position={[-0.15, 0.4, 0]} castShadow><capsuleGeometry args={[0.09, 0.58, 5, 8]} /><meshStandardMaterial color={PALETTE.charcoal} /></mesh>
      <mesh position={[0.15, 0.4, 0]} castShadow><capsuleGeometry args={[0.09, 0.58, 5, 8]} /><meshStandardMaterial color={PALETTE.charcoal} /></mesh>
    </group>
  )
}

function Bakery() {
  return (
    <group position={[27.2, 0, 7]}>
      <Box position={[0, 3.8, 0]} size={[10.5, 7.6, 12]} color="#332c24" />
      <Box position={[-3.2, 2, -6.04]} size={[2.4, 4, 0.18]} color={PALETTE.camel} userData={{ material: 'door' }} />
      <mesh position={[1, 2.1, -6.13]}>
        <planeGeometry args={[4.4, 3.5]} />
        <meshBasicMaterial color={PALETTE.wheat} transparent opacity={0.21} />
      </mesh>
      <Box position={[0, 5.2, -6.2]} size={[8.8, 1, 0.25]} color={PALETTE.cream} />
      <mesh position={[0, 5.2, -6.34]}>
        <planeGeometry args={[7.6, 0.55]} />
        <meshBasicMaterial color={PALETTE.black} />
      </mesh>
    </group>
  )
}

function SmellParticles({ center, color, radius }: { center: readonly [number, number]; color: string; radius: number }) {
  const ref = useRef<THREE.Points>(null)
  const geometry = useMemo(() => {
    const count = 52
    const points = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const angle = i * 2.39996
      const distance = radius * Math.sqrt((i + 1) / count) * 0.72
      points[i * 3] = center[0] + Math.cos(angle) * distance
      points[i * 3 + 1] = 0.35 + ((i * 17) % 31) / 31 * 3.8
      points[i * 3 + 2] = center[1] + Math.sin(angle) * distance
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(points, 3))
    return geo
  }, [center, radius])
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.008
  })
  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial color={color} size={0.105} opacity={0.25} transparent depthWrite={false} />
    </points>
  )
}

const trafficVehicles = [
  { offset: -54, lane: -2.8, direction: 1, speed: 7.4, color: PALETTE.camel, scale: 1 },
  { offset: -32, lane: -2.8, direction: 1, speed: 7.4, color: '#67635d', scale: 0.92 },
  { offset: -10, lane: -2.8, direction: 1, speed: 7.4, color: '#8c7962', scale: 1.08 },
  { offset: 14, lane: -2.8, direction: 1, speed: 7.4, color: PALETTE.stone, scale: 0.96 },
  { offset: 39, lane: -2.8, direction: 1, speed: 7.4, color: '#514c45', scale: 1.14 },
  { offset: -43, lane: 2.8, direction: -1, speed: 6.8, color: PALETTE.cream, scale: 0.94 },
  { offset: -18, lane: 2.8, direction: -1, speed: 6.8, color: '#756f67', scale: 1.04 },
  { offset: 6, lane: 2.8, direction: -1, speed: 6.8, color: PALETTE.wheat, scale: 0.9 },
  { offset: 30, lane: 2.8, direction: -1, speed: 6.8, color: '#5d5953', scale: 1.12 },
  { offset: 53, lane: 2.8, direction: -1, speed: 6.8, color: PALETTE.camel, scale: 0.98 },
] as const

function TrafficVehicle({ vehicle }: { vehicle: (typeof trafficVehicles)[number] }) {
  const ref = useRef<THREE.Group>(null)
  const crossing = useGameStore((s) => s.crossingState)
  const travel = useRef<number>(vehicle.offset)
  useFrame((_, delta) => {
    const speed = crossing === 'CROSS_TRAFFIC'
      ? vehicle.speed
      : crossing === 'TURNING_VEHICLE'
        ? 1.25
        : crossing === 'CLEARANCE'
          ? 2.4
          : 0.08
    travel.current += delta * speed * vehicle.direction
    if (travel.current > 60) travel.current = -60
    if (travel.current < -60) travel.current = 60
    if (ref.current) ref.current.position.x = travel.current
  })
  return (
    <group ref={ref} position={[vehicle.offset, 0, -25 + vehicle.lane]} rotation={[0, vehicle.direction < 0 ? Math.PI : 0, 0]} scale={vehicle.scale}>
      <Box position={[0, 0.66, 0]} size={[4.4, 0.9, 1.82]} color={vehicle.color} />
      <Box position={[0.2, 1.25, 0]} size={[2.25, 0.7, 1.58]} color={PALETTE.charcoal} />
      <Box position={[0.15, 1.3, 0.81]} size={[1.75, 0.48, 0.05]} color="#78766f" edge={false} />
      {[-1.35, 1.35].flatMap((wx) => [-0.86, 0.86].map((wz) => (
        <mesh key={`${wx}-${wz}`} position={[wx, 0.42, wz]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.35, 0.35, 0.2, 16]} />
          <meshStandardMaterial color="#11100f" roughness={0.8} />
        </mesh>
      )))}
      <mesh position={[2.23, 0.72, -0.52]} rotation={[0, Math.PI / 2, 0]}><circleGeometry args={[0.13, 12]} /><meshBasicMaterial color={PALETTE.cream} /></mesh>
      <mesh position={[2.23, 0.72, 0.52]} rotation={[0, Math.PI / 2, 0]}><circleGeometry args={[0.13, 12]} /><meshBasicMaterial color={PALETTE.cream} /></mesh>
    </group>
  )
}

function MovingCars() {
  return <>{trafficVehicles.map((vehicle, index) => <TrafficVehicle key={index} vehicle={vehicle} />)}</>
}

function Home() {
  return (
    <group position={[25, 0, -56]} userData={{ material: 'wall' }}>
      <Box position={[0, 5, 0]} size={[21, 10, 6]} color="#2e2a24" userData={{ material: 'wall' }} />
      <Box position={[-7, 2, 3.06]} size={[3.2, 4, 0.2]} color={PALETTE.camel} userData={{ material: 'home door' }} />
      <Box position={[-2.2, 4.8, 3.07]} size={[2.5, 2.4, 0.18]} color={PALETTE.stone} />
      <Box position={[5.5, 4.8, 3.07]} size={[2.5, 2.4, 0.18]} color={PALETTE.stone} />
      <mesh position={[-7, 4.35, 3.22]}>
        <circleGeometry args={[0.25, 20]} />
        <meshBasicMaterial color={PALETTE.cream} />
      </mesh>
    </group>
  )
}

export function GameWorld() {
  const debug = useGameStore((s) => s.debug)
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[54, 0.1, 60]} position={[0, -0.13, 0]} />
        {BLOCKERS.map((b, i) => (
          <CuboidCollider key={i} args={[b.w / 2, 4, b.d / 2]} position={[b.x, 4, b.z]} />
        ))}
      </RigidBody>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow userData={{ material: 'ground' }}>
        <planeGeometry args={[108, 120]} />
        <meshStandardMaterial color="#201e1a" roughness={1} />
      </mesh>
      <mesh position={[0, 0.015, -25]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[108, 12]} />
        <meshStandardMaterial color="#171614" roughness={0.98} />
      </mesh>
      <mesh position={[25, 0.025, -25]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5, 12]} />
        <meshStandardMaterial color={PALETTE.stone} transparent opacity={0.16} />
      </mesh>
      <TactilePath />
      {STREET_OBSTACLES.map((obstacle) => (
        <group key={obstacle.id} position={[obstacle.x, 0, obstacle.z]}>
          <StreetObstacleModel kind={obstacle.kind} />
        </group>
      ))}
      <BusStop />
      <Bakery />
      {SMELL_SOURCES.map((source) => (
        <SmellParticles key={source.id} center={source.position} color={source.color} radius={source.radius} />
      ))}
      <MovingCars />
      <Home />
      <Building x={-28} z={34} w={30} d={18} h={12} />
      <Building x={28} z={35} w={30} d={20} h={15} />
      <Building x={-30} z={7} w={28} d={26} h={10} />
      <Building x={-30} z={-45} w={28} d={18} h={14} />
      <Building x={39} z={-46} w={16} d={19} h={11} />
      {NPCS.map((npc) => <NPC key={npc.id} id={npc.id} position={npc.position} />)}
      {pedestrianRoutes.map((route, index) => <AmbientPedestrian key={index} route={route} index={index} />)}
      {([[-13, 0, -10], [-5, 0, -10], [4, 0, -12], [38, 0, -12], [35, 0, -38], [14, 0, -43]] as Array<[number, number, number]>).map((p, i) => (
        <Tree key={i} position={p} scale={0.75 + (i % 3) * 0.12} />
      ))}
      {[-45, -15, 15, 45].map((x) => (
        <group key={x} position={[x, 0, -17]}>
          <Box position={[0, 2.8, 0]} size={[0.12, 5.6, 0.12]} color={PALETTE.stone} />
          <mesh position={[0.4, 5.45, 0]}>
            <boxGeometry args={[0.9, 0.12, 0.3]} />
            <meshStandardMaterial color={PALETTE.cream} emissive={PALETTE.cream} emissiveIntensity={0.35} />
          </mesh>
        </group>
      ))}
      {debug && BLOCKERS.map((b, i) => (
        <mesh key={`debug-${i}`} position={[b.x, 1, b.z]}>
          <boxGeometry args={[b.w, 2, b.d]} />
          <meshBasicMaterial color="#ff6b6b" wireframe transparent opacity={0.3} />
        </mesh>
      ))}
    </group>
  )
}
