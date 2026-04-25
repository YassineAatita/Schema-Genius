import { useCallback, useRef, useState } from 'react'
import {
  getBezierPath, getSmoothStepPath, getStraightPath,
  EdgeLabelRenderer, useReactFlow,
} from '@xyflow/react'
import { useCanvasTheme } from '../../contexts/CanvasThemeContext'
import useSchemaStore from '../../store/useSchemaStore'

// ── Normalise stored relationship types to the canonical set ─────────────────
const NORM_REL = { '1:M': '1:N', 'M:1': 'N:1' }

// ── Display labels for each cardinality value ────────────────────────────────
const REL_LABEL = {
  '1:1': '1 : 1',
  '1:N': '1 : N',
  'N:1': 'N : 1',
  'M:N': 'M : N',
  'M:M': 'M : M',
  'N:N': 'N : N',
}

// ── Arrow end marker (SVG defs) — used for all line types via markerEnd ───────
// Only the arrow uses context-stroke (works reliably as markerEnd in all browsers).
// Diamonds are rendered as explicit <g> elements (see below) because markerStart
// with context-stroke has known orientation issues on curved paths.
function EdgeDefs() {
  return (
    <defs>
      {/* Filled solid arrow ─ Association / Dependency / Aggregation / Composition */}
      <marker id="sg-arrow" viewBox="0 0 12 12" refX="10" refY="6"
        markerUnits="userSpaceOnUse" markerWidth="14" markerHeight="14" orient="auto">
        <path d="M 1 1 L 11 6 L 1 11 Z" fill="context-stroke" stroke="none"/>
      </marker>

      {/* Open hollow triangle ─ Inheritance / Generalisation */}
      <marker id="sg-triangle" viewBox="0 0 14 14" refX="12" refY="7"
        markerUnits="userSpaceOnUse" markerWidth="18" markerHeight="18" orient="auto">
        <path d="M 1 1 L 13 7 L 1 13 Z" fill="white" stroke="context-stroke" strokeWidth="1.4"/>
      </marker>
    </defs>
  )
}

// ── Diamond rendered as an explicit SVG element at the source point ──────────
// This bypasses the markerStart + context-stroke orientation issue on bezier /
// smoothstep paths that caused diamonds to disappear on non-straight lines.
function DiamondAtSource({ sx, sy, tx, ty, filled, strokeColor, bgColor }) {
  const angle = Math.atan2(ty - sy, tx - sx) * 180 / Math.PI
  // Diamond: left-tip at origin, extends 20px toward target, half-height 6px
  return (
    <g transform={`translate(${sx},${sy}) rotate(${angle})`} style={{ pointerEvents: 'none' }}>
      <polygon
        points="0,0 10,-6 20,0 10,6"
        fill={filled ? strokeColor : bgColor}
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </g>
  )
}

// ── Path builder ─────────────────────────────────────────────────────────────
function getEdgePath(lineStyle, params) {
  if (lineStyle === 'straight')   return getStraightPath(params)
  if (lineStyle === 'smoothstep') return getSmoothStepPath(params)
  if (lineStyle === 'step')       return getSmoothStepPath({ ...params, borderRadius: 0 })
  return getBezierPath(params)
}

// Quadratic bezier through a user-dragged control-point offset (cpX, cpY).
// Formula: bezier CP = 2*(mid+offset) − 0.5*(start+end)
function buildBentPath(sx, sy, tx, ty, cpX, cpY) {
  const midX = (sx + tx) / 2
  const midY = (sy + ty) / 2
  const cpBX = 2 * (midX + cpX) - 0.5 * (sx + tx)
  const cpBY = 2 * (midY + cpY) - 0.5 * (sy + ty)
  return [`M ${sx} ${sy} Q ${cpBX} ${cpBY} ${tx} ${ty}`, midX + cpX, midY + cpY]
}

// ── Main edge component ───────────────────────────────────────────────────────
export default function CustomSchemaEdge({
  id,
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  data = {},
  selected,
  style = {},
}) {
  const dark       = useCanvasTheme()
  const { getViewport } = useReactFlow()
  const updateEdge = useSchemaStore(s => s.updateEdge)

  const lineStyle   = data.lineStyle   || 'default'
  const diagramType = data.diagramType || 'association'
  const cpX         = data.cpX ?? 0
  const cpY         = data.cpY ?? 0
  const hasBend     = Math.abs(cpX) > 0.5 || Math.abs(cpY) > 0.5

  // ── Path ─────────────────────────────────────────────────────────────────
  let edgePath, midX, midY
  if (hasBend) {
    ;[edgePath, midX, midY] = buildBentPath(sourceX, sourceY, targetX, targetY, cpX, cpY)
  } else {
    ;[edgePath, midX, midY] = getEdgePath(lineStyle, {
      sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
    })
  }

  // ── Colors ───────────────────────────────────────────────────────────────
  const [hovered, setHovered] = useState(false)
  const strokeColor = selected  ? '#3B82F6'
    : hovered                   ? (dark ? '#60a5fa' : '#2563EB')
    : (style.stroke || (dark ? '#9ca3af' : '#6B7280'))
  const strokeWidth = (selected || hovered) ? (style.strokeWidth || 2) + 0.5 : (style.strokeWidth || 2)
  const isDashed    = diagramType === 'dependency'

  // Canvas background — used for hollow fills (hollow diamond, open triangle)
  const bgColor = dark ? '#0f1117' : '#ffffff'

  // ── Markers ──────────────────────────────────────────────────────────────
  // Diamonds are drawn explicitly (DiamondAtSource below), NOT via markerStart.
  const markerEnd = diagramType === 'inheritance' ? 'url(#sg-triangle)' : 'url(#sg-arrow)'
  // No markerStart on the path — diamonds rendered as separate SVG elements.

  // ── Draggable bend handle ─────────────────────────────────────────────────
  const dragRef = useRef(null)

  const onHandleMouseDown = useCallback((e) => {
    e.stopPropagation()
    e.preventDefault()
    const { zoom } = getViewport()
    dragRef.current = { startX: e.clientX, startY: e.clientY, cpX, cpY, zoom }

    const onMove = (me) => {
      if (!dragRef.current) return
      const dz = dragRef.current.zoom
      const dx = (me.clientX - dragRef.current.startX) / dz
      const dy = (me.clientY - dragRef.current.startY) / dz
      updateEdge(id, { data: { cpX: dragRef.current.cpX + dx, cpY: dragRef.current.cpY + dy } })
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [id, cpX, cpY, getViewport, updateEdge])

  const onHandleDblClick = useCallback((e) => {
    e.stopPropagation()
    updateEdge(id, { data: { cpX: 0, cpY: 0 } })
  }, [id, updateEdge])

  // ── Label text ────────────────────────────────────────────────────────────
  const rawRel   = data.relationshipType || data.type || '1:N'
  const relType  = NORM_REL[rawRel] || rawRel
  const relLabel = REL_LABEL[relType] || relType
  const srcRole  = data.sourceLabel?.trim() || ''
  const tgtRole  = data.targetLabel?.trim() || ''

  // Push the centre label 10 px above the line to reduce overlap with nodes
  const labelY = midY - 10

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <EdgeDefs />

      {/* ── Wide invisible hit-area ────────────────────────────────────── */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="react-flow__edge-interaction"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />

      {/* ── Visible line ──────────────────────────────────────────────── */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={isDashed ? '8 4' : undefined}
        markerEnd={markerEnd}
        className="react-flow__edge-path"
        style={{ transition: 'stroke 0.12s, stroke-width 0.12s' }}
      />

      {/* ── Explicit diamond at source (aggregation / composition) ────── */}
      {(diagramType === 'aggregation' || diagramType === 'composition') && (
        <DiamondAtSource
          sx={sourceX} sy={sourceY}
          tx={targetX} ty={targetY}
          filled={diagramType === 'composition'}
          strokeColor={strokeColor}
          bgColor={bgColor}
        />
      )}

      {/* ── Selected highlight ring ───────────────────────────────────── */}
      {selected && (
        <path
          d={edgePath}
          fill="none"
          stroke="#3B82F6"
          strokeWidth={strokeWidth + 4}
          strokeOpacity={0.15}
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* ── Labels + bend handle (via EdgeLabelRenderer) ─────────────── */}
      <EdgeLabelRenderer>

        {/* Centre cardinality pill — lifted slightly above the line */}
        <div
          style={{
            position:      'absolute',
            transform:     `translate(-50%,-50%) translate(${midX}px,${labelY}px)`,
            pointerEvents: 'none',
            zIndex:        10,
          }}
        >
          <span style={{
            display:         'inline-flex',
            alignItems:      'center',
            fontSize:        10,
            fontWeight:      700,
            fontFamily:      'ui-monospace, SFMono-Regular, Menlo, monospace',
            letterSpacing:   '0.05em',
            color:           selected ? (dark ? '#93c5fd' : '#1D4ED8') : (dark ? '#e5e7eb' : '#374151'),
            backgroundColor: dark ? '#1c1f2eee' : '#ffffffee',
            border:          `1.5px solid ${selected
              ? (dark ? '#3b82f6' : '#93C5FD')
              : (dark ? '#374151' : '#D1D5DB')}`,
            padding:         '2px 8px',
            borderRadius:    9999,
            boxShadow:       dark ? '0 2px 6px rgba(0,0,0,0.6)' : '0 1px 4px rgba(0,0,0,0.14)',
            whiteSpace:      'nowrap',
            userSelect:      'none',
          }}>
            {relLabel}
          </span>
        </div>

        {/* Source role label (18 % along the line toward mid, offset up) */}
        {srcRole && (
          <div style={{
            position:      'absolute',
            transform:     `translate(-50%,-100%) translate(${
              sourceX + (midX - sourceX) * 0.22
            }px,${sourceY + (midY - sourceY) * 0.22 - 4}px)`,
            pointerEvents: 'none',
          }}>
            <span style={{
              fontSize:        9,
              fontWeight:      600,
              color:           dark ? '#9ca3af' : '#6B7280',
              backgroundColor: dark ? '#0f1117cc' : '#ffffffcc',
              padding:         '1px 5px',
              borderRadius:    4,
              whiteSpace:      'nowrap',
              backdropFilter:  'blur(2px)',
            }}>
              {srcRole}
            </span>
          </div>
        )}

        {/* Target role label */}
        {tgtRole && (
          <div style={{
            position:      'absolute',
            transform:     `translate(-50%,-100%) translate(${
              targetX + (midX - targetX) * 0.22
            }px,${targetY + (midY - targetY) * 0.22 - 4}px)`,
            pointerEvents: 'none',
          }}>
            <span style={{
              fontSize:        9,
              fontWeight:      600,
              color:           dark ? '#9ca3af' : '#6B7280',
              backgroundColor: dark ? '#0f1117cc' : '#ffffffcc',
              padding:         '1px 5px',
              borderRadius:    4,
              whiteSpace:      'nowrap',
              backdropFilter:  'blur(2px)',
            }}>
              {tgtRole}
            </span>
          </div>
        )}

        {/* Bend drag handle — visible when selected, hovered, or already bent */}
        {(selected || hovered || hasBend) && (
          <div
            onMouseDown={onHandleMouseDown}
            onDoubleClick={onHandleDblClick}
            title={hasBend ? 'Drag to reshape · Double-click to straighten' : 'Drag to bend this line'}
            style={{
              position:        'absolute',
              transform:       `translate(-50%,-50%) translate(${midX}px,${midY}px)`,
              cursor:          'grab',
              pointerEvents:   'all',
              width:           16,
              height:          16,
              borderRadius:    '50%',
              backgroundColor: selected ? '#3B82F6' : hovered ? (dark ? '#60a5fa' : '#2563EB') : (dark ? '#4b5563' : '#9CA3AF'),
              border:          `2.5px solid ${dark ? '#1c1f2e' : '#ffffff'}`,
              boxShadow:       selected
                ? '0 0 0 3px rgba(59,130,246,0.25), 0 2px 6px rgba(0,0,0,0.3)'
                : '0 1px 4px rgba(0,0,0,0.3)',
              transition:      'background-color 0.12s, box-shadow 0.12s',
              zIndex:          20,
            }}
          />
        )}

      </EdgeLabelRenderer>
    </>
  )
}
