import { getBezierPath, getSmoothStepPath, getStraightPath, EdgeLabelRenderer } from '@xyflow/react'

// SVG marker definitions — shared IDs across all edges (identical content so last-wins is fine)
function EdgeDefs() {
  return (
    <defs>
      {/* Filled arrow — Association & Dependency */}
      <marker
        id="sg-arrow"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerUnits="userSpaceOnUse"
        markerWidth="12"
        markerHeight="12"
        orient="auto"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
      </marker>

      {/* Open triangle — Inheritance */}
      <marker
        id="sg-triangle"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerUnits="userSpaceOnUse"
        markerWidth="14"
        markerHeight="14"
        orient="auto"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="white" stroke="context-stroke" strokeWidth="1.2" />
      </marker>

      {/* Open diamond — Aggregation (markerStart) */}
      <marker
        id="sg-diamond-open"
        viewBox="0 0 20 10"
        refX="19"
        refY="5"
        markerUnits="userSpaceOnUse"
        markerWidth="24"
        markerHeight="14"
        orient="auto"
      >
        <path d="M 0 5 L 9 0 L 18 5 L 9 10 z" fill="white" stroke="context-stroke" strokeWidth="1.2" />
      </marker>

      {/* Filled diamond — Composition (markerStart) */}
      <marker
        id="sg-diamond-filled"
        viewBox="0 0 20 10"
        refX="19"
        refY="5"
        markerUnits="userSpaceOnUse"
        markerWidth="24"
        markerHeight="14"
        orient="auto"
      >
        <path d="M 0 5 L 9 0 L 18 5 L 9 10 z" fill="context-stroke" />
      </marker>
    </defs>
  )
}

function getEdgePath(lineStyle, params) {
  if (lineStyle === 'straight')   return getStraightPath(params)
  if (lineStyle === 'smoothstep') return getSmoothStepPath(params)
  if (lineStyle === 'step')       return getSmoothStepPath({ ...params, borderRadius: 0 })
  return getBezierPath(params)
}

export default function CustomSchemaEdge({
  id,
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  data = {},
  selected,
  style = {},
  label,
  labelX,
  labelY,
}) {
  const lineStyle   = data.lineStyle   || 'default'
  const diagramType = data.diagramType || 'association'

  const [edgePath, midX, midY] = getEdgePath(lineStyle, {
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  })

  const strokeColor = selected ? '#3B82F6' : (style.stroke || '#6B7280')
  const strokeWidth = style.strokeWidth || 2
  const isDashed    = diagramType === 'dependency'

  const markerEnd   = diagramType === 'inheritance' ? 'url(#sg-triangle)' : 'url(#sg-arrow)'
  const markerStart = diagramType === 'aggregation'  ? 'url(#sg-diamond-open)'
    :                 diagramType === 'composition'  ? 'url(#sg-diamond-filled)'
    :                 undefined

  return (
    <>
      <EdgeDefs />

      {/* Wide invisible path for easier click/hover interaction */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="react-flow__edge-interaction"
      />

      {/* Visible styled path */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={isDashed ? '8 4' : undefined}
        markerEnd={markerEnd}
        markerStart={markerStart}
        className="react-flow__edge-path"
      />

      {/* Label rendered via EdgeLabelRenderer for correct z-index */}
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX ?? midX}px,${labelY ?? midY}px)`,
              pointerEvents: 'all',
              fontSize: 11,
              fontWeight: 600,
              color: selected ? '#1D4ED8' : '#374151',
              backgroundColor: '#F3F4F6',
              padding: '2px 6px',
              borderRadius: 4,
              border: `1px solid ${selected ? '#93C5FD' : '#E5E7EB'}`,
              whiteSpace: 'nowrap',
            }}
            className="nodrag nopan"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
