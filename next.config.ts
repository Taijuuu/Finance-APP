import type { NextConfig } from 'next'
import withPWAInit from '@ducanh2912/next-pwa'

const withPWA = withPWAInit({
  dest: 'public',
  // Ne PAS mettre en cache les navigations : les pages contiennent des données
  // utilisateur (dépenses, transactions) qui doivent toujours être fraîches.
  // Sinon chaque appareil affiche un instantané périmé et différent des autres.
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    disableDevLogs: true,
    // Activer immédiatement chaque nouvelle version du service worker et purger
    // les anciens caches, pour éviter que les appareils restent bloqués sur une
    // version périmée après un déploiement.
    skipWaiting: true,
    clientsClaim: true,
    cleanupOutdatedCaches: true,
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
        handler: 'NetworkOnly',
      },
    ],
  },
})

const nextConfig: NextConfig = {
  turbopack: {},
}

export default withPWA(nextConfig)
