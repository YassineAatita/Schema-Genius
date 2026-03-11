import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import useAuthStore from '../store/useAuthStore'
import api from '../services/api'

const schema = z.object({
  name:                  z.string().min(2, 'Name must be at least 2 characters'),
  email:                 z.string().email('Please enter a valid email'),
  password:              z.string().min(8, 'Password must be at least 8 characters'),
  password_confirmation: z.string(),
}).refine(data => data.password === data.password_confirmation, {
  message: 'Passwords do not match',
  path: ['password_confirmation'],
})

export default function RegisterPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } =
    useForm({ resolver: zodResolver(schema) })

  const onSubmit = async (data) => {
    setLoading(true)
    setServerError('')
    try {
      const response = await api.post('/auth/register', data)
      setAuth(response.data.user, response.data.token)
      navigate('/dashboard')
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed. Please try again.'
      setServerError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col">

      {/* ── Top bar ── */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-white/10">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center
                          group-hover:bg-blue-500 transition-colors">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 7v10c0 1.1.9 2 2 2h12a2 2 0 002-2V7M4 7l8-4 8 4M4 7h16"/>
            </svg>
          </div>
          <span className="font-bold text-white text-sm tracking-tight">Schema Genius</span>
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
            <h1 className="text-2xl font-bold text-white mb-1">Create your account</h1>
            <p className="text-sm text-gray-500">Start designing database schemas visually — free</p>
          </div>

          {/* Card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur">

            {serverError && (
              <div className="mb-5 p-3 bg-red-500/10 border border-red-500/20
                              rounded-lg text-red-400 text-sm">
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase
                                  tracking-wide mb-1.5">
                  Full Name
                </label>
                <input
                  {...register('name')}
                  type="text"
                  placeholder="John Doe"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl
                             text-sm text-white placeholder:text-gray-600
                             focus:outline-none focus:ring-2 focus:ring-blue-500/50
                             focus:border-blue-500/50 transition-all"
                />
                {errors.name && (
                  <p className="mt-1.5 text-xs text-red-400">{errors.name.message}</p>
                )}
              </div>

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
                             focus:outline-none focus:ring-2 focus:ring-blue-500/50
                             focus:border-blue-500/50 transition-all"
                />
                {errors.email && (
                  <p className="mt-1.5 text-xs text-red-400">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase
                                  tracking-wide mb-1.5">
                  Password
                </label>
                <input
                  {...register('password')}
                  type="password"
                  placeholder="Min. 8 characters"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl
                             text-sm text-white placeholder:text-gray-600
                             focus:outline-none focus:ring-2 focus:ring-blue-500/50
                             focus:border-blue-500/50 transition-all"
                />
                {errors.password && (
                  <p className="mt-1.5 text-xs text-red-400">{errors.password.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase
                                  tracking-wide mb-1.5">
                  Confirm Password
                </label>
                <input
                  {...register('password_confirmation')}
                  type="password"
                  placeholder="Repeat your password"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl
                             text-sm text-white placeholder:text-gray-600
                             focus:outline-none focus:ring-2 focus:ring-blue-500/50
                             focus:border-blue-500/50 transition-all"
                />
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
                    Creating account...
                  </>
                ) : 'Create Account →'}
              </button>

            </form>

            <p className="mt-6 text-center text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
