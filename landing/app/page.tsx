import { Nav, Footer } from '@/components/Nav'
import { Hero } from '@/components/Hero'
import { Analyzer } from '@/components/Analyzer'
import { Ticker, Stats, Problem, Pillars, Intelligence, Lifecycle, Trust, CTA } from '@/components/Sections'

// Where "Launch / Enter the studio" points. Override at build time with
// NEXT_PUBLIC_APP_URL (e.g. the deployed Vite app); defaults to the app root.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '/'

export default function Page() {
  return (
    <main id="top">
      <Nav appUrl={APP_URL} />
      <Hero appUrl={APP_URL} />
      <Ticker />
      <Analyzer />
      <Stats />
      <Problem />
      <Pillars />
      <Intelligence />
      <Lifecycle />
      <Trust />
      <CTA appUrl={APP_URL} />
      <Footer />
    </main>
  )
}
