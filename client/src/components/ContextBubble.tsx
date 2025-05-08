import { useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { BubbleNode } from "../types";

interface ContextBubbleProps {
  node: BubbleNode;
  onClick?: (node: BubbleNode) => void;
  pulsate?: boolean;
  scale?: number;
}

export default function ContextBubble({ 
  node, 
  onClick,
  pulsate = true, 
  scale = 1 
}: ContextBubbleProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [active, setActive] = useState(false);
  const [showText, setShowText] = useState(false);
  
  // Color based on node type and state
  let color = node.type === 'user' ? 0x0066ff : 0x00ff99;
  if (hovered) color = node.type === 'user' ? 0x66aaff : 0x66ffbb;
  if (active) color = 0xff9900;

  // Pulsation animation
  useFrame((state) => {
    if (!meshRef.current) return;
    
    if (pulsate) {
      const t = state.clock.getElapsedTime();
      const pulseFactor = 0.05 * Math.sin(t * 2);
      meshRef.current.scale.setScalar((scale + pulseFactor) * (1 + node.importance * 0.5));
    }
    
    // Add subtle rotation
    meshRef.current.rotation.x = Math.sin(state.clock.getElapsedTime() / 4) * 0.3;
    meshRef.current.rotation.z = Math.cos(state.clock.getElapsedTime() / 4) * 0.2;
  });

  // Random offsets for more organic movement
  const wobbleOffset = useRef({
    x: Math.random() * Math.PI * 2,
    y: Math.random() * Math.PI * 2,
    z: Math.random() * Math.PI * 2,
    speed: 0.2 + Math.random() * 0.3,
    amplitude: 0.05 + Math.random() * 0.1
  });

  // Bubble wobble effect
  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    const wobble = wobbleOffset.current;
    
    // Apply the wobble effect
    const posX = node.position.x + Math.sin(t * wobble.speed + wobble.x) * wobble.amplitude;
    const posY = node.position.y + Math.sin(t * wobble.speed + wobble.y) * wobble.amplitude;
    const posZ = node.position.z + Math.sin(t * wobble.speed + wobble.z) * wobble.amplitude;
    
    meshRef.current.position.set(posX, posY, posZ);
  });

  // Handle interaction
  const handleClick = () => {
    setActive(!active);
    setShowText(!showText);
    if (onClick) onClick(node);
  };

  // Create a material with glow effect
  const material = useRef(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      emissive: new THREE.Color(color).multiplyScalar(0.4),
      metalness: 0.5,
      roughness: 0.2,
    })
  );

  // Update material when color changes
  useEffect(() => {
    material.current.color.set(new THREE.Color(color));
    material.current.emissive.set(new THREE.Color(color).multiplyScalar(0.4));
  }, [color]);

  return (
    <group>
      <mesh
        ref={meshRef}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={handleClick}
        position={[node.position.x, node.position.y, node.position.z]}
        scale={scale * (1 + node.importance * 0.5)}
      >
        <sphereGeometry args={[1, 32, 32]} />
        <primitive object={material.current} attach="material" />
      </mesh>
      
      {/* Text label */}
      {(showText || hovered) && (
        <Html position={[node.position.x, node.position.y + 1.5, node.position.z]}>
          <div className="text-snippet">
            {node.content.length > 100 
              ? `${node.content.substring(0, 100)}...` 
              : node.content}
          </div>
        </Html>
      )}
    </group>
  );
}
