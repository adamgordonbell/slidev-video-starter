<script setup lang="ts">
// A boxes-and-arrows diagram that builds up click by click, with a camera that pushes in on
// whatever changed at each step (cam.ts, from the Temporal deck) and pulls back out after.
//
//   nodes   [{ id, x, y, w, h, label, sub?, icon?, at?, ok?, fail?, held?, note? }]
//           at   = the step the node appears on (default 0)
//           ok / fail / held = the step it turns ✓ blue / ✕ orange / ⏸ violet (glyph + colour,
//           never colour alone); it flashes on that step. The latest one reached shows.
//   edges   [{ from, to, at? }] — drawn on the later of `at` and both ends appearing
//   focus   per step: node ids to frame, or null for the whole diagram
//   step    usually $clicks
//   safe    the part of the frame (fractions of the viewBox) the camera frames into: the default keeps
//           clear of a head PiP in the bottom-right corner. Every step, null included, fits inside it.
import { computed } from 'vue'
import type { Box } from './cam'

interface N {
  id: string; x: number; y: number; w: number; h: number
  label: string; sub?: string; icon?: string; note?: boolean
  at?: number; ok?: number; fail?: number; held?: number
}
interface E { from: string; to: string; at?: number }

const props = withDefaults(
  defineProps<{ nodes: N[]; edges?: E[]; focus?: (string[] | null)[]; step: number; vb?: Box; fill?: number; guard?: number; safe?: Box }>(),
  { edges: () => [], focus: () => [], vb: () => ({ x: 0, y: 0, w: 1600, h: 640 }), fill: 0.8, guard: -1,
    safe: () => ({ x: 0.02, y: 0.06, w: 0.74, h: 0.64 }) },
)

const byId = computed(() => Object.fromEntries(props.nodes.map(n => [n.id, n])))
const shown = (n: N) => props.step >= (n.at ?? 0)
const reached = (s?: number) => s !== undefined && props.step >= s
// the latest state reached wins (held at 5 then ok at 7 reads ✓ from 7); on a tie, fail > held > ok
function state(n: N) {
  let best = '', at = -1
  for (const k of ['ok', 'held', 'fail'] as const) {
    const s = n[k]
    if (s !== undefined && props.step >= s && s >= at) { best = k; at = s }
  }
  return best
}
const glyph = { ok: '✓', fail: '✕', held: '⏸' } as Record<string, string>
const flashing = (n: N) => [n.at, n.ok, n.fail, n.held].includes(props.step) && props.step > 0

function edgeShown(e: E) {
  const a = byId.value[e.from], b = byId.value[e.to]
  return a && b && shown(a) && shown(b) && props.step >= (e.at ?? 0)
}
function edgePath(e: E) {
  const a = byId.value[e.from], b = byId.value[e.to]
  const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2
  const mx = (x1 + x2) / 2
  return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2 - 6},${y2}`
}

const all = computed(() => {
  const x = Math.min(...props.nodes.map(n => n.x)), y = Math.min(...props.nodes.map(n => n.y))
  return { x, y, w: Math.max(...props.nodes.map(n => n.x + n.w)) - x, h: Math.max(...props.nodes.map(n => n.y + n.h)) - y }
})
const cam = computed(() => {
  const f = props.focus[Math.min(props.step, props.focus.length - 1)] ?? null
  const ids = f && f.length ? f : props.nodes.map(n => n.id)
  const ns = ids.map(id => byId.value[id]).filter(Boolean)
  const pad = props.guard >= 0 ? 70 : 40
  const x = Math.min(...ns.map(n => n.x)) - pad, y = Math.min(...ns.map(n => n.y)) - pad
  const w = Math.max(...ns.map(n => n.x + n.w)) + pad - x, h = Math.max(...ns.map(n => n.y + n.h)) + pad - y
  // fit the box into the safe area (whole diagram: as large as fits; a focus: `fill` of it), centred there
  const vb = props.vb, sf = props.safe
  const sw = vb.w * sf.w, sh = vb.h * sf.h
  const k = Math.min(sw / w, sh / h) * (f && f.length ? props.fill : 1)
  const cx = vb.w * (sf.x + sf.w / 2), cy = vb.h * (sf.y + sf.h / 2)
  const tx = cx - k * (x + w / 2 - vb.x), ty = cy - k * (y + h / 2 - vb.y)
  return `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${k.toFixed(3)})`
})
</script>

<template>
  <svg class="flow" :viewBox="`${vb.x} ${vb.y} ${vb.w} ${vb.h}`">
    <defs>
      <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="#8b7fd6" />
      </marker>
    </defs>
    <g class="cam" :style="{ transform: cam }">
      <rect v-if="guard >= 0" class="guard-box" :class="{ on: step >= guard }" :x="all.x - 30" :y="all.y - 30" :width="all.w + 60" :height="all.h + 60" rx="34" />
      <path v-for="(e, i) in edges" :key="'e' + i" class="edge" :class="{ on: edgeShown(e) }" :d="edgePath(e)" marker-end="url(#arrow)" pathLength="1" />
      <g v-for="n in nodes" :key="n.id" class="node" :class="[state(n), { on: shown(n), note: n.note, flash: flashing(n) }]"
         :style="{ transformOrigin: `${n.x + n.w / 2}px ${n.y + n.h / 2}px` }">
        <rect :x="n.x" :y="n.y" :width="n.w" :height="n.h" rx="20" />
        <text class="lbl" :x="n.x + n.w / 2" :y="n.y + n.h / 2 + (n.sub ? -6 : 10)" text-anchor="middle">
          <tspan v-if="n.icon">{{ n.icon }} </tspan>{{ n.label }}
        </text>
        <text v-if="n.sub" class="sub" :x="n.x + n.w / 2" :y="n.y + n.h / 2 + 30" text-anchor="middle">{{ n.sub }}</text>
        <g v-if="state(n)" class="mark">
          <circle :cx="n.x + n.w - 6" :cy="n.y + 6" r="22" />
          <text :x="n.x + n.w - 6" :y="n.y + 15" text-anchor="middle">{{ glyph[state(n)] }}</text>
        </g>
      </g>
    </g>
  </svg>
</template>

<style scoped>
.flow { width: 100%; height: 100%; overflow: hidden; }
.cam { transform-box: view-box; transform-origin: 0 0; transition: transform 1s cubic-bezier(.65, 0, .35, 1); }
/* opacity as well as the dash: an arrowhead is drawn even when its line is dashed away */
.edge { fill: none; stroke: #8b7fd6; stroke-width: 5; stroke-dasharray: 1; stroke-dashoffset: 1; opacity: 0; transition: stroke-dashoffset .6s ease-out .15s, opacity .2s ease-out .15s; }
.edge.on { stroke-dashoffset: 0; opacity: 1; }
.node { opacity: 0; transform: scale(.6); transition: opacity .35s ease-out, transform .5s cubic-bezier(.34, 1.56, .64, 1); }
.node.on { opacity: 1; transform: scale(1); }
.node rect { fill: #2e2648; stroke: #492e8e; stroke-width: 4; transition: stroke .4s, fill .4s; }
.node.note rect { fill: #392960; stroke: #a697fc; stroke-dasharray: 10 8; }
.lbl { fill: #fafafa; font: 600 38px Inter, sans-serif; }
.sub { fill: #b9b6c8; font: 600 24px Inter, sans-serif; }
.node.ok rect { stroke: #5fa8ff; fill: #1f2c4a; }
.node.fail rect { stroke: #fb923c; fill: #4a2a1a; }
.node.held rect { stroke: #c3bdff; fill: #392960; }
.mark circle { stroke: #231f33; stroke-width: 5; }
.mark text { font: 700 28px Inter, sans-serif; fill: #231f33; }
.ok .mark circle { fill: #5fa8ff; }
.fail .mark circle { fill: #fb923c; }
.held .mark circle { fill: #c3bdff; }
.flash rect { animation: flash .9s ease-out; }
@keyframes flash { 0% { stroke-width: 4; } 25% { stroke-width: 14; filter: brightness(1.6); } 100% { stroke-width: 4; } }
.guard-box { fill: transparent; stroke: transparent; stroke-width: 6; transition: stroke .6s, fill .6s; }
.guard-box.on { stroke: #a697fc; fill: rgba(57, 41, 96, .35); }
</style>
