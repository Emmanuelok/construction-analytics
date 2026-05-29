import { lazy } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import ForYou from '@/pages/ForYou'
import Overview from '@/pages/Overview'
import NotFound from '@/pages/NotFound'

// Code-split heavier pages so the landing paints fast and charting libraries
// only load when a data module is opened.
const DataCenter = lazy(() => import('@/pages/DataCenter'))
const DatasetDetail = lazy(() => import('@/pages/DatasetDetail'))
const AnalysisStudio = lazy(() => import('@/pages/AnalysisStudio'))
const SellerStudio = lazy(() => import('@/pages/SellerStudio'))
const Library = lazy(() => import('@/pages/Library'))
const Workspaces = lazy(() => import('@/pages/Workspaces'))
const WorkspaceDetail = lazy(() => import('@/pages/WorkspaceDetail'))
const Teams = lazy(() => import('@/pages/Teams'))
const TeamDetail = lazy(() => import('@/pages/TeamDetail'))
const FlowStudio = lazy(() => import('@/pages/FlowStudio'))
const DataWorkbench = lazy(() => import('@/pages/DataWorkbench'))
const Insights = lazy(() => import('@/pages/Insights'))
const Ask = lazy(() => import('@/pages/Ask'))
const Lakehouse = lazy(() => import('@/pages/Lakehouse'))
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

// Match the router base to however the app is hosted (root on Vercel/Netlify,
// a project sub-path on GitHub Pages). Vite injects the resolved base here.
const rawBase = import.meta.env.BASE_URL
const basename = rawBase.length > 1 ? rawBase.replace(/\/+$/, '') : '/'

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppShell />,
      children: [
        { index: true, element: <ForYou /> },
        { path: 'overview', element: <Overview /> },
        // Pillars
        { path: 'data', element: <DataCenter /> },
        { path: 'data/:id', element: <DatasetDetail /> },
        { path: 'analyze', element: <AnalysisStudio /> },
        { path: 'sell', element: <SellerStudio /> },
        { path: 'library', element: <Library /> },
        { path: 'workspaces', element: <Workspaces /> },
        { path: 'workspaces/:id', element: <WorkspaceDetail /> },
        { path: 'flow', element: <FlowStudio /> },
        { path: 'workbench', element: <DataWorkbench /> },
        { path: 'teams', element: <Teams /> },
        { path: 'teams/:id', element: <TeamDetail /> },
        { path: 'marketplace', element: <Navigate to="/data" replace /> },
        // Intelligence + platform
        { path: 'insights', element: <Insights /> },
        { path: 'ask', element: <Ask /> },
        { path: 'lakehouse', element: <Lakehouse /> },
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
  { basename },
)
