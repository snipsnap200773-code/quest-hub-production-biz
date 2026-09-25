import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // ⚠️ 2026/09/25【BR②】：autoUpdate → prompt。新しい版が届いたら、
      //    PwaUpdateBanner の「更新する」を押したときだけ切り替える（入力途中の内容を消さないため）。
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      // 👇 ここから追加！
      devOptions: {
        enabled: true
      },
      // 👆 ここまで
      manifest: {
        name: 'QUEST HUB Biz',
        short_name: 'QH Biz',
        description: '総合予約サイト',
        theme_color: '#00b900',
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
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
});