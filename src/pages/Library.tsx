import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Library as LibraryIcon,
  ShoppingCart,
  Check,
  Trash2,
  Download,
  Clock,
  ArrowRight,
  CreditCard,
  Sparkles,
  Package,
  Wallet,
  Loader2,
} from 'lucide-react'
import { Card, CardHeader, PageHeader, StatTile, Badge, Tabs } from '@/components/ui'
import { useStudio } from '@/store/studio'
import { useAuth } from '@/store/auth'
import { isStripeEnabled, startCheckout } from '@/lib/payments'
import { ACCENT } from '@/lib/nav'
import { cn } from '@/lib/cn'
import { formatCurrency, formatNumber } from '@/lib/format'

function priceLabel(price: number | null) {
  if (price === null) return 'On request'
  if (price === 0) return 'Free'
  return formatCurrency(price, { compact: false })
}

export default function Library() {
  const { cart, library, downloads, cartTotal, getAny, removeFromCart, checkout } = useStudio()
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState('cart')
  const [done, setDone] = useState(false)
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  const totalSpend = useMemo(() => library.reduce((s, l) => s + (l.price ?? 0), 0), [library])

  // Handle the return from Stripe Checkout (?checkout=success|cancelled).
  useEffect(() => {
    const status = params.get('checkout')
    if (!status) return
    if (status === 'success') {
      checkout() // idempotent local/cloud grant; the webhook also grants server-side
      setDone(true)
      setTab('licensed')
    } else if (status === 'cancelled') {
      setPayError('Checkout was cancelled — your card was not charged.')
    }
    params.delete('checkout')
    params.delete('session_id')
    setParams(params, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCheckout() {
    setPayError(null)
    if (isStripeEnabled && cartTotal > 0) {
      if (!user) {
        setPayError('Please sign in to purchase.')
        return
      }
      setPaying(true)
      const { url, error } = await startCheckout(cart.map((id) => ({ id })), { userId: user.id, email: user.email })
      if (url) {
        window.location.href = url
        return
      }
      setPayError(error ?? 'Unable to start checkout.')
      setPaying(false)
      return
    }
    // Free items, demo mode, or no payment backend → instant licensing.
    checkout()
    setDone(true)
    setTab('licensed')
  }

  const tabs = [
    { id: 'cart', label: `Cart (${cart.length})`, icon: ShoppingCart },
    { id: 'licensed', label: `Licensed (${library.length})`, icon: Check },
    { id: 'downloads', label: `Downloads (${downloads.length})`, icon: Download },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        icon={LibraryIcon}
        accent="cyan"
        eyebrow="Studio"
        title="My Library"
        description="Your cart, licensed datasets and download history — everything you've acquired from the Data Center, in one place."
        actions={
          <Link to="/data" className="btn-ghost">
            Browse Data Center <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="In cart" value={String(cart.length)} icon={ShoppingCart} accent="amber" sub={priceLabel(cartTotal)} />
        <StatTile label="Licensed datasets" value={String(library.length)} icon={Package} accent="emerald" />
        <StatTile label="Files downloaded" value={String(downloads.length)} icon={Download} accent="cyan" />
        <StatTile label="Total spend" value={formatCurrency(totalSpend, { compact: false })} icon={Wallet} accent="violet" />
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {/* Cart */}
      {tab === 'cart' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            {cart.length === 0 ? (
              <Card className="grid place-items-center p-14 text-center text-slate-400">
                <ShoppingCart className="h-7 w-7 text-slate-600" />
                <p className="mt-3">Your cart is empty.</p>
                <Link to="/data" className="btn-primary mt-4">Browse datasets</Link>
              </Card>
            ) : (
              cart.map((id) => {
                const d = getAny(id)
                if (!d) return null
                const a = ACCENT[d.accent]
                return (
                  <Card key={id} className="flex items-center gap-4 p-4">
                    <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xs font-bold', a.bg, a.text)}>{d.modality.slice(0, 3)}</span>
                    <div className="min-w-0 flex-1">
                      <Link to={`/data/${d.id}`} className="truncate font-medium text-slate-100 hover:text-white">{d.name}</Link>
                      <div className="text-xs text-slate-500">{d.provider} · {d.license}</div>
                    </div>
                    <span className="font-semibold text-slate-200">{priceLabel(d.price)}</span>
                    <button onClick={() => removeFromCart(id)} className="rounded-lg p-2 text-slate-500 hover:bg-elevated hover:text-rose-300">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </Card>
                )
              })
            )}
          </div>

          <Card className="h-fit p-5">
            <h3 className="font-semibold text-slate-100">Order summary</h3>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between text-slate-400"><span>Items</span><span className="text-slate-200">{cart.length}</span></div>
              <div className="flex justify-between text-slate-400"><span>Subtotal</span><span className="text-slate-200">{formatCurrency(cartTotal, { compact: false })}</span></div>
              <div className="flex justify-between text-slate-400"><span>Platform fee</span><span className="text-slate-200">Included</span></div>
              <div className="mt-2 flex justify-between border-t border-edge/50 pt-3 text-base font-bold text-slate-100">
                <span>Total</span><span>{formatCurrency(cartTotal, { compact: false })}</span>
              </div>
            </div>
            {payError && <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{payError}</p>}
            <button onClick={handleCheckout} disabled={cart.length === 0 || paying} className="btn-primary mt-4 w-full">
              {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              {isStripeEnabled && cartTotal > 0 ? ' Pay with card' : ' Complete licensing'}
            </button>
            <p className="mt-3 text-center text-xs text-slate-500">
              {isStripeEnabled && cartTotal > 0
                ? 'Secure payment via Stripe · revocable license'
                : 'Instant access · revocable license · full audit trail'}
            </p>
          </Card>
        </div>
      )}

      {/* Licensed */}
      {tab === 'licensed' && (
        <div className="space-y-3">
          {done && library.length > 0 && (
            <Card className="flex items-center gap-3 border-emerald-500/30 bg-emerald-500/5 p-4">
              <Sparkles className="h-5 w-5 text-emerald-400" />
              <p className="text-sm text-slate-200">Licensing complete — your datasets are unlocked. Open any of them to download the full files.</p>
            </Card>
          )}
          {library.length === 0 ? (
            <Card className="grid place-items-center p-14 text-center text-slate-400">
              <Package className="h-7 w-7 text-slate-600" />
              <p className="mt-3">No licensed datasets yet.</p>
              <Link to="/data" className="btn-primary mt-4">Find datasets</Link>
            </Card>
          ) : (
            library.map((l) => {
              const d = getAny(l.datasetId)
              if (!d) return null
              const a = ACCENT[d.accent]
              return (
                <Card key={l.datasetId} className="flex items-center gap-4 p-4">
                  <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xs font-bold', a.bg, a.text)}>{d.modality.slice(0, 3)}</span>
                  <div className="min-w-0 flex-1">
                    <Link to={`/data/${d.id}`} className="truncate font-medium text-slate-100 hover:text-white">{d.name}</Link>
                    <div className="text-xs text-slate-500">Licensed {new Date(l.licensedAt).toLocaleDateString()} · {l.tier}</div>
                  </div>
                  <Badge variant="success" dot>Active</Badge>
                  <Link to={`/data/${d.id}`} className="btn-ghost !px-3 !py-1.5 !text-xs"><Download className="h-3.5 w-3.5" /> Files</Link>
                </Card>
              )
            })
          )}
        </div>
      )}

      {/* Downloads */}
      {tab === 'downloads' && (
        <Card>
          <CardHeader icon={Download} accent="cyan" title="Download history" subtitle="Files you've exported from the platform" />
          {downloads.length === 0 ? (
            <div className="grid place-items-center p-14 text-center text-slate-400">
              <Clock className="h-7 w-7 text-slate-600" />
              <p className="mt-3">No downloads yet. Open a dataset and download a sample file.</p>
            </div>
          ) : (
            <div className="divide-y divide-edge/40 border-t border-edge/50">
              {downloads.map((dl, i) => {
                const d = getAny(dl.datasetId)
                return (
                  <div key={i} className="flex items-center gap-3 px-5 py-3">
                    <Download className="h-4 w-4 text-slate-500" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-200">{dl.fileName}</div>
                      <div className="text-xs text-slate-500">{d?.name ?? dl.datasetId}</div>
                    </div>
                    <span className="text-xs text-slate-500">{new Date(dl.at).toLocaleString()}</span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
