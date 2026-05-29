import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AEC Data & Intelligence Studio — the operating system for the built environment',
  description:
    'A unified data lakehouse, marketplace and AI analytics studio for architecture, engineering & construction. Frame a problem, assemble data, compute real statistical findings, decide as a team — from brainstorm to production.',
  keywords: ['AEC', 'construction data', 'BIM', 'IFC', 'data marketplace', 'analytics', 'embodied carbon', 'digital twin'],
  openGraph: {
    title: 'AEC Data & Intelligence Studio',
    description: 'The operating system for the built environment — data, analytics & AI in one studio.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#04060d',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
