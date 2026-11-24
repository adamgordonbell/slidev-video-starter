<script setup lang="ts">
// A screen recording on a slide: <Clip src="r11-dev.mp4" /> plays deck/public/clips/r11-dev.mp4 from its
// start when the slide comes on, and holds its last frame. With at="2" it stays hidden until the
// slide's second click and plays from there, so several clips can share a slide, one per click.
import { computed, ref, watch } from 'vue'
import { useIsSlideActive, useSlideContext } from '@slidev/client'

const props = withDefaults(defineProps<{ src: string; at?: number | string }>(), { at: 0 })
const el = ref<HTMLVideoElement>()
const active = useIsSlideActive()
const { $clicks } = useSlideContext()
const on = computed(() => active.value && $clicks.value >= +props.at)

watch([on, el], () => {
  const v = el.value
  if (!v) return
  if (on.value) {
    v.currentTime = 0
    // when it started, for tools/record-deck.mjs, which steps the video frame by frame itself
    v.dataset.startedAt = String(performance.now())
    v.play().catch(() => {})
  } else {
    v.pause()
    delete v.dataset.startedAt
  }
}, { immediate: true })
</script>

<template>
  <video ref="el" class="clip" :class="{ on }" :src="`/clips/${src}`" muted playsinline preload="auto" />
</template>

<style scoped>
.clip { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; visibility: hidden; }
.clip.on { visibility: visible; }
</style>
