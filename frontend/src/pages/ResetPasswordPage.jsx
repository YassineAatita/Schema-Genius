import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import api from '../services/api'

const schema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  password_confirmation: z.string(),
}).refine(data => data.password === data.password_confirmation, {
  message: "Passwords don't match",
  path: ['password_confirmation'],
})

function StrengthBar({ password }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
    password.length >= 12,
  ]
  const score = checks.filter(Boolean).length

  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500']
  const labels = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong']
  const color  = score > 0 ? colors[score - 1] : 'bg-white/10'
  const label  = score > 0 ? labels[score - 1] : ''

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1,2,3,4,5].map(i => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? color : 'bg-white/10'}`}
          />
        ))}
      </div>
      {label && (
        <p className={`text-xs ${score <= 2 ? 'text-red-400' : score <= 3 ? 'text-yellow-400' : 'text-green-400'}`}>
          {label}
        </p>
      )}
    </div>
  )
}

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const token = searchParams.get('token') || ''
  const email = searchParams.get('email') || ''

  const [loading, setLoading]           = useState(false)
  const [serverError, setServerError]   = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)

  const { register, handleSubmit, watch, formState: { errors } } =
    useForm({ resolver: zodResolver(schema) })

  const watchedPassword = watch('password', '')

  const onSubmit = async (data) => {
    setLoading(true)
    setServerError('')
    try {
      await api.post('/auth/reset-password', {
        token,
        email,
        password:              data.password,
        password_confirmation: data.password_confirmation,
      })
      navigate('/login?reset=1')
    } catch (err) {
      setServerError(
        err.response?.data?.message || 'Password reset failed. Please request a new link.'
      )
    } finally {
      setLoading(false)
    }
  }

  // Guard: missing token or email in URL
  if (!token || !email) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-500/15 border border-red-500/25
                          flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-3">Invalid reset link</h1>
          <p className="text-sm text-gray-400 mb-6">
            This link is missing required parameters. Please request a new password reset.
          </p>
          <Link
            to="/forgot-password"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500
                       text-sm text-white font-semibold rounded-xl transition-colors"
          >
            Request new link
          </Link>
        </div>
      </div>
    )
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

          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-full bg-indigo-500/15 border border-indigo-500/25
                            flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Choose a new password</h1>
            <p className="text-sm text-gray-500">
              For <span className="text-gray-300">{email}</span>
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur">

            {serverError && (
              <div className="mb-5 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {serverError}
                {(serverError.toLowerCase().includes('invalid') || serverError.toLowerCase().includes('used')) && (
                  <div className="mt-2">
                    <Link to="/forgot-password" className="text-xs text-red-300 hover:text-red-200 underline">
                      Request a new reset link
                    </Link>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="At least 8 characters"
                    className="w-full px-4 py-2.5 pr-10 bg-white/5 border border-white/10 rounded-xl
                               text-sm text-white placeholder:text-gray-600
                               focus:outline-none focus:ring-2 focus:ring-blue-500/50
                               focus:border-blue-500/50 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <StrengthBar password={watchedPassword || ''} />
                {errors.password && (
                  <p className="mt-1.5 text-xs text-red-400">{errors.password.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    {...register('password_confirmation')}
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Repeat your password"
                    className="w-full px-4 py-2.5 pr-10 bg-white/5 border border-white/10 rounded-xl
                               text-sm text-white placeholder:text-gray-600
                               focus:outline-none focus:ring-2 focus:ring-blue-500/50
                               focus:border-blue-500/50 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password_confirmation && (
                  <p className="mt-1.5 text-xs text-red-400">{errors.password_confirmation.message}</p>
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
                    Resetting...
                  </>
                ) : 'Reset Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
