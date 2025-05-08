import { create } from 'zustand';
import { BubbleNode, Edge } from '../../types';

interface VisualizationState {
  nodes: BubbleNode[];
  edges: Edge[];
  selectedNodeId: string | null;
  
  addNode: (node: BubbleNode) => void;
  removeNode: (id: string) => void;
  updateNode: (id: string, updates: Partial<BubbleNode>) => void;
  
  addEdge: (edge: Edge) => void;
  removeEdge: (id: string) => void;
  
  selectNode: (id: string | null) => void;
  clearAll: () => void;
}

export const useVisualization = create<VisualizationState>((set) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  
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
  
  selectNode: (id) => set({ selectedNodeId: id }),
  
  clearAll: () => set({ nodes: [], edges: [], selectedNodeId: null }),
}));
