import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Trail } from '@react-three/drei';
import { BubbleNode } from '../types';

interface AgentDroneProps {
  startPosition: [number, number, number];
  nodes: BubbleNode[];
  color?: string;
}

/**
 * AI Agent drone that navigates between conversation nodes with advanced visual effects
 */
export function AgentDrone({ 
  startPosition, 
  nodes,
  color = '#00ffff' 
}: AgentDroneProps) {
  const droneRef = useRef<THREE.Group>(null);
  const wingLeftRef = useRef<THREE.Mesh>(null);
  const wingRightRef = useRef<THREE.Mesh>(null);
  const targetIndexRef = useRef(0);
  const lastPositionRef = useRef(new THREE.Vector3(...startPosition));
  const speedRef = useRef(0.02 + Math.random() * 0.03);
  
  // Flicker effect for the engine glow with more complexity
  const engineGlowRef = useRef<THREE.PointLight>(null);
  const glowIntensityBase = 0.8;
  
  // Create unique color variation for each drone
  const droneColor = useMemo(() => {
    // Start with base color and adjust hue slightly
    const colorObj = new THREE.Color(color);
    const hsl = { h: 0, s: 0, l: 0 };
    colorObj.getHSL(hsl);
    
    // Adjust hue by random amount
    hsl.h = (hsl.h + Math.random() * 0.2) % 1;
    // Make sure saturation is high enough to be visible
    hsl.s = Math.max(0.7, hsl.s);
    
    return new THREE.Color().setHSL(hsl.h, hsl.s, hsl.l);
  }, [color]);
  
  // Convert THREE.Color to hex string for props
  const droneColorHex = useMemo(() => droneColor.getHexString(), [droneColor]);
  
  useFrame((state) => {
    if (!droneRef.current || !wingLeftRef.current || !wingRightRef.current || nodes.length === 0) return;
    
    const time = state.clock.getElapsedTime();
    
    // Flicker the engine glow with complex pattern
    if (engineGlowRef.current) {
      // Combine multiple sine waves for more organic flickering
      engineGlowRef.current.intensity = 
        glowIntensityBase + 
        Math.sin(time * 10) * 0.1 + 
        Math.sin(time * 25) * 0.05;
      
      // Occasionally add a bigger pulse
      if (Math.random() > 0.995) {
        engineGlowRef.current.intensity = glowIntensityBase * 1.5;
      }
    }
    
    // Wing animation - slight flapping/tilting
    const wingTilt = Math.sin(time * 15) * 0.2;
    wingLeftRef.current.rotation.z = 0.2 + wingTilt;
    wingRightRef.current.rotation.z = -0.2 - wingTilt;
    
    // Select current target node
    const targetIdx = targetIndexRef.current % nodes.length;
    const targetNode = nodes[targetIdx];
    const targetPos = new THREE.Vector3(
      targetNode.position.x,
      targetNode.position.y,
      targetNode.position.z
    );
    
    // Store current position for velocity calculation
    const currentPos = droneRef.current.position.clone();
    
    // Calculate distance to target
    const distanceToTarget = currentPos.distanceTo(targetPos);
    
    // Adjust speed based on distance (slow down as we approach)
    const adjustedSpeed = distanceToTarget < 2 
      ? speedRef.current * (distanceToTarget / 2) 
      : speedRef.current;
    
    // Move toward target with smooth easing
    droneRef.current.position.lerp(targetPos, adjustedSpeed);
    
    // If close enough to target, choose next target
    if (distanceToTarget < 0.5) {
      // Add brief pause at node
      if (Math.random() > 0.7) {
        // Choose a more distant node occasionally to create a network scanning effect
        let nextIdx = (targetIndexRef.current + Math.floor(Math.random() * nodes.length / 2)) % nodes.length;
        targetIndexRef.current = nextIdx;
      } else {
        // Move to next sequential node
        targetIndexRef.current = (targetIndexRef.current + 1) % nodes.length;
      }
      
      // Randomize speed a bit for variety
      speedRef.current = 0.015 + Math.random() * 0.035;
    }
    
    // Calculate direction to face the target with smoothing
    const direction = new THREE.Vector3().subVectors(targetPos, currentPos).normalize();
    
    // Only update rotation if moving enough
    if (direction.length() > 0.01) {
      // Create a target quaternion for smooth rotation
      const targetQuaternion = new THREE.Quaternion();
      const lookAt = new THREE.Vector3().addVectors(currentPos, direction);
      const tempMatrix = new THREE.Matrix4();
      tempMatrix.lookAt(currentPos, lookAt, new THREE.Vector3(0, 1, 0));
      targetQuaternion.setFromRotationMatrix(tempMatrix);
      
      // Smoothly interpolate current rotation to target rotation
      droneRef.current.quaternion.slerp(targetQuaternion, 0.1);
    }
    
    // Slight bobbing motion for more lifelike movement
    droneRef.current.position.y += Math.sin(time * 2) * 0.003;
    
    // Update last position
    lastPositionRef.current.copy(currentPos);
  });
  
  return (
    <group ref={droneRef} position={startPosition}>
      {/* Thruster trail effect */}
      <Trail 
        width={0.5}
        length={8}
        color={droneColorHex}
        attenuation={(width) => width * 0.5}
      >
        <mesh position={[0, 0, -0.5]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial color={droneColorHex} transparent opacity={0} />
        </mesh>
      </Trail>
      
      {/* Drone body - more detailed and streamlined */}
      <mesh>
        <boxGeometry args={[0.3, 0.1, 0.7]} />
        <meshStandardMaterial 
          color="#001830" 
          emissive="#00233b" 
          metalness={0.8} 
          roughness={0.2} 
        />
      </mesh>
      
      {/* Detailed body elements */}
      <mesh position={[0, 0.08, 0.1]}>
        <boxGeometry args={[0.2, 0.05, 0.3]} />
        <meshStandardMaterial 
          color="#002040" 
          metalness={0.9} 
          roughness={0.1}
        />
      </mesh>
      
      {/* Cockpit/sensor array */}
      <mesh position={[0, 0.05, 0.25]}>
        <sphereGeometry args={[0.1, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial 
          color={droneColorHex} 
          emissive={droneColorHex} 
          emissiveIntensity={0.5}
          metalness={0.7} 
          roughness={0.3}
          transparent
          opacity={0.9}
        />
      </mesh>
      
      {/* Wings with animation */}
      <mesh ref={wingLeftRef} position={[0.3, 0, 0]} rotation={[0, 0, 0.2]}>
        <boxGeometry args={[0.5, 0.04, 0.2]} />
        <meshStandardMaterial 
          color="#002a40" 
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>
      <mesh ref={wingRightRef} position={[-0.3, 0, 0]} rotation={[0, 0, -0.2]}>
        <boxGeometry args={[0.5, 0.04, 0.2]} />
        <meshStandardMaterial 
          color="#002a40" 
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>
      
      {/* Wing tip lights */}
      <pointLight position={[0.5, 0, 0]} distance={2} intensity={0.2} color="#ff2a2a" />
      <pointLight position={[-0.5, 0, 0]} distance={2} intensity={0.2} color="#2aff2a" />
      
      <mesh position={[0.5, 0, 0]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshBasicMaterial color="#ff0000" />
      </mesh>
      <mesh position={[-0.5, 0, 0]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshBasicMaterial color="#00ff00" />
      </mesh>
      
      {/* Enhanced engine glow */}
      <pointLight 
        ref={engineGlowRef} 
        position={[0, 0, -0.45]} 
        distance={3} 
        intensity={glowIntensityBase} 
        color={droneColorHex} 
      />
      
      <mesh position={[0, 0, -0.40]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshBasicMaterial color={droneColorHex} transparent opacity={0.9} />
      </mesh>
      
      {/* Add a subtle ambient glow around the entire drone */}
      <pointLight position={[0, 0, 0]} distance={1.5} intensity={0.3} color={droneColorHex} />
    </group>
  );
}
