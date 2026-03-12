import { useState, useEffect } from 'react'
import useSchemaStore from '../../store/useSchemaStore'
import ConfirmModal from '../ui/ConfirmModal'

const KNOWN_LINE_STYLES = ['default', 'smoothstep', 'step', 'straight']

const LINE_STYLES = [
  {
    value: 'default',
    label: 'Curved',
    description: 'Smooth bezier curve',
    icon: (
      <svg viewBox="0 0 40 20" className="w-10 h-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M2 18 C10 18, 15 2, 38 2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    value: 'smoothstep',
    label: 'Elbow',
    description: 'Rounded 90° bends',
    icon: (
      <svg viewBox="0 0 40 20" className="w-10 h-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M2 18 Q2 2, 20 2 L38 2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    value: 'step',
    label: 'Step',
    description: 'Hard 90° angles',
    icon: (
      <svg viewBox="0 0 40 20" className="w-10 h-5" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="2,18 2,2 38,2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    value: 'straight',
    label: 'Straight',
    description: 'Direct line',
    icon: (
      <svg viewBox="0 0 40 20" className="w-10 h-5" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="2" y1="18" x2="38" y2="2" strokeLinecap="round"/>
      </svg>
    ),
  },
]

const DIAGRAM_TYPES = [
  {
    value: 'association',
    label: 'Association',
    description: 'Standard directed relationship',
    color: 'blue',
    icon: (
      <svg viewBox="0 0 48 16" className="w-12 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <line x1="2" y1="8" x2="36" y2="8"/>
        <path d="M 26 3 L 38 8 L 26 13" fill="none" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    value: 'aggregation',
    label: 'Aggregation',
    description: '"Has a" — shared ownership',
    color: 'violet',
    icon: (
      <svg viewBox="0 0 54 16" className="w-14 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M 2 8 L 8 3 L 14 8 L 8 13 z" fill="white" stroke="currentColor"/>
        <line x1="14" y1="8" x2="38" y2="8"/>
        <path d="M 28 3 L 40 8 L 28 13" fill="none" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    value: 'composition',
    label: 'Composition',
    description: '"Part of" — strong ownership',
    color: 'purple',
    icon: (
      <svg viewBox="0 0 54 16" className="w-14 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M 2 8 L 8 3 L 14 8 L 8 13 z" fill="currentColor"/>
        <line x1="14" y1="8" x2="38" y2="8"/>
        <path d="M 28 3 L 40 8 L 28 13" fill="none" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    value: 'inheritance',
    label: 'Inheritance',
    description: '"Is a" — generalization',
    color: 'emerald',
    icon: (
      <svg viewBox="0 0 48 16" className="w-12 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <line x1="2" y1="8" x2="30" y2="8"/>
        <path d="M 22 3 L 36 8 L 22 13 z" fill="white" stroke="currentColor" strokeWidth="1.8"/>
      </svg>
    ),
  },
  {
    value: 'dependency',
    label: 'Dependency',
    description: 'Dashed — uses / relies on',
    color: 'amber',
    icon: (
      <svg viewBox="0 0 48 16" className="w-12 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <line x1="2" y1="8" x2="36" y2="8" strokeDasharray="5 3"/>
        <path d="M 26 3 L 38 8 L 26 13" fill="none" strokeLinejoin="round"/>
      </svg>
    ),
  },
]

const RELATIONSHIP_TYPES = [
  {
    value: '1:1',
    label: 'One to One',
    description: 'Each row in A links to exactly one row in B',
    example: 'User → Profile',
  },
  {
    value: '1:M',
    label: 'One to Many',
    description: 'One row in A links to many rows in B',
    example: 'User → Orders',
  },
  {
    value: 'M:1',
    label: 'Many to One',
    description: 'Many rows in A link to one row in B',
    example: 'Orders → User',
  },
  {
    value: 'M:M',
    label: 'Many to Many',
    description: 'Many rows in A link to many rows in B',
    example: 'Students ↔ Courses',
  },
]

const DIAGRAM_COLORS = {
  blue:    { border: 'border-blue-500',    bg: 'bg-blue-50',    text: 'text-blue-600',    dot: 'bg-blue-500'    },
  violet:  { border: 'border-violet-500',  bg: 'bg-violet-50',  text: 'text-violet-600',  dot: 'bg-violet-500'  },
  purple:  { border: 'border-purple-500',  bg: 'bg-purple-50',  text: 'text-purple-600',  dot: 'bg-purple-500'  },
  emerald: { border: 'border-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  amber:   { border: 'border-amber-500',   bg: 'bg-amber-50',   text: 'text-amber-600',   dot: 'bg-amber-500'   },
}

export default function RelationshipEditor({ edge, onClose }) {
  const { nodes, updateEdge, deleteEdge } = useSchemaStore()

  const [selectedType,  setSelectedType]  = useState('1:M')
  const [lineStyle,     setLineStyle]     = useState('smoothstep')
  const [diagramType,   setDiagramType]   = useState('association')
  const [sourceLabel,   setSourceLabel]   = useState('')
  const [targetLabel,   setTargetLabel]   = useState('')
  const [saved,         setSaved]         = useState(false)
  const [showDelModal,  setShowDelModal]  = useState(false)

  const sourceNode = nodes.find(n => n.id === edge.source)
  const targetNode = nodes.find(n => n.id === edge.target)

  // Load current values when edge changes
  useEffect(() => {
    setSelectedType(edge.data?.relationshipType || '1:M')
    setLineStyle(
      edge.data?.lineStyle ||
      (KNOWN_LINE_STYLES.includes(edge.type) ? edge.type : 'smoothstep')
    )
    setDiagramType(edge.data?.diagramType || 'association')
    setSourceLabel(edge.data?.sourceLabel || '')
    setTargetLabel(edge.data?.targetLabel || '')
    setSaved(false)
  }, [edge.id])

  const handleSave = () => {
    const src = sourceLabel.trim()
    const tgt = targetLabel.trim()
    const canvasLabel = (src || tgt)
      ? `${src || '—'} [${selectedType}] ${tgt || '—'}`
      : selectedType

    updateEdge(edge.id, {
      type:  'schema',
      label: canvasLabel,
      data:  {
        ...edge.data,
        relationshipType: selectedType,
        sourceLabel:      src,
        targetLabel:      tgt,
        lineStyle,
        diagramType,
      },
      style: { stroke: '#6B7280', strokeWidth: 2 },
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleDelete = () => setShowDelModal(true)
  const confirmDelete = () => {
    deleteEdge(edge.id)
    onClose()
  }

  const currentLineStyle = edge.data?.lineStyle ||
    (KNOWN_LINE_STYLES.includes(edge.type) ? edge.type : 'smoothstep')

  const hasChanges =
    selectedType !== (edge.data?.relationshipType || '1:M') ||
    lineStyle    !== currentLineStyle ||
    diagramType  !== (edge.data?.diagramType || 'association') ||
    sourceLabel  !== (edge.data?.sourceLabel || '') ||
    targetLabel  !== (edge.data?.targetLabel || '')

  const activeDiagram = DIAGRAM_TYPES.find(d => d.value === diagramType)
  const activeDiagramColors = DIAGRAM_COLORS[activeDiagram?.color || 'blue']

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full shadow-lg">

      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-purple-500"/>
          <h3 className="font-semibold text-gray-800 text-sm">Relationship Editor</h3>
        </div>
        <button onClick={onClose}
          className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* Connection summary */}
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
          <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Connection</p>
          <div className="flex items-center justify-between gap-2">
            <div className="bg-blue-600 text-white text-xs font-semibold
                            px-3 py-1.5 rounded-lg truncate flex-1 text-center">
              {sourceNode?.data?.name || edge.source}
            </div>
            <div className="flex flex-col items-center flex-shrink-0">
              <span className="text-xs font-mono font-bold text-purple-600">{selectedType}</span>
              <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${activeDiagramColors.dot}`}/>
            </div>
            <div className="bg-blue-600 text-white text-xs font-semibold
                            px-3 py-1.5 rounded-lg truncate flex-1 text-center">
              {targetNode?.data?.name || edge.target}
            </div>
          </div>
        </div>

        {/* Diagram Type */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Diagram Type
          </p>
          <div className="space-y-1.5">
            {DIAGRAM_TYPES.map((dt) => {
              const colors = DIAGRAM_COLORS[dt.color]
              const active = diagramType === dt.value
              return (
                <button
                  key={dt.value}
                  onClick={() => { setDiagramType(dt.value); setSaved(false) }}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl border-2 transition-all text-left
                    ${active
                      ? `${colors.border} ${colors.bg}`
                      : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'
                    }`}
                >
                  <span className={active ? colors.text : 'text-gray-400'}>
                    {dt.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs font-semibold ${active ? colors.text : 'text-gray-700'}`}>
                      {dt.label}
                    </span>
                    <p className="text-xs text-gray-400 truncate">{dt.description}</p>
                  </div>
                  {active && (
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${colors.dot}`}/>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Line Style */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Line Style
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {LINE_STYLES.map((style) => (
              <button
                key={style.value}
                onClick={() => { setLineStyle(style.value); setSaved(false) }}
                title={style.description}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all
                  ${lineStyle === style.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'
                  }`}
              >
                <span className={lineStyle === style.value ? 'text-blue-600' : 'text-gray-500'}>
                  {style.icon}
                </span>
                <span className={`text-xs font-medium leading-tight
                  ${lineStyle === style.value ? 'text-blue-600' : 'text-gray-500'}`}>
                  {style.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Cardinality */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Cardinality
          </p>
          <div className="space-y-2">
            {RELATIONSHIP_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => { setSelectedType(type.value); setSaved(false) }}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all
                  ${selectedType === type.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'
                  }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`font-bold text-sm font-mono
                    ${selectedType === type.value ? 'text-blue-600' : 'text-gray-700'}`}>
                    {type.value}
                  </span>
                  <span className={`text-xs font-semibold
                    ${selectedType === type.value ? 'text-blue-500' : 'text-gray-500'}`}>
                    {type.label}
                  </span>
                </div>
                <p className="text-xs text-gray-400">{type.description}</p>
                <p className="text-xs text-gray-300 mt-0.5 italic">{type.example}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Role Names */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Role Names <span className="text-gray-300 font-normal normal-case">(optional)</span>
          </p>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-gray-400 mb-1">{sourceNode?.data?.name || 'Source'} side</p>
              <input
                type="text"
                value={sourceLabel}
                onChange={e => { setSourceLabel(e.target.value); setSaved(false) }}
                placeholder='e.g. "places many"'
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           placeholder:text-gray-300"
              />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">{targetNode?.data?.name || 'Target'} side</p>
              <input
                type="text"
                value={targetLabel}
                onChange={e => { setTargetLabel(e.target.value); setSaved(false) }}
                placeholder='e.g. "belongs to one"'
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           placeholder:text-gray-300"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-100 bg-gray-50 space-y-2">
        {hasChanges && !saved && (
          <p className="text-xs text-amber-600 text-center flex items-center justify-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213
                   2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11
                   13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1
                   1 0 00-1-1z"
                clipRule="evenodd"/>
            </svg>
            Unsaved changes
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={!hasChanges && !saved}
          className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all
            ${saved
              ? 'bg-green-500 text-white'
              : hasChanges
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
        >
          {saved ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
              </svg>
              Saved!
            </span>
          ) : 'Save Relationship'}
        </button>

        <button
          onClick={handleDelete}
          className="w-full py-2 rounded-lg text-xs text-red-400 hover:text-red-600
                     hover:bg-red-50 transition-colors border border-transparent
                     hover:border-red-100">
          Delete this relationship
        </button>
      </div>

      <ConfirmModal
        open={showDelModal}
        variant="danger"
        title="Delete relationship?"
        message={`Remove the connection between ${sourceNode?.data?.name || 'source'} and ${targetNode?.data?.name || 'target'}?`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setShowDelModal(false)}
      />
    </div>
  )
}
