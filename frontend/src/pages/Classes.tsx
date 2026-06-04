import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import api from '../api/client'

const COLORS = ['var(--brand)', 'var(--teal)', 'var(--violet)', 'var(--rose)', 'var(--green)']

export default function Classes() {
  const { user } = useAuthStore()
  const nav = useNavigate()
  const [classes, setClasses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showEnroll, setShowEnroll] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', require_approval: false })
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    try { const { data } = await api.get('/classes'); setClasses(data) } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function createClass() {
    if (!form.name) { setErr('El nombre es obligatorio'); return }
    setSaving(true); setErr('')
    try { await api.post('/classes', form); setShowCreate(false); setForm({ name: '', description: '', require_approval: false }); load() }
    catch (e: any) { setErr(e.response?.data?.detail || 'Error al crear') }
    setSaving(false)
  }

  async function enroll() {
    setSaving(true); setErr('')
    try {
      const { data } = await api.post('/classes/enroll', { access_code: code.toUpperCase() })
      setMsg(data.status === 'pending' ? 'Solicitud enviada, espera aprobación' : `Te uniste a "${data.class_name}"`)
      setShowEnroll(false); setCode(''); load()
    } catch (e: any) { setErr(e.response?.data?.detail || 'Código no válido') }
    setSaving(false)
  }

  return (
    <div className="page fade-up">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div className="page-title">Clases</div>
          <div className="page-sub" style={{ marginBottom: 0 }}>
            {user?.role === 'professor' ? 'Gestiona tus clases y materiales' : 'Tus clases inscritas'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {user?.role === 'student' && (
            <button className="btn btn-secondary" onClick={() => { setShowEnroll(true); setErr('') }}>
              <i className="ti ti-key" /> Unirse con código
            </button>
          )}
          {(user?.role === 'professor' || user?.role === 'admin') && (
            <button className="btn btn-primary" onClick={() => { setShowCreate(true); setErr('') }}>
              <i className="ti ti-plus" /> Nueva clase
            </button>
          )}
        </div>
      </div>

      {msg && <div className="alert alert-success"><i className="ti ti-circle-check" />{msg}</div>}

      {loading ? <div className="loading"><div className="spinner" />Cargando...</div> :
       classes.length === 0 ? (
         <div className="empty">
           <i className="ti ti-school" />
           <p>No hay clases todavía</p>
           {user?.role === 'student' && <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowEnroll(true)}><i className="ti ti-key" /> Unirse con código</button>}
         </div>
       ) : (
         <div className="grid-3">
           {classes.map((c: any, i) => (
             <div key={c.id} className="card" style={{ cursor: 'pointer', transition: 'transform .15s, box-shadow .15s' }}
               onClick={() => nav(`/classes/${c.id}`)}
               onMouseOver={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(0,0,0,.3)' }}
               onMouseOut={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '' }}>
               <div style={{ height: 3, background: COLORS[i % COLORS.length] }} />
               <div className="card-body">
                 <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                   <div style={{ width: 36, height: 36, borderRadius: 10, background: `${COLORS[i % COLORS.length]}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                     <i className="ti ti-school" style={{ fontSize: 18, color: COLORS[i % COLORS.length] }} />
                   </div>
                   {(user?.role === 'professor' || user?.role === 'admin') && (
                     <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--brand)', background: 'var(--brand-bg)', padding: '3px 8px', borderRadius: 6 }}>{c.access_code}</code>
                   )}
                 </div>
                 <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4, letterSpacing: '-.02em' }}>{c.name}</div>
                 <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14, minHeight: 18 }}>{c.description || 'Sin descripción'}</div>
                 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                   <div style={{ fontSize: 11, color: 'var(--text3)' }}>{c.enrollment_count} alumno{c.enrollment_count !== 1 ? 's' : ''}</div>
                   {c.professor_name && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{c.professor_name}</div>}
                 </div>
                 <div style={{ display: 'flex', gap: 6 }}>
                   <button className="btn btn-sm btn-secondary" style={{ flex: 1, justifyContent: 'center' }}
                     onClick={e => { e.stopPropagation(); nav(`/classes/${c.id}/chat`) }}>
                     <i className="ti ti-messages" /> Chat
                   </button>
                   <button className="btn btn-sm btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>
                     <i className="ti ti-files" /> Docs
                   </button>
                 </div>
               </div>
             </div>
           ))}
           {user?.role === 'student' && (
             <div className="card" style={{ cursor: 'pointer', border: '1px dashed var(--border2)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}
               onClick={() => { setShowEnroll(true); setErr('') }}
               onMouseOver={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--brand)'}
               onMouseOut={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)'}>
               <div style={{ textAlign: 'center', color: 'var(--text3)' }}>
                 <i className="ti ti-plus" style={{ fontSize: 24, display: 'block', marginBottom: 8 }} />
                 <div style={{ fontSize: 13, fontWeight: 600 }}>Unirse a clase</div>
               </div>
             </div>
           )}
         </div>
       )
      }

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <span className="modal-title">Nueva clase</span>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 18 }} onClick={() => setShowCreate(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              {err && <div className="alert alert-error"><i className="ti ti-alert-circle" />{err}</div>}
              <div className="form-group"><label className="form-label">Nombre *</label><input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej: Historia A10" /></div>
              <div className="form-group"><label className="form-label">Descripción</label><textarea className="form-input form-textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descripción breve..." /></div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.require_approval} onChange={e => setForm({ ...form, require_approval: e.target.checked })} />
                Requerir aprobación para inscribirse
              </label>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={createClass} disabled={saving}>{saving ? 'Creando...' : 'Crear clase'}</button>
            </div>
          </div>
        </div>
      )}

      {showEnroll && (
        <div className="modal-overlay" onClick={() => setShowEnroll(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <span className="modal-title">Unirse a clase</span>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 18 }} onClick={() => setShowEnroll(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              {err && <div className="alert alert-error"><i className="ti ti-alert-circle" />{err}</div>}
              <div className="form-group">
                <label className="form-label">Código de acceso</label>
                <input className="form-input" value={code} onChange={e => setCode(e.target.value.toUpperCase())}
                  placeholder="Ej: ABC123"
                  style={{ fontFamily: 'var(--font-mono)', letterSpacing: '.12em', fontSize: 16, textAlign: 'center' }} />
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setShowEnroll(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={enroll} disabled={saving || !code}>{saving ? 'Uniéndose...' : 'Unirse'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
