import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

const APP_VERSION = '0.8.0'
const BUILD_ID = `${APP_VERSION}-${Date.now().toString(36)}`

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Heatz Auto - Simulador de Motores',
        short_name: 'Heatz Auto',
        description: 'Simulador realista de motores veiculares',
        theme_color: '#0a0a0b',
        background_color: '#0a0a0b',
        display: 'standalone',
        orientation: 'landscape',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,ogg,mp3,wav}'],
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Configurações JSON de veículos: NetworkFirst garante dados atualizados
            urlPattern: /\/vehicles\/.*\.json$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'vehicle-configs',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
          {
            // Arquivos de mídia de veículos: CacheFirst para economia de banda
            urlPattern: /\/vehicles\/.*\.(ogg|mp3|wav|png|jpg|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'vehicle-media',
              expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
