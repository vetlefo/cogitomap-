import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useVisualization } from '../lib/stores/useVisualization';
import { MathUtils } from 'three';

export default function SceneManager() {
  const { scene, camera } = useThree();
  const { nodes } = useVisualization();
  
  // Create a grid for visual reference
  useEffect(() => {
    // Create cyberpunk style grid
    const gridSize = 40;
    const gridDivisions = 40;
    const gridHelper = new THREE.GridHelper(
      gridSize, 
      gridDivisions,
      new THREE.Color(0x00ffff), // Cyan color for main lines
      new THREE.Color(0x004040)  // Darker cyan for secondary lines
    );
    gridHelper.position.y = -5;
    
    // Apply slight animation to the grid
    const gridMaterial = gridHelper.material as THREE.Material;
    if (Array.isArray(gridMaterial)) {
      gridMaterial.forEach(mat => {
        if (mat instanceof THREE.LineBasicMaterial) {
          mat.transparent = true;
          mat.opacity = 0.4;
        }
      });
    } else if (gridMaterial instanceof THREE.LineBasicMaterial) {
      gridMaterial.transparent = true;
      gridMaterial.opacity = 0.4;
    }
    
    scene.add(gridHelper);
    
    // Add fog for depth and cyberpunk feel
    scene.fog = new THREE.FogExp2(0x000814, 0.03);
    
    // Cleanup on unmount
    return () => {
      scene.remove(gridHelper);
      scene.fog = null;
    };
  }, [scene]);

  // Add ambient particles for cyberpunk atmosphere
  const particlesRef = useRef<THREE.Points | null>(null);
  
  useEffect(() => {
    // Create particles
    const particleCount = 1000;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      particlePositions[i3] = (Math.random() - 0.5) * 50; // x
      particlePositions[i3 + 1] = (Math.random() - 0.5) * 50; // y
      particlePositions[i3 + 2] = (Math.random() - 0.5) * 50; // z
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    
    const particleMaterial = new THREE.PointsMaterial({
      color: 0x0088ff,
      size: 0.05,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending
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
  
  // Animate particles
  useFrame((state) => {
    if (particlesRef.current) {
      particlesRef.current.rotation.y = state.clock.getElapsedTime() * 0.05;
      
      // Get particle positions
      const positions = particlesRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
      const positionArray = positions.array as Float32Array;
      
      // Randomly reposition some particles for a twinkling effect
      for (let i = 0; i < 10; i++) {
        const idx = Math.floor(Math.random() * (positionArray.length / 3));
        const i3 = idx * 3;
        
        if (Math.random() > 0.99) {
          positionArray[i3] = (Math.random() - 0.5) * 50; // x
          positionArray[i3 + 1] = (Math.random() - 0.5) * 50; // y
          positionArray[i3 + 2] = (Math.random() - 0.5) * 50; // z
        }
      }
      
      positions.needsUpdate = true;
    }
  });
  
  // Adjust camera based on nodes
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
  
  return null;
}
