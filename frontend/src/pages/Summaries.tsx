import { useEffect, useState } from 'react'
import api from '../api/client'

export default function Summaries() {
  const [classes, setClasses] = useState<any[]>([])
  const [docs, setDocs] = useState<any[]>([])
  const [summaries, setSummaries] = useState<any[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [activeSummary, setActiveSummary] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [showGen, setShowGen] = useState(false)
  const [genForm, setGenForm] = useState({ document_id: '', class_id: '' })
  const [err, setErr] = useState('')

  useEffect(() => {
    api.get('/classes').then(({ data }) => {
      setClasses(data)
      if (data.length > 0) setSelectedClass(data[0].id)
    })
  }, [])

  useEffect(() => {
    if (!selectedClass) return
    setLoading(true)
    Promise.all([
      api.get(`/summaries?class_id=${selectedClass}`),
      api.get(`/documents?class_id=${selectedClass}`)
    ]).then(([s, d]) => { setSummaries(s.data); setDocs(d.data.filter((x: any) => x.status === 'ready')) })
      .finally(() => setLoading(false))
  }, [selectedClass])

  async function openSummary(s: any) {
    const { data } = await api.get(`/summaries/${s.id}`)
    setActiveSummary(data)
  }

  async function generate() {
    if (!genForm.document_id || !genForm.class_id) { setErr('Selecciona un documento'); return }
    setGenerating(true); setErr('')
    try {
      const { data } = await api.post('/summaries/generate', genForm)
      setShowGen(false)
      const { data: list } = await api.get(`/summaries?class_id=${genForm.class_id}`)
      setSummaries(list)
      setActiveSummary(data)
    } catch (e: any) { setErr(e.response?.data?.detail || 'Error al generar') }
    setGenerating(false)
  }

  async function deleteSummary(id: string) {
    if (!confirm('¿Eliminar este resumen?')) return
    await api.delete(`/summaries/${id}`)
    setSummaries(p => p.filter(s => s.id !== id))
    if (activeSummary?.id === id) setActiveSummary(null)
  }

  // Simple markdown-to-html renderer
  function renderMarkdown(text: string) {
    return text
      .replace(/^### (.+)$/gm, '<h3 style="font-size:14px;font-weight:700;color:var(--brand2);margin:18px 0 8px;letter-spacing:-.01em">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 style="font-size:16px;font-weight:700;color:var(--text);margin:22px 0 10px;letter-spacing:-.02em">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 style="font-size:18px;font-weight:700;color:var(--text);margin:24px 0 12px;letter-spacing:-.03em">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text);font-weight:600">$1</strong>')
      .replace(/^- (.+)$/gm, '<li style="color:var(--text2);margin:4px 0;padding-left:4px">$1</li>')
      .replace(/\n\n/g, '<br/><br/>')
  }

  return (
    <div className="page fade-up">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div className="page-title">Resúmenes</div>
          <div className="page-sub" style={{ marginBottom: 0 }}>Resúmenes automáticos con conceptos clave extraídos por IA</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowGen(true); setErr('') }}>
          <i className="ti ti-sparkles" /> Generar resumen
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {classes.map((c: any) => (
          <button key={c.id} onClick={() => setSelectedClass(c.id)}
            className={selectedClass === c.id ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}>
            {c.name}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: activeSummary ? '280px 1fr' : '1fr', gap: 20 }}>
        {/* List */}
        <div>
          {loading ? <div className="loading"><div className="spinner" /></div> :
           summaries.length === 0 ? (
             <div className="empty">
               <i className="ti ti-file-description" />
               <p>No hay resúmenes para esta clase</p>
               <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowGen(true)}>
                 <i className="ti ti-sparkles" /> Generar el primero
               </button>
             </div>
           ) : (
             <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
               {summaries.map((s: any) => (
                 <div key={s.id} className="card" style={{ cursor: 'pointer', transition: 'border-color .15s', borderColor: activeSummary?.id === s.id ? 'var(--brand)' : '' }}
                   onClick={() => openSummary(s)}>
                   <div className="card-body">
                     <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                       <div style={{ flex: 1, minWidth: 0 }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                           <div style={{ width: 28, height: 28, background: 'var(--teal-bg)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                             <i className="ti ti-file-description" style={{ fontSize: 14, color: 'var(--teal)' }} />
                           </div>
                           <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                         </div>
                         <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                           {s.key_concepts?.length || 0} conceptos clave · {new Date(s.created_at).toLocaleDateString('es')}
                         </div>
                       </div>
                       <button onClick={e => { e.stopPropagation(); deleteSummary(s.id) }}
                         style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4, flexShrink: 0 }}
                         onMouseOver={e => (e.currentTarget.style.color = 'var(--rose)')}
                         onMouseOut={e => (e.currentTarget.style.color = 'var(--text3)')}>
                         <i className="ti ti-trash" style={{ fontSize: 14 }} />
                       </button>
                     </div>
                   </div>
                 </div>
               ))}
             </div>
           )
          }
        </div>

        {/* Detail */}
        {activeSummary && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Key concepts */}
            {activeSummary.key_concepts?.length > 0 && (
              <div className="card">
                <div className="card-head">
                  <span className="card-title"><i className="ti ti-key" style={{ marginRight: 8, color: 'var(--brand)' }} />Conceptos clave</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{activeSummary.key_concepts.length} términos</span>
                </div>
                <div style={{ display: 'flex', flex: 1, flexWrap: 'wrap', gap: 10, padding: 16 }}>
                  {activeSummary.key_concepts.map((kc: any, i: number) => (
                    <div key={i} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', minWidth: 160, flex: '1 1 160px' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand2)', marginBottom: 4 }}>{kc.term}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>{kc.definition}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Content */}
            <div className="card">
              <div className="card-head">
                <span className="card-title">{activeSummary.title}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{new Date(activeSummary.created_at).toLocaleDateString('es')}</span>
              </div>
              <div className="card-body">
                <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.8 }}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(activeSummary.content) }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {showGen && (
        <div className="modal-overlay" onClick={() => setShowGen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <span className="modal-title"><i className="ti ti-sparkles" style={{ color: 'var(--brand)', marginRight: 8 }} />Generar Resumen</span>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 18 }} onClick={() => setShowGen(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              {err && <div className="alert alert-error"><i className="ti ti-alert-circle" />{err}</div>}
              <div className="form-group">
                <label className="form-label">Clase</label>
                <select className="form-input form-select" value={genForm.class_id}
                  onChange={e => { setGenForm({ ...genForm, class_id: e.target.value, document_id: '' }); setSelectedClass(e.target.value) }}>
                  <option value="">Selecciona una clase</option>
                  {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Documento</label>
                <select className="form-input form-select" value={genForm.document_id} onChange={e => setGenForm({ ...genForm, document_id: e.target.value })}>
                  <option value="">Selecciona un documento</option>
                  {docs.filter(d => !genForm.class_id || d.class_id === genForm.class_id).map((d: any) => (
                    <option key={d.id} value={d.id}>{d.filename}</option>
                  ))}
                </select>
              </div>
              <div className="alert alert-info" style={{ marginTop: 8 }}>
                <i className="ti ti-info-circle" />
                Si ya existe un resumen para este documento, se regenerará con el contenido actualizado.
              </div>
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
