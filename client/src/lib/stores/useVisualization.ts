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
}

export const useVisualization = create<VisualizationState>((set) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedNodes: [],
  hoveredNodeId: null,
  opinionSources: {},
  
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
  
  // Clear everything
  clearAll: () => set({ 
    nodes: [], 
    edges: [], 
    selectedNodeId: null,
    selectedNodes: [],
    hoveredNodeId: null,
    opinionSources: {}
  }),
}));
