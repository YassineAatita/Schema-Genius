import { Link, useSearchParams } from 'react-router-dom'

export default function EmailVerifiedPage() {
  const [params] = useSearchParams()
  const success = params.get('success') === '1'
  const already = params.get('already') === '1'
  const error   = params.get('error')   // 'invalid' | 'expired' | null

  /* ── Success (or already verified) ── */
  if (success || already) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex flex-col">

        <div className="px-6 py-4 flex items-center border-b border-white/10">
          <Link to="/" className="flex items-center">
            <img src="/logo_white.svg" alt="Schema Genius" className="h-7 w-auto" />
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md text-center">

            {/* Success ring animation */}
            <div className="w-20 h-20 rounded-full bg-green-500/15 border border-green-500/30
                            flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-white mb-3">
              {already ? 'Already verified!' : 'Email verified!'}
            </h1>
            <p className="text-sm text-gray-400 mb-8">
              {already
                ? 'Your email address was already confirmed. You can log in.'
                : 'Your email address has been confirmed. Your account is ready to use.'}
            </p>

            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500
                         text-white font-semibold rounded-xl text-sm transition-all
                         shadow-lg shadow-blue-900/30"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
              </svg>
              Sign in to Schema Genius
            </Link>

          </div>
        </div>
      </div>
    )
  }

  /* ── Error state ── */
  const isExpired = error === 'expired'

  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col">

      <div className="px-6 py-4 flex items-center border-b border-white/10">
        <Link to="/" className="flex items-center">
          <img src="/logo_white.svg" alt="Schema Genius" className="h-7 w-auto" />
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">

          {/* Error icon */}
          <div className="w-20 h-20 rounded-full bg-red-500/15 border border-red-500/30
                          flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-white mb-3">
            {isExpired ? 'Link expired' : 'Invalid link'}
          </h1>
          <p className="text-sm text-gray-400 mb-8">
            {isExpired
              ? 'This verification link has expired. Verification links are valid for 60 minutes.'
              : 'This verification link is invalid or has already been used.'}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5
                         bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl
                         text-sm transition-all shadow-lg shadow-blue-900/30"
            >
              Go to login
            </Link>
            {isExpired && (
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5
                           border border-white/10 text-gray-400 hover:text-white hover:border-white/25
                           rounded-xl text-sm transition-all"
              >
                Register again
              </Link>
            )}
          </div>

          <p className="mt-6 text-xs text-gray-600">
            If you need a new link, log in and we'll prompt you to resend.
          </p>

        </div>
      </div>
    </div>
  )
}
