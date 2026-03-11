import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/useAuthStore'
import useProjectStore from '../store/useProjectStore'
import api from '../services/api'
import ConfirmModal from '../components/ui/ConfirmModal'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, setUser, logout } = useAuthStore()
  const { projects, loading, fetchProjects, deleteProject } = useProjectStore()
  const [showModal,     setShowModal]     = useState(false)
  const [search,        setSearch]        = useState('')
  const [pendingDelete, setPendingDelete] = useState(null) // { id, name }

  // Load user + projects when page opens
  useEffect(() => {
    api.get('/auth/me')
      .then(res => setUser(res.data))
      .catch(() => { logout(); navigate('/login') })

    fetchProjects()
  }, [])

  const handleLogout = async () => {
    try { await api.post('/auth/logout') } finally {
      logout()
      navigate('/login')
    }
  }

  const handleDelete = (id, name) => setPendingDelete({ id, name })
  const confirmDelete = async () => {
    await deleteProject(pendingDelete.id)
    setPendingDelete(null)
  }

  // Filter projects by search
  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Navbar ── */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 7v10c0 1.1.9 2 2 2h12a2 2 0 002-2V7M4 7l8-4 8 4M4 7h16"/>
              </svg>
            </div>
            <span className="font-bold text-gray-900 text-lg">Schema-Genius</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.name}</span>
            <button onClick={handleLogout}
              className="text-sm text-gray-400 hover:text-red-500 transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </nav>

      {/* ── Main ── */}
      <main className="max-w-7xl mx-auto px-6 py-10">

        {/* Header row */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              My Projects
            </h1>
            <p className="text-gray-400 text-sm mt-0.5">
              {projects.length} project{projects.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium
                       px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
            </svg>
            New Project
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
          </svg>
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full max-w-sm pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"/>
                <div className="h-3 bg-gray-100 rounded w-full mb-2"/>
                <div className="h-3 bg-gray-100 rounded w-2/3"/>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7"/>
              </svg>
            </div>
            <h3 className="font-semibold text-gray-800 mb-1">
              {search ? 'No projects match your search' : 'No projects yet'}
            </h3>
            <p className="text-gray-400 text-sm mb-5">
              {search ? 'Try a different keyword' : 'Create your first project to get started'}
            </p>
            {!search && (
              <button onClick={() => setShowModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm
                           font-medium px-5 py-2.5 rounded-lg transition-colors">
                Create first project
              </button>
            )}
          </div>
        )}

        {/* Project grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={() => navigate(`/projects/${project.id}/designer`)}
                onDelete={() => handleDelete(project.id, project.name)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Create Project Modal */}
      {showModal && (
        <CreateProjectModal
          onClose={() => setShowModal(false)}
        />
      )}

      <ConfirmModal
        open={!!pendingDelete}
        variant="danger"
        title="Delete project?"
        message={`"${pendingDelete?.name}" and all its schema data will be permanently deleted. This cannot be undone.`}
        confirmText="Delete project"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}

// ── Project Card Component ────────────────────────────────────────
function ProjectCard({ project, onOpen, onDelete }) {
  const date = new Date(project.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300
                    hover:shadow-md transition-all duration-200 group">

      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 7v10c0 1.1.9 2 2 2h12a2 2 0 002-2V7M4 7l8-4 8 4M4 7h16"/>
          </svg>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2">
          {!project.is_owner && (
            <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-medium">
              Shared
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium
            ${project.visibility === 'public'
              ? 'bg-green-50 text-green-600'
              : 'bg-gray-100 text-gray-500'}`}>
            {project.visibility}
          </span>
        </div>
      </div>

      {/* Name */}
      <h3 className="font-semibold text-gray-900 mb-1 truncate">{project.name}</h3>

      {/* Description */}
      <p className="text-gray-400 text-xs mb-4 line-clamp-2 min-h-[2rem]">
        {project.description || 'No description'}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <span className="text-xs text-gray-400">{date}</span>

        <div className="flex items-center gap-1">
          {/* Open button */}
          <button
            onClick={onOpen}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white
                       px-3 py-1.5 rounded-lg transition-colors font-medium">
            Open
          </button>

          {/* Delete button — only for owner */}
          {project.is_owner && (
            <button
              onClick={onDelete}
              className="p-1.5 text-gray-300 hover:text-red-400 transition-colors rounded-lg
                         hover:bg-red-50">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5
                     4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Create Project Modal ─────────────────────────────────────────
function CreateProjectModal({ onClose }) {
  const { createProject } = useProjectStore()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Project name is required'); return }
    setLoading(true)
    setError('')
    try {
      const project = await createProject({ name: name.trim(), description })
      onClose()
      navigate(`/projects/${project.id}/designer`)
    } catch {
      setError('Failed to create project. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">

        <h2 className="text-lg font-bold text-gray-900 mb-1">New Project</h2>
        <p className="text-gray-400 text-sm mb-5">Give your schema project a name to get started</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Name */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Project Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="e.g. Hospital Management System"
            autoFocus
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Description */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What is this database for?"
            rows={3}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600
                       rounded-lg text-sm hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                       text-white font-medium py-2.5 px-4 rounded-lg text-sm
                       transition-colors flex items-center justify-center gap-2">
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Creating...
              </>
            ) : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  )
}