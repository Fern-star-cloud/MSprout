export interface AuthField {
  name: string
  label: string
  type?: 'text' | 'password' | 'email' | 'checkbox'
  autoComplete?: string
  inputMode?: 'numeric' | 'text'
  minLength?: number
}

export const emailField: AuthField = { name: 'email', label: 'Email', type: 'email', autoComplete: 'username' }
export const passwordField: AuthField = { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password' }
export const newPasswordFields: AuthField[] = [
  { ...passwordField, label: 'New password', autoComplete: 'new-password', minLength: 12 },
  { name: 'password_confirmation', label: 'Confirm new password', type: 'password', autoComplete: 'new-password', minLength: 12 },
]
export const codeField: AuthField = { name: 'code', label: 'Authenticator code', autoComplete: 'one-time-code', inputMode: 'numeric' }
