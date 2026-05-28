import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react'
import { CATALOG, getDataset, type CatalogDataset } from '@/data/catalog'

export type LibraryItem = { datasetId: string; tier: string; licensedAt: string; price: number }
export type DownloadLog = { datasetId: string; fileName: string; at: string }

type State = {
  cart: string[]
  library: LibraryItem[]
  downloads: DownloadLog[]
  listings: CatalogDataset[]
}

const initial: State = { cart: [], library: [], downloads: [], listings: [] }
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
    default:
      return state
  }
}

type StudioValue = {
  cart: string[]
  library: LibraryItem[]
  downloads: DownloadLog[]
  listings: CatalogDataset[]
  cartTotal: number
  allDatasets: CatalogDataset[]
  getAny: (id: string) => CatalogDataset | undefined
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

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* quota — ignore */
    }
  }, [state])

  const value = useMemo<StudioValue>(() => {
    const getAny = (id: string) => state.listings.find((l) => l.id === id) ?? getDataset(id)
    const toItem = (id: string): LibraryItem => {
      const d = getAny(id)
      return { datasetId: id, tier: d?.license ?? 'Commercial', price: d?.price ?? 0, licensedAt: new Date().toISOString() }
    }
    const owns = (id: string) => state.library.some((l) => l.datasetId === id)
    return {
      cart: state.cart,
      library: state.library,
      downloads: state.downloads,
      listings: state.listings,
      cartTotal: state.cart.reduce((sum, id) => sum + (getAny(id)?.price ?? 0), 0),
      allDatasets: [...state.listings, ...CATALOG],
      getAny,
      inCart: (id) => state.cart.includes(id),
      owns,
      addToCart: (id) => dispatch({ type: 'add', id }),
      removeFromCart: (id) => dispatch({ type: 'remove', id }),
      clearCart: () => dispatch({ type: 'clearCart' }),
      checkout: () => dispatch({ type: 'checkout', items: state.cart.map(toItem) }),
      license: (id) => dispatch({ type: 'license', item: toItem(id) }),
      recordDownload: (datasetId, fileName) =>
        dispatch({ type: 'download', log: { datasetId, fileName, at: new Date().toISOString() } }),
      publishListing: (dataset) => dispatch({ type: 'publish', dataset }),
      removeListing: (id) => dispatch({ type: 'removeListing', id }),
    }
  }, [state])

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
}

export function useStudio(): StudioValue {
  const ctx = useContext(StudioContext)
  if (!ctx) throw new Error('useStudio must be used within StudioProvider')
  return ctx
}
