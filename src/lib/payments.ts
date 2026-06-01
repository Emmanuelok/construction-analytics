/* Client side of Stripe Checkout. When VITE_STRIPE_PUBLISHABLE_KEY is set the
 * Library "Pay with card" flow POSTs the cart to /api/checkout and redirects to
 * the hosted Stripe page; otherwise the app uses instant demo licensing. */

export const isStripeEnabled = Boolean(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

export async function startCheckout(
  items: { id: string }[],
  opts: { userId?: string; email?: string } = {},
): Promise<{ url?: string; error?: string }> {
  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items, userId: opts.userId, email: opts.email, origin: window.location.origin }),
    })
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
    if (!res.ok) return { error: data.error ?? `Checkout failed (${res.status})` }
    return { url: data.url }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Network error' }
  }
}
