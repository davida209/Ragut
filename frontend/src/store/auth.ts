import { create } from 'zustand'
import api from '../api/client'
interface User { id: string; email: string; full_name: string; role: 'admin'|'professor'|'student'; is_active: boolean }
interface S { user: User|null; loading: boolean; login:(e:string,p:string)=>Promise<void>; logout:()=>void; fetchMe:()=>Promise<void> }
export const useAuthStore = create<S>(set => ({
  user: null, loading: true,
  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    set({ user: data.user })
  },
  logout: () => { localStorage.clear(); set({ user: null }) },
  fetchMe: async () => {
    const token = localStorage.getItem('access_token')
    if (!token) { set({ loading: false }); return }
    try { const { data } = await api.get('/auth/me'); set({ user: data, loading: false }) }
    catch { localStorage.clear(); set({ user: null, loading: false }) }
  }
}))
