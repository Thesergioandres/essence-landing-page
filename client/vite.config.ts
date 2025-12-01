import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { compression } from 'vite-plugin-compression2';

export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    compression({ algorithms: ['gzip'] }),
    compression({ algorithms: ['brotliCompress'] }),
  ],
  build: {
    target: "esnext",
    minify: "esbuild",
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Separar vendors grandes
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            if (id.includes('react-router')) {
              return 'router';
            }
            if (id.includes('axios')) {
              return 'axios';
            }
            return 'vendor';
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 3000,
    open: true,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 3000,
    },
  },
  preview: {
    port: 4173,
    open: true,
  },
});
