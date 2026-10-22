// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  future: {
    compatibilityVersion: 4,
  },
  devServer: { 
    port: 8540,
  },
  modules: ['@nuxt/ui'],
  // Fonts are self-hosted from public/fonts; keep @nuxt/fonts from fetching any.
  ui: {
    fonts: false,
  },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: "Conway's Game of Life",
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: "Conway's Game of Life simulation with Three.js" },
      ],
      link: [
        {
          rel: 'icon',
          type: 'image/svg+xml',
          href: '/favicon.svg',
        },
        {
          rel: 'icon',
          type: 'image/png',
          href: '/favicon.png',
        },
        {
          rel: 'shortcut icon',
          href: '/favicon.png',
        },
        {
          rel: 'stylesheet',
          href: '/fonts/fonts.css',
        },
      ],
      script: [
        { src: 'https://tools.atlesque.dev/consent.js', defer: true },
      ],
    },
  },
})
