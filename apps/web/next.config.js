const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.join(__dirname, '../..'),
  transpilePackages: [
    '@buildingopen/shared',
    '@buildingopen/ui',
    '@buildingopen/openapi-form',
  ],
  async redirects() {
    return [
      { source: '/welcome', destination: '/', permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          // CSP is set dynamically in middleware.ts based on request host
        ],
      },
    ];
  },
}

module.exports = nextConfig
