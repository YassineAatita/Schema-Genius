import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import api from '../services/api'

const schema = z.object({
  email: z.string().email('Please enter a valid email'),
})

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading]     = useState(false)
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, getValues, formState: { errors } } =
    useForm({ resolver: zodResolver(schema) })

  const onSubmit = async (data) => {
    setLoading(true)
    setServerError('')
    try {
      await api.post('/auth/forgot-password', data)
      setSubmitted(true)
    } catch {
      setServerError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col">

      {/* Top bar */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-white/10">
        <Link to="/" className="flex items-center">
          <img src="/logo_white.svg" alt="Schema Genius" className="h-7 w-auto" />
        </Link>
        <Link to="/login"
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
          Back to login
        </Link>
      </div>

      {/* Form area */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">

          {submitted ? (
            /* ── Success state ── */
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/25
                              flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white mb-3">Check your inbox</h1>
              <p className="text-sm text-gray-400 mb-2 leading-relaxed">
                If <span className="text-gray-200 font-medium">{getValues('email')}</span> is
                registered, you'll receive a reset link shortly.
              </p>
              <p className="text-xs text-gray-600 mb-8">
                Don't see it? Check your spam folder. The link expires in 60 minutes.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-white/5 border border-white/10
                           text-sm text-gray-300 rounded-xl hover:bg-white/10 transition-colors"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            /* ── Form state ── */
            <>
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-full bg-indigo-500/15 border border-indigo-500/25
                                flex items-center justify-center mx-auto mb-5">
                  <svg className="w-7 h-7 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-white mb-1">Forgot your password?</h1>
                <p className="text-sm text-gray-500">
                  Enter your email and we'll send you a reset link.
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur">

                {serverError && (
                  <div className="mb-5 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                    {serverError}
                  </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                      Email Address
                    </label>
                    <input
                      {...register('email')}
                      type="email"
                      placeholder="you@example.com"
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl
                                 text-sm text-white placeholder:text-gray-600
                                 focus:outline-none focus:ring-2 focus:ring-blue-500/50
                                 focus:border-blue-500/50 transition-all"
                    />
                    {errors.email && (
                      <p className="mt-1.5 text-xs text-red-400">{errors.email.message}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50
                               disabled:cursor-not-allowed text-white font-semibold py-2.5
                               rounded-xl text-sm transition-all shadow-lg shadow-blue-900/30
                               flex items-center justify-center gap-2 mt-2"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10"
                            stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                        </svg>
                        Sending...
                      </>
                    ) : 'Send Reset Link'}
                  </button>
                </form>

                <p className="mt-6 text-center text-sm text-gray-600">
                  Remember your password?{' '}
                  <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                    Sign in
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
