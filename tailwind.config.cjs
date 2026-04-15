/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/renderer/**/*.{vue,js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // Primary colors
        'terminal-green': '#00FF88',
        'cyber-cyan': '#00D4FF',
        'neon-purple': '#BD00FF',
        'warning-orange': '#FF9500',
        'error-red': '#FF3B5C',
        // Background colors
        'deep-black': '#0D0D0D',
        'terminal-dark': '#141414',
        'panel-gray': '#1A1A1A',
        'border-dark': '#2A2A2A',
        'hover-gray': '#333333',
        // Text colors
        'text-primary': '#E0E0E0',
        'text-secondary': '#888888',
        'text-placeholder': '#555555'
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'Fira Code', 'Source Code Pro', 'Consolas', 'monospace'],
        'heading': ['Orbitron', 'Rajdhani', 'Share Tech Mono', 'sans-serif'],
        'chinese': ['PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', 'sans-serif']
      },
      boxShadow: {
        'glow-green': '0 0 10px rgba(0, 255, 136, 0.5)',
        'glow-cyan': '0 0 10px rgba(0, 212, 255, 0.5)',
        'glow-purple': '0 0 10px rgba(189, 0, 255, 0.5)'
      },
      animation: {
        'cursor-blink': 'cursor-blink 1s infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'scanline': 'scanline 2s linear infinite'
      },
      keyframes: {
        'cursor-blink': {
          '0%, 50%': { opacity: '1' },
          '51%, 100%': { opacity: '0' }
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(0, 255, 136, 0.5)' },
          '50%': { boxShadow: '0 0 20px rgba(0, 255, 136, 0.8)' }
        },
        'scanline': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' }
        }
      }
    }
  },
  plugins: []
}
