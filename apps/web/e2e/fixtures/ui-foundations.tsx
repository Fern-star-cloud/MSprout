// Test-only entry, bundled in memory by Playwright; never included in the application build.
import { StrictMode, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/styles/tokens.css'
import '../../src/styles/global.css'
import '../../src/App.css'
import '../../src/styles/foundations.css'
import { Button, Dialog, EmptyState, Field, LoadingState, ResponsiveList, ResponsiveTable, StatusBadge, StatusBanner, Tabs } from '../../src/components/ui/Foundations'
import { AuthForm } from '../../src/features/auth/AuthForm'
import { emailField, passwordField } from '../../src/features/auth/fields'
import { ApiError } from '../../src/api/client'

export function Examples() {
  const [open, setOpen] = useState(false)
  const cancel = useRef<HTMLButtonElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  return <main className="public-layout">
    <h1>MinistrySprout foundations</h1>
    <section className="auth-card" aria-label="Shared examples" style={{ display: 'grid', gap: 'var(--space-4)' }}>
      <h2>Accessible controls</h2>
      <Field label="Local PIN example" name="pin" type="password" inputMode="numeric" hint="Synthetic example only" />
      <div className="application-actions"><Button>Primary action</Button><Button variant="secondary">Secondary action</Button><Button variant="danger">Destructive action</Button></div>
      <p><StatusBadge>Absent</StatusBadge> <StatusBadge tone="success">Saved</StatusBadge> <StatusBadge tone="warning">Needs review</StatusBadge> <StatusBadge tone="danger">Failed</StatusBadge></p>
      <StatusBanner>Offline</StatusBanner><StatusBanner tone="info">Account required</StatusBanner><LoadingState label="Loading authorized data" />
      <EmptyState title="No loaded results" description="Try a different filter." />
      <Button ref={trigger} onClick={() => setOpen(true)}>Review example</Button>
      <Dialog open={open} onClose={() => setOpen(false)} initialFocus={cancel} returnFocus={trigger} title="Review example action" description="This synthetic example makes no stored changes.">
        <div className="ui-dialog-actions"><Button ref={cancel} variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => setOpen(false)}>Confirm example</Button></div>
      </Dialog>
      <Tabs label="Example views" items={[{ id: 'one', label: 'First view', content: 'First panel' }, { id: 'two', label: 'Second view', content: 'Second panel' }]} />
      <ResponsiveTable label="Loaded example rows"><thead><tr><th scope="col">Name</th><th scope="col">Status</th></tr></thead><tbody><tr><td>Very long synthetic display name for responsive presentation and reflow</td><td>Unmarked</td></tr></tbody></ResponsiveTable>
      <ResponsiveList label="Example cards"><li>Very long synthetic display name for responsive presentation and reflow</li></ResponsiveList>
      <AuthForm fields={[emailField, passwordField]} submitLabel="Test sign in" onSubmit={async () => { throw new ApiError('validation_failed', 'Untrusted response text', 'synthetic-correlation', 422, { email: ['Untrusted field error'] }) }} />
    </section>
  </main>
}

createRoot(document.getElementById('root')!).render(<StrictMode><Examples /></StrictMode>)
