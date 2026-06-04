import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import Shell from './components/Shell'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Classes from './pages/Classes'
import ClassDetail from './pages/ClassDetail'
import Chat from './pages/Chat'
import Exams from './pages/Exams'
import ExamTake from './pages/ExamTake'
import AdminPanel from './pages/AdminPanel'
import Flashcards from './pages/Flashcards'
import Summaries from './pages/Summaries'

function Guard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore()
  if (loading) return <div className="loading" style={{ height: '100vh' }}><div className="spinner" />Cargando...</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const { fetchMe } = useAuthStore()
  useEffect(() => { fetchMe() }, [])
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Guard><Shell /></Guard>}>
          <Route index element={<Dashboard />} />
          <Route path="classes" element={<Classes />} />
          <Route path="classes/:classId" element={<ClassDetail />} />
          <Route path="classes/:classId/chat" element={<Chat />} />
          <Route path="exams" element={<Exams />} />
          <Route path="exams/:examId" element={<ExamTake />} />
          <Route path="flashcards" element={<Flashcards />} />
          <Route path="summaries" element={<Summaries />} />
          <Route path="admin" element={<AdminPanel />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
