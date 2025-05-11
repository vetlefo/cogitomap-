import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { KeyboardControls } from '@react-three/drei';
import GameScene from './GameScene';
import { Controls } from './types';

// Define key mappings for our game controls
const keyMap = [
  { name: Controls.forward, keys: ['ArrowUp', 'KeyW'] },
  { name: Controls.back, keys: ['ArrowDown', 'KeyS'] },
  { name: Controls.left, keys: ['ArrowLeft', 'KeyA'] },
  { name: Controls.right, keys: ['ArrowRight', 'KeyD'] },
  { name: Controls.jump, keys: ['Space'] },
];

function Game() {
  console.log("Game component initialized");
  
  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <KeyboardControls map={keyMap}>
        <Canvas
          camera={{ position: [0, 5, 10], fov: 60 }}
          gl={{ antialias: true }}
        >
          <color attach="background" args={["#87CEEB"]} />
          <Suspense fallback={null}>
            <GameScene />
          </Suspense>
        </Canvas>
      </KeyboardControls>
      
      {/* Game UI - positioned on top of the canvas */}
      <div style={{ 
        position: 'absolute', 
        top: '20px', 
        left: '20px', 
        background: 'rgba(0,0,0,0.7)', 
        color: 'white',
        padding: '10px',
        borderRadius: '5px'
      }}>
        <h2>Game Controls</h2>
        <p>Movement: WASD or Arrow Keys</p>
        <p>Jump: Space</p>
      </div>
    </div>
  );
}

export default Game;