import { useCallback, useEffect, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  reconnectEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useViewport,
  BackgroundVariant,
  ConnectionMode,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import TableNode from './TableNode'
import CustomSchemaEdge from './CustomSchemaEdge'
import useSchemaStore from '../../store/useSchemaStore'

const nodeTypes = { tableNode: TableNode }
const edgeTypes = { schema: CustomSchemaEdge }

const KNOWN_LINE_STYLES = ['default', 'smoothstep', 'step', 'straight']

// Normalise a raw store edge into display-ready form for the custom edge component
function buildEdgeDisplay(edge) {
  const lineStyle = edge.data?.lineStyle
    || (KNOWN_LINE_STYLES.includes(edge.type) ? edge.type : 'default')

  const diagramType = edge.data?.diagramType || 'association'

  const relType = edge.data?.relationshipType || edge.data?.type || '1:N'
  const src     = edge.data?.sourceLabel?.trim() || ''
  const tgt     = edge.data?.targetLabel?.trim() || ''
  const label   = src || tgt ? `${src} [${relType}] ${tgt}` : relType

  return {
    ...edge,
    type:  'schema',
    label,
    data:  { ...edge.data, lineStyle, diagramType },
    style: { stroke: '#6B7280', strokeWidth: 2, ...edge.style },
  }
}

export default function SchemaCanvas({
  onNodeClick,
  onEdgeClick,
  readOnly      = false,
  onCursorMove,          // (flowX, flowY) => void  — throttled 50 ms
  remoteCursors = {},    // { [userId]: { userId, name, color, x, y } }
}) {
  const { nodes: storeNodes, edges: storeEdges, setNodes, setEdges, bulkDelete } = useSchemaStore()

  const [nodes, setLocalNodes, onNodesChange] = useNodesState(storeNodes)
  const [edges, setLocalEdges, onEdgesChange] = useEdgesState(storeEdges.map(buildEdgeDisplay))

  const prevStoreNodesRef = useRef(storeNodes)
  const prevStoreEdgesRef = useRef(storeEdges)
  const cursorTimerRef    = useRef(null)

  // React Flow instance — for screenToFlowPosition
  const rfInstance = useReactFlow()
  // Current viewport transform — for converting flow coords → container pixels
  const viewport   = useViewport()

  // ── Store → local sync ──────────────────────────────────────────────────────

  useEffect(() => {
    const prev    = prevStoreNodesRef.current
    const current = storeNodes
    if (prev === current) return
    prevStoreNodesRef.current = current

    const storeIds = new Set(current.map(n => n.id))
    setLocalNodes(prevLocal => {
      const filtered = prevLocal.filter(n => storeIds.has(n.id))
      const localIds  = new Set(filtered.map(n => n.id))
      const toAdd     = current.filter(n => !localIds.has(n.id))
      const updated   = filtered.map(localNode => {
        const storeNode = current.find(n => n.id === localNode.id)
        if (!storeNode) return localNode
        // Sync data AND position so remote moves are immediately visible on canvas
        return { ...localNode, data: storeNode.data, position: storeNode.position }
      })
      return [...updated, ...toAdd]
    })
  }, [storeNodes])

  useEffect(() => {
    if (prevStoreEdgesRef.current === storeEdges) return
    prevStoreEdgesRef.current = storeEdges
    setLocalEdges(storeEdges.map(buildEdgeDisplay))
  }, [storeEdges])

  // ── Drag stop — update store positions; store emits SchemaNodeMoved ─────────

  const handleNodeDragStop = useCallback((_, __, currentNodes) => {
    if (!readOnly) setNodes(currentNodes)
  }, [setNodes, readOnly])

  // ── Strip display-only props before persisting to store ─────────────────────

  const toStoreEdge = (e) => ({
    id:           e.id,
    source:       e.source,
    target:       e.target,
    type:         e.type,
    data:         e.data,
    sourceHandle: e.sourceHandle ?? null,
    targetHandle: e.targetHandle ?? null,
  })

  // ── New connection — forward newEdge so store emits SchemaEdgeAdded ─────────

  const onConnect = useCallback((params) => {
    const base = {
      ...params,
      id:       `edge_${Date.now()}`,
      type:     'schema',
      animated: false,
      data:     { relationshipType: '1:N', sourceLabel: '', targetLabel: '', lineStyle: 'smoothstep', diagramType: 'association' },
    }
    const displayEdge = buildEdgeDisplay(base)
    const storeEdge   = toStoreEdge(displayEdge)
    setLocalEdges(eds => {
      const updated = addEdge(displayEdge, eds)
      setEdges(updated.map(toStoreEdge), storeEdge)   // storeEdge triggers SchemaEdgeAdded emit
      return updated
    })
  }, [setEdges])

  const onNodesDelete = useCallback((deletedNodes) => {
    bulkDelete(deletedNodes.map(n => n.id), [])
  }, [bulkDelete])

  const onEdgesDelete = useCallback((deletedEdges) => {
    bulkDelete([], deletedEdges.map(e => e.id))
  }, [bulkDelete])

  const onReconnect = useCallback((oldEdge, newConnection) => {
    setLocalEdges(eds => {
      const updated = reconnectEdge(oldEdge, newConnection, eds)
      setEdges(updated.map(toStoreEdge))
      return updated.map(buildEdgeDisplay)
    })
  }, [setEdges])

  // ── Cursor broadcast — throttled to 50 ms ───────────────────────────────────

  const handleMouseMove = useCallback((e) => {
    if (!onCursorMove || readOnly) return
    clearTimeout(cursorTimerRef.current)
    cursorTimerRef.current = setTimeout(() => {
      const fp = rfInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY })
      onCursorMove(fp.x, fp.y)
    }, 50)
  }, [onCursorMove, readOnly, rfInstance])

  useEffect(() => () => clearTimeout(cursorTimerRef.current), [])

  // ── Render ──────────────────────────────────────────────────────────────────

  const cursorEntries = Object.values(remoteCursors)

  return (
    <div className="w-full h-full relative" onMouseMove={handleMouseMove}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={handleNodeDragStop}
        onConnect={readOnly ? undefined : onConnect}
        onReconnect={readOnly ? undefined : onReconnect}
        onNodesDelete={readOnly ? undefined : onNodesDelete}
        onEdgesDelete={readOnly ? undefined : onEdgesDelete}
        onNodeClick={(_, node) => onNodeClick(node)}
        onEdgeClick={(_, edge) => onEdgeClick(edge)}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        edgesReconnectable={!readOnly}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        deleteKeyCode={readOnly ? null : 'Delete'}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#E5E7EB"/>
        <Controls className="!shadow-md !border !border-gray-200 !rounded-xl overflow-hidden"/>
        <MiniMap
          nodeColor="#1A56DB"
          maskColor="rgba(249,250,251,0.8)"
          className="!border !border-gray-200 !rounded-xl !shadow-md"
        />
      </ReactFlow>

      {/* ── Remote cursor overlay ─────────────────────────────────────────── */}
      {cursorEntries.length > 0 && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {cursorEntries.map(cursor => {
            // Convert flow coordinate → pixel position within this container
            const sx = Math.round(cursor.x * viewport.zoom + viewport.x)
            const sy = Math.round(cursor.y * viewport.zoom + viewport.y)
            return (
              <div
                key={cursor.userId}
                className="absolute pointer-events-none"
                style={{ left: sx, top: sy, willChange: 'left, top' }}
              >
                <svg
                  width="14" height="18" viewBox="0 0 14 18"
                  style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))' }}
                >
                  <path
                    d="M0 0 L0 13 L3.5 9 L6.5 16 L8.5 15 L5.5 8.5 L10 8.5 Z"
                    fill={cursor.color}
                    stroke="white"
                    strokeWidth="1"
                    strokeLinejoin="round"
                  />
                </svg>
                <div
                  className="absolute left-3.5 top-0 px-1.5 py-0.5 rounded-full text-white
                             text-[10px] font-semibold whitespace-nowrap shadow-sm leading-tight"
                  style={{ backgroundColor: cursor.color }}
                >
                  {cursor.name}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
