import { useEffect, useId, useRef, useState } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, Ref, RefObject } from 'react'

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export function Button({ variant = 'primary', busy = false, disabled, className = '', type = 'button', ref, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger'; busy?: boolean; ref?: Ref<HTMLButtonElement> }) {
  return <button {...props} ref={ref} type={type} className={`ui-button ui-button-${variant} ${className}`} disabled={disabled || busy} aria-busy={busy || undefined} />
}

export function Field({ label, hint, error, id, className = '', 'aria-describedby': describedBy, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const descriptions = [describedBy, hint && `${fieldId}-hint`, error && `${fieldId}-error`].filter(Boolean).join(' ') || undefined
  return <div className={`form-field ui-field ${className}`}>
    <label htmlFor={fieldId}>{label}</label>
    {hint && <p className="ui-field-hint" id={`${fieldId}-hint`}>{hint}</p>}
    <input {...props} id={fieldId} aria-invalid={error ? true : props['aria-invalid']} aria-describedby={descriptions} />
    {error && <p className="ui-field-error" id={`${fieldId}-error`}>{error}</p>}
  </div>
}

export function ErrorSummary({ message, errors = [], ref }: { message: string; errors?: { target: string; message: string }[]; ref?: Ref<HTMLDivElement> }) {
  return <div className="ui-error-summary tone-danger" role="alert" tabIndex={-1} ref={ref}>
    <p>{message}</p>
    {errors.length > 0 && <ul>{errors.map(error => <li key={error.target}><a href={`#${error.target}`} onClick={event => {
      const target = document.getElementById(error.target)
      if (target) { event.preventDefault(); target.focus() }
    }}>{error.message}</a></li>)}</ul>}
  </div>
}

export function StatusBadge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`ui-status-badge tone-${tone}`}>{children}</span>
}

export function StatusBanner({ tone = 'neutral', live = false, children }: { tone?: Tone; live?: boolean; children: ReactNode }) {
  return <div className={`ui-status-banner tone-${tone}`} role={live ? 'status' : undefined}>{children}</div>
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return <StatusBanner live>{label}</StatusBanner>
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="ui-empty-state"><h2>{title}</h2>{description && <p>{description}</p>}{action}</div>
}

export function Dialog({ open, title, description, onClose, initialFocus, returnFocus, children }: { open: boolean; title: string; description?: string; onClose: () => void; initialFocus?: RefObject<HTMLElement | null>; returnFocus?: RefObject<HTMLElement | null>; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const id = useId()
  useEffect(() => {
    const element = dialog.current
    if (!open || !element) return
    // Safari pointer activation need not focus the trigger; callers can identify it explicitly.
    const trigger = returnFocus?.current ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    element.showModal()
    ;(initialFocus?.current ?? heading.current)?.focus()
    return () => {
      if (element.open) element.close()
      if (trigger?.isConnected) trigger.focus()
    }
  }, [open, initialFocus, returnFocus])
  return <dialog ref={dialog} className="ui-dialog" aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-description` : undefined} onCancel={event => { event.preventDefault(); onClose() }} onKeyDown={event => {
    if (event.key !== 'Tab') return
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]')].filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0)
    event.preventDefault()
    if (!controls.length) { heading.current?.focus(); return }
    const index = controls.indexOf(document.activeElement as HTMLElement)
    const next = event.shiftKey ? (index <= 0 ? controls.length - 1 : index - 1) : (index + 1) % controls.length
    controls[next].focus()
  }}>
    <h2 ref={heading} tabIndex={-1} id={`${id}-title`}>{title}</h2>
    {description && <p id={`${id}-description`}>{description}</p>}
    {children}
  </dialog>
}

export function Tabs({ label, items }: { label: string; items: { id: string; label: string; content: ReactNode }[] }) {
  const id = useId()
  const [selectedId, setSelectedId] = useState(items[0]?.id)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const selected = Math.max(0, items.findIndex(item => item.id === selectedId))
  return <div className="ui-tabs">
    <div role="tablist" aria-label={label}>{items.map((item, index) => <button key={item.id} ref={element => { buttons.current[index] = element }} type="button" role="tab" id={`${id}-tab-${item.id}`} aria-controls={`${id}-panel-${item.id}`} aria-selected={index === selected} tabIndex={index === selected ? 0 : -1} onClick={() => setSelectedId(item.id)} onKeyDown={event => {
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : event.key === 'ArrowRight' ? (index + 1) % items.length : event.key === 'ArrowLeft' ? (index + items.length - 1) % items.length : undefined
      if (next !== undefined) { event.preventDefault(); setSelectedId(items[next].id); buttons.current[next]?.focus() }
    }}>{item.label}</button>)}</div>
    {items.map((item, index) => <div key={item.id} role="tabpanel" id={`${id}-panel-${item.id}`} aria-labelledby={`${id}-tab-${item.id}`} tabIndex={0} hidden={index !== selected}>{item.content}</div>)}
  </div>
}

export function ResponsiveTable({ label, children }: { label: string; children: ReactNode }) {
  return <div className="ui-table-region" role="region" aria-label={label} tabIndex={0}><table><caption>{label}</caption>{children}</table></div>
}

export function ResponsiveList({ label, children }: { label: string; children: ReactNode }) {
  return <ul className="ui-responsive-list" aria-label={label}>{children}</ul>
}
