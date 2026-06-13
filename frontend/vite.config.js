import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            // Precache small static assets only — large GIFs stay in /public and load via runtime cache.
            includeAssets: ['logo/logo.png', 'favicon.ico'],
            manifest: {
                name: 'Niolla Project Management',
                short_name: 'Niolla PM',
                description: 'Project, lead, billing, and team management for NIOLLA Solutions.',
                theme_color: '#FB8C19',
                background_color: '#FAF9F6',
                display: 'standalone',
                orientation: 'portrait-primary',
                scope: '/',
                start_url: '/',
                categories: ['business', 'productivity'],
                icons: [
                    {
                        src: '/logo/logo.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'any',
                    },
                    {
                        src: '/logo/logo.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any',
                    },
                    {
                        src: '/logo/logo.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                ],
                shortcuts: [
                    {
                        name: 'Dashboard',
                        short_name: 'Dashboard',
                        url: '/dashboard',
                        icons: [{ src: '/logo/logo.png', sizes: '192x192' }],
                    },
                    {
                        name: 'Projects',
                        short_name: 'Projects',
                        url: '/projects',
                        icons: [{ src: '/logo/logo.png', sizes: '192x192' }],
                    },
                    {
                        name: 'Notifications',
                        short_name: 'Alerts',
                        url: '/notifications',
                        icons: [{ src: '/logo/logo.png', sizes: '192x192' }],
                    },
                ],
            },
            workbox: {
                // Keep GIFs in public/ for Sidebar & Login — exclude from precache (files can exceed 2 MiB).
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webp}'],
                globIgnores: ['**/*.gif', '**/login/background.png'],
                maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
                navigateFallback: '/index.html',
                navigateFallbackDenylist: [/^\/api/],
                runtimeCaching: [
                    {
                        urlPattern: function (_a) {
                            var url = _a.url;
                            return url.pathname.startsWith('/api/');
                        },
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'niolla-api',
                            networkTimeoutSeconds: 10,
                            expiration: {
                                maxEntries: 80,
                                maxAgeSeconds: 5 * 60,
                            },
                            cacheableResponse: {
                                statuses: [0, 200],
                            },
                        },
                    },
                    {
                        urlPattern: function (_a) {
                            var url = _a.url;
                            return /\.gif$/i.test(url.pathname);
                        },
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'niolla-gifs',
                            expiration: {
                                maxEntries: 12,
                                maxAgeSeconds: 30 * 24 * 60 * 60,
                            },
                            cacheableResponse: {
                                statuses: [0, 200],
                            },
                        },
                    },
                    {
                        urlPattern: function (_a) {
                            var url = _a.url;
                            return url.pathname === '/login/background.png';
                        },
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'niolla-login-assets',
                            expiration: {
                                maxEntries: 4,
                                maxAgeSeconds: 30 * 24 * 60 * 60,
                            },
                        },
                    },
                ],
            },
            devOptions: {
                enabled: true,
                type: 'module',
                // dev-dist has no built assets to precache — suppress workbox glob warning in dev
                suppressWarnings: true,
            },
        }),
    ],
    resolve: {
        alias: { '@': path.resolve(__dirname, './src') },
    },
    server: {
        port: 3000,
        strictPort: true,
        proxy: {
            '/api': { target: 'http://localhost:5000', changeOrigin: true },
        },
    },
});
