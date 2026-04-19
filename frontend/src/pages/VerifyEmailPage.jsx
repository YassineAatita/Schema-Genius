import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import api from '../services/api'

export default function VerifyEmailPage() {
  const location   = useLocation()
  const email      = location.state?.email ?? null

  const [resendStatus,  setResendStatus]  = useState('idle')   // idle | sending | sent | error
  const [resendMessage, setResendMessage] = useState('')

  async function handleResend() {
    if (!email || resendStatus === 'sending' || resendStatus === 'sent') return
    setResendStatus('sending')
    setResendMessage('')
    try {
      const res = await api.post('/auth/email/resend', { email })
      // Backend returns 503 when mail transport is down — axios throws on non-2xx
      setResendStatus('sent')
      setResendMessage(res.data?.message ?? 'New link sent! Check your inbox.')
    } catch (err) {
      setResendStatus('error')
      // Extract the friendly message from 503 response, fall back to generic
      const msg = err.response?.data?.message || 'Failed to resend. Please try again shortly.'
      setResendMessage(msg)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col">

      {/* Top bar */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-white/10">
        <Link to="/" className="flex items-center">
          <img src="/logo_white.svg" alt="Schema Genius" className="h-7 w-auto" />
        </Link>
        <Link to="/" className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
          Back to home
        </Link>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">

          {/* Envelope icon */}
          <div className="w-20 h-20 rounded-full bg-blue-600/15 border border-blue-500/20
                          flex items-center justify-center mx-auto mb-6">
            <svg className="w-9 h-9 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">Check your inbox</h1>
          <p className="text-sm text-gray-400 mb-1">
            We sent a verification link to
          </p>
          {email ? (
            <p className="text-base font-semibold text-blue-400 mb-6">{email}</p>
          ) : (
            <p className="text-base font-semibold text-gray-300 mb-6">your email address</p>
          )}

          {/* Card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur text-left">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-6 h-6 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-400 text-xs font-bold">1</span>
              </div>
              <p className="text-sm text-gray-300">Open the email from <span className="text-white font-medium">Schema Genius</span></p>
            </div>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-6 h-6 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-400 text-xs font-bold">2</span>
              </div>
              <p className="text-sm text-gray-300">Click <span className="text-white font-medium">"Verify Email Address"</span></p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-400 text-xs font-bold">3</span>
              </div>
              <p className="text-sm text-gray-300">Come back and <span className="text-white font-medium">sign in</span></p>
            </div>
          </div>

          {/* Resend */}
          <div className="mt-6">
            {resendStatus === 'sent' ? (
              <div className="flex items-center justify-center gap-2 text-sm text-green-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                </svg>
                {resendMessage || 'New link sent! Check your inbox.'}
              </div>
            ) : resendStatus === 'error' ? (
              <p className="text-sm text-amber-400">
                {resendMessage || 'Failed to resend. Please try again shortly.'}
              </p>
            ) : (
              <p className="text-sm text-gray-500">
                Didn't receive it?{' '}
                {email ? (
                  <button
                    onClick={handleResend}
                    disabled={resendStatus === 'sending'}
                    className="text-blue-400 hover:text-blue-300 font-medium transition-colors disabled:opacity-60"
                  >
                    {resendStatus === 'sending' ? 'Sending…' : 'Resend email'}
                  </button>
                ) : (
                  <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                    Go to login to resend
                  </Link>
                )}
              </p>
            )}
          </div>

          <p className="mt-8 text-xs text-gray-600">
            The link expires in 60 minutes. Check your spam folder if you don't see it.
          </p>

          <Link
            to="/login"
            className="mt-6 inline-flex items-center gap-1.5 text-sm text-gray-500
                       hover:text-gray-300 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
            Back to login
          </Link>

        </div>
      </div>
    </div>
  )
}
