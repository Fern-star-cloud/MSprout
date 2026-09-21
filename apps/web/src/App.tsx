import './App.css'
import { useState } from 'react'
import { AuthScreen, type AuthPage } from './features/auth/AuthScreen'
import { PlatformAuthScreen } from './features/platform-auth/PlatformAuthScreen'

function App() {
  const [entry] = useState(() => ({ path: globalThis.location?.pathname ?? '/', fragment: globalThis.location?.hash.slice(1) ?? '' }))
  const page = entry.path.split('/').pop() ?? 'login'
  const pages: AuthPage[] = ['login', 'verify-email', 'forgot-password', 'reset-password', 'mfa']
  return (
    <main>
      <header className="brand"><h1>MinistrySprout</h1><p>Children&apos;s ministry, ready anywhere.</p></header>
      {page === 'platform-login' || page === 'platform-setup'
        ? <PlatformAuthScreen setup={page === 'platform-setup'} fragment={entry.fragment} />
        : <AuthScreen initialPage={pages.includes(page as AuthPage) ? page as AuthPage : 'login'} fragment={entry.fragment} />}
      <footer><a href="/account/platform-login">Platform administration</a></footer>
    </main>
  )
}

export default App
