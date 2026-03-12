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
  // Migrate old edges: edge.type used to hold the line style
  const lineStyle = edge.data?.lineStyle
    || (KNOWN_LINE_STYLES.includes(edge.type) ? edge.type : 'default')

  const diagramType = edge.data?.diagramType || 'association'

  const relType = edge.data?.relationshipType || edge.data?.type || '1:N'
  const src     = edge.data?.sourceLabel?.trim() || ''
  const tgt     = edge.data?.targetLabel?.trim() || ''
  const label   = src || tgt ? `${src} [${relType}] ${tgt}` : relType

  return {
    ...edge,
    type:  'schema',        // always use our custom edge renderer
    label,
    data:  { ...edge.data, lineStyle, diagramType },
    style: { stroke: '#6B7280', strokeWidth: 2, ...edge.style },
  }
}

export default function SchemaCanvas({ onNodeClick, onEdgeClick, readOnly = false }) {
  const { nodes: storeNodes, edges: storeEdges, setNodes, setEdges, bulkDelete } = useSchemaStore()

  const [nodes, setLocalNodes, onNodesChange] = useNodesState(storeNodes)
  const [edges, setLocalEdges, onEdgesChange] = useEdgesState(storeEdges.map(buildEdgeDisplay))

  const prevStoreNodesRef = useRef(storeNodes)
  const prevStoreEdgesRef = useRef(storeEdges)

  // Sync nodes — smart merge, never reset
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
        return { ...localNode, data: storeNode.data }
      })
      return [...updated, ...toAdd]
    })
  }, [storeNodes])

  // Sync edges — rebuild display props every time store edges change
  useEffect(() => {
    if (prevStoreEdgesRef.current === storeEdges) return
    prevStoreEdgesRef.current = storeEdges
    setLocalEdges(storeEdges.map(buildEdgeDisplay))
  }, [storeEdges])

  const handleNodeDragStop = useCallback((_, __, currentNodes) => {
    if (!readOnly) setNodes(currentNodes)
  }, [setNodes, readOnly])

  // Strip display-only props before saving to store; keep handle IDs for routing
  const toStoreEdge = (e) => ({
    id:           e.id,
    source:       e.source,
    target:       e.target,
    type:         e.type,
    data:         e.data,
    sourceHandle: e.sourceHandle ?? null,
    targetHandle: e.targetHandle ?? null,
  })

  const onConnect = useCallback((params) => {
    const base = {
      ...params,
      id:       `edge_${Date.now()}`,
      type:     'schema',
      animated: false,
      data:     { relationshipType: '1:N', sourceLabel: '', targetLabel: '', lineStyle: 'smoothstep', diagramType: 'association' },
    }
    const newEdge = buildEdgeDisplay(base)
    setLocalEdges(eds => {
      const updated = addEdge(newEdge, eds)
      setEdges(updated.map(toStoreEdge))
      return updated
    })
  }, [setEdges])

  // Intercept React Flow's Delete key — push history THEN remove from store
  const onNodesDelete = useCallback((deletedNodes) => {
    bulkDelete(deletedNodes.map(n => n.id), [])
  }, [bulkDelete])

  const onEdgesDelete = useCallback((deletedEdges) => {
    bulkDelete([], deletedEdges.map(e => e.id))
  }, [bulkDelete])

  // Allow dragging an edge endpoint to a different handle
  const onReconnect = useCallback((oldEdge, newConnection) => {
    setLocalEdges(eds => {
      const updated = reconnectEdge(oldEdge, newConnection, eds)
      setEdges(updated.map(toStoreEdge))
      return updated.map(buildEdgeDisplay)
    })
  }, [setEdges])

  return (
    <div className="w-full h-full">
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
    </div>
  )
}
