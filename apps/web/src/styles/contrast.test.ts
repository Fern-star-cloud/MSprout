import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const source = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')
const colors = Object.fromEntries([...source.matchAll(/--color-([\w-]+):\s*(#[\da-f]{6})/gi)].map(match => [match[1], match[2]]))
function luminance(hex: string) {
  const channels = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722
}
function contrast(first: string, second: string) {
  const values = [luminance(colors[first]), luminance(colors[second])].sort((a, b) => b - a)
  return (values[0] + .05) / (values[1] + .05)
}

it('measures normal text, semantic feedback and filled actions at WCAG AA contrast', () => {
  for (const [foreground, background] of [
    ['ink', 'surface'], ['ink', 'canvas'], ['muted', 'surface'], ['muted', 'canvas'],
    ['surface', 'navy'], ['surface', 'brand'], ['surface', 'brand-strong'], ['surface', 'danger'],
    ['brand', 'brand-soft'], ['success', 'success-soft'], ['warning-ink', 'warning-soft'], ['danger', 'danger-soft'], ['neutral', 'neutral-soft'],
  ]) expect(contrast(foreground, background), `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5)
})

it('measures interactive boundaries and focus against their adjacent surfaces', () => {
  for (const [foreground, background] of [['control-border', 'surface'], ['control-border', 'canvas'], ['focus', 'surface'], ['focus', 'canvas'], ['focus', 'brand-soft']]) {
    expect(contrast(foreground, background), `${foreground} on ${background}`).toBeGreaterThanOrEqual(3)
  }
})
