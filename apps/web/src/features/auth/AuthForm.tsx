import { useState } from 'react'
import { ApiError } from '../../api/client'
import { safeAuthMessage } from './transport'
import type { AuthField } from './fields'

export function AuthForm({ fields, submitLabel, onSubmit }: {
  fields: AuthField[]
  submitLabel: string
  onSubmit: (values: Record<string, string>) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [invalidFields, setInvalidFields] = useState<string[]>([])
  return <form aria-label={submitLabel} onSubmit={async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form).entries()) as Record<string, string>
    setBusy(true); setError(''); setInvalidFields([])
    try { await onSubmit(values) } catch (failure) {
      setError(safeAuthMessage(failure))
      if (failure instanceof ApiError) setInvalidFields(Object.keys(failure.fieldErrors ?? {}))
    } finally {
      form.querySelectorAll<HTMLInputElement>('input[type="password"], input[autocomplete="one-time-code"]').forEach((input) => { input.value = '' })
      setBusy(false)
    }
  }}>
    {error && <p role="alert" tabIndex={-1}>{error}</p>}
    {fields.map((field) => <div className="form-field" key={field.name}>
      <label htmlFor={field.name}>{field.label}</label>
      <input id={field.name} name={field.name} type={field.type ?? 'text'} autoComplete={field.autoComplete}
        inputMode={field.inputMode} minLength={field.minLength} required disabled={busy}
        aria-invalid={invalidFields.includes(field.name)} aria-describedby={invalidFields.includes(field.name) ? `${field.name}-error` : undefined} />
      {invalidFields.includes(field.name) && <span id={`${field.name}-error`}>Check this field.</span>}
    </div>)}
    <button disabled={busy} type="submit">{busy ? 'Please wait…' : submitLabel}</button>
  </form>
}
