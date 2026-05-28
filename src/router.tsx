import { lazy } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import Overview from '@/pages/Overview'
import NotFound from '@/pages/NotFound'

// Code-split heavier module pages so the landing page paints fast and
// charting libraries only load when a data module is opened.
const Insights = lazy(() => import('@/pages/Insights'))
const Ask = lazy(() => import('@/pages/Ask'))
const Lakehouse = lazy(() => import('@/pages/Lakehouse'))
const Marketplace = lazy(() => import('@/pages/Marketplace'))
const AiStudio = lazy(() => import('@/pages/AiStudio'))
const Governance = lazy(() => import('@/pages/Governance'))
const Bim = lazy(() => import('@/pages/Bim'))
const Documents = lazy(() => import('@/pages/Documents'))
const CostSchedule = lazy(() => import('@/pages/CostSchedule'))
const Procurement = lazy(() => import('@/pages/Procurement'))
const Field = lazy(() => import('@/pages/Field'))
const RealityCapture = lazy(() => import('@/pages/RealityCapture'))
const Sustainability = lazy(() => import('@/pages/Sustainability'))
const DigitalTwin = lazy(() => import('@/pages/DigitalTwin'))
const PainPoints = lazy(() => import('@/pages/PainPoints'))

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppShell />,
      children: [
        { index: true, element: <Overview /> },
        { path: 'insights', element: <Insights /> },
        { path: 'ask', element: <Ask /> },
        { path: 'lakehouse', element: <Lakehouse /> },
        { path: 'marketplace', element: <Marketplace /> },
        { path: 'ai-studio', element: <AiStudio /> },
        { path: 'governance', element: <Governance /> },
        { path: 'bim', element: <Bim /> },
        { path: 'documents', element: <Documents /> },
        { path: 'cost-schedule', element: <CostSchedule /> },
        { path: 'procurement', element: <Procurement /> },
        { path: 'field', element: <Field /> },
        { path: 'reality-capture', element: <RealityCapture /> },
        { path: 'sustainability', element: <Sustainability /> },
        { path: 'digital-twin', element: <DigitalTwin /> },
        { path: 'pain-points', element: <PainPoints /> },
        { path: '*', element: <NotFound /> },
      ],
    },
  ],
  { basename: '/construction-analytics' },
)
