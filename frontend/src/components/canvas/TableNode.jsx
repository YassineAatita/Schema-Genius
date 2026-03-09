import { useState } from 'react'
import { Handle, Position } from '@xyflow/react'

// Icons for column types
const TYPE_COLORS = {
  BIGINT:   'bg-blue-100 text-blue-700',
  INT:      'bg-blue-100 text-blue-700',
  VARCHAR:  'bg-purple-100 text-purple-700',
  TEXT:     'bg-purple-100 text-purple-700',
  BOOLEAN:  'bg-green-100 text-green-700',
  DATE:     'bg-orange-100 text-orange-700',
  DATETIME: 'bg-orange-100 text-orange-700',
  DECIMAL:  'bg-yellow-100 text-yellow-700',
  ENUM:     'bg-pink-100 text-pink-700',
}

export default function TableNode({ data, selected }) {
  return (
    <div className={`bg-white rounded-xl shadow-md border-2 min-w-[220px] max-w-[280px]
                     transition-all duration-150
                     ${selected ? 'border-blue-500 shadow-blue-100 shadow-lg' : 'border-gray-200'}`}>

      {/* Table Header */}
      <div className="bg-blue-600 rounded-t-xl px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-blue-200 flex-shrink-0" fill="none"
            stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 10h18M3 6h18M3 14h18M3 18h18"/>
          </svg>
          <span className="text-white font-semibold text-sm truncate">
            {data.name}
          </span>
        </div>
        <span className="text-blue-200 text-xs">
          {data.columns?.length || 0} col{data.columns?.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Columns List */}
      <div className="divide-y divide-gray-100">
        {data.columns?.map((col) => (
          <div key={col.id}
            className="px-3 py-2 flex items-center justify-between gap-2 hover:bg-gray-50">

            {/* Left: key icon + column name */}
            <div className="flex items-center gap-1.5 min-w-0">
              {col.pk ? (
                <svg className="w-3 h-3 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 1C8.676 1 6 3.676 6 7c0 2.65 1.628 4.934 4 5.745V21h2v-2h2v-2h-2v-2h2v-2h-2v-1.255C14.372 11.934 16 9.65 16 7c0-3.324-2.676-6-4-6zm0 2c2.206 0 4 1.794 4 4s-1.794 4-4 4-4-1.794-4-4 1.794-4 4-4zm0 1a3 3 0 100 6 3 3 0 000-6z"/>
                </svg>
              ) : col.fk ? (
                <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none"
                  stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10.172 13.828a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.1-1.1"/>
                </svg>
              ) : (
                <div className="w-3 h-3 flex-shrink-0"/>
              )}

              <span className={`text-xs truncate
                ${col.pk ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>
                {col.name}
              </span>

              {col.nullable && (
                <span className="text-gray-300 text-xs flex-shrink-0">?</span>
              )}
            </div>

            {/* Right: type badge */}
            <span className={`text-xs px-1.5 py-0.5 rounded font-mono flex-shrink-0
              ${TYPE_COLORS[col.type] || 'bg-gray-100 text-gray-600'}`}>
              {col.type}
            </span>
          </div>
        ))}

        {/* Empty columns state */}
        {(!data.columns || data.columns.length === 0) && (
          <div className="px-3 py-3 text-center text-gray-300 text-xs">
            No columns yet
          </div>
        )}
      </div>

      {/* Connection handles — invisible dots on edges for drawing relationships */}
      <Handle type="target" position={Position.Left}
        className="!w-3 !h-3 !bg-blue-400 !border-2 !border-white"/>
      <Handle type="source" position={Position.Right}
        className="!w-3 !h-3 !bg-blue-400 !border-2 !border-white"/>
    </div>
  )
}