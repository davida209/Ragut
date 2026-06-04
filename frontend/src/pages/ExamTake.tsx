import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'

export default function ExamTake() {
  const { examId } = useParams()
  const nav = useNavigate()
  const [exam, setExam] = useState<any>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    api.get(`/exams/${examId}`).then(({ data }) => { setExam(data); setLoading(false) }).catch(() => setLoading(false))
  }, [examId])

  async function submit() {
    setSubmitting(true)
    const answersArr = Object.entries(answers).map(([id, answer]) => ({ id: parseInt(id), answer }))
    try { const { data } = await api.post(`/exams/${examId}/attempt`, { answers: answersArr }); setResult(data); setCurrent(0) } catch {}
    setSubmitting(false)
  }

  if (loading) return <div className="loading" style={{ height: '100vh' }}><div className="spinner" />Cargando examen...</div>
  if (!exam) return <div className="page"><div className="alert alert-error"><i className="ti ti-alert-circle" />Examen no encontrado</div></div>

  const questions = result ? result.graded : exam.questions
  const total = questions?.length || 0
  const answered = Object.keys(answers).length
  const progress = result ? 100 : total ? (answered / total) * 100 : 0
  const q = questions?.[current]
  const letters = ['A', 'B', 'C', 'D']

  return (
    <div className="page fade-up" style={{ maxWidth: 680 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => nav('/exams')}><i className="ti ti-arrow-left" /></button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em' }}>{exam.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{total} preguntas</div>
        </div>
        {result && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, letterSpacing: '-.03em', color: result.score >= 70 ? 'var(--green)' : result.score >= 50 ? 'var(--brand)' : 'var(--rose)' }}>{result.score}%</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{result.correct}/{result.total} correctas</div>
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="card" style={{ marginBottom: 16, padding: '12px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>
            {result ? 'Revisión' : `Pregunta ${current + 1} de ${total}`}
          </div>
          <div style={{ flex: 1, height: 5, background: 'var(--bg4)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: result ? (result.score >= 70 ? 'var(--green)' : result.score >= 50 ? 'var(--brand)' : 'var(--rose)') : 'var(--brand)', borderRadius: 3, width: `${progress}%`, transition: 'width .4s ease' }} />
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', whiteSpace: 'nowrap' }}>{Math.round(progress)}%</div>
        </div>
      </div>

      {/* Question */}
      {q && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body">
            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>Pregunta {current + 1}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--text)', lineHeight: 1.55, marginBottom: 20 }}>{q.question}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(q.options || []).map((opt: string, i: number) => {
                const letter = letters[i]
                const isSelected = result ? q.user_answer === letter : answers[q.id] === letter
                const isCorrect = result && q.correct_answer === letter
                const isWrong = result && q.user_answer === letter && !q.is_correct
                let bg = 'var(--bg3)', border = 'var(--border)', color = 'var(--text2)', circBg = '', circBorder = 'var(--border2)', circColor = 'var(--text3)'
                if (isCorrect) { bg = 'var(--green-bg)'; border = 'rgba(74,222,128,.3)'; color = 'var(--green)'; circBg = 'var(--green)'; circBorder = 'var(--green)'; circColor = '#000' }
                else if (isWrong) { bg = 'var(--rose-bg)'; border = 'rgba(251,113,133,.3)'; color = 'var(--rose)'; circBg = 'var(--rose)'; circBorder = 'var(--rose)'; circColor = '#fff' }
                else if (isSelected && !result) { bg = 'var(--brand-bg2)'; border = 'rgba(232,168,56,.4)'; color = 'var(--brand2)'; circBg = 'var(--brand)'; circBorder = 'var(--brand)'; circColor = '#000' }
                return (
                  <div key={i} onClick={() => { if (!result) setAnswers(p => ({ ...p, [q.id]: letter })) }}
                    style={{ padding: '11px 14px', border: `1px solid ${border}`, borderRadius: 10, fontSize: 13, cursor: result ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 12, background: bg, color, transition: 'all .15s' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${circBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, background: circBg, color: circColor }}>
                      {letter}
                    </div>
                    {opt}
                  </div>
                )
              })}
            </div>
            {result && q.explanation && (
              <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--teal-bg)', border: '1px solid rgba(45,212,191,.2)', borderRadius: 10, fontSize: 12, color: 'var(--teal)', lineHeight: 1.65 }}>
                <strong>Explicación:</strong> {q.explanation}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}>
          <i className="ti ti-chevron-left" /> Anterior
        </button>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center' }}>
          {questions?.map((_: any, i: number) => {
            const dq = questions[i]
            const ans = result ? true : !!answers[questions[i]?.id]
            const ok = result && dq.is_correct
            const ng = result && !dq.is_correct
            return (
              <div key={i} onClick={() => setCurrent(i)}
                style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: ok ? 'var(--green-bg)' : ng ? 'var(--rose-bg)' : ans ? 'var(--brand-bg2)' : 'var(--bg3)', border: `1px solid ${ok ? 'rgba(74,222,128,.3)' : ng ? 'rgba(251,113,133,.3)' : ans ? 'rgba(232,168,56,.3)' : 'var(--border)'}`, color: ok ? 'var(--green)' : ng ? 'var(--rose)' : ans ? 'var(--brand2)' : 'var(--text3)', outline: current === i ? `2px solid var(--brand)` : 'none', outlineOffset: 2 }}>
                {i + 1}
              </div>
            )
          })}
        </div>
        {result ? (
          <button className="btn btn-primary btn-sm" onClick={() => nav('/exams')}><i className="ti ti-check" /> Finalizar</button>
        ) : current < total - 1 ? (
          <button className="btn btn-primary btn-sm" onClick={() => setCurrent(c => c + 1)}>Siguiente <i className="ti ti-chevron-right" /></button>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={submit} disabled={submitting || answered < total}>
            {submitting ? <><div className="spinner" style={{ width: 14, height: 14, borderTopColor: '#000' }} />Enviando...</> : <><i className="ti ti-send" /> Enviar</>}
          </button>
        )}
      </div>
    </div>
  )
}
