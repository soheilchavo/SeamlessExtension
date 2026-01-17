import { defineConfig } from 'vite';
import { resolve } from 'path';

// Build configuration for bundling the extension
export default defineConfig({
    build: {
        outDir: 'extension/dist',
        lib: {
            entry: resolve(__dirname, 'extension/sidepanel.js'),
            name: 'SeamlessSidepanel',
            fileName: 'sidepanel.bundle',
            formats: ['es']
        },
        rollupOptions: {
            output: {
                entryFileNames: 'sidepanel.bundle.js'
            }
        }
    }
});
