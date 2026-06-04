import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import api from '../api/client'

export default function Dashboard() {
  const { user } = useAuthStore()
  const nav = useNavigate()
  const [classes, setClasses] = useState<any[]>([])
  const [adminStats, setAdminStats] = useState<any>(null)
  const [studyStats, setStudyStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const reqs: Promise<any>[] = [api.get('/classes')]
      if (user?.role === 'admin') reqs.push(api.get('/admin/stats'))
      reqs.push(api.get('/dashboard/stats'))
      const results = await Promise.allSettled(reqs)
      if (results[0].status === 'fulfilled') setClasses(results[0].value.data.slice(0, 6))
      if (user?.role === 'admin' && results[1].status === 'fulfilled') setAdminStats((results[1] as any).value.data)
      const idx = user?.role === 'admin' ? 2 : 1
      if (results[idx]?.status === 'fulfilled') setStudyStats((results[idx] as any).value.data)
      setLoading(false)
    }
    load()
  }, [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'
  const colors = ['var(--brand)', 'var(--teal)', 'var(--violet)', 'var(--rose)', 'var(--green)']
  const maxAct = studyStats ? Math.max(...studyStats.daily_activity.map((d: any) => d.count), 1) : 1

  return (
    <div className="page fade-up">
      <div className="page-title">{greeting}, {user?.full_name.split(' ')[0]}</div>
      <div className="page-sub">
        {user?.role === 'admin' ? 'Panel de control institucional' :
         user?.role === 'professor' ? 'Gestiona tus clases y materiales' :
         'Continúa aprendiendo donde lo dejaste'}
      </div>

      {user?.role === 'admin' && adminStats && (
        <div className="metrics" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 24 }}>
          <div className="metric-card"><div className="metric-label">Usuarios</div><div className="metric-val">{adminStats.total_users}</div><div className="metric-sub">{adminStats.professors} prof · {adminStats.students} alumnos</div></div>
          <div className="metric-card"><div className="metric-label">Clases activas</div><div className="metric-val">{adminStats.active_classes}</div></div>
          <div className="metric-card"><div className="metric-label">Solicitudes</div><div className="metric-val" style={{ color: adminStats.pending_enrollments > 0 ? 'var(--brand)' : 'var(--text)' }}>{adminStats.pending_enrollments}</div><div className="metric-sub">pendientes</div></div>
        </div>
      )}

      {studyStats && (
        <div className="metrics" style={{ marginBottom: 24 }}>
          {[
            { label: 'Preguntas hechas', val: studyStats.questions_total, sub: `+${studyStats.questions_week} esta semana`, icon: 'ti-messages', color: 'var(--teal)' },
            { label: 'Exámenes', val: studyStats.exams_completed, sub: `Promedio ${studyStats.avg_score}%`, icon: 'ti-clipboard-check', color: 'var(--violet)' },
            { label: 'Flashcards', val: studyStats.flashcard_reviews, sub: `+${studyStats.flashcard_reviews_week} esta semana`, icon: 'ti-cards', color: 'var(--brand)' },
            { label: 'Racha de estudio', val: `${studyStats.study_streak}`, sub: studyStats.study_streak > 0 ? '¡Sigue así!' : 'Empieza hoy', icon: 'ti-flame', color: 'var(--rose)', unit: 'días' },
          ].map(m => (
            <div key={m.label} className="metric-card">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div className="metric-label">{m.label}</div>
                  <div className="metric-val" style={{ color: m.label === 'Racha de estudio' && studyStats.study_streak > 0 ? 'var(--brand)' : 'var(--text)' }}>
                    {m.val}{m.unit && <span style={{ fontSize: 14 }}> {m.unit}</span>}
                  </div>
                  <div className="metric-sub">{m.sub}</div>
                </div>
                <div style={{ width: 36, height: 36, background: `${m.color}18`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className={`ti ${m.icon}`} style={{ color: m.color, fontSize: 18 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {studyStats?.daily_activity && (
          <div className="card">
            <div className="card-head"><span className="card-title">Actividad últimas 2 semanas</span></div>
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
                {studyStats.daily_activity.map((d: any, i: number) => {
                  const h = d.count === 0 ? 4 : Math.max(8, (d.count / maxAct) * 72)
                  const isToday = i === studyStats.daily_activity.length - 1
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div title={`${d.date}: ${d.count}`}
                        style={{ width: '100%', height: h, borderRadius: 3, background: d.count === 0 ? 'var(--bg4)' : isToday ? 'var(--brand)' : 'var(--brand-bg2)', transition: 'height .3s' }} />
                      {i % 3 === 0 && <div style={{ fontSize: 9, color: 'var(--text3)' }}>{new Date(d.date).getDate()}</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
        <div className="card">
          <div className="card-head">
            <span className="card-title">{user?.role === 'professor' ? 'Mis clases' : 'Clases inscritas'}</span>
            <button className="btn btn-sm btn-ghost" onClick={() => nav('/classes')}>Ver todas</button>
          </div>
          <div style={{ padding: 0 }}>
            {loading ? <div className="loading" style={{ height: 100 }}><div className="spinner" /></div> :
             classes.length === 0 ? <div className="empty" style={{ padding: 28 }}><i className="ti ti-school" /><p>Sin clases</p></div> :
             classes.map((c: any, i) => (
               <div key={c.id} onClick={() => nav(`/classes/${c.id}`)}
                 style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: i < classes.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', transition: 'background .1s' }}
                 onMouseOver={e => (e.currentTarget.style.background = 'var(--bg3)')}
                 onMouseOut={e => (e.currentTarget.style.background = '')}>
                 <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors[i % colors.length], flexShrink: 0 }} />
                 <div style={{ flex: 1 }}>
                   <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{c.name}</div>
                   <div style={{ fontSize: 11, color: 'var(--text3)' }}>{c.enrollment_count} alumnos{c.professor_name ? ` · ${c.professor_name}` : ''}</div>
                 </div>
                 <i className="ti ti-chevron-right" style={{ fontSize: 14, color: 'var(--text3)' }} />
               </div>
             ))
            }
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><span className="card-title">Acceso rápido</span></div>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          {[
            { icon: 'ti-messages', color: 'var(--teal)', label: 'Chat IA', action: () => classes[0] && nav(`/classes/${classes[0].id}/chat`) },
            { icon: 'ti-cards', color: 'var(--violet)', label: 'Flashcards', action: () => nav('/flashcards') },
            { icon: 'ti-file-description', color: 'var(--brand)', label: 'Resúmenes', action: () => nav('/summaries') },
            { icon: 'ti-clipboard-check', color: 'var(--rose)', label: 'Exámenes', action: () => nav('/exams') },
          ].map(item => (
            <button key={item.label} onClick={item.action}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 16, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer', transition: 'all .15s', fontFamily: 'var(--font-body)' }}
              onMouseOver={e => { (e.currentTarget.style.background = 'var(--bg4)'); (e.currentTarget.style.borderColor = 'var(--border2)') }}
              onMouseOut={e => { (e.currentTarget.style.background = 'var(--bg3)'); (e.currentTarget.style.borderColor = 'var(--border)') }}>
              <i className={`ti ${item.icon}`} style={{ fontSize: 22, color: item.color }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
