import path from "path"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [
    TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // Local UI requests to /api are proxied to the deployed Vercel API.
      // This is convenient for manual testing, but it means local actions can
      // read or mutate remote state. Point this at a local API runner before
      // doing destructive local QA or seed-data experiments.
      "/api": {
        target: "https://wills-app-sage.vercel.app",
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
