import { defineConfig } from 'vite'

export default defineConfig(({}) => ({
    // Use BASE env if provided, otherwise root
    base: process.env.BASE ?? '/',
}))
