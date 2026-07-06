<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Facebook, Twitter, Linkedin, Link, Check } from 'lucide-vue-next'

const props = defineProps<{
  url: string
  title: string
  description?: string
  shareLabel?: string
}>()

const shareLabel = props.shareLabel || 'Share'

const { t } = useI18n()

const copied = ref(false)

function copyLink() {
  navigator.clipboard.writeText(props.url)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

function shareFacebook() {
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(props.url)}`, '_blank', 'width=600,height=400')
}

function shareTwitter() {
  const text = encodeURIComponent(`${props.title}\n${props.description ? props.description + '\n' : ''}`)
  window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(props.url)}&text=${text}`, '_blank', 'width=600,height=400')
}

function shareLinkedin() {
  window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(props.url)}`, '_blank', 'width=600,height=400')
}
</script>

<template>
  <div class="flex items-center gap-2">
    <span class="text-sm font-medium text-text-secondary mr-2">{{ shareLabel }}:</span>
    <button 
      @click="shareFacebook" 
      class="flex h-8 w-8 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30"
      :title="t('common.shareOnFacebook')"
    >
      <Facebook :size="16" />
    </button>
    <button 
      @click="shareTwitter" 
      class="flex h-8 w-8 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-sky-50 hover:text-sky-500 dark:hover:bg-sky-900/30"
      :title="t('common.shareOnTwitter')"
    >
      <Twitter :size="16" />
    </button>
    <button 
      @click="shareLinkedin" 
      class="flex h-8 w-8 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/30"
      :title="t('common.shareOnLinkedIn')"
    >
      <Linkedin :size="16" />
    </button>
    
    <div class="w-px h-4 bg-border-default mx-1"></div>
    
    <button 
      @click="copyLink" 
      class="flex h-8 w-8 items-center justify-center rounded-full text-text-tertiary transition-colors"
      :class="copied ? 'text-green-500 bg-green-50 dark:bg-green-900/20' : 'hover:bg-bg-hover'"
      :title="copied ? t('common.copiedTitle') : t('common.copyLinkTitle')"
    >
      <Check v-if="copied" :size="16" />
      <Link v-else :size="16" />
    </button>
  </div>
</template>
