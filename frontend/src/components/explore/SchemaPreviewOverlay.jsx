import { useState, useEffect, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  EdgeLabelRenderer,
  Handle,
  Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import api from '../../services/api'

// ── Table header color derived from table name ────────────────────────────────
const HEADER_COLORS = [
  { bg: '#3b82f6', light: '#eff6ff', border: '#93c5fd' },  // blue
  { bg: '#8b5cf6', light: '#f5f3ff', border: '#c4b5fd' },  // violet
  { bg: '#10b981', light: '#ecfdf5', border: '#6ee7b7' },  // emerald
  { bg: '#f59e0b', light: '#fffbeb', border: '#fcd34d' },  // amber
  { bg: '#ef4444', light: '#fef2f2', border: '#fca5a5' },  // red
  { bg: '#06b6d4', light: '#ecfeff', border: '#67e8f9' },  // cyan
  { bg: '#ec4899', light: '#fdf2f8', border: '#f9a8d4' },  // pink
  { bg: '#f97316', light: '#fff7ed', border: '#fdba74' },  // orange
]
function tableColor(name = '') {
  let h = 0
  for (let i = 0; i < name.length; i++) { h = ((h << 5) - h) + name.charCodeAt(i); h |= 0 }
  return HEADER_COLORS[Math.abs(h) % HEADER_COLORS.length]
}

// ── Type badge ────────────────────────────────────────────────────────────────
const TYPE_BADGE = {
  BIGINT: 'bg-blue-100 text-blue-700', INT: 'bg-blue-100 text-blue-700',
  INTEGER: 'bg-blue-100 text-blue-700', SMALLINT: 'bg-blue-100 text-blue-700',
  TINYINT: 'bg-blue-100 text-blue-700', DECIMAL: 'bg-yellow-100 text-yellow-700',
  FLOAT: 'bg-yellow-100 text-yellow-700', DOUBLE: 'bg-yellow-100 text-yellow-700',
  VARCHAR: 'bg-purple-100 text-purple-700', CHAR: 'bg-purple-100 text-purple-700',
  TEXT: 'bg-purple-100 text-purple-700', LONGTEXT: 'bg-purple-100 text-purple-700',
  ENUM: 'bg-pink-100 text-pink-700', DATE: 'bg-orange-100 text-orange-700',
  TIME: 'bg-orange-100 text-orange-700', DATETIME: 'bg-orange-100 text-orange-700',
  TIMESTAMP: 'bg-orange-100 text-orange-700', BOOLEAN: 'bg-green-100 text-green-700',
  JSON: 'bg-cyan-100 text-cyan-700', UUID: 'bg-indigo-100 text-indigo-700',
  BLOB: 'bg-slate-100 text-slate-600', MEDIUMBLOB: 'bg-slate-100 text-slate-600',
  LONGBLOB: 'bg-slate-100 text-slate-600',
}

// ── PreviewTableNode — read-only table card ───────────────────────────────────
function PreviewTableNode({ data }) {
  const color  = tableColor(data.name)
  const fields = data.fields || []

  return (
    <div className="bg-white rounded-xl overflow-hidden"
         style={{ minWidth: 160, maxWidth: 240, boxShadow: '0 2px 12px rgba(0,0,0,0.10)', border: `1.5px solid ${color.border}` }}>
      {/* Header */}
      <div className="px-3 py-2 flex items-center gap-2"
           style={{ background: color.light, borderBottom: `2px solid ${color.bg}` }}>
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color.bg }}/>
        <span className="font-bold text-[12px] text-gray-800 truncate">{data.name || 'table'}</span>
      </div>

      {/* Fields */}
      <div className="divide-y divide-gray-50">
        {fields.slice(0, 16).map((field, i) => (
          <div key={field.id || i} className="px-3 py-1.5 flex items-center gap-2">
            <div className="w-6 flex-shrink-0 flex items-center">
              {field.isPrimary && (
                <span className="text-amber-500 text-[8px] font-bold leading-none">PK</span>
              )}
              {!field.isPrimary && field.isForeign && (
                <span className="text-violet-500 text-[8px] font-bold leading-none">FK</span>
              )}
            </div>
            <span className="text-[11px] text-gray-700 font-medium flex-1 truncate">{field.name}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold flex-shrink-0
              ${TYPE_BADGE[(field.type || '').toUpperCase()] || 'bg-gray-100 text-gray-500'}`}>
              {(field.type || 'text').toLowerCase()}
            </span>
          </div>
        ))}
        {fields.length > 16 && (
          <div className="px-3 py-1.5 text-[10px] text-gray-400 italic">
            +{fields.length - 16} more fields…
          </div>
        )}
        {fields.length === 0 && (
          <div className="px-3 py-2 text-[10px] text-gray-400 italic">No fields defined</div>
        )}
      </div>

      {/* React Flow handles — invisible but needed for edge connections */}
      <Handle type="source" position={Position.Right}  style={{ opacity: 0, width: 8, height: 8 }}/>
      <Handle type="target" position={Position.Left}   style={{ opacity: 0, width: 8, height: 8 }}/>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 8, height: 8 }}/>
      <Handle type="target" position={Position.Top}    style={{ opacity: 0, width: 8, height: 8 }}/>
    </div>
  )
}

// ── PreviewEdge — read-only relationship line ─────────────────────────────────
const NORM_REL   = { '1:M': '1:N', 'M:1': 'N:1' }
const REL_LABEL  = {
  '1:1': '1 : 1', '1:N': '1 : N', 'N:1': 'N : 1',
  'M:N': 'M : N', 'M:M': 'M : M', 'N:N': 'N : N',
}

function deriveEndCardinalities(relType) {
  const map = { '1:1': ['1','1'], '1:N': ['1','*'], 'N:1': ['*','1'], 'M:M': ['*','*'], 'M:N': ['*','*'], 'N:N': ['*','*'] }
  return map[relType] || [null, null]
}

function PreviewEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data = {}, style = {},
}) {
  const lineStyle   = data.lineStyle   || 'default'
  const diagramType = data.diagramType || 'association'
  const isDashed    = diagramType === 'dependency' || diagramType === 'realization'
  const strokeColor = style.stroke || '#6B7280'

  // Path
  let edgePath, midX, midY
  if (lineStyle === 'straight') {
    ;[edgePath, midX, midY] = getStraightPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  } else if (lineStyle === 'smoothstep') {
    ;[edgePath, midX, midY] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  } else if (lineStyle === 'step') {
    ;[edgePath, midX, midY] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 0 })
  } else {
    ;[edgePath, midX, midY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  }

  // Relationship label
  const rawRel  = data.relationshipType || data.type || '1:N'
  const relType = NORM_REL[rawRel] || rawRel
  const relLabel = REL_LABEL[relType] || relType

  // Cardinality end labels
  const [derivedSrc, derivedTgt] = deriveEndCardinalities(relType)
  const srcCard = data.sourceCardinality?.trim() || derivedSrc || ''
  const tgtCard = data.targetCardinality?.trim() || derivedTgt || ''
  const srcRole = data.sourceLabel?.trim() || ''
  const tgtRole = data.targetLabel?.trim() || ''

  // Marker for inheritance/realization
  const markerEnd =
    (diagramType === 'inheritance' || diagramType === 'realization')
      ? 'url(#preview-triangle)'
      : (diagramType === 'directed-association' || diagramType === 'dependency')
        ? 'url(#preview-arrow)'
        : undefined

  const labelY     = midY - 10
  const srcCardX   = sourceX + (midX - sourceX) * 0.12
  const srcCardY   = sourceY + (midY - sourceY) * 0.12
  const tgtCardX   = targetX + (midX - targetX) * 0.12
  const tgtCardY   = targetY + (midY - targetY) * 0.12

  const cardStyle = {
    fontSize: 9, fontWeight: 700,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    color: '#374151', backgroundColor: '#ffffffee',
    border: '1px solid #D1D5DB', padding: '1px 5px',
    borderRadius: 4, whiteSpace: 'nowrap', userSelect: 'none',
    backdropFilter: 'blur(2px)',
  }

  return (
    <>
      {/* SVG marker defs */}
      <defs>
        <marker id="preview-arrow" viewBox="0 0 14 14" refX="11" refY="7"
          markerUnits="userSpaceOnUse" markerWidth="16" markerHeight="16" orient="auto">
          <path d="M 1 1 L 13 7 L 1 13" fill="none" stroke={strokeColor}
                strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"/>
        </marker>
        <marker id="preview-triangle" viewBox="0 0 14 14" refX="12" refY="7"
          markerUnits="userSpaceOnUse" markerWidth="18" markerHeight="18" orient="auto">
          <path d="M 1 1 L 13 7 L 1 13 Z" fill="white" stroke={strokeColor} strokeWidth="1.4"/>
        </marker>
      </defs>

      {/* Visible line */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={style.strokeWidth || 1.8}
        strokeDasharray={isDashed ? '8 4' : undefined}
        markerEnd={markerEnd}
        className="react-flow__edge-path"
      />

      <EdgeLabelRenderer>
        {/* Centre relationship label */}
        <div style={{
          position: 'absolute',
          transform: `translate(-50%,-50%) translate(${midX}px,${labelY}px)`,
          pointerEvents: 'none', zIndex: 10,
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            fontSize: 10, fontWeight: 700,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            letterSpacing: '0.04em', color: '#374151',
            backgroundColor: '#ffffffee', border: '1.5px solid #D1D5DB',
            padding: '2px 8px', borderRadius: 9999,
            boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
            whiteSpace: 'nowrap', userSelect: 'none',
          }}>
            {relLabel}
          </span>
        </div>

        {/* Source cardinality */}
        {srcCard && (
          <div style={{ position: 'absolute', transform: `translate(-50%,-140%) translate(${srcCardX}px,${srcCardY}px)`, pointerEvents: 'none', zIndex: 10 }}>
            <span style={cardStyle}>{srcCard}</span>
          </div>
        )}
        {/* Target cardinality */}
        {tgtCard && (
          <div style={{ position: 'absolute', transform: `translate(-50%,-140%) translate(${tgtCardX}px,${tgtCardY}px)`, pointerEvents: 'none', zIndex: 10 }}>
            <span style={cardStyle}>{tgtCard}</span>
          </div>
        )}
        {/* Source role label */}
        {srcRole && (
          <div style={{ position: 'absolute', transform: `translate(-50%,-100%) translate(${sourceX + (midX - sourceX) * 0.22}px,${sourceY + (midY - sourceY) * 0.22 - 4}px)`, pointerEvents: 'none' }}>
            <span style={{ ...cardStyle, fontWeight: 600, border: 'none', backgroundColor: '#ffffffcc' }}>{srcRole}</span>
          </div>
        )}
        {/* Target role label */}
        {tgtRole && (
          <div style={{ position: 'absolute', transform: `translate(-50%,-100%) translate(${targetX + (midX - targetX) * 0.22}px,${targetY + (midY - targetY) * 0.22 - 4}px)`, pointerEvents: 'none' }}>
            <span style={{ ...cardStyle, fontWeight: 600, border: 'none', backgroundColor: '#ffffffcc' }}>{tgtRole}</span>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  )
}

// ── Node and edge type registrations ──────────────────────────────────────────
const PREVIEW_NODE_TYPES = { tableNode: PreviewTableNode }
const PREVIEW_EDGE_TYPES = { schema: PreviewEdge }

// ── Inner canvas (must be inside ReactFlowProvider) ───────────────────────────
function PreviewCanvas({ nodes: rawNodes, edges: rawEdges }) {
  // Normalise edges to use our read-only type
  const initEdges = rawEdges.map(e => ({
    ...e,
    type:  'schema',
    style: { stroke: '#6B7280', strokeWidth: 1.8, ...e.style },
  }))

  const [nodes] = useNodesState(rawNodes)
  const [edges] = useEdgesState(initEdges)

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={PREVIEW_NODE_TYPES}
      edgeTypes={PREVIEW_EDGE_TYPES}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnDrag={true}
      zoomOnScroll={true}
      zoomOnPinch={true}
      zoomOnDoubleClick={false}
      fitView
      fitViewOptions={{ padding: 0.28 }}
      minZoom={0.08}
      maxZoom={2.5}
      deleteKeyCode={null}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#E5E7EB"/>
      <Controls className="!border !border-gray-200 !shadow-md !rounded-xl overflow-hidden"/>
    </ReactFlow>
  )
}

// ── GitForkIcon ───────────────────────────────────────────────────────────────
function ForkIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="6" cy="6" r="2" strokeWidth={2}/>
      <circle cx="18" cy="6" r="2" strokeWidth={2}/>
      <circle cx="12" cy="18" r="2" strokeWidth={2}/>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M6 8v1a6 6 0 006 6m0 0a6 6 0 006-6V8M12 15v3"/>
    </svg>
  )
}

// ── Main overlay component ────────────────────────────────────────────────────
export default function SchemaPreviewOverlay({ card, onClose, onFork, user }) {
  const [schemaData,  setSchemaData]  = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [forking,     setForking]     = useState(false)
  const [visible,     setVisible]     = useState(false)

  // Fade in + lock body scroll
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true))
    document.body.style.overflow = 'hidden'
    return () => {
      cancelAnimationFrame(frame)
      document.body.style.overflow = ''
    }
  }, [])

  // Load schema JSON from the public endpoint
  useEffect(() => {
    if (!card?.id) return
    setLoading(true)
    api.get(`/explore/projects/${card.id}/schema`)
      .then(r => setSchemaData(r.data))
      .catch(() => setSchemaData({ nodes: [], edges: [] }))
      .finally(() => setLoading(false))
  }, [card?.id])

  // Smooth fade-out before calling onClose
  const handleClose = useCallback(() => {
    setVisible(false)
    setTimeout(onClose, 200)
  }, [onClose])

  // ESC key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [handleClose])

  const handleFork = useCallback(async () => {
    if (!user || card.is_forked || forking) return
    setForking(true)
    await onFork(card)
    setForking(false)
  }, [user, card, forking, onFork])

  const nodes = schemaData?.nodes || []
  const edges = schemaData?.edges || []

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col"
      style={{
        opacity:    visible ? 1 : 0,
        transition: 'opacity 0.2s ease',
        background: '#f7f5f1',
      }}
    >
      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-[#161413] border-b border-white/10 px-5 py-3 flex items-center gap-4 z-10">

        {/* ← Back to Explore */}
        <button onClick={handleClose}
          className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm font-medium
                     transition-colors flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
          Back to Explore
        </button>

        {/* Schema name + author (centred) */}
        <div className="flex-1 flex items-center justify-center gap-3 min-w-0">
          <h2 className="text-white font-bold text-sm truncate max-w-xs">{card?.name}</h2>
          {card?.owner && (
            <>
              <span className="text-white/20 hidden sm:inline">·</span>
              <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center
                                text-[9px] font-bold text-white overflow-hidden flex-shrink-0">
                  {card.owner.avatar_url
                    ? <img src={card.owner.avatar_url} alt="" className="w-full h-full object-cover"/>
                    : (card.owner.name || '?')[0].toUpperCase()}
                </div>
                <span className="text-white/60 text-xs">{card.owner.name}</span>
              </div>
            </>
          )}
        </div>

        {/* Fork button */}
        <div className="flex-shrink-0">
          {user && !card?.is_forked && (
            <button onClick={handleFork} disabled={forking}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white
                         text-xs font-semibold px-4 py-2 rounded-xl transition-colors
                         disabled:opacity-60 disabled:cursor-not-allowed shadow-sm">
              {forking ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white
                                   rounded-full animate-spin inline-block"/>
                  Forking…
                </>
              ) : (
                <><ForkIcon/> Fork to my projects</>
              )}
            </button>
          )}
          {card?.is_forked && (
            <span className="text-violet-300 text-xs font-medium px-3 py-2 rounded-xl
                             bg-violet-500/20 border border-violet-500/30">
              ✓ Already forked
            </span>
          )}
          {!user && (
            <span className="text-white/40 text-xs">Log in to fork</span>
          )}
        </div>
      </div>

      {/* ── Canvas area ──────────────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#f7f5f1]">
            <div className="w-9 h-9 border-2 border-gray-300 border-t-orange-400 rounded-full animate-spin mb-4"/>
            <p className="text-gray-500 text-sm font-medium">Loading schema…</p>
          </div>
        ) : nodes.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#f7f5f1]">
            <div className="w-16 h-16 rounded-2xl bg-[#ebe6dd] flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7"/>
              </svg>
            </div>
            <p className="text-[#161413] font-semibold text-sm mb-1">No schema designed yet</p>
            <p className="text-gray-400 text-xs">The canvas for this project is empty</p>
          </div>
        ) : (
          <ReactFlowProvider>
            <PreviewCanvas nodes={nodes} edges={edges}/>
          </ReactFlowProvider>
        )}
      </div>

      {/* ── Keyboard hint ────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-[#161413]/80 px-5 py-2 flex items-center justify-center gap-4 text-[10px] text-white/30">
        <span><kbd className="font-mono">Esc</kbd> to close</span>
        <span>·</span>
        <span>Scroll to zoom · Drag to pan</span>
        <span>·</span>
        <span>Read-only preview</span>
      </div>
    </div>
  )
}
