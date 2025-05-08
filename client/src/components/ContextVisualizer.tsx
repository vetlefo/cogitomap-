import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import ContextBubble from './ContextBubble';
import SceneManager from './SceneManager';
import { useVisualization } from '../lib/stores/useVisualization';
import { AgentDrone } from './AgentDrone';

interface ContextVisualizerProps {
  showDrones: boolean;
}

export default function ContextVisualizer({ showDrones }: ContextVisualizerProps) {
  const { nodes, edges } = useVisualization();
  const edgeLinesRef = useRef<THREE.LineSegments | null>(null);
  
  // Update edge connections with enhanced visuals
  useEffect(() => {
    if (edges.length > 0) {
      // Create a lookup map for node positions by ID
      const nodePositionsMap = nodes.reduce((acc, node) => {
        acc[node.id] = node.position;
        return acc;
      }, {} as Record<string, { x: number; y: number; z: number }>);
      
      // Create edge geometry
      const linePoints: number[] = [];
      
      edges.forEach(edge => {
        const sourcePos = nodePositionsMap[edge.source];
        const targetPos = nodePositionsMap[edge.target];
        
        if (sourcePos && targetPos) {
          linePoints.push(
            sourcePos.x, sourcePos.y, sourcePos.z,
            targetPos.x, targetPos.y, targetPos.z
          );
        }
      });
      
      if (linePoints.length > 0) {
        const edgeGeometry = new THREE.BufferGeometry();
        edgeGeometry.setAttribute(
          'position', 
          new THREE.Float32BufferAttribute(linePoints, 3)
        );
        
        // Enhanced edge material with glow effect
        const edgeMaterial = new THREE.LineBasicMaterial({ 
          color: 0x00ffff,
          transparent: true,
          opacity: 0.6,
          linewidth: 1, // Note: line width beyond 1 doesn't work in WebGL
          blending: THREE.AdditiveBlending // Adds glow effect
        });
        
        // Remove old lines if they exist
        if (edgeLinesRef.current) {
          if (edgeLinesRef.current.geometry) {
            edgeLinesRef.current.geometry.dispose();
          }
          
          // Properly handle material disposal by checking type
          const material = edgeLinesRef.current.material;
          if (material) {
            if (Array.isArray(material)) {
              material.forEach(m => m.dispose());
            } else {
              material.dispose();
            }
          }
          
          edgeLinesRef.current.parent?.remove(edgeLinesRef.current);
        }
        
        // Create new lines
        const lines = new THREE.LineSegments(edgeGeometry, edgeMaterial);
        edgeLinesRef.current = lines;
        
        // Return the lines object to be added to the scene
        return () => {
          if (edgeLinesRef.current) {
            edgeLinesRef.current.parent?.remove(edgeLinesRef.current);
            
            if (edgeLinesRef.current.geometry) {
              edgeLinesRef.current.geometry.dispose();
            }
            
            // Properly handle material disposal
            const material = edgeLinesRef.current.material;
            if (material) {
              if (Array.isArray(material)) {
                material.forEach(m => m.dispose());
              } else {
                material.dispose();
              }
            }
          }
        };
      }
    }
  }, [nodes, edges]);

  // Animation for edge lines - pulse effect
  useFrame((state) => {
    if (edgeLinesRef.current) {
      const material = edgeLinesRef.current.material as THREE.LineBasicMaterial;
      material.opacity = 0.3 + Math.sin(state.clock.getElapsedTime() * 2) * 0.2;
    }
  });

  return (
    <>
      <SceneManager />
      
      {/* Render all the nodes */}
      {nodes.map((node) => (
        <ContextBubble 
          key={node.id} 
          node={node} 
        />
      ))}
      
      {/* Render the edges */}
      {edgeLinesRef.current && <primitive object={edgeLinesRef.current} />}
      
      {/* Render agent drones */}
      {showDrones && nodes.length > 0 && (
        <>
          <AgentDrone startPosition={[5, 0, 5]} nodes={nodes} />
          <AgentDrone startPosition={[-5, 3, -5]} nodes={nodes} />
          <AgentDrone startPosition={[0, -5, 8]} nodes={nodes} />
        </>
      )}
    </>
  );
}

// Note: We're using the AgentDrone component imported from './AgentDrone'
