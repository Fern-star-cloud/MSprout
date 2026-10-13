// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CompactNameHeading } from './CompactNameHeading'

let measure: ResizeObserverCallback
const disconnect = vi.fn()
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { constructor(callback: ResizeObserverCallback) { measure = callback } observe() {} disconnect = disconnect })
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value: function(this: HTMLDialogElement) { this.open = true } },
    close: { configurable: true, value: function(this: HTMLDialogElement) { this.open = false } },
  })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })

it('preserves the complete clipped heading and offers a focus-safe full-name view without mutation', () => {
  const value = 'M'.repeat(120)
  const { container } = render(<CompactNameHeading id="ministry" value={value} kind="ministry" />)
  const text = container.querySelector('.compact-name-text')!
  Object.defineProperties(text, { scrollHeight: { configurable: true, value: 240 }, clientHeight: { configurable: true, value: 48 } })
  act(() => measure([], {} as ResizeObserver))
  expect(screen.getByRole('heading', { name: value }).textContent).toBe(value)
  const reveal = screen.getByRole('button', { name: 'Show full ministry name' })
  reveal.focus(); fireEvent.click(reveal)
  expect(screen.getByRole('dialog', { name: 'Full ministry name' }).textContent).toContain(value)
  const close = screen.getByRole('button', { name: 'Close full name' })
  expect(document.activeElement).toBe(close)
  fireEvent.click(close); expect(document.activeElement).toBe(reveal)
  expect(value).toBe('M'.repeat(120))
})

it('keeps normal names free of extra controls and disconnects its measurement on removal', () => {
  const { unmount } = render(<CompactNameHeading id="ministry" value="Sunday Explorers" kind="ministry" />)
  act(() => measure([], {} as ResizeObserver))
  expect(screen.queryByRole('button', { name: 'Show full ministry name' })).toBeNull()
  expect(screen.getByRole('heading', { name: 'Sunday Explorers' })).toBeTruthy()
  unmount(); expect(disconnect).toHaveBeenCalledOnce()
})

it('returns focus to the complete heading when a wider layout no longer needs the disclosure', async () => {
  const value = 'W'.repeat(50)
  const { container } = render(<CompactNameHeading id="ministry" value={value} kind="ministry" />)
  const text = container.querySelector('.compact-name-text')!
  Object.defineProperties(text, { scrollHeight: { configurable: true, value: 120 }, clientHeight: { configurable: true, value: 48 } })
  act(() => measure([], {} as ResizeObserver))
  fireEvent.click(screen.getByRole('button', { name: 'Show full ministry name' }))
  Object.defineProperty(text, 'scrollHeight', { configurable: true, value: 48 })
  act(() => measure([], {} as ResizeObserver))
  fireEvent.click(screen.getByRole('button', { name: 'Close full name' }))
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { name: value })))
})
