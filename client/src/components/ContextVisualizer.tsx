import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import ContextBubble from './ContextBubble';
import SceneManager from './SceneManager';
import { useVisualization } from '../lib/stores/useVisualization';
import { AgentDrone } from './AgentDrone';
import { useKeyboardState } from '../hooks/useKeyboardState';

interface ContextVisualizerProps {
  showDrones: boolean;
}

export default function ContextVisualizer({ showDrones }: ContextVisualizerProps) {
  const { nodes, edges, selectedNodes } = useVisualization();
  const edgeLinesRef = useRef<THREE.Group | null>(null);
  const keyboardState = useKeyboardState();
  
  // Debug console log for selected nodes
  useEffect(() => {
    console.log(`ContextVisualizer - Selected Nodes: [${selectedNodes.join(', ')}]`);
    console.log(`ContextVisualizer - Total Nodes: ${nodes.length}`);
    console.log(`ContextVisualizer - Shift key state: ${keyboardState.shiftKey}`);
    
    // Log a few node examples if we have any
    if (nodes.length > 0) {
      const sampleNode = nodes[0];
      console.log(`Sample node: id=${sampleNode.id}, type=${sampleNode.type}, content=${sampleNode.content.substring(0, 30)}...`);
    }
  }, [nodes, selectedNodes, keyboardState.shiftKey]);
  
  // Update edge connections with enhanced visuals and meaningful representations
  useEffect(() => {
    if (edges.length > 0) {
      // Create a lookup map for node positions and metadata by ID
      const nodeDataMap = nodes.reduce((acc, node) => {
        acc[node.id] = {
          position: node.position,
          type: node.type,
          importance: node.importance
        };
        return acc;
      }, {} as Record<string, { 
        position: { x: number; y: number; z: number }; 
        type: string;
        importance: number;
      }>);
      
      // Create separate materials and geometries for different connection types:
      // 1. Conversation flow (direct Q&A pairs)
      // 2. Semantic similarity (concept relationships)
      // 3. Topic similarity (thematic connections)
      const conversationPoints: number[] = [];
      const semanticPoints: number[] = [];
      const topicPoints: number[] = [];
      
      // Color values for different connection types
      const conversationColor = new THREE.Color(0x00dbff); // Bright cyan
      const semanticColor = new THREE.Color(0x00acff);     // Mid blue
      const topicColor = new THREE.Color(0x007aff);        // Deep blue
      
      // Process each edge
      edges.forEach(edge => {
        const sourceData = nodeDataMap[edge.source];
        const targetData = nodeDataMap[edge.target];
        
        if (sourceData && targetData) {
          const sourcePos = sourceData.position;
          const targetPos = targetData.position;
          
          // Determine connection type based on edge metadata
          // High strength (0.8-1.0) = direct conversation flow
          // Medium strength (0.4-0.7) = semantic relationship
          // Low strength (0.1-0.3) = topic similarity
          let points: number[];
          
          if (edge.strength >= 0.8) {
            points = conversationPoints;
          } else if (edge.strength >= 0.4) {
            points = semanticPoints;
          } else {
            points = topicPoints;
          }
          
          // For curved connections, generate a slight arc
          // Only for non-direct conversation flows (semantic & topic connections)
          if (edge.strength < 0.8) {
            // Calculate midpoint with slight upward curve
            const midX = (sourcePos.x + targetPos.x) / 2;
            const midY = (sourcePos.y + targetPos.y) / 2 + 
                         Math.min(
                           Math.sqrt(
                             Math.pow(targetPos.x - sourcePos.x, 2) + 
                             Math.pow(targetPos.z - sourcePos.z, 2)
                           ) * 0.15,
                           1.5
                         ); // Arc height based on horizontal distance
            const midZ = (sourcePos.z + targetPos.z) / 2;
            
            // First segment
            points.push(
              sourcePos.x, sourcePos.y, sourcePos.z,
              midX, midY, midZ
            );
            
            // Second segment
            points.push(
              midX, midY, midZ,
              targetPos.x, targetPos.y, targetPos.z
            );
          } else {
            // Direct line for conversation flows
            points.push(
              sourcePos.x, sourcePos.y, sourcePos.z,
              targetPos.x, targetPos.y, targetPos.z
            );
          }
        }
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
      
      // Create conversational flow lines (bright, thick)
      if (conversationPoints.length > 0) {
        const convGeometry = new THREE.BufferGeometry();
        convGeometry.setAttribute(
          'position', 
          new THREE.Float32BufferAttribute(conversationPoints, 3)
        );
        
        const convMaterial = new THREE.LineBasicMaterial({ 
          color: conversationColor,
          transparent: true,
          opacity: 0.8,
          linewidth: 1,
          blending: THREE.AdditiveBlending
        });
        
        const convLines = new THREE.LineSegments(convGeometry, convMaterial);
        linesGroup.add(convLines);
      }
      
      // Create semantic relationship lines (medium brightness/thickness)
      if (semanticPoints.length > 0) {
        const semGeometry = new THREE.BufferGeometry();
        semGeometry.setAttribute(
          'position', 
          new THREE.Float32BufferAttribute(semanticPoints, 3)
        );
        
        const semMaterial = new THREE.LineBasicMaterial({ 
          color: semanticColor,
          transparent: true,
          opacity: 0.6,
          linewidth: 1,
          blending: THREE.AdditiveBlending
        });
        
        const semLines = new THREE.LineSegments(semGeometry, semMaterial);
        linesGroup.add(semLines);
      }
      
      // Create topic similarity lines (subtle, thin)
      if (topicPoints.length > 0) {
        const topicGeometry = new THREE.BufferGeometry();
        topicGeometry.setAttribute(
          'position', 
          new THREE.Float32BufferAttribute(topicPoints, 3)
        );
        
        const topicMaterial = new THREE.LineBasicMaterial({ 
          color: topicColor,
          transparent: true,
          opacity: 0.4,
          linewidth: 1,
          blending: THREE.AdditiveBlending
        });
        
        const topicLines = new THREE.LineSegments(topicGeometry, topicMaterial);
        linesGroup.add(topicLines);
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

  // Animation for edge lines - pulse effect
  useFrame((state) => {
    if (edgeLinesRef.current) {
      // Apply pulse animation to each line segment in the group
      edgeLinesRef.current.traverse((child) => {
        if (child instanceof THREE.LineSegments) {
          const material = child.material as THREE.LineBasicMaterial;
          if (material && !Array.isArray(material)) {
            // Check what index this child is in the group to determine animation
            const childIndex = child.parent?.children.indexOf(child) || 0;
            
            // Different animations based on child index
            if (childIndex === 0) { // Conversation lines
              material.opacity = 0.6 + Math.sin(state.clock.getElapsedTime() * 2.5) * 0.25;
            } else if (childIndex === 1) { // Semantic lines
              material.opacity = 0.4 + Math.sin(state.clock.getElapsedTime() * 1.8) * 0.2;
            } else { // Topic lines
              material.opacity = 0.3 + Math.sin(state.clock.getElapsedTime() * 1.2) * 0.15;
            }
          }
        }
      });
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
