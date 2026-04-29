import axios from 'axios'

// API base URL is configured via VITE_API_URL in frontend/.env (or frontend/.env.production).
// Hardcoding 127.0.0.1:8000 here would break every deployment; always use the env variable.
// Development default: http://127.0.0.1:8000/api
const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000') + '/api',
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
})

// Automatically attach token to every request if it exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// If server returns 401 (unauthorized), log the user out automatically.
// If the user HAD a token (thought they were authenticated) when the 401
// arrived, it means the session was terminated externally — most likely
// because the account was signed in from another browser.  Store a reason
// so LoginPage can surface the right message.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const hadToken = !!localStorage.getItem('token')
      localStorage.removeItem('token')
      sessionStorage.removeItem('dashboard_view')
      if (hadToken) {
        sessionStorage.setItem('logout_reason', 'session_conflict')
      }
      window.location.replace('/login')
    }
    return Promise.reject(error)
  }
)

export default api