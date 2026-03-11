import { create } from 'zustand'

const useSchemaStore = create((set, get) => ({
  nodes: [],
  edges: [],
  schemaId: null,
  projectId: null,
  isDirty: false,

  loadSchema: (schemaId, projectId, versionJson) => {
    set({
      schemaId,
      projectId,
      nodes: versionJson?.nodes || [],
      edges: versionJson?.edges || [],
      isDirty: false,
    })
  },

  setNodes: (incomingNodes) => {
    set((state) => {
      // Merge incoming positions into existing nodes
      const positionMap = new Map(incomingNodes.map(n => [n.id, n.position]))
      const merged = state.nodes.map(n => ({
        ...n,
        position: positionMap.get(n.id) ?? n.position,
      }))
      return { nodes: merged, isDirty: true }
    })
  },

  setEdges: (edges) => set({ edges, isDirty: true }),

  addTable: () => {
    const existing = get().nodes
    const id = `table_${Date.now()}`
    const newNode = {
      id,
      type: 'tableNode',
      position: {
        x: 80 + (existing.length % 3) * 320,
        y: 80 + Math.floor(existing.length / 3) * 280,
      },
      data: {
        name: `table_${existing.length + 1}`,
        columns: [{
          id: `col_${Date.now()}`,
          name: 'id',
          type: 'BIGINT',
          nullable: false,
          pk: true,
          unique: true,
          autoIncrement: true,
          default: null,
          fk: false,
        }],
      },
    }
    set((state) => ({ nodes: [...state.nodes, newNode], isDirty: true }))
  },

  updateEdge: (edgeId, changes) => {
    set((state) => ({
      edges: state.edges.map(e =>
        e.id === edgeId
          ? { ...e, ...changes, data: { ...e.data, ...changes.data } }
          : e
      ),
      isDirty: true,
    }))
  },

  deleteEdge: (edgeId) => {
    set((state) => ({
      edges: state.edges.filter(e => e.id !== edgeId),
      isDirty: true,
    }))
  },

  updateNodeData: (nodeId, newData) => {
    set((state) => ({
      nodes: state.nodes.map(n =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, ...newData } }
          : n
      ),
      isDirty: true,
    }))
  },

  deleteNode: (nodeId) => {
    set((state) => ({
      nodes: state.nodes.filter(n => n.id !== nodeId),
      edges: state.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
      isDirty: true,
    }))
  },

  // Replace entire canvas with AI-generated schema
  aiGenerate: (nodes, edges) => {
    set({ nodes, edges, isDirty: true })
  },

  markSaved: () => set({ isDirty: false }),
}))

export default useSchemaStore
