import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import { CATALOG, getDataset, type CatalogDataset } from '@/data/catalog'
import { useAuth } from '@/store/auth'
import { loadCloud, pushDownload, pushLicense, pushListing, removeListingCloud } from '@/lib/cloud'

export type LibraryItem = { datasetId: string; tier: string; licensedAt: string; price: number }
export type DownloadLog = { datasetId: string; fileName: string; at: string }

type State = {
  cart: string[]
  library: LibraryItem[]
  downloads: DownloadLog[]
  listings: CatalogDataset[] // the signed-in seller's own datasets
  marketplace: CatalogDataset[] // datasets published by other sellers (browse only)
}

const initial: State = { cart: [], library: [], downloads: [], listings: [], marketplace: [] }
const KEY = 'aec-studio-v1'

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...initial, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return initial
}

type Action =
  | { type: 'add'; id: string }
  | { type: 'remove'; id: string }
  | { type: 'clearCart' }
  | { type: 'checkout'; items: LibraryItem[] }
  | { type: 'license'; item: LibraryItem }
  | { type: 'download'; log: DownloadLog }
  | { type: 'publish'; dataset: CatalogDataset }
  | { type: 'removeListing'; id: string }
  | { type: 'hydrate'; state: Partial<State> }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'add':
      return state.cart.includes(action.id) ? state : { ...state, cart: [...state.cart, action.id] }
    case 'remove':
      return { ...state, cart: state.cart.filter((c) => c !== action.id) }
    case 'clearCart':
      return { ...state, cart: [] }
    case 'checkout': {
      const owned = new Set(state.library.map((l) => l.datasetId))
      const fresh = action.items.filter((i) => !owned.has(i.datasetId))
      return { ...state, library: [...state.library, ...fresh], cart: [] }
    }
    case 'license': {
      if (state.library.some((l) => l.datasetId === action.item.datasetId)) return state
      return { ...state, library: [...state.library, action.item], cart: state.cart.filter((c) => c !== action.item.datasetId) }
    }
    case 'download':
      return { ...state, downloads: [action.log, ...state.downloads].slice(0, 100) }
    case 'publish':
      return { ...state, listings: [action.dataset, ...state.listings.filter((l) => l.id !== action.dataset.id)] }
    case 'removeListing':
      return { ...state, listings: state.listings.filter((l) => l.id !== action.id) }
    case 'hydrate':
      return { ...state, ...action.state }
    default:
      return state
  }
}

type StudioValue = {
  cart: string[]
  library: LibraryItem[]
  downloads: DownloadLog[]
  listings: CatalogDataset[]
  marketplace: CatalogDataset[]
  cartTotal: number
  allDatasets: CatalogDataset[]
  getAny: (id: string) => CatalogDataset | undefined
  refresh: () => void
  inCart: (id: string) => boolean
  owns: (id: string) => boolean
  addToCart: (id: string) => void
  removeFromCart: (id: string) => void
  clearCart: () => void
  checkout: () => void
  license: (id: string) => void
  recordDownload: (datasetId: string, fileName: string) => void
  publishListing: (dataset: CatalogDataset) => void
  removeListing: (id: string) => void
}

const StudioContext = createContext<StudioValue | null>(null)

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)
  const { user, mode } = useAuth()
  const cloud = mode === 'supabase' && !!user
  const storageKey = useMemo(() => (user ? `${KEY}::${user.id}` : KEY), [user])

  // Re-hydrate when the signed-in identity changes: local cache first (instant),
  // then the cloud snapshot (authoritative) when a backend is configured.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      dispatch({ type: 'hydrate', state: raw ? JSON.parse(raw) : { library: [], downloads: [], listings: [], marketplace: [] } })
    } catch {
      /* ignore */
    }
    if (cloud && user) {
      loadCloud(user.id)
        .then((snap) => snap && dispatch({ type: 'hydrate', state: snap }))
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, cloud, user?.id])

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state))
    } catch {
      /* quota — ignore */
    }
  }, [state, storageKey])

  const value = useMemo<StudioValue>(() => {
    const getAny = (id: string) =>
      state.listings.find((l) => l.id === id) ?? state.marketplace.find((l) => l.id === id) ?? getDataset(id)
    const toItem = (id: string): LibraryItem => {
      const d = getAny(id)
      return { datasetId: id, tier: d?.license ?? 'Commercial', price: d?.price ?? 0, licensedAt: new Date().toISOString() }
    }
    const owns = (id: string) => state.library.some((l) => l.datasetId === id)
    // Browse surfaces see own listings + other sellers' published datasets + the
    // static catalog, de-duplicated by id (own wins, then marketplace, then seed).
    const allDatasets: CatalogDataset[] = []
    const seen = new Set<string>()
    for (const d of [...state.listings, ...state.marketplace, ...CATALOG]) {
      if (seen.has(d.id)) continue
      seen.add(d.id)
      allDatasets.push(d)
    }
    return {
      cart: state.cart,
      library: state.library,
      downloads: state.downloads,
      listings: state.listings,
      marketplace: state.marketplace,
      cartTotal: state.cart.reduce((sum, id) => sum + (getAny(id)?.price ?? 0), 0),
      allDatasets,
      getAny,
      refresh: () => {
        if (cloud && user) loadCloud(user.id).then((snap) => snap && dispatch({ type: 'hydrate', state: snap })).catch(() => {})
      },
      inCart: (id) => state.cart.includes(id),
      owns,
      addToCart: (id) => dispatch({ type: 'add', id }),
      removeFromCart: (id) => dispatch({ type: 'remove', id }),
      clearCart: () => dispatch({ type: 'clearCart' }),
      checkout: () => {
        const items = state.cart.map(toItem)
        dispatch({ type: 'checkout', items })
        if (cloud && user) items.forEach((it) => void pushLicense(it, user.id))
      },
      license: (id) => {
        const item = toItem(id)
        dispatch({ type: 'license', item })
        if (cloud && user) void pushLicense(item, user.id)
      },
      recordDownload: (datasetId, fileName) => {
        const log = { datasetId, fileName, at: new Date().toISOString() }
        dispatch({ type: 'download', log })
        if (cloud && user) void pushDownload(log, user.id)
      },
      publishListing: (dataset) => {
        dispatch({ type: 'publish', dataset })
        if (cloud && user) void pushListing(dataset, user.id)
      },
      removeListing: (id) => {
        dispatch({ type: 'removeListing', id })
        if (cloud && user) void removeListingCloud(id)
      },
    }
  }, [state, cloud, user])

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
}

export function useStudio(): StudioValue {
  const ctx = useContext(StudioContext)
  if (!ctx) throw new Error('useStudio must be used within StudioProvider')
  return ctx
}
