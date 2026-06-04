import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import api from '../api/client'

export default function AdminPanel() {
  const { user } = useAuthStore()
  const nav = useNavigate()
  const [stats, setStats] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [tab, setTab] = useState('users')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ email: '', full_name: '', password: '', role: 'student' })
  const [err, setErr] = useState('')
  const [success, setSuccess] = useState('')

  if (user?.role !== 'admin') { nav('/'); return null }

  async function load() {
    const [s, u, c] = await Promise.all([api.get('/admin/stats'), api.get('/admin/users'), api.get('/classes')])
    setStats(s.data); setUsers(u.data); setClasses(c.data); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function createUser() {
    setErr('')
    if (!form.email || !form.full_name || !form.password) { setErr('Completa todos los campos'); return }
    try {
      await api.post('/admin/users', form)
      setSuccess('Usuario creado correctamente')
      setShowCreate(false); setForm({ email: '', full_name: '', password: '', role: 'student' }); load()
    } catch (e: any) { setErr(e.response?.data?.detail || 'Error') }
  }

  async function toggleActive(id: string, current: boolean) {
    await api.put(`/admin/users/${id}`, { is_active: !current }); load()
  }

  async function changeRole(id: string, role: string) {
    await api.put(`/admin/users/${id}`, { role }); load()
  }

  const roleLabel: any = { admin: 'Admin', professor: 'Profesor', student: 'Alumno' }
  const roleBadge: any = { admin: 'badge-rose', professor: 'badge-brand', student: 'badge-teal' }

  return (
    <div className="page fade-up">
      <div className="page-title">Panel de administración</div>
      <div className="page-sub">Control total de la institución RagUT</div>

      {stats && (
        <div className="metrics" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: 28 }}>
          <div className="metric-card"><div className="metric-label">Total usuarios</div><div className="metric-val">{stats.total_users}</div></div>
          <div className="metric-card"><div className="metric-label">Profesores</div><div className="metric-val">{stats.professors}</div></div>
          <div className="metric-card"><div className="metric-label">Alumnos</div><div className="metric-val">{stats.students}</div></div>
          <div className="metric-card"><div className="metric-label">Clases activas</div><div className="metric-val">{stats.active_classes}</div></div>
          <div className="metric-card"><div className="metric-label">Solicitudes</div><div className="metric-val" style={{ color: stats.pending_enrollments > 0 ? 'var(--brand)' : 'var(--text)' }}>{stats.pending_enrollments}</div></div>
        </div>
      )}

      {success && <div className="alert alert-success" style={{ marginBottom: 16 }}><i className="ti ti-circle-check" />{success}</div>}

      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {['users', 'classes'].map(t => (
          <div key={t} onClick={() => setTab(t)}
            style={{ padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: tab === t ? 'var(--brand)' : 'var(--text3)', borderBottom: tab === t ? '2px solid var(--brand)' : '2px solid transparent', marginBottom: -1, transition: 'color .15s' }}>
            {t === 'users' ? `Usuarios (${users.length})` : `Clases (${classes.length})`}
          </div>
        ))}
      </div>

      {tab === 'users' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => { setShowCreate(true); setErr('') }}><i className="ti ti-plus" /> Crear usuario</button>
          </div>
          {loading ? <div className="loading"><div className="spinner" /></div> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody>
                  {users.map((u: any) => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text)' }}>{u.full_name}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text3)' }}>{u.email}</td>
                      <td>
                        <select value={u.role} onChange={e => changeRole(u.id, e.target.value)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: 'var(--text2)', padding: 0 }}>
                          <option value="student">Alumno</option>
                          <option value="professor">Profesor</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td><span className={`badge ${u.is_active ? 'badge-green' : 'badge-muted'}`}>{u.is_active ? 'Activo' : 'Inactivo'}</span></td>
                      <td>
                        <button className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-ghost'}`} onClick={() => toggleActive(u.id, u.is_active)}>
                          {u.is_active ? 'Desactivar' : 'Activar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'classes' && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Clase</th><th>Profesor</th><th>Código</th><th>Alumnos</th><th>Estado</th></tr></thead>
            <tbody>
              {classes.map((c: any) => (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/classes/${c.id}`)}>
                  <td style={{ fontWeight: 600, color: 'var(--text)' }}>{c.name}</td>
                  <td>{c.professor_name}</td>
                  <td><code style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--brand)', fontSize: 12, background: 'var(--brand-bg)', padding: '2px 8px', borderRadius: 5 }}>{c.access_code}</code></td>
                  <td>{c.enrollment_count}</td>
                  <td><span className={`badge ${c.is_active ? 'badge-green' : 'badge-muted'}`}>{c.is_active ? 'Activa' : 'Inactiva'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <span className="modal-title">Crear usuario</span>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 18 }} onClick={() => setShowCreate(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              {err && <div className="alert alert-error"><i className="ti ti-alert-circle" />{err}</div>}
              <div className="form-group"><label className="form-label">Nombre completo</label><input className="form-input" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Contraseña</label><input className="form-input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
              <div className="form-group">
                <label className="form-label">Rol</label>
                <select className="form-input form-select" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="student">Alumno</option>
                  <option value="professor">Profesor</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={createUser}>Crear usuario</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
