import { useEffect, useId, useRef, useState } from 'react'
import { Button, ErrorSummary, Field } from '../../components/ui/Foundations'
import { ApiError } from '../../api/client'
import { safeAuthMessage } from './transport'
import type { AuthField } from './fields'

export function AuthForm({ fields, submitLabel, onSubmit, disabled = false }: {
  fields: AuthField[]
  submitLabel: string
  onSubmit: (values: Record<string, string>) => Promise<void>
  disabled?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [invalidFields, setInvalidFields] = useState<string[]>([])
  const submitting = useRef(false)
  const summary = useRef<HTMLDivElement>(null)
  const id = useId()
  useEffect(() => { if (error && !busy) summary.current?.focus() }, [error, busy])
  return <form aria-label={submitLabel} onSubmit={async (event) => {
    event.preventDefault()
    if (submitting.current || disabled) return
    submitting.current = true
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form).entries()) as Record<string, string>
    setBusy(true); setError(''); setInvalidFields([])
    try { await onSubmit(values) } catch (failure) {
      setError(safeAuthMessage(failure))
      if (failure instanceof ApiError) setInvalidFields(Object.keys(failure.fieldErrors ?? {}))
    } finally {
      form.querySelectorAll<HTMLInputElement>('input[type="password"], input[autocomplete="one-time-code"], input[name="recovery_code"]').forEach((input) => { input.value = '' })
      setBusy(false)
      submitting.current = false
    }
  }}>
    {error && <ErrorSummary ref={summary} message={error} errors={fields.filter(field => invalidFields.includes(field.name)).map(field => ({ target: `${id}-${field.name}`, message: `${field.label}: Check this field.` }))} />}
    {fields.map((field) => <Field key={field.name} label={field.label} id={`${id}-${field.name}`} name={field.name} type={field.type ?? 'text'} autoComplete={field.autoComplete}
        inputMode={field.inputMode} minLength={field.minLength} required disabled={busy || disabled}
        error={invalidFields.includes(field.name) ? 'Check this field.' : undefined} />)}
    <Button busy={busy} disabled={disabled} type="submit">{busy ? 'Please wait…' : submitLabel}</Button>
  </form>
}
