import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/useAuthStore'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import DesignerPage from './pages/DesignerPage'

// Protects routes that require login
function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected routes */}
        <Route path="/dashboard" element={
          <PrivateRoute><DashboardPage /></PrivateRoute>
        } />
        <Route path="/projects/:projectId/designer" element={
          <PrivateRoute><DesignerPage /></PrivateRoute>
        } />
        {/* /profile redirects to dashboard (profile is now a tab inside dashboard) */}
        <Route path="/profile" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}