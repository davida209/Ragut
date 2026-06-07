import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { useAuthStore } from '../store/auth'
import api from '../api/client'

const API_URL = import.meta.env.VITE_API_URL || 'https://ragut-1.onrender.com'

export default function Chat() {
  const { classId } = useParams()
  const { user } = useAuthStore()
  const nav = useNavigate()
  const [cls, setCls] = useState<any>(null)
  const [docs, setDocs] = useState<any[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [convId, setConvId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [streamEnabled] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  async function loadData() {
    const [c, d, convs] = await Promise.all([
      api.get(`/classes/${classId}`),
      api.get(`/documents?class_id=${classId}`),
      api.get(`/query/conversations?class_id=${classId}`)
    ])
    setCls(c.data)
    const ready = d.data.filter((x: any) => x.status === 'ready')
    setDocs(ready); setSelected(ready.map((x: any) => x.id))
    setConversations(convs.data)
  }
  useEffect(() => { loadData() }, [classId])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const onDrop = useCallback(async (files: File[]) => {
    setUploading(true)
    for (const file of files) {
      const fd = new FormData()
      fd.append('file', file); fd.append('class_id', classId!)
      fd.append('visibility', user?.role === 'student' ? 'private' : 'class_wide')
      try { await api.post('/documents/upload', fd) } catch {}
    }
    setUploading(false); loadData()
  }, [classId])
  const { getRootProps, getInputProps } = useDropzone({ onDrop, accept: { 'application/pdf': ['.pdf'] }, noClick: true })

  function toggle(id: string) {
    setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  }

  async function loadConversation(id: string) {
    const { data } = await api.get(`/query/conversations/${id}/messages`)
    setMessages(data); setConvId(id)
  }

  async function send() {
    if (!input.trim() || loading) return
    const q = input.trim(); setInput('')
    const userMsgId = Date.now().toString()
    setMessages(p => [...p, { id: userMsgId, role: 'user', content: q }])
    setLoading(true)

    const aiMsgId = (Date.now() + 1).toString()

    if (streamEnabled) {
      // Streaming via SSE
      const token = localStorage.getItem('access_token')
      try {
        const res = await fetch(`${API_URL}/query/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            question: q, class_id: classId,
            document_ids: selected.length > 0 ? selected : undefined,
            conversation_id: convId, stream: true
          })
        })

        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let streamedText = ''
        let sources: string[] = []
        let newConvId = convId

        setMessages(p => [...p, { id: aiMsgId, role: 'assistant', content: '', sources: [], streaming: true }])

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === 'meta') {
                sources = data.sources || []
                newConvId = data.conversation_id
                setConvId(newConvId)
              } else if (data.type === 'token') {
                streamedText += data.content
                setMessages(p => p.map(m => m.id === aiMsgId ? { ...m, content: streamedText, sources } : m))
              } else if (data.type === 'done') {
                setMessages(p => p.map(m => m.id === aiMsgId ? { ...m, streaming: false } : m))
              }
            } catch {}
          }
        }
        if (!conversations.find((c: any) => c.id === newConvId)) loadData()
      } catch {
        setMessages(p => p.map(m => m.id === aiMsgId ? { ...m, content: 'Error al conectar con el servidor.', streaming: false } : m))
      }
    } else {
      // Non-streaming fallback
      try {
        const { data } = await api.post('/query/ask', {
          question: q, class_id: classId,
          document_ids: selected.length > 0 ? selected : undefined,
          conversation_id: convId, stream: false
        })
        setMessages(p => [...p, { id: aiMsgId, role: 'assistant', content: data.answer, sources: data.sources }])
        setConvId(data.conversation_id)
        if (!conversations.find((c: any) => c.id === data.conversation_id)) loadData()
      } catch {
        setMessages(p => [...p, { id: aiMsgId, role: 'assistant', content: 'Ocurrió un error. Intenta de nuevo.', sources: [] }])
      }
    }
    setLoading(false)
  }

  return (
    <div {...getRootProps()} style={{ padding: '18px 24px', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <input {...getInputProps()} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexShrink: 0 }}>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => nav(`/classes/${classId}`)}>
          <i className="ti ti-arrow-left" />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{cls?.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            Tutoría · {selected.length} doc{selected.length !== 1 ? 's' : ''} · Streaming {streamEnabled ? 'activado' : 'desactivado'}
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => nav('/exams', { state: { classId, documentIds: selected } })}>
          <i className="ti ti-wand" /> Generar examen
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => nav(`/flashcards`)}>
          <i className="ti ti-cards" /> Flashcards
        </button>
      </div>

      <div className="chat-layout" style={{ flex: 1, overflow: 'hidden' }}>
        {/* Left panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
          <div className="card" style={{ flexShrink: 0 }}>
            <div className="card-head" style={{ padding: '10px 14px' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', letterSpacing: '.04em', textTransform: 'uppercase' }}>Documentos</span>
              <label style={{ fontSize: 11, color: 'var(--brand)', cursor: 'pointer' }}>
                <input {...getInputProps()} style={{ display: 'none' }} />
                {uploading ? '...' : '+ Subir'}
              </label>
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              {docs.length === 0 ? (
                <div style={{ padding: '14px', fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>Sube un PDF para comenzar</div>
              ) : docs.map((d: any) => (
                <div key={d.id} onClick={() => toggle(d.id)}
                  style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', borderBottom: '1px solid var(--border)', background: selected.includes(d.id) ? 'var(--brand-bg)' : '', color: selected.includes(d.id) ? 'var(--brand2)' : 'var(--text2)', transition: 'all .1s' }}>
                  <i className="ti ti-file-text" style={{ fontSize: 13, flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.filename}</span>
                  <div style={{ width: 14, height: 14, borderRadius: 3, border: `1px solid ${selected.includes(d.id) ? 'var(--brand)' : 'var(--border2)'}`, background: selected.includes(d.id) ? 'var(--brand)' : '', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {selected.includes(d.id) && <i className="ti ti-check" style={{ fontSize: 9, color: '#000' }} />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {conversations.length > 0 && (
            <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div className="card-head" style={{ padding: '10px 14px', flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', letterSpacing: '.04em', textTransform: 'uppercase' }}>Historial</span>
                <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', fontSize: 10 }} onClick={() => { setMessages([]); setConvId(null) }}>Nueva</button>
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {conversations.map((c: any) => (
                  <div key={c.id} onClick={() => loadConversation(c.id)}
                    style={{ padding: '8px 14px', fontSize: 11, cursor: 'pointer', borderBottom: '1px solid var(--border)', color: convId === c.id ? 'var(--brand2)' : 'var(--text3)', background: convId === c.id ? 'var(--brand-bg)' : '', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'all .1s' }}>
                    {c.title}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Chat main */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="chat-messages" style={{ flex: 1 }}>
            {messages.length === 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12, color: 'var(--text3)' }}>
                <div style={{ width: 56, height: 56, background: 'var(--brand-bg)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ti ti-brain" style={{ fontSize: 28, color: 'var(--brand)' }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>RagUT está listo</p>
                  <p style={{ fontSize: 12 }}>{selected.length} documento{selected.length !== 1 ? 's' : ''} · Streaming activado</p>
                </div>
              </div>
            )}
            {messages.map((m: any) => (
              <div key={m.id} className={`msg-row ${m.role === 'user' ? 'user' : 'ai'}`}>
                {m.role === 'assistant' && (
                  <div style={{ width: 28, height: 28, background: 'var(--brand-bg2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <i className="ti ti-brain" style={{ fontSize: 14, color: 'var(--brand)' }} />
                  </div>
                )}
                <div>
                  <div className="msg-bubble" style={{ position: 'relative' }}>
                    {m.content || (m.streaming && <span style={{ color: 'var(--text3)' }}>...</span>)}
                    {m.streaming && (
                      <span style={{ display: 'inline-block', width: 6, height: 14, background: 'var(--brand)', borderRadius: 2, marginLeft: 2, animation: 'pulse-ring 0.8s ease infinite', verticalAlign: 'middle' }} />
                    )}
                  </div>
                  {m.sources?.length > 0 && (
                    <div className="msg-sources">
                      {m.sources.map((s: string, i: number) => <span key={i} className="msg-source-tag">{s}</span>)}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
            <textarea className="form-input" rows={1} value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Pregunta sobre los documentos... (Enter para enviar)"
              style={{ flex: 1, resize: 'none', minHeight: 42, maxHeight: 120 }} />
            <button className="btn btn-primary btn-icon" onClick={send} disabled={loading || !input.trim()}>
              <i className="ti ti-send" style={{ fontSize: 16 }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
