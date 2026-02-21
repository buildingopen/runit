const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.join(__dirname, '../..'),
  transpilePackages: [
    '@runtime-ai/shared',
    '@runtime-ai/ui',
    '@runtime-ai/openapi-form',
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
        ],
      },
    ];
  },
  webpack(config) {
    config.ignoreWarnings = config.ignoreWarnings || [];
    config.ignoreWarnings.push({
      module: /@prisma\/instrumentation\/node_modules\/@opentelemetry\/instrumentation/,
      message: /Critical dependency: the request of a dependency is an expression/,
    });
    config.ignoreWarnings.push({
      module: /@supabase\/realtime-js\/dist\/module\/lib\/websocket-factory\.js/,
      message: /A Node\.js API is used .* Edge Runtime/,
    });
    config.ignoreWarnings.push({
      module: /@supabase\/supabase-js\/dist\/index\.mjs/,
      message: /A Node\.js API is used .* Edge Runtime/,
    });
    return config;
  },
}

module.exports = nextConfig
