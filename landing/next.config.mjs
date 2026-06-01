/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export so the marketing site deploys anywhere (same ethos as the app).
  output: 'export',
  images: { unoptimized: true },
  // Served under /landing when colocated; override with BASE_PATH for root hosting.
  basePath: process.env.BASE_PATH ?? '',
  trailingSlash: true,
}

export default nextConfig
