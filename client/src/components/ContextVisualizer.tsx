import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import ContextBubble from './ContextBubble';
import SceneManager from './SceneManager';
import { useVisualization } from '../lib/stores/useVisualization';
import { AgentDrone } from './AgentDrone';
import { useKeyboardState } from '../hooks/useKeyboardState';

interface ContextVisualizerProps {
  showDrones: boolean;
}

export default function ContextVisualizer({ showDrones }: ContextVisualizerProps) {
  const { 
    nodes, 
    edges, 
    selectedNodes,
    opinionSources,
    isLoading,
    error,
    loadInitialData,
    syncWithDatabase
  } = useVisualization();
  
  const edgeLinesRef = useRef<THREE.Group | null>(null);
  const keyboardState = useKeyboardState();
  
  // Load initial data from graph database
  useEffect(() => {
    console.log('ContextVisualizer - Loading initial data from graph database');
    loadInitialData().catch(error => {
      console.error('Failed to load initial graph data:', error);
    });
    
    // DISABLE periodic sync temporarily to debug disappearing nodes
    // const syncInterval = setInterval(() => {
    //   console.log('ContextVisualizer - Syncing with graph database');
    //   syncWithDatabase().catch(error => {
    //     console.error('Failed to sync with graph database:', error);
    //   });
    // }, 30000);
    
    // Clean up on unmount
    return () => {
      // clearInterval(syncInterval);
      console.log('ContextVisualizer - Unmounting, cleaning up timers');
    };
  }, [loadInitialData, syncWithDatabase]);
  
  // Debug console log for visualization state
  useEffect(() => {
    console.log(`ContextVisualizer - Selected Nodes: [${selectedNodes.join(', ')}]`);
    console.log(`ContextVisualizer - Total Nodes: ${nodes.length}`);
    console.log(`ContextVisualizer - Total Edges: ${edges.length}`);
    console.log(`ContextVisualizer - Loading State: ${isLoading}`);
    if (error) {
      console.error(`ContextVisualizer - Error: ${error}`);
    }
    
    // Log a few node examples if we have any
    if (nodes.length > 0) {
      const sampleNode = nodes[0];
      console.log(`Sample node: id=${sampleNode.id}, type=${sampleNode.type}, content=${sampleNode.content.substring(0, 30)}...`);
    }
  }, [nodes.length, edges.length, selectedNodes, isLoading, error]);
  
  // Update edge connections with enhanced visuals and meaningful representations
  useEffect(() => {
    if (edges.length > 0) {
      // Create a simple lookup map for node positions by ID
      const nodePositions = new Map<string, THREE.Vector3>();
      
      // Collect valid nodes only once
      nodes.forEach(node => {
        if (node && node.position && 
            typeof node.position.x === 'number' && 
            typeof node.position.y === 'number' && 
            typeof node.position.z === 'number') {
          nodePositions.set(node.id, new THREE.Vector3(
            node.position.x,
            node.position.y,
            node.position.z
          ));
        }
      });
      
      // Simplified: just two types of connection points for better performance
      // 1. Primary connections (most important, more visible)
      // 2. Secondary connections (less important, less visible)
      const primaryPoints: number[] = [];
      const secondaryPoints: number[] = [];
      
      // Simpler colors
      const primaryColor = new THREE.Color(0x00dbff);   // Bright cyan 
      const secondaryColor = new THREE.Color(0x0066aa); // Darker blue
      
      // Process only valid edges
      edges.forEach(edge => {
        const sourcePos = nodePositions.get(edge.source);
        const targetPos = nodePositions.get(edge.target);
        
        // Skip if either node is missing
        if (!sourcePos || !targetPos) return;
        
        // Simplify categorization - just primary vs secondary
        // More important edges (higher strength) go to primary
        const points = edge.strength >= 0.6 ? primaryPoints : secondaryPoints;
        
        // Use straight lines for all connections (much better performance)
        points.push(
          sourcePos.x, sourcePos.y, sourcePos.z,
          targetPos.x, targetPos.y, targetPos.z
        );
      });
      
      // Clean up old edge lines
      if (edgeLinesRef.current) {
        // Dispose of all geometries and materials in the group
        edgeLinesRef.current.traverse((child) => {
          if (child instanceof THREE.LineSegments) {
            if (child.geometry) {
              child.geometry.dispose();
            }
            
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        });
        
        // Remove the group from the scene
        edgeLinesRef.current.parent?.remove(edgeLinesRef.current);
        edgeLinesRef.current = null;
      }
      
      // Create a group to hold all the different line types
      const linesGroup = new THREE.Group();
      
      // Create primary connection lines (bright, more opaque)
      if (primaryPoints.length > 0) {
        const primaryGeometry = new THREE.BufferGeometry();
        primaryGeometry.setAttribute(
          'position', 
          new THREE.Float32BufferAttribute(primaryPoints, 3)
        );
        
        const primaryMaterial = new THREE.LineBasicMaterial({ 
          color: primaryColor,
          transparent: true,
          opacity: 0.8,
          linewidth: 1, // Note: linewidth has no effect in WebGL, but kept for clarity
          blending: THREE.AdditiveBlending
        });
        
        const primaryLines = new THREE.LineSegments(primaryGeometry, primaryMaterial);
        linesGroup.add(primaryLines);
      }
      
      // Create secondary connection lines (darker, more transparent)
      if (secondaryPoints.length > 0) {
        const secondaryGeometry = new THREE.BufferGeometry();
        secondaryGeometry.setAttribute(
          'position', 
          new THREE.Float32BufferAttribute(secondaryPoints, 3)
        );
        
        const secondaryMaterial = new THREE.LineBasicMaterial({ 
          color: secondaryColor,
          transparent: true,
          opacity: 0.5,
          linewidth: 1,
          blending: THREE.AdditiveBlending
        });
        
        const secondaryLines = new THREE.LineSegments(secondaryGeometry, secondaryMaterial);
        linesGroup.add(secondaryLines);
      }
      
      // Store the group in our ref
      edgeLinesRef.current = linesGroup;
      
      // Cleanup function
      return () => {
        if (edgeLinesRef.current) {
          // Clean up the entire group
          edgeLinesRef.current.traverse((child) => {
            if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
              if (child.geometry) {
                child.geometry.dispose();
              }
              
              if (child.material) {
                if (Array.isArray(child.material)) {
                  child.material.forEach(m => m.dispose());
                } else {
                  child.material.dispose();
                }
              }
            }
          });
          
          edgeLinesRef.current.parent?.remove(edgeLinesRef.current);
        }
      };
    }
  }, [nodes, edges]);

  // Simplified animation for edge lines - subtle pulse effect
  useFrame((state) => {
    if (edgeLinesRef.current) {
      // Apply subtle pulse animation to each line segment in the group
      edgeLinesRef.current.traverse((child) => {
        if (child instanceof THREE.LineSegments && child.material instanceof THREE.LineBasicMaterial) {
          const material = child.material;
          if (material && !Array.isArray(material)) {
            // Determine which type of line by checking the index in parent
            const childIndex = child.parent?.children.indexOf(child) || 0;
            
            // Primary connections (index 0) pulse more visibly
            if (childIndex === 0) {
              material.opacity = 0.6 + Math.sin(state.clock.getElapsedTime() * 2) * 0.2;
            } 
            // Secondary connections (index 1) pulse more subtly
            else {
              material.opacity = 0.4 + Math.sin(state.clock.getElapsedTime() * 1.5) * 0.1;
            }
          }
        }
      });
    }
  });

  // Helper component for loading indicator
  const LoadingIndicator = () => {
    const meshRef = useRef<THREE.Mesh>(null);
    
    useFrame(({ clock }) => {
      if (meshRef.current) {
        // Rotate the loading indicator
        meshRef.current.rotation.y = clock.getElapsedTime() * 2;
        // Pulse scale
        const scale = 0.8 + Math.sin(clock.getElapsedTime() * 4) * 0.2;
        meshRef.current.scale.set(scale, scale, scale);
      }
    });
    
    return (
      <mesh ref={meshRef} position={[0, 0, 0]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial 
          color="#00a2ff" 
          emissive="#0077ff" 
          emissiveIntensity={2}
          wireframe
        />
      </mesh>
    );
  };
  
  // Helper component for displaying errors
  const ErrorDisplay = ({ message }: { message: string }) => {
    return (
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[4, 1, 0.1]} />
        <meshStandardMaterial color="#ff0044" emissive="#ff0044" emissiveIntensity={0.5} />
        <group position={[0, 0, 0.1]}>
          {/* Error icon (X) */}
          <mesh position={[-1.5, 0, 0.1]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.5, 0.1, 0.1]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position={[-1.5, 0, 0.1]} rotation={[0, 0, -Math.PI / 4]}>
            <boxGeometry args={[0.5, 0.1, 0.1]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          {/* We can't render text directly in Three.js without additional libraries,
              so we'll use this as a visual indicator and log the error to console */}
        </group>
      </mesh>
    );
  };

  return (
    <>
      <SceneManager />
      
      {/* Show loading indicator when data is being fetched */}
      {isLoading && <LoadingIndicator />}
      
      {/* Show error if one occurred */}
      {error && <ErrorDisplay message={error} />}
      
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
      {showDrones && nodes.length > 0 && (() => {
        // Filter nodes to ensure they all have valid position data
        const validNodes = nodes.filter(node => 
          node && node.position && 
          typeof node.position.x === 'number' && 
          typeof node.position.y === 'number' && 
          typeof node.position.z === 'number'
        );
        
        // Only render drones if we have enough valid nodes
        if (validNodes.length > 1) {
          return (
            <>
              <AgentDrone startPosition={[5, 0, 5]} nodes={validNodes} color="#00eeff" />
              <AgentDrone startPosition={[-5, 3, -5]} nodes={validNodes} color="#ff00aa" />
              <AgentDrone startPosition={[0, -5, 8]} nodes={validNodes} color="#ffaa00" />
            </>
          );
        }
        return null;
      })()}
      
      {/* Display database connection status */}
      {nodes.length > 0 && (
        <group>
          {/* Connection status indicator */}
          <mesh position={[-10, -8, 0]} scale={0.5}>
            <sphereGeometry args={[0.5, 16, 16]} />
            <meshStandardMaterial color="#00ff44" emissive="#00ff44" emissiveIntensity={0.5} />
          </mesh>
          
          {/* Debug info - node count */}
          <mesh position={[-9, -8, 0]}>
            <Html>
              <div style={{ color: 'white', fontSize: '0.8rem', background: 'rgba(0,0,0,0.5)', padding: '3px' }}>
                {nodes.length} nodes
              </div>
            </Html>
          </mesh>
        </group>
      )}
    </>
  );
}

// Note: We're using the AgentDrone component imported from './AgentDrone'
