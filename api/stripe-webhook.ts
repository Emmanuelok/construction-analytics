import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { resolvePrice } from './_prices'

/* POST /api/stripe-webhook — verifies the Stripe signature and, on a completed
 * checkout, grants the buyer a license row per purchased dataset (idempotent).
 * Configure this URL in the Stripe dashboard and set STRIPE_WEBHOOK_SECRET. */
export default async function handler(req: Request): Promise<Response> {
  const secret = process.env.STRIPE_SECRET_KEY
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret || !whSecret) return new Response('Stripe not configured', { status: 501 })

  const sig = req.headers.get('stripe-signature')
  if (!sig) return new Response('Missing stripe-signature header', { status: 400 })

  const raw = await req.text()
  const stripe = new Stripe(secret)
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, whSecret)
  } catch (err) {
    return new Response(`Signature verification failed: ${(err as Error).message}`, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.metadata?.userId
    const datasetIds = (session.metadata?.datasetIds ?? '').split(',').filter(Boolean)
    const supaUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
    const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (userId && datasetIds.length && supaUrl && supaKey) {
      const supabase = createClient(supaUrl, supaKey)
      const rows = []
      for (const id of datasetIds) {
        const resolved = await resolvePrice(supabase, id)
        rows.push({ user_id: userId, dataset_id: id, tier: 'Commercial', price: resolved?.price ?? 0, status: 'active' })
      }
      await supabase.from('licenses').upsert(rows, { onConflict: 'user_id,dataset_id' })
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'content-type': 'application/json' } })
}
