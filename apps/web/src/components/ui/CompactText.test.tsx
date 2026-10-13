// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { ChurchName, CompactText } from './CompactText'
import { compactLabel } from './compact-label'
import { Brand } from './Brand'

afterEach(cleanup)
it('bounds compact display to 50 code points without changing exact-50 or stored strings', () => {
  const exact = 'Church '.padEnd(50, 'A'), long = exact + ' extra complete name'
  expect(compactLabel(exact)).toBe(exact)
  expect(Array.from(compactLabel(long))).toHaveLength(50)
  expect(compactLabel(long)).toBe(long.slice(0,49) + '…')
  expect(long).toBe(exact + ' extra complete name')
  expect(compactLabel('🌱'.repeat(60))).toBe('🌱'.repeat(49) + '…')
})
it('keeps full long values available to assistive text, titles and keyboard-expanded church context', () => {
  const value = 'UnbrokenChurchName'.repeat(8)
  const { container } = render(<ChurchName value={value} />)
  expect(screen.getByText(value).className).toBe('sr-only')
  expect(container.querySelector('.compact-text')?.getAttribute('title')).toBe(value)
  const summary = container.querySelector('summary')!
  expect(summary.getAttribute('aria-label')).toBe(`Church name: ${value}`)
  const details = container.querySelector('details')!
  details.open = true
  fireEvent(details, new Event('toggle'))
  expect(container.querySelector('.church-name-expanded')?.textContent).toBe(value)
})
it('does not duplicate short readable labels and uses the supplied symbol with the approved split wordmark', () => {
  const { container } = render(<><CompactText value="Sample Church" /><Brand /></>)
  expect(screen.getAllByText('Sample Church')).toHaveLength(1)
  expect(container.querySelector('.brand-symbol')?.getAttribute('src')).toBe('/brand/msprout-symbol.svg')
  expect(container.querySelector('.brand-ms')?.textContent).toBe('MS')
  expect(container.querySelector('.brand-prout')?.textContent).toBe('prout')
})
