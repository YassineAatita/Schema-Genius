import { create } from 'zustand'

const MAX_HISTORY = 50

// Lightweight snapshot — shallow-copy nodes and edges arrays
const snap = ({ nodes, edges }) => ({
  nodes: nodes.map(n => ({ ...n, data: { ...n.data, columns: [...(n.data.columns || [])] } })),
  edges: edges.map(e => ({ ...e })),
})

const useSchemaStore = create((set, get) => ({
  nodes: [],
  edges: [],
  schemaId: null,
  projectId: null,
  isDirty: false,
  past: [],    // undo stack — array of { nodes, edges }
  future: [],  // redo stack — array of { nodes, edges }

  loadSchema: (schemaId, projectId, versionJson) => {
    set({
      schemaId,
      projectId,
      nodes: versionJson?.nodes || [],
      edges: versionJson?.edges || [],
      isDirty: false,
      past: [],
      future: [],
    })
  },

  // Internal — push current canvas to undo stack before mutating
  _pushHistory: () => {
    const { nodes, edges, past } = get()
    set({
      past: [...past.slice(-(MAX_HISTORY - 1)), snap({ nodes, edges })],
      future: [],
    })
  },

  setNodes: (incomingNodes) => {
    set((state) => {
      // Merge incoming positions into existing nodes (drag support)
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
    get()._pushHistory()
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
    get()._pushHistory()
    set((state) => ({
      edges: state.edges.filter(e => e.id !== edgeId),
      isDirty: true,
    }))
  },

  updateNodeData: (nodeId, newData) => {
    get()._pushHistory()
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
    get()._pushHistory()
    set((state) => ({
      nodes: state.nodes.filter(n => n.id !== nodeId),
      edges: state.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
      isDirty: true,
    }))
  },

  // Bulk delete — one history entry for multi-select or keyboard Delete
  bulkDelete: (nodeIds, edgeIds) => {
    if (nodeIds.length === 0 && edgeIds.length === 0) return
    get()._pushHistory()
    const nSet = new Set(nodeIds)
    const eSet = new Set(edgeIds)
    set((state) => ({
      nodes: state.nodes.filter(n => !nSet.has(n.id)),
      edges: state.edges.filter(e =>
        !eSet.has(e.id) && !nSet.has(e.source) && !nSet.has(e.target)
      ),
      isDirty: true,
    }))
  },

  // Replace entire canvas with AI-generated schema
  aiGenerate: (nodes, edges) => {
    get()._pushHistory()
    set({ nodes, edges, isDirty: true })
  },

  // Undo — pop from past, push current to future
  undo: () => {
    const { past, nodes, edges, future } = get()
    if (past.length === 0) return
    const prev = past[past.length - 1]
    const current = snap({ nodes, edges })
    set({
      past: past.slice(0, -1),
      future: [current, ...future.slice(0, MAX_HISTORY - 1)],
      nodes: prev.nodes,
      edges: prev.edges,
      isDirty: true,
    })
  },

  // Redo — pop from future, push current to past
  redo: () => {
    const { future, nodes, edges, past } = get()
    if (future.length === 0) return
    const next = future[0]
    const current = snap({ nodes, edges })
    set({
      past: [...past.slice(-(MAX_HISTORY - 1)), current],
      future: future.slice(1),
      nodes: next.nodes,
      edges: next.edges,
      isDirty: true,
    })
  },

  markSaved: () => set({ isDirty: false }),
}))

export default useSchemaStore
