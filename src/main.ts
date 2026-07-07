import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import i18n from './i18n'
import App from './App.vue'
import { createHead } from '@unhead/vue/client'
import { setHttpClientRouter } from './shared/api/httpClient'
import './assets/styles/base.css'
import 'highlight.js/styles/atom-one-dark.css'

import AppSpinner from '@/components/ui/AppSpinner.vue'

const app = createApp(App)
app.component('AppSpinner', AppSpinner)

app.use(createPinia())
app.use(router)
app.use(i18n)
app.use(createHead())

// Give httpClient access to Vue Router for SPA-safe 401 redirects
setHttpClientRouter(router)

// Wait for router to be ready before mounting to avoid initial layout flashes/routing glitches on reload
router.isReady().then(() => {
  app.mount('#app')

  // Fade out the PWA splash screen after Vue has mounted
  setTimeout(() => {
    ;(window as any).__removeSplash?.()
  }, 800)
})

