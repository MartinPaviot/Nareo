/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Turbopack alias to replace html2canvas with html2canvas-pro (supports lab/oklch colors)
  turbopack: {
    resolveAlias: {
      'html2canvas': 'html2canvas-pro',
    },
  },
  async redirects() {
    return [
      {
        source: '/chapter/:id',
        destination: '/dashboard',
        permanent: false,
      },
    ];
  },
}

module.exports = nextConfig
