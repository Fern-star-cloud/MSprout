// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { AuthForm } from './AuthForm'
import { ApiError } from '../../api/client'
import { emailField, passwordField } from './fields'

afterEach(cleanup)

it('focuses safe field-linked errors, retains email and clears the submitted secret', async () => {
  const submit = vi.fn().mockRejectedValue(new ApiError('validation_failed', 'Private raw response', 'synthetic-correlation', 422, { email: ['Do not expose raw server values'] }))
  render(<AuthForm fields={[emailField, passwordField]} submitLabel="Sign in" onSubmit={submit} />)
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'synthetic@example.test' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: crypto.randomUUID() } })
  fireEvent.submit(screen.getByRole('form'))
  const summary = await screen.findByRole('alert')
  await waitFor(() => expect(document.activeElement).toBe(summary))
  expect(summary.textContent).not.toContain('Private raw response')
  expect(summary.textContent).not.toContain('raw server values')
  expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('synthetic@example.test')
  expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('')
  await userEvent.click(screen.getByRole('link', { name: 'Email: Check this field.' }))
  expect(document.activeElement).toBe(screen.getByLabelText('Email'))
})

it('does not duplicate a pending submission even when submit events repeat', async () => {
  let finish!: () => void
  const submit = vi.fn(() => new Promise<void>(resolve => { finish = resolve }))
  render(<AuthForm fields={[emailField]} submitLabel="Continue" onSubmit={submit} />)
  fireEvent.submit(screen.getByRole('form'))
  fireEvent.submit(screen.getByRole('form'))
  expect(submit).toHaveBeenCalledOnce()
  finish()
  await waitFor(() => expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false))
})
