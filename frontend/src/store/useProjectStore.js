import { create } from 'zustand'
import { projectService } from '../services/project.service'

const useProjectStore = create((set) => ({
  projects: [],
  loading: false,
  error: null,

  fetchProjects: async () => {
    set({ loading: true, error: null })
    try {
      const res = await projectService.getAll()
      set({ projects: res.data, loading: false })
    } catch {
      set({ error: 'Failed to load projects', loading: false })
    }
  },

  createProject: async (data) => {
    const res = await projectService.create(data)
    set((state) => ({
      projects: [res.data, ...state.projects],
    }))
    return res.data
  },

  deleteProject: async (id) => {
    await projectService.delete(id)
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
    }))
  },
}))

export default useProjectStore