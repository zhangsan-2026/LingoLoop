import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa'; // 引入 PWA 插件

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      // 1. 基础路径配置：确保在 GitHub Pages 子目录下正常运行
      base: '/LingoLoop/', 

      server: {
        port: 3000,
        host: '0.0.0.0',
      },

      plugins: [
        react(),
        // 2. PWA 离线支持深度配置
        VitePWA({
          registerType: 'autoUpdate', 
          includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
          manifest: {
            name: 'LingoLoop Player',
            short_name: 'LingoLoop',
            description: '离线视频播放器',
            theme_color: '#ffffff',
            icons: [
              {
                src: 'pwa-192x192.png',
                sizes: '192x192',
                type: 'image/png'
              },
              {
                src: 'pwa-512x512.png',
                sizes: '512x512',
                type: 'image/png'
              }
            ]
          },
          workbox: {
            // 核心 1：缓存所有静态资源，包含 Vite 混淆后的 CSS 和 JS
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
            
            // 核心 2：确保新版缓存立即生效，不等待浏览器重启
            clientsClaim: true,
            skipWaiting: true,

            // 核心 3：清理旧缓存，解决 UI 布局随机乱掉的问题
            cleanupOutdatedCaches: true,

            // 核心 4：离线导航回退，确保刷新页面不报 404
            navigateFallback: 'index.html',

            // 核心 5：第三方资源（如字体、外部样式）的手动强制缓存
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365 // 缓存一年
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              }
            ]
          }
        })
      ],

      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },

      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
