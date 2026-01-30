import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa'; // 引入 PWA 插件

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      // 1. 基础路径配置
      base: '/LingoLoop/', 

      server: {
        port: 3000,
        host: '0.0.0.0',
      },

      plugins: [
        react(),
        // 2. PWA 离线支持配置
        VitePWA({
          registerType: 'autoUpdate', // 自动更新缓存
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
            // 核心：缓存所有的 JS, CSS, HTML 和静态资源
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
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
