import { create } from 'zustand'

const MAX_HISTORY = 50

// Lightweight snapshot — shallow-copy nodes and edges arrays
const snap = ({ nodes, edges }) => ({
  nodes: nodes.map(n => ({ ...n, data: { ...n.data, columns: [...(n.data.columns || [])] } })),
  edges: edges.map(e => ({ ...e })),
})

// ── Real-time broadcast mechanism ─────────────────────────────────────────────
//
// _broadcastFn  — set by DesignerPage after joining the Reverb presence channel.
//                 Calls channel.whisper(event, data) so all other collaborators
//                 receive the change instantly without a server roundtrip.
//
// _isRemote     — set to true while applying an incoming whisper, so store
//                 actions skip re-emitting and skip marking isDirty.
//
let _broadcastFn = null
let _isRemote    = false

export const setBroadcastFn  = (fn)  => { _broadcastFn = fn }
export const setRemoteUpdate = (val) => { _isRemote = val }

const emit = (event, data) => {
  if (_isRemote) return
  if (!_broadcastFn) {
    console.warn('[Collab] emit("' + event + '") skipped — broadcastFn not wired yet')
    return
  }
  console.log('[Collab] emit →', event, data)
  _broadcastFn(event, data)
}
// ──────────────────────────────────────────────────────────────────────────────

const useSchemaStore = create((set, get) => ({
  nodes:     [],
  edges:     [],
  schemaId:  null,
  projectId: null,
  isDirty:   false,
  past:    [],   // undo stack — array of { nodes, edges }
  future:  [],   // redo stack — array of { nodes, edges }

  loadSchema: (schemaId, projectId, versionJson) => {
    set({
      schemaId,
      projectId,
      nodes:   versionJson?.nodes || [],
      edges:   versionJson?.edges || [],
      isDirty: false,
      past:    [],
      future:  [],
    })
  },

  // Internal — push current canvas to undo stack before mutating.
  // Skipped for remote updates so remote actions are not undoable locally.
  _pushHistory: () => {
    if (_isRemote) return
    const { nodes, edges, past } = get()
    set({
      past:   [...past.slice(-(MAX_HISTORY - 1)), snap({ nodes, edges })],
      future: [],
    })
  },

  // Called by SchemaCanvas onNodeDragStop with the full nodes array.
  // Merges positions; emits SchemaNodeMoved for each node that moved.
  setNodes: (incomingNodes) => {
    const prevNodes = get().nodes
    set((state) => {
      const positionMap = new Map(incomingNodes.map(n => [n.id, n.position]))
      const merged = state.nodes.map(n => ({
        ...n,
        position: positionMap.get(n.id) ?? n.position,
      }))
      return { nodes: merged, isDirty: _isRemote ? state.isDirty : true }
    })
    if (!_isRemote) {
      incomingNodes.forEach(incoming => {
        if (!incoming.position) return
        const prev = prevNodes.find(p => p.id === incoming.id)
        if (prev && (
          Math.abs(prev.position.x - incoming.position.x) > 0.5 ||
          Math.abs(prev.position.y - incoming.position.y) > 0.5
        )) {
          emit('SchemaNodeMoved', { nodeId: incoming.id, position: incoming.position })
        }
      })
    }
  },

  // newEdge — the single newly-created edge (from onConnect), passed so we
  //           can emit SchemaEdgeAdded without diffing the whole array.
  setEdges: (edges, newEdge = null) => {
    set((state) => ({ edges, isDirty: _isRemote ? state.isDirty : true }))
    if (newEdge) emit('SchemaEdgeAdded', { edge: newEdge })
  },

  addTable: () => {
    get()._pushHistory()
    const existing = get().nodes
    const id       = `table_${Date.now()}`
    const newNode  = {
      id,
      type: 'tableNode',
      position: {
        x: 80 + (existing.length % 3) * 320,
        y: 80 + Math.floor(existing.length / 3) * 280,
      },
      data: {
        name: `table_${existing.length + 1}`,
        columns: [{
          id:            `col_${Date.now()}`,
          name:          'id',
          type:          'BIGINT',
          nullable:      false,
          pk:            true,
          unique:        true,
          autoIncrement: true,
          index:         false,
          default:       null,
          fk:            false,
          fkRef:         null,
        }],
      },
    }
    set((state) => ({
      nodes:   [...state.nodes, newNode],
      isDirty: _isRemote ? state.isDirty : true,
    }))
    emit('SchemaNodeAdded', { node: newNode })
  },

  // Same as addTable but places the node at an explicit canvas position (for drag-and-drop).
  addTableAt: (x, y) => {
    get()._pushHistory()
    const existing = get().nodes
    const id       = `table_${Date.now()}`
    const newNode  = {
      id,
      type: 'tableNode',
      position: { x, y },
      data: {
        name: `table_${existing.length + 1}`,
        columns: [{
          id:            `col_${Date.now()}`,
          name:          'id',
          type:          'BIGINT',
          nullable:      false,
          pk:            true,
          unique:        true,
          autoIncrement: true,
          index:         false,
          default:       null,
          fk:            false,
          fkRef:         null,
        }],
      },
    }
    set((state) => ({
      nodes:   [...state.nodes, newNode],
      isDirty: _isRemote ? state.isDirty : true,
    }))
    emit('SchemaNodeAdded', { node: newNode })
  },

  updateEdge: (edgeId, changes) => {
    set((state) => ({
      edges: state.edges.map(e =>
        e.id === edgeId
          ? { ...e, ...changes, data: { ...e.data, ...changes.data } }
          : e
      ),
      isDirty: _isRemote ? state.isDirty : true,
    }))
    emit('SchemaEdgeUpdated', { edgeId, changes })
  },

  deleteEdge: (edgeId) => {
    get()._pushHistory()
    set((state) => ({
      edges:   state.edges.filter(e => e.id !== edgeId),
      isDirty: _isRemote ? state.isDirty : true,
    }))
    emit('SchemaEdgeDeleted', { edgeId })
  },

  updateNodeData: (nodeId, newData) => {
    get()._pushHistory()
    set((state) => ({
      nodes: state.nodes.map(n =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n
      ),
      isDirty: _isRemote ? state.isDirty : true,
    }))
    emit('SchemaNodeUpdated', { nodeId, data: newData })
  },

  deleteNode: (nodeId) => {
    get()._pushHistory()
    set((state) => ({
      nodes:   state.nodes.filter(n => n.id !== nodeId),
      edges:   state.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
      isDirty: _isRemote ? state.isDirty : true,
    }))
    emit('SchemaNodeDeleted', { nodeId })
  },

  // Wipe every fkRef across ALL nodes that points at tableName.colName.
  // Called after a column is deleted so no orphaned FK references survive.
  // Skipped entirely (no history push) when nothing references the column.
  cleanupFkRefsForColumn: (tableName, colName) => {
    const hasRefs = get().nodes.some(n =>
      (n.data?.columns || []).some(
        c => c.fk && c.fkRef?.table === tableName && c.fkRef?.column === colName
      )
    )
    if (!hasRefs) return   // nothing to do

    get()._pushHistory()
    set((state) => ({
      nodes: state.nodes.map(n => ({
        ...n,
        data: {
          ...n.data,
          columns: (n.data?.columns || []).map(c => {
            if (c.fk && c.fkRef?.table === tableName && c.fkRef?.column === colName) {
              return { ...c, fk: false, fkRef: null }
            }
            return c
          }),
        },
      })),
      isDirty: _isRemote ? state.isDirty : true,
    }))
    emit('SchemaFkRefsCleaned', { tableName, colName })
  },

  // Bulk delete — one history entry for multi-select or keyboard Delete
  bulkDelete: (nodeIds, edgeIds) => {
    if (nodeIds.length === 0 && edgeIds.length === 0) return
    get()._pushHistory()
    const nSet = new Set(nodeIds)
    const eSet = new Set(edgeIds)
    set((state) => ({
      nodes:   state.nodes.filter(n => !nSet.has(n.id)),
      edges:   state.edges.filter(e =>
        !eSet.has(e.id) && !nSet.has(e.source) && !nSet.has(e.target)
      ),
      isDirty: _isRemote ? state.isDirty : true,
    }))
    nodeIds.forEach(nodeId => emit('SchemaNodeDeleted', { nodeId }))
    edgeIds.forEach(edgeId => emit('SchemaEdgeDeleted', { edgeId }))
  },

  // Replace entire canvas with AI-generated schema — always local, always dirty
  aiGenerate: (nodes, edges) => {
    get()._pushHistory()
    set({ nodes, edges, isDirty: true })
  },

  // Merge AI-generated schema into the existing canvas without removing anything.
  // New tables are shifted right of the rightmost existing table so they don't overlap.
  // All incoming IDs are remapped with a timestamp suffix to avoid collisions.
  aiMerge: (newNodes, newEdges) => {
    get()._pushHistory()
    const existingNodes = get().nodes

    // Find the rightmost x extent of existing tables (assume ~320 px wide each)
    let offsetX = 80
    if (existingNodes.length > 0) {
      const maxRight = Math.max(...existingNodes.map(n => (n.position?.x ?? 0) + 320))
      offsetX = maxRight + 80   // 80 px gap between old and new clusters
    }

    // Normalise new nodes so the leftmost one starts at offsetX
    const minNewX = newNodes.length > 0
      ? Math.min(...newNodes.map(n => n.position?.x ?? 0))
      : 0

    // Remap every new ID with a timestamp suffix to prevent any collision
    const ts   = Date.now()
    const idMap = {}
    newNodes.forEach((n, i) => { idMap[n.id] = `${n.id}_m${ts}_${i}` })

    const mergedNodes = newNodes.map(n => ({
      ...n,
      id:       idMap[n.id],
      position: {
        x: (n.position?.x ?? 0) - minNewX + offsetX,
        y: n.position?.y ?? 80,
      },
    }))

    const mergedEdges = newEdges.map((e, i) => ({
      ...e,
      id:     `${e.id}_m${ts}_${i}`,
      source: idMap[e.source] ?? e.source,
      target: idMap[e.target] ?? e.target,
    }))

    set((state) => ({
      nodes:   [...state.nodes, ...mergedNodes],
      edges:   [...state.edges, ...mergedEdges],
      isDirty: true,
    }))
  },

  // Undo — pop from past, push current to future
  undo: () => {
    const { past, nodes, edges, future } = get()
    if (past.length === 0) return
    const prev    = past[past.length - 1]
    const current = snap({ nodes, edges })
    set({
      past:    past.slice(0, -1),
      future:  [current, ...future.slice(0, MAX_HISTORY - 1)],
      nodes:   prev.nodes,
      edges:   prev.edges,
      isDirty: true,
    })
  },

  // Redo — pop from future, push current to past
  redo: () => {
    const { future, nodes, edges, past } = get()
    if (future.length === 0) return
    const next    = future[0]
    const current = snap({ nodes, edges })
    set({
      past:    [...past.slice(-(MAX_HISTORY - 1)), current],
      future:  future.slice(1),
      nodes:   next.nodes,
      edges:   next.edges,
      isDirty: true,
    })
  },

  markSaved: () => set({ isDirty: false }),
}))

export default useSchemaStore
