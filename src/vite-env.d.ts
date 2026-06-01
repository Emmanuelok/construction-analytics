/// <reference types="vite/client" />

// web-ifc's WASM kernel imported as a Vite asset URL (see ifc-wasm-url.ts).
declare module '*.wasm?url' {
  const url: string
  export default url
}
