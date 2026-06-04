import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'

export default function Shell() {
  const { user, logout } = useAuthStore()
  const nav = useNavigate()
  const ini = user?.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U'
  const avCls = user?.role === 'admin' ? 'av-admin' : user?.role === 'professor' ? 'av-prof' : 'av-student'
  const roleLabel = user?.role === 'admin' ? 'Administrador' : user?.role === 'professor' ? 'Profesor' : 'Estudiante'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sb-logo">
          <div className="sb-logomark"><i className="ti ti-brain" /></div>
          <span className="sb-logotype">Rag<span>UT</span></span>
        </div>

        <div className="sb-section">Principal</div>
        <NavLink to="/" end className={({ isActive }) => `sb-item${isActive ? ' active' : ''}`}>
          <i className="ti ti-layout-dashboard" /> Dashboard
        </NavLink>
        <NavLink to="/classes" className={({ isActive }) => `sb-item${isActive ? ' active' : ''}`}>
          <i className="ti ti-school" /> Clases
        </NavLink>

        <div className="sb-section">Estudio</div>
        <NavLink to="/exams" className={({ isActive }) => `sb-item${isActive ? ' active' : ''}`}>
          <i className="ti ti-clipboard-check" /> Exámenes
        </NavLink>
        <NavLink to="/flashcards" className={({ isActive }) => `sb-item${isActive ? ' active' : ''}`}>
          <i className="ti ti-cards" /> Flashcards
        </NavLink>
        <NavLink to="/summaries" className={({ isActive }) => `sb-item${isActive ? ' active' : ''}`}>
          <i className="ti ti-file-description" /> Resúmenes
        </NavLink>

        {user?.role === 'admin' && (
          <>
            <div className="sb-section">Administración</div>
            <NavLink to="/admin" className={({ isActive }) => `sb-item${isActive ? ' active' : ''}`}>
              <i className="ti ti-shield-check" /> Panel Admin
            </NavLink>
          </>
        )}

        <div style={{ flex: 1 }} />

        <div className="sb-user">
          <div className={`sb-av ${avCls}`}>{ini}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.full_name}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{roleLabel}</div>
          </div>
          <button onClick={() => { logout(); nav('/login') }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4, borderRadius: 6, transition: 'color .15s' }}
            onMouseOver={e => (e.currentTarget.style.color = 'var(--rose)')}
            onMouseOut={e => (e.currentTarget.style.color = 'var(--text3)')}>
            <i className="ti ti-logout" style={{ fontSize: 17 }} />
          </button>
        </div>
      </aside>
      <main className="main-area"><Outlet /></main>
    </div>
  )
}
