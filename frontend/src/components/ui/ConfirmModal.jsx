import { useEffect } from 'react'

/**
 * Beautiful confirmation modal.
 *
 * Props:
 *   open        — boolean
 *   variant     — 'info' | 'warning' | 'danger'  (default: 'warning')
 *   title       — string
 *   message     — string
 *   confirmText — string  (default: 'Confirm')
 *   cancelText  — string  (default: 'Cancel')
 *   onConfirm   — () => void
 *   onCancel    — () => void
 */
export default function ConfirmModal({
  open,
  variant = 'warning',
  title,
  message,
  confirmText = 'Confirm',
  cancelText  = 'Cancel',
  onConfirm,
  onCancel,
}) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onCancel?.() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null

  const isInfo    = variant === 'info'
  const isDanger  = variant === 'danger'
  const iconBg    = isDanger ? 'bg-red-100' : isInfo ? 'bg-blue-100' : 'bg-amber-100'
  const iconColor = isDanger ? 'text-red-500' : isInfo ? 'text-blue-500' : 'text-amber-500'
  const btnColor  = isDanger
    ? 'bg-red-600 hover:bg-red-500 shadow-red-900/20'
    : isInfo
      ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20'
      : 'bg-amber-500 hover:bg-amber-400 shadow-amber-900/20'

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      {/* Blur overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>

      {/* Card */}
      <div
        className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl
                   border border-gray-100 p-6 animate-modal"
        onClick={e => e.stopPropagation()}
      >
        {/* Icon */}
        <div className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center mb-4 mx-auto`}>
          {isDanger ? (
            <svg className={`w-6 h-6 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5
                   4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          ) : isInfo ? (
            <svg className={`w-6 h-6 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          ) : (
            <svg className={`w-6 h-6 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464
                   0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          )}
        </div>

        {/* Text */}
        <div className="text-center mb-6">
          <h3 className="text-base font-bold text-gray-900 mb-1.5">{title}</h3>
          <p className="text-sm text-gray-500 leading-relaxed">{message}</p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600
                       bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white
                        transition-all shadow-lg ${btnColor}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
