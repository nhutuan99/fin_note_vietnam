<script setup lang="ts">
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { X } from 'lucide-vue-next'

defineProps(nodeViewProps)
</script>

<template>
  <node-view-wrapper as="span" class="custom-image-wrapper" :class="{ 'is-selected': selected }">
    <img :src="node.attrs.src" :alt="node.attrs.alt" :title="node.attrs.title" />
    
    <!-- Remove button -->
    <button 
      v-if="editor.isEditable"
      class="image-remove-btn" 
      @click.stop="deleteNode"
      title="Remove Image"
    >
      <X :size="14" />
    </button>
  </node-view-wrapper>
</template>

<style scoped>
.custom-image-wrapper {
  position: relative;
  display: inline-block;
  line-height: 0;
  margin: 0;
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  border: 1px solid var(--border-default);
}

.custom-image-wrapper:hover {
  transform: scale(1.02);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
  z-index: 5;
}

.custom-image-wrapper::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: white;
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.custom-image-wrapper:hover::after {
  opacity: 0.05;
}

.custom-image-wrapper img {
  max-width: 100%;
  display: block;
  cursor: pointer;
  transition: opacity 0.2s, outline 0.2s;
  background-color: var(--bg-surface);
}
.custom-image-wrapper.is-selected img {
  outline: 2px solid var(--accent);
}

.image-remove-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.65);
  color: white;
  border: none;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s, background 0.2s, transform 0.1s;
  backdrop-filter: blur(4px);
  z-index: 10;
}
.custom-image-wrapper:hover .image-remove-btn {
  opacity: 1;
}
.image-remove-btn:hover {
  background: var(--error);
  transform: scale(1.1);
}
.image-remove-btn:active {
  transform: scale(0.95);
}

/* Ensure mobile users can always see the remove button or tap to see it */
@media (hover: none) {
  .image-remove-btn {
    opacity: 0.8;
  }
}
</style>
