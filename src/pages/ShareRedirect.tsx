import { useEffect } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { decodeShareToken } from '@/lib/collab'

const SEL_KEY = 'aec-active-project'

/* Resolves a /share/:token deep link to the right workbench. A subject is
 * either a route slug ('cost-schedule') or 'project:<id>' — the latter pins the
 * active project before sending the visitor to the project cockpit. */
export default function ShareRedirect() {
  const { token } = useParams()
  const subject = token ? decodeShareToken(token) : null

  useEffect(() => {
    if (subject?.startsWith('project:')) {
      try { localStorage.setItem(SEL_KEY, subject.slice(8)) } catch { /* ignore */ }
    }
  }, [subject])

  if (!subject) return <Navigate to="/welcome" replace />
  if (subject.startsWith('project:')) return <Navigate to="/project" replace />
  return <Navigate to={`/${subject}`} replace />
}
