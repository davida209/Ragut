import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

type Card = { id: string; front: string; back: string; hint: string | null; card_index: number }
type FSet = { id: string; title: string; document_id: string; class_id: string; card_count: number }

export default function Flashcards() {
  const nav = useNavigate()
  const [classes, setClasses] = useState<any[]>([])
  const [docs, setDocs] = useState<any[]>([])
  const [sets, setSets] = useState<FSet[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [activeSet, setActiveSet] = useState<{ set: FSet; cards: Card[] } | null>(null)
  const [studyMode, setStudyMode] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [showGen, setShowGen] = useState(false)
  const [genForm, setGenForm] = useState({ document_id: '', class_id: '', n_cards: 15 })
  const [err, setErr] = useState('')
  const [reviewCounts, setReviewCounts] = useState<Record<string, string>>({})

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
      api.get(`/flashcards?class_id=${selectedClass}`),
      api.get(`/documents?class_id=${selectedClass}`)
    ]).then(([f, d]) => { setSets(f.data); setDocs(d.data.filter((x: any) => x.status === 'ready')) })
      .finally(() => setLoading(false))
  }, [selectedClass])

  async function openSet(s: FSet) {
    const { data } = await api.get(`/flashcards/${s.id}/cards`)
    setActiveSet(data); setCurrentIdx(0); setFlipped(false); setShowHint(false)
  }

  async function generate() {
    if (!genForm.document_id || !genForm.class_id) { setErr('Selecciona un documento'); return }
    setGenerating(true); setErr('')
    try {
      await api.post('/flashcards/generate', genForm)
      setShowGen(false)
      const { data } = await api.get(`/flashcards?class_id=${genForm.class_id}`)
      setSets(data)
    } catch (e: any) { setErr(e.response?.data?.detail || 'Error al generar') }
    setGenerating(false)
  }

  async function review(cardId: string, difficulty: string) {
    await api.post('/flashcards/review', { card_id: cardId, difficulty })
    setReviewCounts(p => ({ ...p, [cardId]: difficulty }))
    setTimeout(() => {
      if (activeSet && currentIdx < activeSet.cards.length - 1) {
        setCurrentIdx(i => i + 1); setFlipped(false); setShowHint(false)
      }
    }, 300)
  }

  async function deleteSet(id: string) {
    if (!confirm('¿Eliminar este set?')) return
    await api.delete(`/flashcards/${id}`)
    setSets(p => p.filter(s => s.id !== id))
    if (activeSet?.set.id === id) setActiveSet(null)
  }

  const diffColors: any = {
    again: { bg: 'var(--rose-bg)', color: 'var(--rose)', border: 'rgba(251,113,133,.25)', label: 'Otra vez' },
    hard:  { bg: 'rgba(251,146,60,.1)', color: '#FB923C', border: 'rgba(251,146,60,.25)', label: 'Difícil' },
    good:  { bg: 'var(--teal-bg)', color: 'var(--teal)', border: 'rgba(45,212,191,.25)', label: 'Bien' },
    easy:  { bg: 'var(--green-bg)', color: 'var(--green)', border: 'rgba(74,222,128,.25)', label: 'Fácil' },
  }

  if (studyMode && activeSet) {
    const card = activeSet.cards[currentIdx]
    const progress = ((currentIdx + 1) / activeSet.cards.length) * 100
    const reviewed = Object.keys(reviewCounts).length
    return (
      <div className="page fade-up" style={{ maxWidth: 680 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setStudyMode(false); setReviewCounts({}) }}>
            <i className="ti ti-arrow-left" />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{activeSet.set.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Tarjeta {currentIdx + 1} de {activeSet.cards.length}</div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)' }}>{reviewed} revisadas</div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 4, background: 'var(--bg4)', borderRadius: 2, marginBottom: 24, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: 'var(--brand)', width: `${progress}%`, transition: 'width .3s ease', borderRadius: 2 }} />
        </div>

        {/* Card */}
        <div onClick={() => setFlipped(f => !f)}
          style={{
            background: flipped ? 'var(--brand-bg2)' : 'var(--bg2)',
            border: `1px solid ${flipped ? 'rgba(232,168,56,.3)' : 'var(--border)'}`,
            borderRadius: 20, padding: '48px 36px', minHeight: 280,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all .25s', textAlign: 'center',
            boxShadow: flipped ? '0 12px 40px rgba(232,168,56,.1)' : '0 4px 20px rgba(0,0,0,.2)'
          }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: flipped ? 'var(--brand)' : 'var(--text3)', marginBottom: 20 }}>
            {flipped ? 'Respuesta' : 'Pregunta'} · Clic para {flipped ? 'ocultar' : 'revelar'}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--text)', lineHeight: 1.5, maxWidth: 480 }}>
            {flipped ? card.back : card.front}
          </div>
          {!flipped && card.hint && (
            <div style={{ marginTop: 20 }}>
              {showHint ? (
                <div style={{ fontSize: 13, color: 'var(--teal)', background: 'var(--teal-bg)', padding: '8px 16px', borderRadius: 8 }}>
                  Pista: {card.hint}
                </div>
              ) : (
                <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setShowHint(true) }}>
                  <i className="ti ti-bulb" /> Ver pista
                </button>
              )}
            </div>
          )}
        </div>

        {/* Review buttons */}
        {flipped && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 20 }}>
            {Object.entries(diffColors).map(([key, s]: any) => (
              <button key={key} onClick={() => review(card.id, key)}
                style={{ padding: '12px 8px', borderRadius: 12, border: `1px solid ${s.border}`, background: s.bg, color: s.color, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, transition: 'all .15s' }}
                onMouseOver={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseOut={e => (e.currentTarget.style.transform = '')}>
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Card navigator */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center', marginTop: 24 }}>
          {activeSet.cards.map((_, i) => {
            const rev = reviewCounts[activeSet.cards[i].id]
            const dc = rev ? diffColors[rev] : null
            return (
              <div key={i} onClick={() => { setCurrentIdx(i); setFlipped(false); setShowHint(false) }}
                style={{ width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, cursor: 'pointer', background: dc ? dc.bg : 'var(--bg3)', border: `1px solid ${dc ? dc.border : 'var(--border)'}`, color: dc ? dc.color : 'var(--text3)', outline: currentIdx === i ? '2px solid var(--brand)' : 'none', outlineOffset: 2 }}>
                {i + 1}
              </div>
            )
          })}
        </div>

        {reviewed === activeSet.cards.length && (
          <div style={{ marginTop: 24, padding: 20, background: 'var(--green-bg)', border: '1px solid rgba(74,222,128,.25)', borderRadius: 14, textAlign: 'center' }}>
            <i className="ti ti-trophy" style={{ fontSize: 28, color: 'var(--green)', display: 'block', marginBottom: 8 }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>¡Set completado!</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>Revisaste {reviewed} tarjetas</div>
            <button className="btn btn-primary btn-sm" onClick={() => { setCurrentIdx(0); setFlipped(false); setReviewCounts({}) }}>
              <i className="ti ti-refresh" /> Repetir set
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="page fade-up">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div className="page-title">Flashcards</div>
          <div className="page-sub" style={{ marginBottom: 0 }}>Repasa tus documentos con tarjetas generadas a partir de tus documentos</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowGen(true); setErr('') }}>
          <i className="ti ti-wand" /> Generar flashcards
        </button>
      </div>

      {/* Class selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {classes.map((c: any) => (
          <button key={c.id} onClick={() => setSelectedClass(c.id)}
            className={selectedClass === c.id ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}>
            {c.name}
          </button>
        ))}
      </div>

      {loading ? <div className="loading"><div className="spinner" /></div> :
       sets.length === 0 ? (
         <div className="empty">
           <i className="ti ti-cards" />
           <p>No hay flashcards para esta clase</p>
           <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowGen(true)}>
             <i className="ti ti-wand" /> Generar el primero
           </button>
         </div>
       ) : (
         <div className="grid-3">
           {sets.map((s: FSet) => (
             <div key={s.id} className="card" style={{ cursor: 'pointer', transition: 'transform .15s' }}
               onMouseOver={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'}
               onMouseOut={e => (e.currentTarget as HTMLElement).style.transform = ''}>
               <div style={{ height: 3, background: 'var(--violet)' }} />
               <div className="card-body">
                 <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                   <div style={{ width: 36, height: 36, background: 'var(--violet-bg)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                     <i className="ti ti-cards" style={{ fontSize: 18, color: 'var(--violet)' }} />
                   </div>
                   <button onClick={() => deleteSet(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}
                     onMouseOver={e => (e.currentTarget.style.color = 'var(--rose)')}
                     onMouseOut={e => (e.currentTarget.style.color = 'var(--text3)')}>
                     <i className="ti ti-trash" style={{ fontSize: 14 }} />
                   </button>
                 </div>
                 <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4, letterSpacing: '-.02em' }}>{s.title}</div>
                 <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>{s.card_count} tarjetas</div>
                 <div style={{ display: 'flex', gap: 6 }}>
                   <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }}
                     onClick={() => { openSet(s).then(() => setStudyMode(true)) }}>
                     <i className="ti ti-player-play" /> Estudiar
                   </button>
                   <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }}
                     onClick={() => openSet(s)}>
                     <i className="ti ti-eye" /> Ver
                   </button>
                 </div>
               </div>
             </div>
           ))}
         </div>
       )
      }

      {/* Preview panel */}
      {activeSet && !studyMode && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-head">
            <span className="card-title">{activeSet.set.title}</span>
            <button className="btn btn-primary btn-sm" onClick={() => { setStudyMode(true); setCurrentIdx(0); setFlipped(false) }}>
              <i className="ti ti-player-play" /> Estudiar
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, padding: 16 }}>
            {activeSet.cards.slice(0, 6).map((c, i) => (
              <div key={c.id} style={{ background: 'var(--bg3)', borderRadius: 10, padding: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>#{i + 1}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{c.front}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', borderTop: '1px solid var(--border)', paddingTop: 6 }}>{c.back.slice(0, 80)}{c.back.length > 80 ? '...' : ''}</div>
              </div>
            ))}
          </div>
          {activeSet.cards.length > 6 && (
            <div style={{ padding: '0 16px 16px', fontSize: 12, color: 'var(--text3)' }}>+{activeSet.cards.length - 6} tarjetas más</div>
          )}
        </div>
      )}

      {/* Generate modal */}
      {showGen && (
        <div className="modal-overlay" onClick={() => setShowGen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <span className="modal-title"><i className="ti ti-wand" style={{ color: 'var(--brand)', marginRight: 8 }} />Generar Flashcards</span>
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
              <div className="form-group">
                <label className="form-label">Cantidad de tarjetas</label>
                <select className="form-input form-select" value={genForm.n_cards} onChange={e => setGenForm({ ...genForm, n_cards: parseInt(e.target.value) })}>
                  {[10, 15, 20, 25, 30].map(n => <option key={n} value={n}>{n} tarjetas</option>)}
                </select>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setShowGen(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={generate} disabled={generating}>
                {generating ? <><div className="spinner" style={{ width: 14, height: 14, borderTopColor: '#000' }} />Generando...</> : <><i className="ti ti-wand" />Generar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
