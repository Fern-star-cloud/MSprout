// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { PwaUpdateNotice } from './PwaUpdateNotice'
import { pwaUpdateController, usePwaUpdate } from './update-controller'
vi.mock('./update-controller', () => ({ usePwaUpdate: vi.fn(), pwaUpdateController: { applyUpdate: vi.fn(async () => false) } }))
afterEach(() => { cleanup(); document.body.removeAttribute('tabindex'); vi.clearAllMocks() })
it('does not display a false update before a waiting worker is reported', () => {
  vi.mocked(usePwaUpdate).mockReturnValue({ updateAvailable: false, updateBlocked: false, updating: false, error: null })
  render(<PwaUpdateNotice />); expect(screen.queryByRole('region', { name: 'Application update' })).toBeNull()
})
it('keeps preservation feedback generic on locked or unauthorized destinations', () => {
  vi.mocked(usePwaUpdate).mockReturnValue({ updateAvailable: true, updateBlocked: true, updating: false, error: null })
  render(<PwaUpdateNotice />)
  expect(screen.getByRole('status').textContent).toContain('Safe updating is not available')
  expect(document.body.textContent).not.toMatch(/pending uploads|attendance|profile|student/i)
})
it('announces safe failure without disclosing technical errors or pretending an update succeeded', () => {
  vi.mocked(usePwaUpdate).mockReturnValue({ updateAvailable: true, updateBlocked: false, updating: false, error: 'activation' })
  render(<PwaUpdateNotice />); expect(screen.getByRole('alert').textContent).toContain('could not be activated')
})
it('requires a deliberate enabled action and prevents repeats while checking', async () => {
  vi.mocked(usePwaUpdate).mockReturnValue({ updateAvailable: true, updateBlocked: false, updating: true, error: null })
  const view = render(<PwaUpdateNotice />)
  await userEvent.click(screen.getByRole('button', { name: 'Update when safe' })); expect(pwaUpdateController.applyUpdate).not.toHaveBeenCalled()
  vi.mocked(usePwaUpdate).mockReturnValue({ updateAvailable: true, updateBlocked: false, updating: false, error: null })
  view.rerender(<PwaUpdateNotice />); await userEvent.click(screen.getByRole('button', { name: 'Update when safe' }))
  expect(pwaUpdateController.applyUpdate).toHaveBeenCalledTimes(1)
})
it('retains the update action across checking and deferred states', async () => {
  const initial = { updateAvailable: true, updateBlocked: false, updating: false, error: null } as const
  vi.mocked(usePwaUpdate).mockReturnValue(initial)
  const view = render(<PwaUpdateNotice />)
  const button = screen.getByRole('button', { name: 'Update when safe' })
  await userEvent.click(button)
  vi.mocked(usePwaUpdate).mockReturnValue({ ...initial, updating: true }); view.rerender(<PwaUpdateNotice />)
  expect(button.hasAttribute('disabled')).toBe(true)
  vi.mocked(usePwaUpdate).mockReturnValue({ ...initial, updateBlocked: true }); view.rerender(<PwaUpdateNotice />)
  expect(document.activeElement).toBe(button)
})
it('returns keyboard focus lost by native disabling without focusing another destination', async () => {
  const initial = { updateAvailable: true, updateBlocked: false, updating: false, error: null } as const
  vi.mocked(usePwaUpdate).mockReturnValue(initial)
  const view = render(<PwaUpdateNotice />)
  const button = screen.getByRole('button', { name: 'Update when safe' })
  await userEvent.click(button)
  vi.mocked(usePwaUpdate).mockReturnValue({ ...initial, updating: true }); view.rerender(<PwaUpdateNotice />)
  document.body.tabIndex = -1; document.body.focus()
  expect(document.activeElement).toBe(document.body)
  vi.mocked(usePwaUpdate).mockReturnValue({ ...initial, updateBlocked: true }); view.rerender(<PwaUpdateNotice />)
  expect(document.activeElement).toBe(button)
})
it('does not steal focus after the user moves to another control during a check', async () => {
  const initial = { updateAvailable: true, updateBlocked: false, updating: false, error: null } as const
  vi.mocked(usePwaUpdate).mockReturnValue(initial)
  const content = () => <><button>Other destination</button><PwaUpdateNotice /></>
  const view = render(content())
  await userEvent.click(screen.getByRole('button', { name: 'Update when safe' }))
  vi.mocked(usePwaUpdate).mockReturnValue({ ...initial, updating: true }); view.rerender(content())
  expect(screen.getByRole('button', { name: 'Update when safe' }).hasAttribute('disabled')).toBe(true)
  const other = screen.getByRole('button', { name: 'Other destination' }); other.focus()
  vi.mocked(usePwaUpdate).mockReturnValue({ ...initial, updateBlocked: true }); view.rerender(content())
  expect(document.activeElement).toBe(other)
})
