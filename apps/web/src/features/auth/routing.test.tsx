// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import App from '../../App'

afterEach(() => { cleanup(); history.replaceState(null, '', '/') })
it.each([
  ['/account/login', 'Welcome back'],
  ['/account/forgot-password', 'Reset your password'],
  ['/account/verify-email', 'Verify your email'],
  ['/account/mfa', 'Protect your account'],
  ['/account/reset-password', 'Choose a new password'],
  ['/account/platform-login', 'Platform sign in'],
  ['/account/platform-setup', 'Set up sage.dev'],
  ['/account/application', 'Your church, ready to grow'],
  ['/account/platform-applications', 'Church applications'],
  ['/account/teachers', 'Teachers'],
  ['/account/teacher-invitation', 'Teacher invitation'],
])('opens %s from a direct browser visit', (path, heading) => {
  history.replaceState(null, '', path)
  render(<App />)
  expect(screen.getByRole('heading', { name: heading })).toBeTruthy()
})
