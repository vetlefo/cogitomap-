import { create } from 'zustand';
import { BubbleNode, Edge } from '../../types';

interface VisualizationState {
  nodes: BubbleNode[];
  edges: Edge[];
  selectedNodeId: string | null;
  selectedNodes: string[]; // Array of selected node IDs for bundling
  hoveredNodeId: string | null;
  
  addNode: (node: BubbleNode) => void;
  removeNode: (id: string) => void;
  updateNode: (id: string, updates: Partial<BubbleNode>) => void;
  
  addEdge: (edge: Edge) => void;
  removeEdge: (id: string) => void;
  
  selectNode: (id: string | null) => void;
  toggleNodeSelection: (id: string) => void; // For multi-select
  clearSelectedNodes: () => void;
  setHoveredNode: (id: string | null) => void;
  clearAll: () => void;
  
  // Second opinion related
  opinionSources: Record<string, string>; // Maps node IDs to their source window/conversation
  markNodeSource: (id: string, source: string) => void;
  
  // Validation features for second opinions
  validation: ValidationState;
  validateNode: (id: string) => void;       // Accept a second opinion into the main graph
  rejectNode: (id: string) => void;         // Reject a second opinion
  markNodePending: (id: string) => void;    // Mark a node as pending validation
}

// Interface to track the validation status of second opinions
interface ValidationState {
  validated: string[];   // Node IDs that have been validated
  rejected: string[];    // Node IDs that have been rejected
  pending: string[];     // Node IDs that are pending validation
}

export const useVisualization = create<VisualizationState>((set) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedNodes: [],
  hoveredNodeId: null,
  opinionSources: {},
  
  // Validation tracking for second opinions
  validation: {
    validated: [],
    rejected: [],
    pending: [],
  } as ValidationState,
  
  addNode: (node) => set((state) => {
    // Check if node already exists
    if (state.nodes.some(n => n.id === node.id)) {
      return state;
    }
    return { nodes: [...state.nodes, node] };
  }),
  
  removeNode: (id) => set((state) => ({
    nodes: state.nodes.filter(node => node.id !== id),
    // Also remove any edges connected to this node
    edges: state.edges.filter(edge => edge.source !== id && edge.target !== id),
    // Also remove from selected nodes if present
    selectedNodes: state.selectedNodes.filter(nodeId => nodeId !== id),
    // And remove from opinion sources
    opinionSources: Object.fromEntries(
      Object.entries(state.opinionSources).filter(([key]) => key !== id)
    ),
  })),
  
  updateNode: (id, updates) => set((state) => ({
    nodes: state.nodes.map(node => 
      node.id === id 
        ? { ...node, ...updates } 
        : node
    ),
  })),
  
  addEdge: (edge) => set((state) => {
    // Check if edge already exists
    if (state.edges.some(e => e.id === edge.id)) {
      return state;
    }
    return { edges: [...state.edges, edge] };
  }),
  
  removeEdge: (id) => set((state) => ({
    edges: state.edges.filter(edge => edge.id !== id),
  })),
  
  selectNode: (id) => {
    console.log(`Selecting single node: ${id}`);
    // Don't clear the multi-selection array, as that's handled separately
    return set({ 
      selectedNodeId: id 
    });
  },
  
  // For multi-select: toggle a node in the selected nodes array
  toggleNodeSelection: (id) => set((state) => {
    console.log(`Toggling node selection for node: ${id}`);
    console.log(`Current selected nodes state: [${state.selectedNodes.join(', ')}]`);
    
    // Check if the node is already in the selected array
    const isAlreadySelected = state.selectedNodes.includes(id);
    
    if (isAlreadySelected) {
      // Remove if already selected
      console.log(`Removing node ${id} from selection.`);
      const newSelectedNodes = state.selectedNodes.filter(nodeId => nodeId !== id);
      console.log(`New selection will be: [${newSelectedNodes.join(', ')}]`);
      return { 
        selectedNodes: newSelectedNodes 
      };
    } else {
      // Add if not already selected
      console.log(`Adding node ${id} to selection.`);
      const newSelectedNodes = [...state.selectedNodes, id];
      console.log(`New selection will be: [${newSelectedNodes.join(', ')}]`);
      return { 
        selectedNodes: newSelectedNodes 
      };
    }
  }),
  
  // Clear all selected nodes
  clearSelectedNodes: () => {
    console.log("Clearing all selected nodes");
    return set({ selectedNodes: [] });
  },
  
  // Set the hovered node
  setHoveredNode: (id) => set({ hoveredNodeId: id }),
  
  // Mark a node with its source (main conversation or parallel window ID)
  markNodeSource: (id, source) => set((state) => ({
    opinionSources: {
      ...state.opinionSources,
      [id]: source
    }
  })),
  
  // Validate a second opinion node - accept it into main graph
  validateNode: (id) => set((state) => {
    console.log(`Validating second opinion node: ${id}`);
    
    // Check if the node is from a second opinion source
    const nodeSource = state.opinionSources[id];
    if (!nodeSource || nodeSource === 'main') {
      console.log(`Node ${id} is not a second opinion node or is already integrated.`);
      return state;
    }
    
    // Update the validation state
    const newValidated = [...state.validation.validated, id];
    
    // Remove from pending if it was there
    const newPending = state.validation.pending.filter(nodeId => nodeId !== id);
    
    // Remove from rejected if it was there (in case user changes their mind)
    const newRejected = state.validation.rejected.filter(nodeId => nodeId !== id);
    
    // Mark the node as part of the main conversation now
    const newOpinionSources = { ...state.opinionSources, [id]: 'main' };
    
    // Create stronger connections to related nodes to emphasize the validation
    // Find related nodes from existing edges
    const relatedNodeIds = state.edges
      .filter(edge => edge.source === id || edge.target === id)
      .map(edge => edge.source === id ? edge.target : edge.source);
    
    // Create new edges with higher strength to represent validated connection
    const newEdges = [...state.edges];
    
    // Create new enhanced connections for each related node
    relatedNodeIds.forEach(relatedId => {
      const existingEdge = state.edges.find(edge => 
        (edge.source === id && edge.target === relatedId) || 
        (edge.source === relatedId && edge.target === id)
      );
      
      if (existingEdge) {
        // Strengthen the existing edge to show this is a validated connection
        const strengthenedEdge = {
          ...existingEdge,
          strength: Math.min(existingEdge.strength * 1.5, 1.0), // Increase strength but cap at 1.0
          relationship: 'supports' as RelationshipType // Always mark as supporting relationship
        };
        
        // Replace the existing edge with the strengthened one
        const edgeIndex = newEdges.findIndex(e => e.id === existingEdge.id);
        if (edgeIndex >= 0) {
          newEdges[edgeIndex] = strengthenedEdge;
        }
      }
    });
    
    return {
      validation: {
        validated: newValidated,
        rejected: newRejected,
        pending: newPending
      },
      opinionSources: newOpinionSources,
      edges: newEdges
    };
  }),
  
  // Reject a second opinion node
  rejectNode: (id) => set((state) => {
    console.log(`Rejecting second opinion node: ${id}`);
    
    // Check if the node is from a second opinion source
    const nodeSource = state.opinionSources[id];
    if (!nodeSource || nodeSource === 'main') {
      console.log(`Node ${id} is not a second opinion node.`);
      return state;
    }
    
    // Update the validation state
    const newRejected = [...state.validation.rejected, id];
    
    // Remove from pending if it was there
    const newPending = state.validation.pending.filter(nodeId => nodeId !== id);
    
    // Remove from validated if it was there (in case user changes their mind)
    const newValidated = state.validation.validated.filter(nodeId => nodeId !== id);
    
    // Fade out the rejected node visually (but don't remove it)
    const updatedNodes = state.nodes.map(node => {
      if (node.id === id) {
        // Lower importance to make it visually fade
        return {
          ...node,
          importance: Math.max(node.importance * 0.5, 0.1) // Reduce importance but keep visible
        };
      }
      return node;
    });
    
    return {
      validation: {
        validated: newValidated,
        rejected: newRejected,
        pending: newPending
      },
      nodes: updatedNodes
    };
  }),
  
  // Mark a node as pending validation
  markNodePending: (id) => set((state) => {
    console.log(`Marking node ${id} as pending validation`);
    
    // Check if the node is from a second opinion source
    const nodeSource = state.opinionSources[id];
    if (!nodeSource || nodeSource === 'main') {
      console.log(`Node ${id} is not a second opinion node.`);
      return state;
    }
    
    // Check if it's already in one of the validation states
    if (
      state.validation.validated.includes(id) ||
      state.validation.rejected.includes(id) ||
      state.validation.pending.includes(id)
    ) {
      console.log(`Node ${id} already has a validation status.`);
      return state;
    }
    
    return {
      validation: {
        ...state.validation,
        pending: [...state.validation.pending, id]
      }
    };
  }),
  
  // Clear everything
  clearAll: () => set({ 
    nodes: [], 
    edges: [], 
    selectedNodeId: null,
    selectedNodes: [],
    hoveredNodeId: null,
    opinionSources: {},
    validation: {
      validated: [],
      rejected: [],
      pending: []
    }
  }),
}));
