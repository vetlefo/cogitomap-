import { useRef, useState, useEffect } from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { Html, useTexture, MeshDistortMaterial, MeshWobbleMaterial, Sphere } from "@react-three/drei";
import { BubbleNode } from "../types";
import { useVisualization } from "../lib/stores/useVisualization";
import { useKeyboardState } from "../hooks/useKeyboardState";

// Utility function to blend two hex colors
function blendColors(color1: number, color2: number, ratio: number): number {
  // Convert hex to RGB
  const r1 = (color1 >> 16) & 255;
  const g1 = (color1 >> 8) & 255;
  const b1 = color1 & 255;
  
  const r2 = (color2 >> 16) & 255;
  const g2 = (color2 >> 8) & 255;
  const b2 = color2 & 255;
  
  // Blend colors
  const r = Math.round(r1 * (1 - ratio) + r2 * ratio);
  const g = Math.round(g1 * (1 - ratio) + g2 * ratio);
  const b = Math.round(b1 * (1 - ratio) + b2 * ratio);
  
  // Convert back to hex
  return (r << 16) + (g << 8) + b;
}

interface ContextBubbleProps {
  node: BubbleNode;
  onClick?: (node: BubbleNode) => void;
  pulsate?: boolean;
  scale?: number;
  source?: string; // The source window/conversation ID for "second opinion" feature
}

export default function ContextBubble({ 
  node, 
  onClick,
  pulsate = true, 
  scale = 1,
  source = 'main'
}: ContextBubbleProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [active, setActive] = useState(false);
  const [showText, setShowText] = useState(false);
  
  // Use our keyboard state hook to track shift key
  const keyboardState = useKeyboardState();
  
  // Get state from the visualization store
  const { 
    selectedNodeId,
    selectedNodes, 
    toggleNodeSelection,
    selectNode,
    setHoveredNode,
    hoveredNodeId,
    opinionSources,
    markNodeSource,
    validation,
    validateNode,
    rejectNode,
    markNodePending
  } = useVisualization();
  
  // Determine if this node is selected (either as primary or in multi-select)
  const isPrimarySelected = selectedNodeId === node.id;
  const isMultiSelected = selectedNodes.includes(node.id);
  const isSelected = isPrimarySelected || isMultiSelected;
  const isHovered = hoveredNodeId === node.id || hovered;
  
  // Add debug logging for selection state
  useEffect(() => {
    console.log(`ContextBubble ${node.id.substring(0, 8)} - Selection Update:
    - isSelected: ${isSelected}
    - In selectedNodes array: ${selectedNodes.includes(node.id)}
    - selectedNodeId: ${selectedNodeId === node.id ? 'yes' : 'no'}
    - selectedNodes count: ${selectedNodes.length}
    - Current selectedNodes: [${selectedNodes.join(', ')}]`);
  }, [isSelected, selectedNodes, selectedNodeId, node.id]);
  
  // Set the source window/conversation for this node when it's created
  useEffect(() => {
    if (source && node.id) {
      markNodeSource(node.id, source);
    }
  }, [node.id, source, markNodeSource]);
  
  // Get the actual source from store or use the prop
  const nodeSource = node.id && opinionSources[node.id] ? opinionSources[node.id] : source;
  
  // Enhanced colors based on node type with more vibrance
  let color = 0x00ff99; // Default color (AI assistant)
  let emissiveIntensity = 0.6;
  
  // Color mapping for different node types, with 'second opinion' variations
  switch (node.type) {
    case 'user_message':
      color = nodeSource === 'main' ? 0x0088ff : 0x8844ff; // Blue for main, purple for second opinion
      break;
    case 'ai_message':
      color = nodeSource === 'main' ? 0x00ff99 : 0x66ccaa; // Green for main, teal for second opinion
      break;
    case 'topic':
      color = nodeSource === 'main' ? 0xaa44cc : 0xdd66ee; // Purple for main, light purple for second opinion
      break;
    case 'entity':
      color = nodeSource === 'main' ? 0xff8800 : 0xffaa44; // Orange for main, light orange for second opinion
      break;
    case 'summary':
      color = nodeSource === 'main' ? 0xffcc00 : 0xffdd66; // Yellow for main, light yellow for second opinion
      break;
    case 'question':
      color = nodeSource === 'main' ? 0xff4444 : 0xff6699; // Red for main, pink for second opinion
      break;
  }
  
  // Apply sentiment color variations if sentiment is defined
  if (node.sentiment) {
    switch (node.sentiment) {
      case 'positive':
        color = blendColors(color, 0x00ff00, 0.3); // Blend with green
        break;
      case 'negative':
        color = blendColors(color, 0xff0000, 0.3); // Blend with red
        break;
      // neutral keeps the original color
    }
  }
  
  // Apply hover effect
  if (isHovered) {
    color = blendColors(color, 0xffffff, 0.3); // Lighten on hover
    emissiveIntensity = 0.8;
  }
  
  // Apply active/selected effects with different visuals for primary vs multi-select
  if (active) {
    // Active (showing details) - Orange glow
    color = 0xff9900;
    emissiveIntensity = 1.0;
  }
  
  if (isPrimarySelected) {
    // Primary selection - White glow
    color = 0xffffff;
    emissiveIntensity = 1.2;
  }
  
  if (isMultiSelected && !isPrimarySelected) {
    // Multi-selected but not primary - Purple glow
    color = 0xaa44cc;
    emissiveIntensity = 1.1;
  }
  
  // Apply special effect for second opinion nodes
  if (nodeSource !== 'main') {
    // Add a slight pulsation for second opinion nodes
    emissiveIntensity *= 1.1;
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
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    // Toggle active state for details display
    setActive(!active);
    setShowText(!showText);
    
    console.log(`Clicked on node: ${node.id}, type: ${node.type}, content: ${node.content.substring(0, 30)}...`);
    
    // Add subtle "pop" animation on click
    if (meshRef.current) {
      meshRef.current.scale.multiplyScalar(1.2);
      setTimeout(() => {
        if (meshRef.current) {
          meshRef.current.scale.divideScalar(1.2);
        }
      }, 150);
    }
    
    // If shift key is held, handle multi-select behavior
    // Use our global keyboard state hook to check if shift is pressed
    const isShiftPressed = keyboardState.shiftKey;
    console.log(`Shift key pressed: ${isShiftPressed}`);
    
    if (isShiftPressed) {
      // Toggle this node in the multi-select array
      console.log(`Shift-click detected on node ${node.id}, calling toggleNodeSelection`);
      toggleNodeSelection(node.id);
      
      // When using shift-select, also set this as the primary active node
      // This improves usability and visual feedback
      selectNode(node.id);
    } else {
      // Standard click behavior - make this the active node
      // This will also clear the multi-selection array
      console.log(`Regular click detected on node ${node.id}, calling selectNode`);
      selectNode(node.id);
      
      // Set hovered node as well for visual consistency
      setHoveredNode(node.id);
    }
    
    // Call the parent onClick handler if provided
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
  const keywordsText = node.keywords && node.keywords.length > 0 
    ? node.keywords.slice(0, 3).join(", ") 
    : "";

  // Generate node display type based on nodetype
  const getNodeTypeDisplay = () => {
    switch (node.type) {
      case 'user_message': return 'USER';
      case 'ai_message': return 'AI';
      case 'topic': return 'TOPIC';
      case 'entity': return 'ENTITY';
      case 'summary': return 'SUMMARY';
      case 'question': return 'QUESTION';
      default: return 'UNKNOWN';
    }
  };

  // Determine which 3D geometry to use based on node type
  const getNodeGeometry = () => {
    switch (node.type) {
      case 'user_message':
        return <sphereGeometry args={[1, 32, 32]} />;
      case 'ai_message':
        return <sphereGeometry args={[1, 32, 32]} />;
      case 'topic':
        return <icosahedronGeometry args={[1, 1]} />;
      case 'entity':
        return <boxGeometry args={[1.4, 1.4, 1.4]} />;
      case 'summary':
        return <dodecahedronGeometry args={[1, 0]} />;
      case 'question':
        return <octahedronGeometry args={[1, 0]} />;
      default:
        return <sphereGeometry args={[1, 24, 24]} />;
    }
  };

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
      
      {/* Main bubble - choose material based on node type */}
      {node.type === 'user_message' || node.type === 'question' ? (
        // User messages and questions use MeshWobbleMaterial for a more organic feel
        <mesh
          ref={meshRef}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
          onClick={handleClick}
          scale={scale * (1 + node.importance * 0.5)}
        >
          {getNodeGeometry()}
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
        // Other nodes use MeshDistortMaterial for a more technical, fluid look
        <mesh
          ref={meshRef}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
          onClick={handleClick}
          scale={scale * (1 + node.importance * 0.5)}
        >
          {getNodeGeometry()}
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
          <div className={`text-snippet ${node.type === 'user_message' ? 'text-user' : 'text-ai'}`}>
            <div className="bubble-header">
              <span className="bubble-type">{getNodeTypeDisplay()}</span>
              <span className="bubble-importance">{Math.round(node.importance * 100)}% relevance</span>
              {node.sentiment && (
                <span className={`bubble-sentiment ${node.sentiment}`}>
                  {node.sentiment.toUpperCase()}
                </span>
              )}
            </div>
            <div className="bubble-content">
              {node.content.length > 150 
                ? `${node.content.substring(0, 150)}...` 
                : node.content}
            </div>
            {node.keywords && node.keywords.length > 0 && (
              <div className="bubble-keywords">
                <span className="keywords-label">Topics:</span>
                {node.keywords.map((keyword, i) => (
                  <span key={i} className="keyword-tag">
                    {keyword}
                  </span>
                ))}
              </div>
            )}
            {node.metadata && Object.keys(node.metadata).length > 0 && (
              <div className="bubble-metadata">
                <span className="metadata-label">Metadata:</span>
                {Object.entries(node.metadata).map(([key, value], i) => (
                  <span key={i} className="metadata-item">
                    {key}: {String(value)}
                  </span>
                ))}
              </div>
            )}
            {/* Validation UI for second opinion nodes */}
            {nodeSource !== 'main' && (
              <div className="validation-container">
                <div className="validation-header">
                  <span className="validation-source">Second Opinion Source</span>
                </div>
                
                {/* Validation status indicators */}
                {validation.validated.includes(node.id) && (
                  <div className="validation-status validated">
                    ✓ Validated - Added to main graph
                  </div>
                )}
                
                {validation.rejected.includes(node.id) && (
                  <div className="validation-status rejected">
                    ✗ Rejected - Not integrated
                  </div>
                )}
                
                {validation.pending.includes(node.id) && (
                  <div className="validation-status pending">
                    ⟳ Pending review...
                  </div>
                )}
                
                {/* Validation action buttons - only show if not already validated/rejected */}
                {!validation.validated.includes(node.id) && 
                 !validation.rejected.includes(node.id) && (
                  <div className="validation-buttons">
                    <button 
                      className="validate-button"
                      onClick={(e) => {
                        e.stopPropagation(); // Don't trigger node click
                        validateNode(node.id);
                      }}
                    >
                      Validate & Integrate
                    </button>
                    <button 
                      className="reject-button"
                      onClick={(e) => {
                        e.stopPropagation(); // Don't trigger node click
                        rejectNode(node.id);
                      }}
                    >
                      Reject
                    </button>
                  </div>
                )}
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
