import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron/simple'
import { resolve } from 'path'
import { rmSync } from 'fs'

// 读取 package.json 依赖
import pkg from './package.json' assert { type: 'json' }

export default defineConfig(({ command }) => {
  rmSync('dist-electron', { recursive: true, force: true })

  const isServe = command === 'serve'
  const isBuild = command === 'build'
  const sourcemap = isServe

  return {
    plugins: [
      vue(),
      electron({
        main: {
          entry: 'src/main/index.ts',
          onstart({ startup }) {
            startup()
          },
          vite: {
            build: {
              sourcemap,
              minify: isBuild,
              outDir: 'dist-electron/main',
              lib: {
                entry: 'src/main/index.ts',
                formats: ['cjs'],
                fileName: () => 'index.js'
              },
              rollupOptions: {
                external: ['electron', ...Object.keys(pkg.dependencies || {})]
              }
            }
          }
        },
        preload: {
          input: 'src/main/preload.ts',
          vite: {
            build: {
              sourcemap: sourcemap ? 'inline' : undefined,
              minify: isBuild,
              outDir: 'dist-electron/preload',
              lib: {
                entry: 'src/main/preload.ts',
                formats: ['cjs'],
                fileName: () => 'preload.js'
              },
              rollupOptions: {
                external: ['electron']
              }
            }
          }
        },
        renderer: {}
      })
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer'),
        '@main': resolve(__dirname, 'src/main')
      }
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true
    },
    clearScreen: false
  }
})
