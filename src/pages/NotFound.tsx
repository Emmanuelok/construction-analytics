import { Link } from 'react-router-dom'
import { Compass, ArrowLeft } from 'lucide-react'
import { IconBadge } from '@/components/ui'

export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div>
        <IconBadge icon={Compass} accent="violet" size="lg" className="mx-auto" />
        <h1 className="mt-6 text-5xl font-extrabold text-slate-100">404</h1>
        <p className="mt-3 max-w-sm text-slate-400">
          This route isn’t part of the studio yet. The data is here — the page just wandered off-site.
        </p>
        <Link to="/" className="btn-primary mt-6 inline-flex">
          <ArrowLeft className="h-4 w-4" /> Back to overview
        </Link>
      </div>
    </div>
  )
}
