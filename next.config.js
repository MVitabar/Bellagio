/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  headers: async () => {
    return [
      {
        source: '/OneSignalSDKWorker.js',
        headers: [
          {
            key: 'Service-Worker-Allowed',
            value: '/'
          }
        ]
      }
    ]
  }
}

module.exports = {
  webpack: (config, { isServer }) => {
    // Add optimization settings
    config.optimization = {
      ...config.optimization,
      minimize: true
    }
    return config
  }
}
module.exports = nextConfig