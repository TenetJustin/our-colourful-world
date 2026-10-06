import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/our-colourful-world/',
  plugins: [react()],
})
