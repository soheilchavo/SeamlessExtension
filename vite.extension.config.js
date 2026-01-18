import { defineConfig } from 'vite';
import { resolve } from 'path';

// Build configuration for bundling the extension
export default defineConfig({
    build: {
        outDir: 'extension/dist',
        rollupOptions: {
            input: {
                sidepanel: resolve(__dirname, 'extension/sidepanel.js'),
                saved: resolve(__dirname, 'extension/saved.js'),
                profile: resolve(__dirname, 'extension/profile.js')
            },
            output: {
                entryFileNames: '[name].bundle.js',
                format: 'es'
            }
        }
    }
});
