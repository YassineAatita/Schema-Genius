import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import useAuthStore from '../store/useAuthStore'
import api from '../services/api'

const schema = z.object({
  email:    z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

export default function LoginPage() {
  const navigate      = useNavigate()
  const [searchParams] = useSearchParams()
  const { setAuth }   = useAuthStore()
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Logout-reason banner (inactivity / session_conflict)
  const [logoutBanner, setLogoutBanner] = useState(null)

  useEffect(() => {
    const reason = sessionStorage.getItem('logout_reason')
    if (reason) {
      sessionStorage.removeItem('logout_reason')
      setLogoutBanner(reason)
    }
  }, [])

  // Email verification banner state
  const [unverifiedEmail, setUnverifiedEmail]   = useState(null)
  const [resendStatus,    setResendStatus]       = useState('idle')   // idle | sending | sent | error
  const [resendMessage,   setResendMessage]      = useState('')

  const { register, handleSubmit, formState: { errors } } =
    useForm({ resolver: zodResolver(schema) })

  async function handleResend() {
    if (!unverifiedEmail || resendStatus === 'sending' || resendStatus === 'sent') return
    setResendStatus('sending')
    setResendMessage('')
    try {
      const res = await api.post('/auth/email/resend', { email: unverifiedEmail })
      setResendStatus('sent')
      setResendMessage(res.data?.message ?? 'New link sent — check your inbox')
    } catch (err) {
      setResendStatus('error')
      const msg = err.response?.data?.message || 'Failed to resend. Please try again shortly.'
      setResendMessage(msg)
    }
  }

  const onSubmit = async (data) => {
    setLoading(true)
    setServerError('')
    setUnverifiedEmail(null)
    setResendStatus('idle')
    try {
      const response = await api.post('/auth/login', data)
      setAuth(response.data.user, response.data.token)
      sessionStorage.removeItem('dashboard_view')
      // Respect ?next= for redirecting back after login (e.g. from shared schema links).
      // Only allow internal paths (starts with /) to prevent open-redirect.
      const next = searchParams.get('next')
      const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
      navigate(safeNext, { replace: true })
    } catch (err) {
      // Special case: email not verified yet
      if (err.response?.status === 403 && err.response?.data?.error === 'email_not_verified') {
        setUnverifiedEmail(err.response.data.email ?? data.email)
        return
      }
      const msg = err.response?.data?.message
        || err.response?.data?.errors?.email?.[0]
        || 'Login failed. Please try again.'
      setServerError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#0f0d0b' }}>

      {/* ── Top bar ── */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-white/10">
        <Link to="/" className="flex items-center">
          <img src="/logo_white.svg" alt="Schema Genius" className="h-7 w-auto" />
        </Link>
        <Link to="/"
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300
                     transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
          Back to home
        </Link>
      </div>

      {/* ── Form area ── */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-1">Welcome back</h1>
            <p className="text-sm text-gray-500">Sign in to your Schema Genius account</p>
          </div>

          {/* Card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur">

            {/* ── Inactivity / session-conflict banner ── */}
            {logoutBanner && (
              <div className={`mb-5 p-4 rounded-xl border flex items-start gap-3
                ${logoutBanner === 'session_conflict'
                  ? 'bg-amber-500/10 border-amber-500/25'
                  : 'bg-[#c96b3a]/10 border-[#c96b3a]/25'}`}>
                <svg className={`w-5 h-5 flex-shrink-0 mt-0.5
                  ${logoutBanner === 'session_conflict' ? 'text-amber-400' : 'text-[#e8724a]'}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <div>
                  <p className={`text-sm font-semibold mb-0.5
                    ${logoutBanner === 'session_conflict' ? 'text-amber-300' : 'text-[#f0a070]'}`}>
                    {logoutBanner === 'session_conflict'
                      ? 'Signed in from another browser'
                      : 'Session expired'}
                  </p>
                  <p className={`text-xs
                    ${logoutBanner === 'session_conflict' ? 'text-amber-400/80' : 'text-[#e8724a]/80'}`}>
                    {logoutBanner === 'session_conflict'
                      ? 'Your account was signed in from another browser. Please sign in again to continue.'
                      : 'You were logged out due to inactivity. Please sign in again.'}
                  </p>
                </div>
                <button onClick={() => setLogoutBanner(null)}
                  className="ml-auto text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            )}

            {/* ── Email not verified banner ── */}
            {unverifiedEmail && (
              <div className="mb-5 p-4 bg-amber-500/10 border border-amber-500/25 rounded-xl">
                <div className="flex items-start gap-3 mb-3">
                  <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-amber-300 mb-0.5">Email not verified</p>
                    <p className="text-xs text-amber-400/80">
                      Please check your inbox and click the verification link for{' '}
                      <span className="font-medium text-amber-300">{unverifiedEmail}</span>
                    </p>
                  </div>
                </div>
                {resendStatus === 'sent' ? (
                  <div className="flex items-center gap-2 text-xs text-green-400 font-medium">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                    </svg>
                    {resendMessage || 'New link sent — check your inbox'}
                  </div>
                ) : resendStatus === 'error' ? (
                  <p className="text-xs text-amber-400">{resendMessage || 'Failed to resend. Please try again.'}</p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendStatus === 'sending'}
                    className="text-xs font-medium text-amber-400 hover:text-amber-300
                               underline underline-offset-2 disabled:opacity-60 transition-colors"
                  >
                    {resendStatus === 'sending' ? 'Sending…' : 'Resend verification email'}
                  </button>
                )}
              </div>
            )}

            {serverError && (
              <div className="mb-5 p-3 bg-red-500/10 border border-red-500/20
                              rounded-lg text-red-400 text-sm">
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase
                                  tracking-wide mb-1.5">
                  Email Address
                </label>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="you@example.com"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl
                             text-sm text-white placeholder:text-gray-600
                             focus:outline-none focus:ring-2 focus:ring-[#c96b3a]/30
                             focus:border-[#c96b3a]/40 transition-all"
                />
                {errors.email && (
                  <p className="mt-1.5 text-xs text-red-400">{errors.email.message}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-[#e8724a] hover:text-[#f0a070] transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Your password"
                    className="w-full px-4 py-2.5 pr-10 bg-white/5 border border-white/10 rounded-xl
                               text-sm text-white placeholder:text-gray-600
                               focus:outline-none focus:ring-2 focus:ring-[#c96b3a]/30
                               focus:border-[#c96b3a]/40 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1.5 text-xs text-red-400">{errors.password.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#c96b3a] hover:bg-[#e8724a] disabled:bg-[#c96b3a]/50
                           disabled:cursor-not-allowed text-white font-semibold py-2.5
                           rounded-xl text-sm transition-all shadow-lg shadow-[#c96b3a]/20
                           flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10"
                        stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                    Signing in...
                  </>
                ) : 'Sign In'}
              </button>

            </form>

            <p className="mt-6 text-center text-sm text-gray-600">
              No account yet?{' '}
              <Link to="/register" className="text-[#e8724a] hover:text-[#f0a070] font-medium transition-colors">
                Create one free
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
