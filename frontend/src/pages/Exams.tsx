import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import api from '../api/client'

export default function Exams() {
  const { user } = useAuthStore()
  const nav = useNavigate()
  const location = useLocation()
  const [classes, setClasses] = useState<any[]>([])
  const [exams, setExams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showGen, setShowGen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [err, setErr] = useState('')
  const [form, setForm] = useState({ class_id: '', title: '', exam_type: 'practice', n_questions: 10, visibility: 'private', topic: '' })

  useEffect(() => {
    async function load() {
      const { data: cls } = await api.get('/classes')
      setClasses(cls)
      const all: any[] = []
      for (const c of cls) {
        try { const { data } = await api.get(`/exams?class_id=${c.id}`); all.push(...data.map((e: any) => ({ ...e, class_name: c.name }))) } catch {}
      }
      setExams(all); setLoading(false)
      if (location.state?.classId) { setForm(f => ({ ...f, class_id: location.state.classId })); setShowGen(true) }
    }
    load()
  }, [])

  async function generate() {
    if (!form.class_id || !form.title) { setErr('Completa clase y título'); return }
    setGenerating(true); setErr('')
    try { const { data } = await api.post('/exams/generate', form); nav(`/exams/${data.id}`) }
    catch (e: any) { setErr(e.response?.data?.detail || 'Error generando examen') }
    setGenerating(false)
  }

  const typeStyle: any = {
    official: { color: 'var(--brand)', bar: 'var(--brand)', badge: 'badge-brand', label: 'Oficial' },
    practice: { color: 'var(--violet)', bar: 'var(--violet)', badge: 'badge-violet', label: 'Práctica' },
    review:   { color: 'var(--teal)',   bar: 'var(--teal)',   badge: 'badge-teal',   label: 'Repaso' }
  }

  return (
    <div className="page fade-up">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div className="page-title">Exámenes</div>
          <div className="page-sub" style={{ marginBottom: 0 }}>Oficiales, prácticas personales y repasos generados con IA</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowGen(true); setErr('') }}>
          <i className="ti ti-sparkles" /> Generar con IA
        </button>
      </div>

      {loading ? <div className="loading"><div className="spinner" />Cargando...</div> :
       exams.length === 0 ? (
         <div className="empty">
           <i className="ti ti-clipboard-x" />
           <p>No hay exámenes todavía</p>
           <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowGen(true)}>
             <i className="ti ti-sparkles" /> Generar el primero
           </button>
         </div>
       ) : (
         <div className="grid-3">
           {exams.map((e: any) => {
             const ts = typeStyle[e.exam_type] || typeStyle.practice
             return (
               <div key={e.id} className="card" style={{ cursor: 'pointer', transition: 'transform .15s, box-shadow .15s' }}
                 onClick={() => nav(`/exams/${e.id}`)}
                 onMouseOver={el => { (el.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (el.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(0,0,0,.3)' }}
                 onMouseOut={el => { (el.currentTarget as HTMLElement).style.transform = ''; (el.currentTarget as HTMLElement).style.boxShadow = '' }}>
                 <div style={{ height: 3, background: ts.bar }} />
                 <div className="card-body">
                   <span className={`badge ${ts.badge}`} style={{ marginBottom: 10 }}>{ts.label}</span>
                   <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4, letterSpacing: '-.02em' }}>{e.title}</div>
                   <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 14 }}>{e.class_name}</div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
                     <span>{e.question_count} preg.</span>
                     {e.due_date && <span style={{ color: 'var(--brand)' }}>Vence {new Date(e.due_date).toLocaleDateString('es')}</span>}
                   </div>
                   <button className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
                     <i className="ti ti-player-play" /> Comenzar
                   </button>
                 </div>
               </div>
             )
           })}
         </div>
       )
      }

      {showGen && (
        <div className="modal-overlay" onClick={() => setShowGen(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <span className="modal-title"><i className="ti ti-sparkles" style={{ color: 'var(--brand)', marginRight: 8 }} />Generar examen con IA</span>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 18 }} onClick={() => setShowGen(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              {err && <div className="alert alert-error"><i className="ti ti-alert-circle" />{err}</div>}
              <div className="form-group">
                <label className="form-label">Clase *</label>
                <select className="form-input form-select" value={form.class_id} onChange={e => setForm({ ...form, class_id: e.target.value })}>
                  <option value="">Selecciona una clase</option>
                  {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Título *</label>
                <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ej: Repaso unidad 3" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Tipo</label>
                  <select className="form-input form-select" value={form.exam_type} onChange={e => setForm({ ...form, exam_type: e.target.value })}>
                    {user?.role !== 'student' && <option value="official">Oficial (toda la clase)</option>}
                    <option value="practice">Práctica personal</option>
                    <option value="review">Repaso inteligente</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Preguntas</label>
                  <select className="form-input form-select" value={form.n_questions} onChange={e => setForm({ ...form, n_questions: parseInt(e.target.value) })}>
                    {[5, 10, 15, 20].map(n => <option key={n} value={n}>{n} preguntas</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Tema específico (opcional)</label>
                <input className="form-input" value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} placeholder="Ej: causas de la Revolución Francesa" />
              </div>
              {user?.role !== 'student' && (
                <div className="form-group">
                  <label className="form-label">Visibilidad</label>
                  <select className="form-input form-select" value={form.visibility} onChange={e => setForm({ ...form, visibility: e.target.value })}>
                    <option value="private">Privado (solo yo)</option>
                    <option value="public">Público (toda la clase)</option>
                  </select>
                </div>
              )}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setShowGen(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={generate} disabled={generating}>
                {generating ? <><div className="spinner" style={{ width: 14, height: 14, borderTopColor: '#000' }} />Generando...</> : <><i className="ti ti-sparkles" />Generar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
