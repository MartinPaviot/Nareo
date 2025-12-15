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
  // Alias to replace html2canvas with html2canvas-pro (supports lab/oklch colors)
  // Works for both Turbopack (dev) and Webpack (production build)
  turbopack: {
    resolveAlias: {
      'html2canvas': 'html2canvas-pro',
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'html2canvas': 'html2canvas-pro',
    };
    return config;
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
