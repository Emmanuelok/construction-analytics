import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Bookmark, Check, ArrowRight, AlertTriangle } from 'lucide-react'
import { PageHeader, Card, CardHeader, Badge } from '@/components/ui'
import { decodeScenarioToken } from '@/lib/scenarios'
import { useScenarios } from '@/store/scenarios'

const MODULE_LABEL: Record<string, string> = {
  'cost-schedule': 'Cost & Schedule', procurement: 'Procurement', field: 'Construction Analytics',
  sustainability: 'Sustainability & ESG', governance: 'Governance & Trust', bim: 'BIM Intelligence',
  'reality-capture': 'Reality Capture', 'digital-twin': 'Digital Twin', insights: 'Executive Insights',
  'ai-studio': 'AI Training Studio', project: 'Project Workspace',
}

/* Resolves a /share/scenario/:token deep link: decodes a shared scenario, lets
 * the visitor import it into the matching workbench, then jump there to load it. */
export default function ScenarioShare() {
  const { token } = useParams()
  const scenario = useMemo(() => (token ? decodeScenarioToken(token) : null), [token])
  const module = scenario?.module ?? 'cost-schedule'
  const { importScenario } = useScenarios(module)
  const [imported, setImported] = useState(false)

  if (!token) return <Navigate to="/welcome" replace />

  if (!scenario) {
    return (
      <div className="space-y-8">
        <PageHeader icon={AlertTriangle} accent="rose" eyebrow="Shared scenario" title="This link isn't valid" description="The shared scenario could not be decoded — the link may be truncated or corrupted." />
        <Link to="/welcome" className="btn-primary w-fit">Back to the studio <ArrowRight className="h-4 w-4" /></Link>
      </div>
    )
  }

  const dest = module === 'project' ? '/project' : `/${module}`
  const moduleName = MODULE_LABEL[module] ?? module

  return (
    <div className="space-y-8">
      <PageHeader icon={Bookmark} accent="blue" eyebrow="Shared scenario" title="Someone shared a scenario with you" description="Import it into your studio, then open the workbench to load and explore it." />
      <Card className="max-w-xl">
        <CardHeader icon={Bookmark} accent="blue" title={scenario.name} subtitle={`For ${moduleName}`} action={<Badge variant="brand">{module}</Badge>} />
        <div className="space-y-4 border-t border-edge/50 p-5">
          {scenario.summary.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {scenario.summary.map((k) => (
                <div key={k.label} className="rounded-xl border border-edge/60 bg-elevated/30 p-3">
                  <div className="text-[11px] text-slate-500">{k.label}</div>
                  <div className="data-mono text-lg font-semibold text-slate-100">{k.unit === '$' ? `$${Math.round(k.value).toLocaleString()}` : k.unit === '%' ? `${k.value}%` : Math.round(k.value * 100) / 100}</div>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {imported ? (
              <>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-300"><Check className="h-4 w-4" /> Imported to your {moduleName} scenarios</span>
                <Link to={dest} className="btn-primary">Open {moduleName} <ArrowRight className="h-4 w-4" /></Link>
              </>
            ) : (
              <button onClick={() => { importScenario(scenario); setImported(true) }} className="btn-primary"><Bookmark className="h-4 w-4" /> Import this scenario</button>
            )}
          </div>
          <p className="text-xs text-slate-500">Importing saves a copy to this browser under your account. Open the workbench and click the scenario chip to load it.</p>
        </div>
      </Card>
    </div>
  )
}
