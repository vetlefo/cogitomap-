import { useRef, useEffect, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useVisualization } from '../lib/stores/useVisualization';
import { Stars, Sparkles } from '@react-three/drei';
import ParallelWindowsManager, { ParallelWindowsManagerRef } from './ParallelWindowsManager';
import SelectedNodesPanel from './SelectedNodesPanel';
import { MathUtils } from 'three';

export default function SceneManager() {
  const { scene, camera, gl } = useThree();
  const { nodes } = useVisualization();
  const [bloom, setBloom] = useState(0); // Used for pulsating bloom effect
  
  // Enhanced scene rendering with better antialiasing
  useEffect(() => {
    gl.setClearColor(new THREE.Color('#000')); 
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.0;

    // Ensure pixel ratio is set properly for better quality on high-DPI displays
    gl.setPixelRatio(window.devicePixelRatio);
    
    return () => {
      gl.setClearColor(new THREE.Color('#000'));
      gl.toneMapping = THREE.NoToneMapping;
    };
  }, [gl]);
  
  // Create an enhanced grid for visual reference
  useEffect(() => {
    // Create cyberpunk style grid with expanded size for wider visualization
    const gridSize = 150; // Increased from 60 to 150
    const gridDivisions = 80; // Increased from 60 to 80
    const gridHelper = new THREE.GridHelper(
      gridSize, 
      gridDivisions,
      new THREE.Color(0x00ffff), // Cyan color for main lines
      new THREE.Color(0x004040)  // Darker cyan for secondary lines
    );
    gridHelper.position.y = -8; // Lower position to give more space above the grid
    
    // Apply animation and transparency to the grid
    const gridMaterial = gridHelper.material as THREE.Material;
    if (Array.isArray(gridMaterial)) {
      gridMaterial.forEach(mat => {
        if (mat instanceof THREE.LineBasicMaterial) {
          mat.transparent = true;
          mat.opacity = 0.5;
          mat.blending = THREE.AdditiveBlending; // Add glow effect with blending
        }
      });
    } else if (gridMaterial instanceof THREE.LineBasicMaterial) {
      gridMaterial.transparent = true;
      gridMaterial.opacity = 0.5;
      gridMaterial.blending = THREE.AdditiveBlending;
    }
    
    scene.add(gridHelper);
    
    // Remove fog entirely for maximum visibility
    // scene.fog = new THREE.FogExp2(0x000814, 0.008);
    scene.fog = null;
    
    // Cleanup on unmount
    return () => {
      scene.remove(gridHelper);
      scene.fog = null;
    };
  }, [scene]);

  // Add ambient particles for cyberpunk atmosphere (enhanced)
  const particlesRef = useRef<THREE.Points | null>(null);
  
  useEffect(() => {
    // Create more particles for a richer atmosphere
    const particleCount = 2000;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    
    // Create particle sizes with variation
    const particleSizes = new Float32Array(particleCount);
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      particlePositions[i3] = (Math.random() - 0.5) * 80; // x (wider spread)
      particlePositions[i3 + 1] = (Math.random() - 0.5) * 80; // y
      particlePositions[i3 + 2] = (Math.random() - 0.5) * 80; // z
      
      // Vary particle sizes for more realism
      particleSizes[i] = 0.03 + Math.random() * 0.07;
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
    
    // More vibrant particle material with texture
    const particleMaterial = new THREE.PointsMaterial({
      color: 0x00aaff,
      size: 0.08,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true, // Makes particles appear smaller with distance
    });
    
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    particlesRef.current = particles;
    scene.add(particles);
    
    // Cleanup
    return () => {
      scene.remove(particles);
      particleGeometry.dispose();
      particleMaterial.dispose();
    };
  }, [scene]);
  
  // Animate particles with more complex movement
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    
    if (particlesRef.current) {
      // Gentle rotation with wobble
      particlesRef.current.rotation.y = time * 0.05;
      particlesRef.current.rotation.x = Math.sin(time * 0.025) * 0.03;
      
      // Get particle positions
      const positions = particlesRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
      const positionArray = positions.array as Float32Array;
      
      // Add wind-like movement to particles
      for (let i = 0; i < 20; i++) {
        const idx = Math.floor(Math.random() * (positionArray.length / 3));
        const i3 = idx * 3;
        
        // Randomly reposition some particles for a twinkling effect
        if (Math.random() > 0.99) {
          positionArray[i3] = (Math.random() - 0.5) * 80; // x
          positionArray[i3 + 1] = (Math.random() - 0.5) * 80; // y
          positionArray[i3 + 2] = (Math.random() - 0.5) * 80; // z
        }
        
        // Apply gentle drift to all particles
        if (Math.random() > 0.9) {
          positionArray[i3] += Math.sin(time + idx) * 0.02;
          positionArray[i3 + 1] += Math.cos(time + idx) * 0.02;
        }
      }
      
      positions.needsUpdate = true;
    }
    
    // Bloom effect pulsation
    setBloom(0.7 + Math.sin(time * 0.5) * 0.3);
  });
  
  // Adjust camera based on nodes with smoother transitions
  useEffect(() => {
    if (nodes.length > 0) {
      // Calculate the center of all nodes, ensuring position data is valid
      const validNodes = nodes.filter(node => 
        node && node.position && typeof node.position.x === 'number' && 
        typeof node.position.y === 'number' && typeof node.position.z === 'number'
      );
      
      // If no valid nodes, use a default position
      if (validNodes.length === 0) {
        console.warn('No nodes with valid position data found');
        return; // Skip camera adjustment
      }
      
      const center = validNodes.reduce(
        (acc, node) => {
          acc.x += node.position.x;
          acc.y += node.position.y;
          acc.z += node.position.z;
          return acc;
        },
        { x: 0, y: 0, z: 0 }
      );
      
      center.x /= validNodes.length;
      center.y /= validNodes.length;
      center.z /= validNodes.length;
      
      // Smoothly move camera to look at the center
      const targetPosition = new THREE.Vector3(center.x, center.y, center.z);
      camera.lookAt(targetPosition);
    }
  }, [nodes, camera]);
  
  // Create refs for component communication
  const windowsManagerRef = useRef<ParallelWindowsManagerRef>(null);
  
  // Track created second opinion windows
  const [secondOpinionWindows, setSecondOpinionWindows] = useState<string[]>([]);
  
  // Handle the request for a second opinion
  const handleRequestSecondOpinion = (selectedNodeIds: string[]) => {
    if (windowsManagerRef.current) {
      const windowId = windowsManagerRef.current.createSecondOpinionWindow(selectedNodeIds);
      if (windowId) {
        setSecondOpinionWindows(prev => [...prev, windowId]);
      }
    }
  };
  
  // Handle window creation (for tracking)
  const handleWindowCreate = (windowId: string) => {
    // Track the window ID for integration with visualization
    console.log(`New window created: ${windowId}`);
    
    // Update visualization store to mark nodes coming from this window
    // They'll be rendered with the "second opinion" color scheme
  };
  
  // Create background Knowledge Nodes representing unexplored/potential topics
  const BackgroundKnowledgeNodes = () => {
    // Generate deterministic pseudo-random positions for background knowledge nodes
    // Using deterministic randomness ensures consistent positions between renders
    const generateBackgroundNodes = () => {
      const count = 2000; // Fewer than stars for better performance
      const nodes = [];
      const seed = 42; // Fixed seed for deterministic randomness
      
      // Simple deterministic random number generator
      const randomFromSeed = (seed: number, index: number) => {
        return ((seed * 9301 + 49297) * index) % 233280 / 233280;
      };
      
      // Generate node properties with various node types
      const nodeTypes = ['topic', 'entity', 'concept', 'idea', 'question'];
      const nodeColors = [0x00aaff, 0xaa44cc, 0x00ff99, 0xff8800, 0xff4444];
      
      for (let i = 0; i < count; i++) {
        // Use deterministic randomness for position
        const distance = 80 + randomFromSeed(seed, i * 3) * 120; // Place nodes between 80-200 units away
        const theta = randomFromSeed(seed, i * 3 + 1) * Math.PI * 2;
        const phi = randomFromSeed(seed, i * 3 + 2) * Math.PI;
        
        // Convert spherical to cartesian coordinates for even distribution
        const x = distance * Math.sin(phi) * Math.cos(theta);
        const y = distance * Math.sin(phi) * Math.sin(theta);
        const z = distance * Math.cos(phi);
        
        // Randomly select node type and color
        const typeIndex = Math.floor(randomFromSeed(seed, i * 7) * nodeTypes.length);
        const type = nodeTypes[typeIndex];
        const color = nodeColors[typeIndex];
        
        // Size based on "importance" (smaller for background nodes)
        const size = 0.05 + randomFromSeed(seed, i * 5) * 0.15;
        
        nodes.push({
          position: [x, y, z],
          type,
          color,
          size,
        });
      }
      
      return nodes;
    };
    
    // Generate nodes once and memoize
    const backgroundNodes = useRef(generateBackgroundNodes());
    
    return (
      <>
        {backgroundNodes.current.map((node, index) => (
          <mesh 
            key={`bg-node-${index}`} 
            position={node.position as [number, number, number]}
            scale={node.size}
          >
            {/* Use very low-poly geometries for performance */}
            {node.type === 'topic' ? (
              <icosahedronGeometry args={[1, 0]} /> // 0 = low detail
            ) : node.type === 'entity' ? (
              <boxGeometry args={[1, 1, 1]} />
            ) : node.type === 'concept' ? (
              <sphereGeometry args={[1, 6, 6]} /> // Low segment count
            ) : node.type === 'idea' ? (
              <octahedronGeometry args={[1, 0]} /> // 0 = low detail
            ) : (
              <tetrahedronGeometry args={[1, 0]} /> // 0 = low detail
            )}
            <meshBasicMaterial // Use Basic material instead of Standard for better performance
              color={node.color}
              transparent
              opacity={0.15 + Math.random() * 0.1} // Subtle visibility
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        ))}
      </>
    );
  };
  
  return (
    <>
      {/* Replace Stars with Background Knowledge Nodes */}
      <BackgroundKnowledgeNodes />
      
      {/* Keep minimal sparkles for atmosphere */}
      <Sparkles 
        count={100} // Reduced count
        scale={[60, 60, 60]}
        size={1.0} // Smaller size 
        speed={0.2} // Slower animation
        opacity={0.1} // More subtle
        color="#00ffff" 
      />
      
      {/* Add volumetric light beam */}
      <mesh position={[0, 30, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.5, 15, 50, 16, 1, true]} /> {/* Reduced segments */}
        <meshBasicMaterial 
          color="#00aaff" 
          transparent 
          opacity={0.12} // Slightly less opaque
          side={THREE.DoubleSide} 
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </>
  );
}
