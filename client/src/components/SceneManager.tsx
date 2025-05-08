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
    // Create cyberpunk style grid with more divisions for detail
    const gridSize = 60;
    const gridDivisions = 60;
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
    
    // Add atmospheric fog for depth and cyberpunk feel (softer now)
    scene.fog = new THREE.FogExp2(0x000814, 0.02);
    
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
      // Calculate the center of all nodes
      const center = nodes.reduce(
        (acc, node) => {
          acc.x += node.position.x;
          acc.y += node.position.y;
          acc.z += node.position.z;
          return acc;
        },
        { x: 0, y: 0, z: 0 }
      );
      
      center.x /= nodes.length;
      center.y /= nodes.length;
      center.z /= nodes.length;
      
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
  
  return (
    <>
      {/* Add stars for cosmic background effect */}
      <Stars 
        radius={100} 
        depth={50} 
        count={5000} 
        factor={4} 
        saturation={0.5} 
        fade 
        speed={1} 
      />
      
      {/* Add sparkles for atmospheric glow */}
      <Sparkles 
        count={200}
        scale={[60, 60, 60]}
        size={1.5} 
        speed={0.3} 
        opacity={0.2} 
        color="#00ffff" 
      />
      
      {/* Add volumetric light beam */}
      <mesh position={[0, 30, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.5, 15, 50, 32, 1, true]} />
        <meshBasicMaterial 
          color="#00aaff" 
          transparent 
          opacity={0.15} 
          side={THREE.DoubleSide} 
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      
      {/* Render the HTML overlays */}
      <div className="overlay-container">
        {/* Node selection panel for second opinion */}
        <SelectedNodesPanel onRequestSecondOpinion={handleRequestSecondOpinion} />
        
        {/* Parallel conversation windows manager */}
        <ParallelWindowsManager 
          ref={windowsManagerRef}
          onWindowCreate={handleWindowCreate}
        />
      </div>
    </>
  );
}
