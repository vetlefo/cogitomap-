import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BubbleNode } from '../types';

interface AgentDroneProps {
  startPosition: [number, number, number];
  nodes: BubbleNode[];
  color?: string;
}

/**
 * AI Agent drone that navigates between conversation nodes
 */
export function AgentDrone({ 
  startPosition, 
  nodes,
  color = '#00ffff' 
}: AgentDroneProps) {
  const droneRef = useRef<THREE.Group>(null);
  const targetIndexRef = useRef(0);
  const speedRef = useRef(0.02 + Math.random() * 0.02);
  
  // Flicker effect for the engine glow
  const engineGlowRef = useRef<THREE.PointLight>(null);
  const glowIntensityBase = 0.8;
  
  useFrame((state) => {
    if (!droneRef.current || nodes.length === 0) return;
    
    // Flicker the engine glow
    if (engineGlowRef.current) {
      engineGlowRef.current.intensity = glowIntensityBase + Math.sin(state.clock.getElapsedTime() * 10) * 0.2;
    }
    
    // Select current target node
    const targetIdx = targetIndexRef.current % nodes.length;
    const targetNode = nodes[targetIdx];
    const targetPos = new THREE.Vector3(
      targetNode.position.x,
      targetNode.position.y,
      targetNode.position.z
    );
    
    // Move toward target
    const currentPos = droneRef.current.position;
    currentPos.lerp(targetPos, speedRef.current);
    
    // If close enough to target, choose next target
    if (currentPos.distanceTo(targetPos) < 0.5) {
      targetIndexRef.current = (targetIndexRef.current + 1) % nodes.length;
      
      // Randomize speed a bit for variety
      speedRef.current = 0.02 + Math.random() * 0.02;
    }
    
    // Calculate direction to face the target
    const direction = new THREE.Vector3().subVectors(targetPos, currentPos).normalize();
    
    // Only update rotation if moving enough
    if (direction.length() > 0.01) {
      const lookAt = new THREE.Vector3().addVectors(currentPos, direction);
      droneRef.current.lookAt(lookAt);
    }
  });
  
  return (
    <group ref={droneRef} position={startPosition}>
      {/* Drone body */}
      <mesh>
        <boxGeometry args={[0.3, 0.1, 0.6]} />
        <meshStandardMaterial color="#004060" emissive="#002030" />
      </mesh>
      
      {/* Wings */}
      <mesh position={[0.3, 0, 0]}>
        <boxGeometry args={[0.4, 0.05, 0.15]} />
        <meshStandardMaterial color="#002040" />
      </mesh>
      <mesh position={[-0.3, 0, 0]}>
        <boxGeometry args={[0.4, 0.05, 0.15]} />
        <meshStandardMaterial color="#002040" />
      </mesh>
      
      {/* Engine glow */}
      <pointLight 
        ref={engineGlowRef} 
        position={[0, 0, -0.4]} 
        distance={2} 
        intensity={glowIntensityBase} 
        color={color} 
      />
      
      <mesh position={[0, 0, -0.35]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}
