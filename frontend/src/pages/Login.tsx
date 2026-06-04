import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const nav = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true)
    try { await login(email, password); nav('/') }
    catch { setError('Correo o contraseña incorrectos') }
    finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden'
    }}>
      {/* Left — branding panel */}
      <div style={{
        background: 'linear-gradient(135deg, #1A1400 0%, #0D0D0F 60%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '48px', position: 'relative', overflow: 'hidden',
        borderRight: '1px solid var(--border)'
      }}>
        {/* Grid pattern */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(232,168,56,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(232,168,56,.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }} />
        {/* Glow */}
        <div style={{ position: 'absolute', top: '30%', left: '20%', width: 300, height: 300, background: 'radial-gradient(circle, rgba(232,168,56,.12) 0%, transparent 70%)', borderRadius: '50%' }} />

        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 64 }}>
            <div className="sb-logomark"><i className="ti ti-brain" /></div>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
              Rag<span style={{ color: 'var(--brand)' }}>UT</span>
            </span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 44, fontWeight: 700, color: 'var(--text)', lineHeight: 1.15, letterSpacing: '-.04em', marginBottom: 20 }}>
            Aprende más<br />
            <span style={{ color: 'var(--brand)' }}>con IA</span>
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.7, maxWidth: 360 }}>
            Plataforma educativa inteligente de la Universidad Tecnológica de Cancún. Pregunta, estudia y genera exámenes con tus propios materiales.
          </p>
        </div>

        <div style={{ position: 'relative', display: 'flex', gap: 20 }}>
          {[['i ti-file-text', 'PDFs vectorizados', 'Sube tus materiales'], ['i ti-messages', 'Chat IA', 'Pregunta libremente'], ['i ti-clipboard-check', 'Exámenes', 'Genera con IA']].map(([icon, title, sub]) => (
            <div key={title} style={{ flex: 1, background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px' }}>
              <i className={`ti ${icon.split(' ')[1]}`} style={{ fontSize: 20, color: 'var(--brand)', display: 'block', marginBottom: 8 }} />
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{title}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right — form */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
        <div style={{ width: '100%', maxWidth: 380 }} className="fade-up">
          <div style={{ marginBottom: 36 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--text)', marginBottom: 6, letterSpacing: '-.03em' }}>Iniciar sesión</h2>
            <p style={{ fontSize: 13, color: 'var(--text2)' }}>Accede a tu plataforma educativa</p>
          </div>

          {error && (
            <div className="alert alert-error">
              <i className="ti ti-alert-circle" style={{ fontSize: 15, flexShrink: 0 }} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Correo electrónico</label>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@utcancun.edu.mx" required />
            </div>
            <div className="form-group" style={{ marginBottom: 24 }}>
              <label className="form-label">Contraseña</label>
              <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 14 }}>
              {loading ? <><div className="spinner" style={{ borderTopColor: '#000' }} />Entrando...</> : 'Entrar a RagUT'}
            </button>
          </form>

          <p style={{ marginTop: 24, fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
            ¿Sin cuenta? Contacta al administrador de tu institución.
          </p>
        </div>
      </div>
    </div>
  )
}
