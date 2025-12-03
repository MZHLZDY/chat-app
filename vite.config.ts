import vue from '@vitejs/plugin-vue';
import laravel from 'laravel-vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import fs from 'fs';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/js/app.ts'],
            ssr: 'resources/js/ssr.ts',
            refresh: true,
        }),
        tailwindcss(),
        vue({
            template: {
                transformAssetUrls: {
                    base: null,
                    includeAbsolute: false,
                },
            },
        }),
    ],
    // server: {
    //     host: '0.0.0.0',
    //     port: 5173, // biar bisa diakses di hp
    //     strictPort: true,
    //     hmr: {
    //         host: '10.103.196.65', // <-- GANTI DENGAN IP ANDA
    //         protocol: 'ws',
    //     },
    // },  
});