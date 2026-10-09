import fs from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

type FirebaseWebConfig = {
  apiKey: string
  authDomain: string
  projectId: string
  messagingSenderId: string
  appId: string
}

function firebaseSwConfigSource(config: FirebaseWebConfig): string {
  return `/* Generated at build/dev time — do not edit by hand */\nself.__FIREBASE_CONFIG__ = ${JSON.stringify(config)};\n`
}

/** Emit firebase-sw-config.js so the Workbox SW can initialize FCM. */
function firebaseSwConfigPlugin(getConfig: () => FirebaseWebConfig): Plugin {
  return {
    name: 'firebase-sw-config',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/firebase-sw-config.js')) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
          res.end(firebaseSwConfigSource(getConfig()))
          return
        }
        next()
      })
    },
    writeBundle(outputOptions) {
      const dir = outputOptions.dir
      if (!dir) return
      fs.writeFileSync(
        path.join(dir, 'firebase-sw-config.js'),
        firebaseSwConfigSource(getConfig()),
        'utf8',
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const firebaseConfig = (): FirebaseWebConfig => ({
    apiKey: env.VITE_FIREBASE_API_KEY ?? '',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: env.VITE_FIREBASE_PROJECT_ID ?? '',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: env.VITE_FIREBASE_APP_ID ?? '',
  })

  return {
    build: {
      chunkSizeWarningLimit: 2200,
    },
    plugins: [
      react(),
      firebaseSwConfigPlugin(firebaseConfig),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.svg',
          'apple-touch-icon.png',
          'sw-messages.js',
          'firebase-push.js',
          'firebase-messaging-sw.js',
        ],
        manifest: {
          name: 'MyExpense',
          short_name: 'MyExpense',
          description: 'Offline-first personal expense tracker',
          theme_color: '#3880ff',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          icons: [
            {
              src: 'icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'icons/maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          navigateFallback: 'index.html',
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          // Order matters: config → Firebase push → sync helpers
          importScripts: [
            'firebase-sw-config.js',
            'firebase-push.js',
            'sw-messages.js',
          ],
          runtimeCaching: [
            {
              urlPattern: ({ url }) =>
                url.hostname.endsWith('supabase.co') &&
                url.pathname.includes('/rest/v1/'),
              handler: 'NetworkFirst',
              method: 'GET',
              options: {
                cacheName: 'supabase-rest-get',
                networkTimeoutSeconds: 8,
                expiration: {
                  maxEntries: 64,
                  maxAgeSeconds: 60 * 60 * 24,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
  }
})
