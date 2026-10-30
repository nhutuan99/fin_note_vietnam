<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { MonitorSmartphone } from 'lucide-vue-next'

const { t } = useI18n()
</script>

<template>
  <div>
    <div class="text-text-secondary mb-3 flex items-center gap-2">
      <MonitorSmartphone :size="18" />
      <h3 class="text-sm font-semibold">{{ t('settings.appDownload') }}</h3>
    </div>
    <div class="card-premium p-5">
      <div class="mb-4 border-b border-border-default pb-4">
        <h4 class="mb-1.5 text-sm font-bold text-text-primary">{{ t('settings.pwaInstallTitle') }}</h4>
        <p class="text-text-tertiary text-xs">{{ t('settings.pwaInstallDesc') }}</p>
      </div>
      
      <div class="space-y-4">
        <!-- iOS Guide -->
        <div class="rounded-lg bg-bg-surface p-3 border border-border-subtle">
          <p class="mb-1 text-xs font-semibold text-text-primary">{{ t('settings.pwaIosTarget') }}</p>
          <p class="text-[11px] text-text-tertiary" v-html="t('settings.pwaIosStep')"></p>
        </div>
        
        <!-- Android Guide -->
        <div class="rounded-lg bg-bg-surface p-3 border border-border-subtle">
          <p class="mb-1 text-xs font-semibold text-text-primary">{{ t('settings.pwaAndroidTarget') }}</p>
          <p class="text-[11px] text-text-tertiary" v-html="t('settings.pwaAndroidStep')"></p>
        </div>
        
        <!-- Desktop Guide -->
        <div class="rounded-lg bg-bg-surface p-3 border border-border-subtle">
          <p class="mb-1 text-xs font-semibold text-text-primary">{{ t('settings.pwaDesktopTarget') }}</p>
          <p class="text-[11px] text-text-tertiary" v-html="t('settings.pwaDesktopStep')"></p>
        </div>
      </div>
    </div>
  </div>
</template>
