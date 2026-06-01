import Stripe from 'stripe'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { resolvePrice } from './_prices'

/* POST /api/checkout — creates a Stripe Checkout Session from cart item ids,
 * pricing each item from a server-trusted source, and returns the hosted
 * checkout URL. Requires STRIPE_SECRET_KEY (and, for listing prices,
 * SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY). */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) return json({ error: 'Stripe is not configured on the server.' }, 501)

  let body: { items?: { id: string }[]; userId?: string; email?: string; origin?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const items = body.items ?? []
  if (!items.length) return json({ error: 'Cart is empty' }, 400)

  const stripe = new Stripe(secret)

  const supaUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase: SupabaseClient | null = supaUrl && supaKey ? createClient(supaUrl, supaKey) : null

  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = []
  const purchasedIds: string[] = []
  for (const it of items) {
    const resolved = await resolvePrice(supabase, it.id)
    if (!resolved || resolved.price <= 0) continue // free or unknown → no charge
    line_items.push({
      quantity: 1,
      price_data: { currency: 'usd', unit_amount: Math.round(resolved.price * 100), product_data: { name: resolved.name } },
    })
    purchasedIds.push(it.id)
  }
  if (!line_items.length) return json({ error: 'No payable items in cart.' }, 400)

  const origin = body.origin ?? req.headers.get('origin') ?? ''
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items,
    customer_email: body.email,
    success_url: `${origin}/library?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/library?checkout=cancelled`,
    metadata: { userId: body.userId ?? '', datasetIds: purchasedIds.join(',') },
  })
  return json({ url: session.url })
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
}
