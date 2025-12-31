/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@execution-layer/shared',
    '@execution-layer/ui',
    '@execution-layer/openapi-form',
  ],
}

module.exports = nextConfig
