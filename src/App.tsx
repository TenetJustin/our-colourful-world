import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { Suspense } from 'react'
import { GameWorld } from './world/World'
import { Player } from './game/Player'
import { GameplayDirector } from './game/GameplayDirector'
import { PerceptionPulses } from './sensory/PerceptionPulse'
import { AudioManager } from './audio/AudioManager'
import { Interface } from './ui/Interface'
import { useGameStore } from './state/gameStore'
import { WebMCPBridge } from './game/WebMCPBridge'

function Scene() {
  return (
    <>
      <color attach="background" args={['#12110F']} />
      <fog attach="fog" args={['#12110F', 7, 46]} />
      <ambientLight intensity={0.19} color="#E6DCCB" />
      <hemisphereLight args={['#E6DCCB', '#12110F', 0.34]} />
      <directionalLight
        position={[20, 28, 15]}
        intensity={0.72}
        color="#F2EEE5"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={90}
        shadow-camera-left={-55}
        shadow-camera-right={55}
        shadow-camera-top={55}
        shadow-camera-bottom={-55}
      />
      <Physics gravity={[0, -9.81, 0]}>
        <GameWorld />
      </Physics>
      <Player />
      <GameplayDirector />
      <PerceptionPulses />
    </>
  )
}

export default function App() {
  const started = useGameStore((s) => s.started)

  return (
    <main className="game-shell">
      <Canvas
        shadows
        dpr={[1, 1.6]}
        camera={{ fov: 68, near: 0.08, far: 130, position: [0, 1.65, 51] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.domElement.setAttribute('aria-label', 'Our Colourful World 三维游戏场景')
        }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
      {started && <AudioManager />}
      <WebMCPBridge />
      <Interface />
    </main>
  )
}
