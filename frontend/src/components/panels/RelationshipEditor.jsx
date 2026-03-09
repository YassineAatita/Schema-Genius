import { useState, useEffect } from 'react'
import useSchemaStore from '../../store/useSchemaStore'

const RELATIONSHIP_TYPES = [
  {
    value: '1:1',
    label: 'One to One',
    description: 'Each row in A links to exactly one row in B',
    example: 'User → Profile',
  },
  {
    value: '1:N',
    label: 'One to Many',
    description: 'One row in A links to many rows in B',
    example: 'User → Orders',
  },
  {
    value: 'N:1',
    label: 'Many to One',
    description: 'Many rows in A link to one row in B',
    example: 'Orders → User',
  },
  {
    value: 'N:N',
    label: 'Many to Many',
    description: 'Many rows in A link to many rows in B',
    example: 'Students ↔ Courses',
  },
]

export default function RelationshipEditor({ edge, onClose }) {
  const { nodes, updateEdge, deleteEdge, setEdges, edges } = useSchemaStore()

  const [selectedType, setSelectedType] = useState('1:N')
  const [saved, setSaved]               = useState(false)

  const sourceNode = nodes.find(n => n.id === edge.source)
  const targetNode = nodes.find(n => n.id === edge.target)

  // Load current type when edge changes
  useEffect(() => {
    const current = edge.data?.relationshipType || edge.label || '1:N'
    setSelectedType(current)
    setSaved(false)
  }, [edge.id])

  const handleSave = () => {
    // Update store
    updateEdge(edge.id, {
      label: selectedType,
      data:  { ...edge.data, relationshipType: selectedType },
      style: { stroke: '#6B7280', strokeWidth: 2 },
      labelStyle:   { fontSize: 11, fill: '#374151', fontWeight: 600 },
      labelBgStyle: { fill: '#F3F4F6', fillOpacity: 1 },
      labelBgPadding:      [6, 3],
      labelBgBorderRadius: 4,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleDelete = () => {
    if (!window.confirm('Delete this relationship?')) return
    deleteEdge(edge.id)
    onClose()
  }

  const hasChanges = selectedType !== (edge.data?.relationshipType || edge.label || '1:N')

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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* Connection summary */}
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
          <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">
            Connection
          </p>
          <div className="flex items-center justify-between gap-2">
            <div className="bg-blue-600 text-white text-xs font-semibold
                            px-3 py-1.5 rounded-lg truncate flex-1 text-center">
              {sourceNode?.data?.name || edge.source}
            </div>
            <div className="flex flex-col items-center flex-shrink-0">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"/>
              </svg>
              <span className="text-xs font-bold text-purple-600 mt-0.5">
                {selectedType}
              </span>
            </div>
            <div className="bg-blue-600 text-white text-xs font-semibold
                            px-3 py-1.5 rounded-lg truncate flex-1 text-center">
              {targetNode?.data?.name || edge.target}
            </div>
          </div>
        </div>

        {/* Type selector */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Relationship Type
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
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-100 bg-gray-50 space-y-2">

        {/* Unsaved warning */}
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

        {/* Save button */}
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M5 13l4 4L19 7"/>
              </svg>
              Relationship Saved!
            </span>
          ) : 'Save Relationship'}
        </button>

        {/* Delete */}
        <button
          onClick={handleDelete}
          className="w-full py-2 rounded-lg text-xs text-red-400 hover:text-red-600
                     hover:bg-red-50 transition-colors border border-transparent
                     hover:border-red-100">
          Delete this relationship
        </button>
      </div>
    </div>
  )
}