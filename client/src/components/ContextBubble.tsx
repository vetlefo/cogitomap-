import { useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Html, useTexture, MeshDistortMaterial, MeshWobbleMaterial, Sphere } from "@react-three/drei";
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
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [active, setActive] = useState(false);
  const [showText, setShowText] = useState(false);
  
  // Enhanced colors with more vibrance
  let color = node.type === 'user' ? 0x0088ff : 0x00ff99;
  let emissiveIntensity = 0.6;
  
  if (hovered) {
    color = node.type === 'user' ? 0x66aaff : 0x66ffbb;
    emissiveIntensity = 0.8;
  }
  
  if (active) {
    color = 0xff9900;
    emissiveIntensity = 1.0;
  }

  // Pulsation animation with more organic feel
  useFrame((state) => {
    if (!meshRef.current || !glowRef.current) return;
    
    const t = state.clock.getElapsedTime();
    
    if (pulsate) {
      // More natural pulsation with combined sine waves
      const pulseFactor = 0.05 * Math.sin(t * 2) + 0.03 * Math.sin(t * 3.7);
      const baseScale = scale * (1 + node.importance * 0.5);
      meshRef.current.scale.setScalar(baseScale + pulseFactor);
      
      // Make the glow pulsate slightly larger than the bubble
      glowRef.current.scale.setScalar(baseScale + pulseFactor + 0.3);
    }
    
    // Add subtle, more natural rotation
    meshRef.current.rotation.x = Math.sin(t / 4) * 0.3;
    meshRef.current.rotation.z = Math.cos(t / 5) * 0.2;
    meshRef.current.rotation.y = Math.sin(t / 6) * 0.1;
  });

  // Enhanced wobble effect with more natural motion
  const wobbleOffset = useRef({
    x: Math.random() * Math.PI * 2,
    y: Math.random() * Math.PI * 2,
    z: Math.random() * Math.PI * 2,
    speed: 0.15 + Math.random() * 0.2, // Slower for more natural feel
    amplitude: 0.05 + Math.random() * 0.1 * (node.importance + 0.5) // More important nodes move more
  });

  // Bubble position with organic wobble
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    const wobble = wobbleOffset.current;
    
    // Apply complex wobble effect with multiple sine waves for natural movement
    const posX = node.position.x + 
      Math.sin(t * wobble.speed + wobble.x) * wobble.amplitude + 
      Math.sin(t * wobble.speed * 0.7 + wobble.x * 2) * wobble.amplitude * 0.3;
      
    const posY = node.position.y + 
      Math.sin(t * wobble.speed + wobble.y) * wobble.amplitude + 
      Math.cos(t * wobble.speed * 0.6 + wobble.y * 1.5) * wobble.amplitude * 0.4;
      
    const posZ = node.position.z + 
      Math.sin(t * wobble.speed + wobble.z) * wobble.amplitude +
      Math.sin(t * wobble.speed * 0.8 + wobble.z * 1.8) * wobble.amplitude * 0.3;
    
    groupRef.current.position.set(posX, posY, posZ);
  });

  // Handle interaction with improved feedback
  const handleClick = () => {
    setActive(!active);
    setShowText(!showText);
    
    // Add subtle "pop" animation on click
    if (meshRef.current) {
      meshRef.current.scale.multiplyScalar(1.2);
      setTimeout(() => {
        if (meshRef.current) {
          meshRef.current.scale.divideScalar(1.2);
        }
      }, 150);
    }
    
    if (onClick) onClick(node);
  };

  // Set up the main material with enhanced properties
  const bubbleMaterial = useRef(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      emissive: new THREE.Color(color),
      emissiveIntensity: emissiveIntensity,
      metalness: 0.6,
      roughness: 0.2,
      envMapIntensity: 1.0,
      transparent: true,
      opacity: 0.9,
    })
  );

  // Update material properties on color/state change
  useEffect(() => {
    if (bubbleMaterial.current) {
      bubbleMaterial.current.color.set(new THREE.Color(color));
      bubbleMaterial.current.emissive.set(new THREE.Color(color));
      bubbleMaterial.current.emissiveIntensity = emissiveIntensity;
      
      // Make active nodes more shiny
      bubbleMaterial.current.metalness = active ? 0.8 : 0.6;
      bubbleMaterial.current.roughness = active ? 0.1 : 0.2;
    }
  }, [color, active, emissiveIntensity]);

  // Prepare keywords for display
  const keywordsText = node.keywords.length > 0 
    ? node.keywords.slice(0, 3).join(", ") 
    : "";

  return (
    <group ref={groupRef}>
      {/* Outer glow sphere */}
      <mesh
        ref={glowRef}
        scale={scale * (1 + node.importance * 0.5) + 0.3}
      >
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color={new THREE.Color(color)}
          transparent={true}
          opacity={0.15}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      
      {/* Main bubble */}
      {node.type === 'user' ? (
        // User nodes use MeshWobbleMaterial for a more organic feel
        <mesh
          ref={meshRef}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
          onClick={handleClick}
          scale={scale * (1 + node.importance * 0.5)}
        >
          <sphereGeometry args={[1, 32, 32]} />
          <MeshWobbleMaterial
            color={new THREE.Color(color)}
            emissive={new THREE.Color(color)}
            emissiveIntensity={emissiveIntensity}
            metalness={active ? 0.8 : 0.6}
            roughness={active ? 0.1 : 0.2}
            factor={0.2} // Wobble amount
            speed={0.5} // Wobble speed
            transparent
            opacity={0.95}
          />
        </mesh>
      ) : (
        // AI nodes use MeshDistortMaterial for a more technical, fluid look
        <mesh
          ref={meshRef}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
          onClick={handleClick}
          scale={scale * (1 + node.importance * 0.5)}
        >
          <sphereGeometry args={[1, 32, 32]} />
          <MeshDistortMaterial
            color={new THREE.Color(color)}
            emissive={new THREE.Color(color)}
            emissiveIntensity={emissiveIntensity}
            metalness={active ? 0.8 : 0.6}
            roughness={active ? 0.1 : 0.2}
            distort={0.3} // Amount of distortion
            speed={2} // Speed of distortion
            transparent
            opacity={0.95}
          />
        </mesh>
      )}
      
      {/* Particle effect around important nodes */}
      {node.importance > 0.6 && (
        <Sphere args={[1.5, 8, 8]} scale={scale * (1 + node.importance * 0.4)}>
          <meshBasicMaterial
            color={new THREE.Color(color)}
            wireframe
            transparent
            opacity={0.1}
          />
        </Sphere>
      )}
      
      {/* Enhanced text label with keywords and metadata */}
      {(showText || hovered) && (
        <Html
          position={[0, 1.8, 0]}
          center
          distanceFactor={10}
          occlude
        >
          <div className={`text-snippet ${node.type === 'user' ? 'text-user' : 'text-ai'}`}>
            <div className="bubble-header">
              <span className="bubble-type">{node.type === 'user' ? 'USER' : 'AI'}</span>
              <span className="bubble-importance">{Math.round(node.importance * 100)}% relevance</span>
            </div>
            <div className="bubble-content">
              {node.content.length > 150 
                ? `${node.content.substring(0, 150)}...` 
                : node.content}
            </div>
            {keywordsText && (
              <div className="bubble-keywords">
                <span className="keywords-label">Topics:</span> {node.keywords.map((keyword, i) => (
                  <span key={i} className="keyword-tag">
                    {keyword}
                  </span>
                ))}
              </div>
            )}
            <div className="bubble-footer">
              {active ? 'Click to hide details' : 'Click to lock view'}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}
