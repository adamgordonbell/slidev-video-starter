<script setup lang="ts">
// The loop delivery pipeline (delivery/index.ts) drawn with Flow, two ways from one set of nodes:
//   build — appears stage by stage as it's described, the camera following the newest stage,
//           pulling back to the whole pipeline on the last step
//   run   — release 11: dev ✓, staging ✕, then (step 1) prod held ⏸ and the guard lights up
//   release — release 12, one stage per step: merge ✓ (1), dev ✓ (3), staging ✓ (4), held at
//           approve ⏸ (5), approved ✓ (7), both prod regions ✓ (8); the whole pipeline in view
import { computed } from 'vue'
import Flow from './Flow.vue'

const props = defineProps<{ mode: 'build' | 'run' | 'release'; step: number; vb?: { x: number; y: number; w: number; h: number }; safe?: { x: number; y: number; w: number; h: number } }>()

const Y = 260, H = 120
const base = [
  { id: 'merge', x: 20, y: Y, w: 180, h: H, label: 'merge', sub: 'a release' },
  { id: 'dev', x: 250, y: Y, w: 170, h: H, label: 'dev', sub: 'deploy' },
  { id: 'smoke1', x: 470, y: Y, w: 170, h: H, label: 'smoke', sub: 'test' },
  { id: 'staging', x: 690, y: Y, w: 190, h: H, label: 'staging', sub: 'deploy' },
  { id: 'smoke2', x: 930, y: Y, w: 170, h: H, label: 'smoke', sub: 'test' },
  { id: 'approve', x: 1150, y: Y, w: 190, h: H, label: 'approve', sub: 'a person' },
  { id: 'us', x: 1400, y: 160, w: 180, h: 110, label: 'prod', sub: 'us' },
  { id: 'eu', x: 1400, y: 370, w: 180, h: 110, label: 'prod', sub: 'eu' },
]
const edges = [
  { from: 'merge', to: 'dev' }, { from: 'dev', to: 'smoke1' }, { from: 'smoke1', to: 'staging' },
  { from: 'staging', to: 'smoke2' }, { from: 'smoke2', to: 'approve' },
  { from: 'approve', to: 'us' }, { from: 'approve', to: 'eu' },
]

const build = {
  nodes: base.map((n, i) => ({ ...n, at: Math.min(i, 6) })),
  focus: [['merge'], ['merge', 'dev'], ['dev', 'smoke1'], ['smoke1', 'staging'], ['staging', 'smoke2'],
    ['smoke2', 'approve'], ['approve', 'us', 'eu'], null],
}
const run = {
  nodes: base.map(n => ({
    ...n,
    ...(['merge', 'dev', 'smoke1'].includes(n.id) ? { ok: 0 } : {}),
    ...(n.id === 'staging' ? { fail: 0 } : {}),
    ...(['approve', 'us', 'eu'].includes(n.id) ? { held: 1 } : {}),
  })),
  focus: [['dev', 'smoke1', 'staging', 'smoke2'], null],
}
const at: Record<string, { ok?: number; held?: number }> = {
  merge: { ok: 1 }, dev: { ok: 3 }, smoke1: { ok: 3 }, staging: { ok: 4 }, smoke2: { ok: 4 },
  approve: { held: 5, ok: 7 }, us: { ok: 8 }, eu: { ok: 8 },
}
const release = { nodes: base.map(n => ({ ...n, ...at[n.id] })), focus: [null] }
const cfg = computed(() => (props.mode === 'build' ? build : props.mode === 'run' ? run : release))
</script>

<template>
  <Flow :nodes="cfg.nodes" :edges="edges" :focus="cfg.focus" :step="step" :guard="mode === 'run' ? 1 : -1" :fill="0.78"
    v-bind="{ ...(vb ? { vb } : {}), ...(safe ? { safe } : {}) }" />
</template>
