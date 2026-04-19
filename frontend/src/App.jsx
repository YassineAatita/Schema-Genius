import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import useAuthStore from './store/useAuthStore'
import api from './services/api'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import EmailVerifiedPage from './pages/EmailVerifiedPage'
import DashboardPage from './pages/DashboardPage'
import DesignerPage from './pages/DesignerPage'
import AdminPage from './pages/AdminPage'

// Protects routes that require login.
// Also ensures `user` is populated after a hard page refresh — the token
// survives in localStorage but the Zustand store resets to { user: null }.
// Without fetching /auth/me here, isOwner / canEdit compute wrong on the
// designer page until the user visits the dashboard first.
function PrivateRoute({ children }) {
  const { isAuthenticated, user, setUser, logout } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated && !user) {
      api.get('/auth/me')
        .then(res => setUser(res.data))
        .catch(() => { logout(); navigate('/login', { replace: true }) })
    }
  }, [isAuthenticated])   // eslint-disable-line react-hooks/exhaustive-deps

  return isAuthenticated ? children : <Navigate to="/login" replace />
}

// Protects the /admin route — must be authenticated AND have the admin role.
// Handles the hard-refresh case where user is null until /auth/me returns.
function AdminRoute({ children }) {
  const { isAuthenticated, user, setUser, logout } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated && !user) {
      api.get('/auth/me')
        .then(res => setUser(res.data))
        .catch(() => { logout(); navigate('/login', { replace: true }) })
    }
  }, [isAuthenticated])   // eslint-disable-line react-hooks/exhaustive-deps

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!user) return null  // still loading user from /auth/me — render nothing briefly
  if (!user.is_admin) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/email-verified" element={<EmailVerifiedPage />} />

        {/* Protected routes */}
        <Route path="/dashboard" element={
          <PrivateRoute><DashboardPage /></PrivateRoute>
        } />
        <Route path="/projects/:projectId/designer" element={
          <PrivateRoute><DesignerPage /></PrivateRoute>
        } />
        {/* Admin panel — admin role required */}
        <Route path="/admin" element={
          <AdminRoute><AdminPage /></AdminRoute>
        } />

        {/* /profile and /friends redirect to dashboard (tabs inside dashboard) */}
        <Route path="/profile" element={<Navigate to="/dashboard" replace />} />
        <Route path="/friends" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
