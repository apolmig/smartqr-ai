/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimize for production
  compress: true,
  poweredByHeader: false,
  
  // Disable linting during build for production
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Disable TypeScript checking during build for production
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
  },

  // Headers for security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },

  // Redirects for QR codes
  async redirects() {
    return [
      {
        source: '/qr/:shortId',
        destination: '/r/:shortId',
        permanent: true,
      },
    ];
  },

  // Environment variables validation
  env: {
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  },
};

module.exports = nextConfig;