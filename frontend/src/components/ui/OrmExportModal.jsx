import { useState, useEffect, useRef, useCallback } from 'react'
import useSchemaStore from '../../store/useSchemaStore'
import { generateLaravel, generateDjango, generatePrisma } from '../../utils/ormGenerator'

// ── Framework tab definitions ─────────────────────────────────────────────────
const FRAMEWORKS = [
  {
    id:       'laravel',
    label:    'Laravel',
    sublabel: 'Eloquent',
    color:    'text-red-600 dark:text-red-400',
    activeBg: 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/40',
    dot:      'bg-red-500',
  },
  {
    id:       'django',
    label:    'Django',
    sublabel: 'Python',
    color:    'text-green-700 dark:text-green-400',
    activeBg: 'bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800/40',
    dot:      'bg-green-500',
  },
  {
    id:       'prisma',
    label:    'Prisma',
    sublabel: 'TypeScript',
    color:    'text-blue-600 dark:text-blue-400',
    activeBg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/40',
    dot:      'bg-blue-500',
  },
]

// ── Download helper ───────────────────────────────────────────────────────────
function downloadFile(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// ── Main component ────────────────────────────────────────────────────────────
export default function OrmExportModal({ onClose }) {
  const { nodes, edges } = useSchemaStore()

  const [activeFramework, setActiveFramework] = useState('laravel')
  const [copied,          setCopied]          = useState(false)

  // Laravel has multiple files — track which one is shown
  const [laravelFiles,    setLaravelFiles]    = useState({})   // { 'User.php': '...' }
  const [activePhpFile,   setActivePhpFile]   = useState('')

  // Generated outputs (memoised when modal opens)
  const [djangoCode,  setDjangoCode]  = useState('')
  const [prismaCode,  setPrismaCode]  = useState('')

  // Generate once when modal mounts so we always reflect current canvas state
  useEffect(() => {
    const lFiles = generateLaravel(nodes, edges)
    const dCode  = generateDjango(nodes, edges)
    const pCode  = generatePrisma(nodes, edges)

    setLaravelFiles(lFiles)
    setActivePhpFile(Object.keys(lFiles)[0] || '')
    setDjangoCode(dCode)
    setPrismaCode(pCode)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // ── Derived state ─────────────────────────────────────────────────────────
  const laravelFileNames = Object.keys(laravelFiles)

  const currentCode = activeFramework === 'laravel'
    ? (laravelFiles[activePhpFile] || '-- no models generated --')
    : activeFramework === 'django'
      ? djangoCode
      : prismaCode

  const currentFilename = activeFramework === 'laravel'
    ? activePhpFile
    : activeFramework === 'django'
      ? 'models.py'
      : 'schema.prisma'

  // ── Copy to clipboard ─────────────────────────────────────────────────────
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(currentCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [currentCode])

  // ── Download current file ─────────────────────────────────────────────────
  const handleDownload = useCallback(() => {
    downloadFile(currentFilename, currentCode)
  }, [currentFilename, currentCode])

  // ── Download ALL Laravel models ───────────────────────────────────────────
  const handleDownloadAllLaravel = useCallback(() => {
    laravelFileNames.forEach((fname, i) => {
      setTimeout(() => downloadFile(fname, laravelFiles[fname]), i * 80)
    })
  }, [laravelFileNames, laravelFiles])

  const activeFw = FRAMEWORKS.find(f => f.id === activeFramework)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"/>

      {/* Card */}
      <div
        className="relative flex flex-col w-full max-w-4xl max-h-[90vh]
                   bg-white dark:bg-[#141620] rounded-2xl shadow-2xl
                   border border-gray-200 dark:border-[#252a3e]
                   overflow-hidden animate-modal"
        onClick={e => e.stopPropagation()}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b
                        bg-gray-50 dark:bg-[#0f1117]
                        border-gray-200 dark:border-[#252a3e] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/50
                            flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Export Models
              </h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {nodes.filter(n => Array.isArray(n.data?.columns)).length} table{nodes.filter(n => n.data?.columns).length !== 1 ? 's' : ''} · ORM code generation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors
                       text-gray-400 dark:text-gray-500
                       hover:text-gray-600 dark:hover:text-gray-300
                       hover:bg-gray-100 dark:hover:bg-[#252a3e]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* ── Framework tabs ──────────────────────────────────────────────── */}
        <div className="flex gap-2 px-5 pt-4 pb-0 flex-shrink-0">
          {FRAMEWORKS.map(fw => (
            <button
              key={fw.id}
              onClick={() => setActiveFramework(fw.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-xl text-sm font-semibold
                          border-b-2 transition-all
                          ${activeFramework === fw.id
                            ? `${fw.color} border-current bg-gray-50 dark:bg-[#1c1f2e]`
                            : 'text-gray-400 dark:text-gray-500 border-transparent hover:text-gray-600 dark:hover:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#1c1f2e]/50'
                          }`}>
              <span className={`w-2 h-2 rounded-full ${fw.dot}`}/>
              {fw.label}
              <span className="text-xs font-normal opacity-70">{fw.sublabel}</span>
            </button>
          ))}
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 flex flex-col
                        bg-gray-50 dark:bg-[#1c1f2e]
                        border-t border-gray-200 dark:border-[#252a3e]">

          {/* Laravel model file sub-tabs */}
          {activeFramework === 'laravel' && laravelFileNames.length > 0 && (
            <div className="flex items-center gap-1 px-4 py-2 border-b overflow-x-auto flex-shrink-0
                            border-gray-200 dark:border-[#252a3e]
                            bg-white dark:bg-[#141620] scrollbar-thin">
              {laravelFileNames.map(fname => (
                <button
                  key={fname}
                  onClick={() => setActivePhpFile(fname)}
                  className={`flex-shrink-0 px-3 py-1 rounded-lg text-xs font-mono font-medium
                              transition-colors whitespace-nowrap
                              ${activePhpFile === fname
                                ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/40'
                                : 'text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#252a3e]'
                              }`}>
                  {fname}
                </button>
              ))}
            </div>
          )}

          {/* Empty state */}
          {activeFramework === 'laravel' && laravelFileNames.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-center p-10">
              <div>
                <svg className="w-10 h-10 text-gray-200 dark:text-gray-700 mx-auto mb-3"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M4 7v10c0 1.1.9 2 2 2h12a2 2 0 002-2V7M4 7l8-4 8 4M4 7h16"/>
                </svg>
                <p className="text-sm text-gray-400 dark:text-gray-600">
                  Add classes to the canvas to generate models.
                </p>
              </div>
            </div>
          )}

          {/* Code preview */}
          {(activeFramework !== 'laravel' || laravelFileNames.length > 0) && (
            <div className="flex-1 min-h-0 overflow-auto p-4">
              <pre
                className="text-xs font-mono leading-relaxed p-5 rounded-xl min-h-full
                           bg-[#0d1117] text-[#e6edf3] overflow-auto
                           selection:bg-blue-600/40"
                style={{ tabSize: 4 }}>
                <code>{currentCode}</code>
              </pre>
            </div>
          )}
        </div>

        {/* ── Footer / Action bar ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3 border-t flex-shrink-0
                        bg-white dark:bg-[#141620]
                        border-gray-200 dark:border-[#252a3e]">

          {/* Left — note */}
          <p className="text-xs text-gray-400 dark:text-gray-600 max-w-xs leading-relaxed">
            Generated from current canvas.{' '}
            <span className="font-medium text-gray-500 dark:text-gray-500">
              Review before using in production.
            </span>
          </p>

          {/* Right — action buttons */}
          <div className="flex items-center gap-2">

            {/* Download all (Laravel only) */}
            {activeFramework === 'laravel' && laravelFileNames.length > 1 && (
              <button
                onClick={handleDownloadAllLaravel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                           transition-colors border
                           text-gray-600 dark:text-gray-400
                           bg-gray-50 dark:bg-[#1c1f2e]
                           border-gray-200 dark:border-[#252a3e]
                           hover:bg-gray-100 dark:hover:bg-[#252a3e]">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                Download all ({laravelFileNames.length})
              </button>
            )}

            {/* Copy */}
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                          transition-colors border
                          ${copied
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40'
                            : 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-[#1c1f2e] border-gray-200 dark:border-[#252a3e] hover:bg-gray-100 dark:hover:bg-[#252a3e]'
                          }`}>
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                  </svg>
                  Copy
                </>
              )}
            </button>

            {/* Download current */}
            <button
              onClick={handleDownload}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                          transition-colors border text-white
                          ${activeFw?.dot === 'bg-red-500'   ? 'bg-red-600   hover:bg-red-500   border-red-700'   : ''}
                          ${activeFw?.dot === 'bg-green-500' ? 'bg-green-600 hover:bg-green-500 border-green-700' : ''}
                          ${activeFw?.dot === 'bg-blue-500'  ? 'bg-blue-600  hover:bg-blue-500  border-blue-700'  : ''}
                          shadow-sm`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              {activeFramework === 'laravel' ? `Download ${activePhpFile || '.php'}` : `Download ${currentFilename}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
