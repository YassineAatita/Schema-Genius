import { Link, useNavigate } from 'react-router-dom'
import useAuthStore from '../store/useAuthStore'

export default function NotFoundPage() {
  const navigate       = useNavigate()
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)

  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col items-center justify-center px-4 relative overflow-hidden">

      {/* ── Ambient glow blobs ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full
                        bg-blue-600/10 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full
                        bg-indigo-600/10 blur-[100px]" />
      </div>

      {/* ── Top bar with logo ── */}
      <div className="absolute top-0 left-0 right-0 px-6 py-4 flex items-center
                      border-b border-white/10">
        <Link to="/" className="flex items-center">
          <img src="/logo_white.svg" alt="Schema Genius" className="h-7 w-auto" />
        </Link>
      </div>

      {/* ── Main content ── */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-lg">

        {/* Large animated 404 */}
        <div className="select-none mb-6">
          <span
            className="text-[9rem] sm:text-[12rem] font-black leading-none tracking-tighter
                       bg-gradient-to-b from-blue-400 via-blue-500 to-indigo-600
                       bg-clip-text text-transparent
                       drop-shadow-[0_0_60px_rgba(59,130,246,0.35)]
                       animate-pulse"
            style={{ animationDuration: '3s' }}
          >
            404
          </span>
        </div>

        {/* Icon */}
        <div className="mb-6 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
          <svg
            className="w-10 h-10 text-blue-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01
                 M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        {/* Heading & description */}
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">
          Page not found
        </h1>
        <p className="text-gray-400 text-sm sm:text-base leading-relaxed mb-10">
          The page you're looking for doesn't exist or has been moved.
          Double-check the URL or head back to safety.
        </p>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <Link
            to="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2
                       px-6 py-2.5 rounded-xl text-sm font-semibold
                       bg-blue-600 hover:bg-blue-500 text-white
                       transition-colors duration-150 shadow-lg shadow-blue-900/30"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Go to Home
          </Link>

          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2
                         px-6 py-2.5 rounded-xl text-sm font-semibold
                         bg-white/5 hover:bg-white/10 border border-white/10
                         hover:border-white/20 text-gray-300 hover:text-white
                         transition-colors duration-150"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z
                     M14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z
                     M4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z
                     M14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              Go to Dashboard
            </Link>
          ) : (
            <button
              onClick={() => navigate(-1)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2
                         px-6 py-2.5 rounded-xl text-sm font-semibold
                         bg-white/5 hover:bg-white/10 border border-white/10
                         hover:border-white/20 text-gray-300 hover:text-white
                         transition-colors duration-150"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 19l-7-7 7-7" />
              </svg>
              Go Back
            </button>
          )}
        </div>
      </div>

      {/* ── Subtle grid overlay ── */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
    </div>
  )
}
