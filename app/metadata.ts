import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Comandero',
  description: 'Restaurant Management App',
  manifest: '/manifest.webmanifest',
  themeColor: '#000000',
  icons: [
    { rel: 'icon', url: '/icons/icon-192x192.png' },
    { rel: 'apple-touch-icon', url: '/icons/icon-512x512.png' }
  ],
  applicationName: 'Comandero',
  appleWebApp: {
    capable: true,
    title: 'Comandero',
    statusBarStyle: 'black'
  }
}