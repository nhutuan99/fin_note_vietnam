import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { setLocale } from '@/i18n'

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior() {
    return { top: 0, behavior: 'smooth' }
  },
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { requiresGuest: true }
    },
    {
      path: '/landing',
      name: 'landing',
      component: () => import('@/views/LandingView.vue'),
      meta: { isPublic: true, requiresGuest: true }
    },
    {
      path: '/onboarding',
      name: 'onboarding',
      component: () => import('@/views/OnboardingView.vue')
    },
    {
      path: '/',
      name: 'dashboard',
      component: () => import('@/views/FinanceDashboardView.vue')
    },
    {
      path: '/transactions',
      name: 'transactions',
      component: () => import('@/views/TransactionsView.vue')
    },
    {
      path: '/transactions/add',
      name: 'add-transaction',
      component: () => import('@/views/AddTransactionView.vue'),
      meta: { parentRoute: '/transactions' }
    },
    {
      path: '/wallets',
      name: 'wallets',
      component: () => import('@/views/WalletsView.vue')
    },
    {
      path: '/recurring',
      name: 'recurring',
      component: () => import('@/views/RecurringView.vue'),
      meta: { parentRoute: '/planning' }
    },
    {
      path: '/budget',
      name: 'budget',
      component: () => import('@/views/BudgetView.vue'),
      meta: { parentRoute: '/planning' }
    },
    {
      path: '/savings',
      name: 'savings',
      component: () => import('@/views/SavingsView.vue'),
      meta: { parentRoute: '/planning' }
    },
    {
      path: '/subscriptions',
      name: 'subscriptions',
      component: () => import('@/views/SubscriptionsView.vue'),
      meta: { parentRoute: '/planning' }
    },
    {
      path: '/debts',
      name: 'debts',
      component: () => import('@/views/DebtView.vue'),
      meta: { parentRoute: '/planning' }
    },
    {
      path: '/planning',
      name: 'planning',
      component: () => import('@/views/PlanningHubView.vue')
    },
    {
      path: '/reminders',
      name: 'reminders',
      component: () => import('@/views/RemindersView.vue'),
      meta: { parentRoute: '/planning' }
    },
    {
      path: '/stocks',
      name: 'stocks',
      component: () => import('@/views/StocksView.vue'),
      meta: { parentRoute: '/planning' }
    },
    {
      path: '/trading',
      name: 'trading',
      component: () => import('@/views/TradingView.vue'),
      meta: { parentRoute: '/' }
    },
    {
      path: '/ai-todo',
      name: 'ai-todo',
      component: () => import('@/views/AiTodoView.vue'),
      meta: { parentRoute: '/planning' }
    },
    {
      path: '/notes',
      name: 'notes',
      component: () => import('@/views/NotesView.vue')
    },
    {
      path: '/notes/:id',
      name: 'note-detail',
      component: () => import('@/views/NoteDetailView.vue'),
      meta: { parentRoute: '/notes' }
    },
    {
      path: '/notes/shared/:id',
      name: 'shared-note',
      component: () => import('@/views/SharedNoteView.vue'),
      meta: { isPublic: true }
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue')
    },
    {
      path: '/auto-sync',
      name: 'auto-sync',
      component: () => import('@/views/AutoSyncView.vue')
    },
    {
      path: '/blog',
      name: 'blog-list',
      component: () => import('@/views/BlogListView.vue'),
      meta: { isPublic: true }
    },
    {
      path: '/blog/:slug',
      name: 'blog-detail',
      component: () => import('@/views/BlogDetailView.vue'),
      meta: { isPublic: true, parentRoute: '/blog' }
    },
    {
      path: '/admin/blog',
      name: 'admin-blog',
      component: () => import('@/views/AdminBlogView.vue'),
      meta: { parentRoute: '/' }
    },
    {
      path: '/otp-hub',
      name: 'otp-hub',
      component: () => import('@/views/OtpHubView.vue'),
      meta: { isPublic: true }
    },
    {
      // Locale-prefixed landing: /en → set EN locale then go to /landing
      path: '/en',
      name: 'landing-en',
      redirect: () => {
        setLocale('en')
        return { path: '/landing' }
      },
      meta: { isPublic: true }
    },
    {
      // Locale-prefixed landing: /vi → set VI locale then go to /landing
      path: '/vi',
      name: 'landing-vi',
      redirect: () => {
        setLocale('vi')
        return { path: '/landing' }
      },
      meta: { isPublic: true }
    }
  ]
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  // Guest-only pages (login): redirect authenticated users to dashboard
  if (to.meta.requiresGuest && auth.isAuthenticated) {
    // Allow Google OAuth callback to hit /login even if there is a stale token
    if (to.path === '/login' && to.query.code && to.query.state) {
      return
    }
    return { path: '/', replace: true }
  }

  // Protected pages: redirect unauthenticated users to login
  if (!to.meta.requiresGuest && !to.meta.isPublic && to.path !== '/login') {
    if (!auth.isAuthenticated) {
      return { path: '/landing', replace: true }
    }
    // Check if the guest session has expired (7 days)
    if (auth.isGuest && auth.checkGuestExpiry()) {
      return { path: '/login', query: { expired: '1' }, replace: true }
    }
  }

  // Onboarding: redirect first-time authenticated users
  const onboardingDone = auth.user?.hasCompletedOnboarding === true || localStorage.getItem('finnote_onboarding_completed') === 'true'
  
  if (auth.isAuthenticated && !onboardingDone && to.path !== '/onboarding' && to.path !== '/login') {
    return { path: '/onboarding', replace: true }
  }

  // Prevent accessing onboarding if already done
  if (auth.isAuthenticated && onboardingDone && to.path === '/onboarding') {
    return { path: '/', replace: true }
  }
})

export default router
