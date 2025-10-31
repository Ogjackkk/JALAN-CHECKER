import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Jalan Web React System',
        short_name: 'JalanWeb',
        description: 'Progressive Web App for Jalan Web React System',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/src/assets/react.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: '/src/assets/react.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
          {
            urlPattern: /^\/src\/img\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-assets',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          {
            urlPattern: /^\/src\/components\/st-home\.jsx$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'st-home-component',
              expiration: {
                maxEntries: 1,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
            },
          },
          {
            urlPattern: /^\/st-home/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'st-home-route',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
            },
          },
          {
            urlPattern: /^\/src\/components\/st-gradeReport\.jsx$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'st-gradeReport-component',
              expiration: {
                maxEntries: 1,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
            },
          },
          {
            urlPattern: /^\/st-gradeReport/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'st-gradeReport-route',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
            },
          },
          {
            urlPattern: /^\/src\/components\/admin\.jsx$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'admin-component',
              expiration: {
                maxEntries: 1,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
            },
          },
          {
            urlPattern: /^\/admin-home/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'admin-route',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
            },
          },
        ],
      },
    })
  ],
})
