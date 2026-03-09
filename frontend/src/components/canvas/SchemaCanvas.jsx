import { useCallback, useEffect, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import TableNode from './TableNode'
import useSchemaStore from '../../store/useSchemaStore'

const nodeTypes = { tableNode: TableNode }

export default function SchemaCanvas({ onNodeClick, onEdgeClick }) {
  const { nodes: storeNodes, edges: storeEdges, setNodes, setEdges } = useSchemaStore()

  const [nodes, setLocalNodes, onNodesChange] = useNodesState(storeNodes)
  const [edges, setLocalEdges, onEdgesChange] = useEdgesState(storeEdges)

  const prevStoreNodesRef = useRef(storeNodes)
  const prevStoreEdgesRef = useRef(storeEdges)

  // Sync nodes — smart merge, never reset
  useEffect(() => {
    const prev    = prevStoreNodesRef.current
    const current = storeNodes

    // Nothing changed at all — skip
    if (prev === current) return
    prevStoreNodesRef.current = current

    const storeIds = new Set(current.map(n => n.id))

    setLocalNodes(prevLocal => {
      // Remove deleted
      const filtered = prevLocal.filter(n => storeIds.has(n.id))
      // Add new
      const localIds  = new Set(filtered.map(n => n.id))
      const toAdd     = current.filter(n => !localIds.has(n.id))
      // Update data only — keep positions
      const updated   = filtered.map(localNode => {
        const storeNode = current.find(n => n.id === localNode.id)
        if (!storeNode) return localNode
        return { ...localNode, data: storeNode.data }
      })
      return [...updated, ...toAdd]
    })
  }, [storeNodes])

  // Sync edges — always keep in sync with store
  useEffect(() => {
    if (prevStoreEdgesRef.current === storeEdges) return
    prevStoreEdgesRef.current = storeEdges
    setLocalEdges(storeEdges)
  }, [storeEdges])

  const handleNodeDragStop = useCallback((_, __, currentNodes) => {
    // Merge positions back — never lose nodes
    setNodes(currentNodes)
  }, [setNodes])

  const onConnect = useCallback((params) => {
    const newEdge = {
      ...params,
      id:       `edge_${Date.now()}`,
      type:     'smoothstep',
      label:    '1:N',
      animated: false,
      data:     { relationshipType: '1:N' },
      style:    { stroke: '#6B7280', strokeWidth: 2 },
      labelStyle:          { fontSize: 11, fill: '#374151', fontWeight: 600 },
      labelBgStyle:        { fill: '#F3F4F6', fillOpacity: 1 },
      labelBgPadding:      [6, 3],
      labelBgBorderRadius: 4,
    }
    setLocalEdges(eds => {
      const updated = addEdge(newEdge, eds)
      setEdges(updated)
      return updated
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
        onConnect={onConnect}
        onNodeClick={(_, node) => onNodeClick(node)}
        onEdgeClick={(_, edge) => onEdgeClick(edge)}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        deleteKeyCode="Delete"
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