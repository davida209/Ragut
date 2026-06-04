import axios from 'axios'
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000' })
api.interceptors.request.use(c => { const t = localStorage.getItem('access_token'); if (t) c.headers.Authorization = `Bearer ${t}`; return c })
api.interceptors.response.use(r => r, async err => {
  if (err.response?.status === 401) {
    const refresh = localStorage.getItem('refresh_token')
    if (refresh) {
      try {
        const { data } = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/auth/refresh`, { refresh_token: refresh })
        localStorage.setItem('access_token', data.access_token)
        err.config.headers.Authorization = `Bearer ${data.access_token}`
        return api.request(err.config)
      } catch { localStorage.clear(); window.location.href = '/login' }
    }
  }
  return Promise.reject(err)
})
export default api
