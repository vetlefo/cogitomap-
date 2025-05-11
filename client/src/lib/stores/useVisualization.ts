import { create } from 'zustand';
import { BubbleNode, Edge, RelationshipType } from '../../types';
import { GraphService } from '../services/graphService';

interface VisualizationState {
  // Data from graph database
  nodes: BubbleNode[];
  edges: Edge[];
  
  // UI state
  selectedNodeId: string | null;
  selectedNodes: string[]; // Array of selected node IDs for bundling
  hoveredNodeId: string | null;
  
  // Loading and error states
  isLoading: boolean;
  error: string | null;
  lastSyncTime: number | null;
  
  // Graph operations (now connected to database)
  addNode: (node: Omit<BubbleNode, 'id'>) => Promise<BubbleNode>;
  removeNode: (id: string) => void;
  updateNode: (id: string, updates: Partial<BubbleNode>) => void;
  addEdge: (source: string, target: string, relationship: string, strength?: number) => Promise<Edge>;
  removeEdge: (id: string) => void;
  
  // Graph data synchronization
  loadInitialData: () => Promise<void>;
  syncWithDatabase: () => Promise<void>;
  
  // Node selection functions
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

export const useVisualization = create<VisualizationState>((set, get) => ({
  // Initial data state
  nodes: [],
  edges: [],
  
  // UI state
  selectedNodeId: null,
  selectedNodes: [],
  hoveredNodeId: null,
  
  // Loading and error states
  isLoading: false,
  error: null,
  lastSyncTime: null,
  
  // Second opinion and validation state
  opinionSources: {},
  validation: {
    validated: [],
    rejected: [],
    pending: [],
  } as ValidationState,
  
  // Load initial data from the graph database
  loadInitialData: async () => {
    try {
      set({ isLoading: true, error: null });
      console.log('Loading initial graph data from database...');
      
      // Fetch all nodes and edges
      const nodesResponse = await GraphService.getNodes();
      const edgesResponse = await GraphService.getEdges();
      
      console.log(`Loaded ${nodesResponse.nodes.length} nodes and ${edgesResponse.edges.length} edges`);
      
      set({ 
        nodes: nodesResponse.nodes, 
        edges: edgesResponse.edges,
        isLoading: false,
        lastSyncTime: Date.now()
      });
    } catch (error) {
      console.error('Error loading initial graph data:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Unknown error loading graph data'
      });
    }
  },
  
  // Synchronize with database (for periodic updates)
  syncWithDatabase: async () => {
    const state = get();
    if (state.isLoading) return; // Don't sync if already loading
    
    try {
      set({ isLoading: true, error: null });
      
      // Fetch data from database
      const nodesResponse = await GraphService.getNodes();
      const edgesResponse = await GraphService.getEdges();
      
      // Update local state with new data
      set({ 
        nodes: nodesResponse.nodes, 
        edges: edgesResponse.edges,
        isLoading: false,
        lastSyncTime: Date.now()
      });
    } catch (error) {
      console.error('Error syncing with graph database:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Unknown error syncing graph data'
      });
    }
  },
  
  // Add a node to the database
  addNode: async (nodeData) => {
    try {
      set({ isLoading: true, error: null });
      
      // Create node in database
      const createdNode = await GraphService.createNode(nodeData);
      
      // Update local state
      set((state) => ({
        nodes: [...state.nodes, createdNode],
        isLoading: false
      }));
      
      return createdNode;
    } catch (error) {
      console.error('Error creating node:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Unknown error creating node'
      });
      throw error;
    }
  },
  
  // Remove node (currently only updates local state)
  // TODO: Add API endpoint for deleting nodes
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
  
  // Update node (currently only updates local state)
  // TODO: Add API endpoint for updating nodes
  updateNode: (id, updates) => set((state) => ({
    nodes: state.nodes.map(node => 
      node.id === id 
        ? { ...node, ...updates } 
        : node
    ),
  })),
  
  // Add an edge to the database
  addEdge: async (source, target, relationship, strength = 0.5) => {
    try {
      set({ isLoading: true, error: null });
      
      // Create edge in database
      const createdEdge = await GraphService.createEdge(source, target, relationship, strength);
      
      // Update local state
      set((state) => ({
        edges: [...state.edges, createdEdge],
        isLoading: false
      }));
      
      return createdEdge;
    } catch (error) {
      console.error('Error creating edge:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Unknown error creating edge'
      });
      throw error;
    }
  },
  
  // Remove edge (currently only updates local state)
  // TODO: Add API endpoint for deleting edges
  removeEdge: (id) => set((state) => ({
    edges: state.edges.filter(edge => edge.id !== id),
  })),
  
  // Node selection functionality (unchanged)
  selectNode: (id) => {
    console.log(`Selecting single node: ${id}`);
    return set({ selectedNodeId: id });
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
      return { selectedNodes: newSelectedNodes };
    } else {
      // Add if not already selected
      console.log(`Adding node ${id} to selection.`);
      const newSelectedNodes = [...state.selectedNodes, id];
      console.log(`New selection will be: [${newSelectedNodes.join(', ')}]`);
      return { selectedNodes: newSelectedNodes };
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
        } as Edge; // Cast to Edge type to avoid TypeScript errors
        
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
    },
    isLoading: false,
    error: null
  }),
}));
