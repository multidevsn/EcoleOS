import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import {VitePWA} from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // On réutilise le manifest déjà présent dans public/manifest.webmanifest plutôt que d'en générer un second.
      manifest: false,
      includeManifestIcons: false,
      workbox: {
        // Seuls les fichiers statiques de l'app (JS, CSS, polices, icônes) sont mis en cache.
        // AUCUNE réponse de /api/... n'est jamais interceptée : notes, paiements, sessions restent
        // toujours demandées au serveur, jamais servies depuis le cache du navigateur.
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'],
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Sécurité : même si un appel /api/ venait à matcher une règle future par erreur,
            // celle-ci force explicitement le réseau et interdit tout cache pour ce chemin.
            urlPattern: /^\/api\//,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  build: {
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
})
