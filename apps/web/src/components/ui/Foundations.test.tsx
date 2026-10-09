// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { Button, Dialog, EmptyState, ErrorSummary, Field, LoadingState, ResponsiveTable, StatusBadge, StatusBanner, Tabs } from './Foundations'

afterEach(cleanup)

it('connects unique field labels, hints and errors without losing caller descriptions', () => {
  render(<><Field label="First email" name="email" hint="Use your account" error="Check this field." aria-describedby="context" /><Field label="Second email" name="email" /><p id="context">Online only</p></>)
  const first = screen.getByLabelText('First email')
  const second = screen.getByLabelText('Second email')
  expect(first.id).not.toBe(second.id)
  expect(first.getAttribute('aria-invalid')).toBe('true')
  const descriptions = first.getAttribute('aria-describedby')!.split(' ').map(id => document.getElementById(id)?.textContent)
  expect(descriptions).toEqual(['Online only', 'Use your account', 'Check this field.'])
})

it('moves focus from a linked error summary to the affected field', async () => {
  render(<><ErrorSummary message="Check the form." errors={[{ target: 'email', message: 'Email: Check this field.' }]} /><Field id="email" label="Email" /></>)
  await userEvent.click(screen.getByRole('link', { name: 'Email: Check this field.' }))
  expect(document.activeElement).toBe(screen.getByLabelText('Email'))
})

it('keeps a busy action disabled and out of accidental form submission', async () => {
  const click = vi.fn()
  render(<Button busy onClick={click}>Save</Button>)
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(click).not.toHaveBeenCalled()
  expect(screen.getByRole('button').getAttribute('aria-busy')).toBe('true')
  expect(screen.getByRole('button').getAttribute('type')).toBe('button')
})

it('uses neutral status by default and announces only deliberately live feedback', () => {
  render(<><StatusBadge>Absent</StatusBadge><StatusBanner>Offline</StatusBanner><StatusBanner live tone="success">Saved on this device</StatusBanner><LoadingState label="Loading ministries" /><EmptyState title="No results" description="Change the filter." /></>)
  expect(screen.getByText('Absent').className).toContain('tone-neutral')
  expect(screen.getByText('Offline').getAttribute('role')).toBeNull()
  expect(screen.getAllByRole('status').map(element => element.textContent)).toEqual(['Saved on this device', 'Loading ministries'])
  expect(screen.getByRole('heading', { name: 'No results' })).toBeTruthy()
})

it('supports tab arrows, wrapping, Home and End with one focus stop and linked panels', async () => {
  render(<Tabs label="Review" items={[{ id: 'first', label: 'Conflicts', content: 'Conflict queue' }, { id: 'second', label: 'Guests', content: 'Guest queue' }, { id: 'last', label: 'History', content: 'History queue' }]} />)
  const tabs = screen.getAllByRole('tab')
  tabs[0].focus()
  await userEvent.keyboard('{ArrowLeft}')
  expect(document.activeElement).toBe(tabs[2])
  expect(screen.getByRole('tabpanel').textContent).toBe('History queue')
  await userEvent.keyboard('{Home}{ArrowRight}')
  expect(document.activeElement).toBe(tabs[1])
  expect(tabs.map(tab => tab.tabIndex)).toEqual([-1, 0, -1])
  const panel = screen.getByRole('tabpanel')
  expect(panel.getAttribute('aria-labelledby')).toBe(tabs[1].id)
  expect(tabs[1].getAttribute('aria-controls')).toBe(panel.id)
  await userEvent.keyboard('{End}')
  expect(document.activeElement).toBe(tabs[2])
})

it('keeps wide table contents inside a named keyboard-accessible region', () => {
  render(<ResponsiveTable label="Loaded students"><thead><tr><th scope="col">Name</th></tr></thead><tbody><tr><td>Synthetic student</td></tr></tbody></ResponsiveTable>)
  expect(screen.getByRole('region', { name: 'Loaded students' }).tabIndex).toBe(0)
  expect(screen.getByRole('table', { name: 'Loaded students' })).toBeTruthy()
})

it('opens a native modal, focuses its safe action and restores its trigger after cancellation', async () => {
  // jsdom has no modal implementation; browser qualification proves native containment.
  const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal')
  const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close')
  const showModal = vi.fn(function (this: HTMLDialogElement) { this.open = true })
  const close = vi.fn(function (this: HTMLDialogElement) { this.open = false })
  Object.defineProperties(HTMLDialogElement.prototype, { showModal: { configurable: true, value: showModal }, close: { configurable: true, value: close } })
  function Example() {
    const [open, setOpen] = useState(false)
    const cancel = useRef<HTMLButtonElement>(null)
    const trigger = useRef<HTMLButtonElement>(null)
    return <><Button ref={trigger} onClick={() => setOpen(true)}>Review action</Button><Dialog open={open} title="Confirm action" description="Review the target before continuing." onClose={() => setOpen(false)} initialFocus={cancel} returnFocus={trigger}><Button ref={cancel} onClick={() => setOpen(false)}>Cancel</Button><Button>Confirm</Button></Dialog></>
  }
  try {
    render(<Example />)
    const trigger = screen.getByRole('button', { name: 'Review action' })
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Confirm action' })
    expect(showModal).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    expect(close).toHaveBeenCalledOnce()
  } finally {
    cleanup()
    if (originalShow) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', originalShow)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
    if (originalClose) Object.defineProperty(HTMLDialogElement.prototype, 'close', originalClose)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
  }
})
