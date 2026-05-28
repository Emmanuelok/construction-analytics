import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import Overview from '@/pages/Overview'
import Insights from '@/pages/Insights'
import Ask from '@/pages/Ask'
import Lakehouse from '@/pages/Lakehouse'
import Marketplace from '@/pages/Marketplace'
import AiStudio from '@/pages/AiStudio'
import Governance from '@/pages/Governance'
import Bim from '@/pages/Bim'
import Documents from '@/pages/Documents'
import CostSchedule from '@/pages/CostSchedule'
import Procurement from '@/pages/Procurement'
import Field from '@/pages/Field'
import RealityCapture from '@/pages/RealityCapture'
import Sustainability from '@/pages/Sustainability'
import DigitalTwin from '@/pages/DigitalTwin'
import PainPoints from '@/pages/PainPoints'
import NotFound from '@/pages/NotFound'

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
