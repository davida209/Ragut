import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { useAuthStore } from '../store/auth'
import api from '../api/client'

export default function ClassDetail() {
  const { classId } = useParams()
  const { user } = useAuthStore()
  const nav = useNavigate()
  const [cls, setCls] = useState<any>(null)
  const [docs, setDocs] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [tab, setTab] = useState('docs')
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [addEmail, setAddEmail] = useState('')
  const [err, setErr] = useState('')

  async function load() {
    try {
      const [c, d] = await Promise.all([api.get(`/classes/${classId}`), api.get(`/documents?class_id=${classId}`)])
      setCls(c.data); setDocs(d.data)
      if (user?.role !== 'student') {
        const m = await api.get(`/classes/${classId}/members`)
        setMembers(m.data)
      }
    } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [classId])

  const onDrop = useCallback(async (files: File[]) => {
    setUploading(true)
    for (const file of files) {
      const fd = new FormData()
      fd.append('file', file); fd.append('class_id', classId!)
      fd.append('visibility', user?.role === 'student' ? 'private' : 'class_wide')
      try { await api.post('/documents/upload', fd) } catch {}
    }
    setUploading(false); load()
  }, [classId])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'application/pdf': ['.pdf'] } })

  async function deleteDoc(id: string) {
    if (!confirm('¿Eliminar este documento?')) return
    await api.delete(`/documents/${id}`); load()
  }

  async function addMember() {
    try { await api.post(`/classes/${classId}/members`, { email: addEmail }); setAddEmail(''); setErr(''); load() }
    catch (e: any) { setErr(e.response?.data?.detail || 'Error') }
  }

  async function reviewEnrollment(eid: string, action: string) {
    await api.put(`/classes/${classId}/members/${eid}`, { action }); load()
  }

  if (loading) return <div className="loading" style={{ height: '100vh' }}><div className="spinner" />Cargando...</div>
  if (!cls) return <div className="page"><div className="alert alert-error"><i className="ti ti-alert-circle" />Clase no encontrada</div></div>

  const canManage = user?.role === 'professor' || user?.role === 'admin'
  const pending = members.filter(m => m.status === 'pending').length

  return (
    <div className="page fade-up">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }} onClick={() => nav('/classes')}>
            <i className="ti ti-arrow-left" /> Clases
          </div>
          <div className="page-title" style={{ marginBottom: 2 }}>{cls.name}</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>{cls.description || 'Sin descripción'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {canManage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--brand-bg)', border: '1px solid rgba(232,168,56,.2)', borderRadius: 10, padding: '8px 14px' }}>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>Código</span>
              <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 15, color: 'var(--brand)', letterSpacing: '.1em' }}>{cls.access_code}</code>
            </div>
          )}
          <button className="btn btn-primary" onClick={() => nav(`/classes/${classId}/chat`)}>
            <i className="ti ti-messages" /> Abrir chat
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {(['docs', canManage ? 'members' : null] as (string|null)[]).filter(Boolean).map(t => (
          <div key={t!} onClick={() => setTab(t!)}
            style={{ padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: tab === t ? 'var(--brand)' : 'var(--text3)', borderBottom: tab === t ? '2px solid var(--brand)' : '2px solid transparent', marginBottom: -1, transition: 'color .15s' }}>
            {t === 'docs' ? 'Documentos' : `Alumnos${pending > 0 ? ` (${pending} pendientes)` : ''}`}
          </div>
        ))}
      </div>

      {tab === 'docs' && (
        <div>
          <div {...getRootProps()} className={`upload-zone${isDragActive ? ' dragover' : ''}`} style={{ marginBottom: 20 }}>
            <input {...getInputProps()} />
            <i className="ti ti-cloud-upload" />
            {uploading ? 'Procesando...' : isDragActive ? 'Suelta aquí' : 'Arrastra un PDF o haz clic para subir'}
            <div style={{ fontSize: 11, marginTop: 6, opacity: .6 }}>Solo archivos PDF · Se procesarán automáticamente</div>
          </div>

          {docs.length === 0 ? <div className="empty"><i className="ti ti-file-x" /><p>No hay documentos aún</p></div> : (
            <div className="grid-3">
              {docs.map((d: any) => (
                <div key={d.id} className="card" style={{ position: 'relative' }}>
                  <div className="card-body">
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 40, height: 40, background: 'var(--rose-bg)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <i className="ti ti-file-type-pdf" style={{ fontSize: 20, color: 'var(--rose)' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.filename}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                          {d.page_count > 0 ? `${d.page_count} págs` : ''}{d.chunk_count > 0 ? ` · ${d.chunk_count} chunks` : ''}
                        </div>
                        <span className={`badge ${d.status === 'ready' ? 'badge-green' : d.status === 'error' ? 'badge-rose' : 'badge-brand'}`} style={{ marginTop: 8 }}>
                          {d.status === 'ready' ? 'Listo' : d.status === 'error' ? 'Error' : 'Procesando...'}
                        </span>
                      </div>
                      {(d.uploaded_by === user?.id || canManage) && (
                        <button onClick={() => deleteDoc(d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4, borderRadius: 6, flexShrink: 0 }}
                          onMouseOver={e => (e.currentTarget.style.color = 'var(--rose)')}
                          onMouseOut={e => (e.currentTarget.style.color = 'var(--text3)')}>
                          <i className="ti ti-trash" style={{ fontSize: 15 }} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'members' && canManage && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            <input className="form-input" style={{ flex: 1 }} value={addEmail} onChange={e => setAddEmail(e.target.value)} placeholder="Email del alumno para agregar manualmente" />
            <button className="btn btn-primary" onClick={addMember}><i className="ti ti-user-plus" /> Agregar</button>
          </div>
          {err && <div className="alert alert-error" style={{ marginBottom: 12 }}><i className="ti ti-alert-circle" />{err}</div>}
          <div className="table-wrap">
            <table>
              <thead><tr><th>Alumno</th><th>Email</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>
                {members.map((m: any) => (
                  <tr key={m.enrollment_id}>
                    <td style={{ fontWeight: 600, color: 'var(--text)' }}>{m.student_name}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{m.student_email}</td>
                    <td>
                      <span className={`badge ${m.status === 'active' ? 'badge-green' : m.status === 'pending' ? 'badge-brand' : 'badge-rose'}`}>
                        {m.status === 'active' ? 'Activo' : m.status === 'pending' ? 'Pendiente' : 'Rechazado'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {m.status === 'pending' && <>
                          <button className="btn btn-sm" style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid rgba(74,222,128,.25)' }} onClick={() => reviewEnrollment(m.enrollment_id, 'approve')}>Aprobar</button>
                          <button className="btn btn-sm btn-danger" onClick={() => reviewEnrollment(m.enrollment_id, 'reject')}>Rechazar</button>
                        </>}
                        {m.status === 'active' && <button className="btn btn-sm btn-ghost" onClick={() => { if(confirm('¿Remover alumno?')) api.delete(`/classes/${classId}/members/${m.student_id}`).then(load) }}>Remover</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
