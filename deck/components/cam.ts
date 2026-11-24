// The scene camera (World.vue's, shared): a transform for the diagram's <g class="cam"> that centres
// a focus box and scales it up to fill `fill` of the frame. null = the whole diagram.
// transform-origin is the viewBox's top-left (transform-box: view-box), so work relative to it.
export interface Box { x: number; y: number; w: number; h: number }

export function camTransform(vb: Box, f: Box | null, fill = 0.82): string {
  if (!f) return 'translate(0px, 0px) scale(1)'
  const k = Math.min(vb.w / f.w, vb.h / f.h) * fill
  const cx = f.x + f.w / 2, cy = f.y + f.h / 2
  const tx = vb.w / 2 - k * (cx - vb.x), ty = vb.h / 2 - k * (cy - vb.y)
  return `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${k.toFixed(3)})`
}
