import './App.css'
import { useState } from 'react'
import { AuthScreen, type AuthPage } from './features/auth/AuthScreen'
import { PlatformAuthScreen } from './features/platform-auth/PlatformAuthScreen'
import { ApplicationScreen } from './features/applications/ApplicationScreen'
import { ApplicationReviewScreen } from './features/platform/applications/ApplicationReviewScreen'
import { TeacherManagementScreen } from './features/teachers/TeacherManagementScreen'
import { TeacherInvitationScreen } from './features/teachers/TeacherInvitationScreen'

function App() {
  const [entry] = useState(() => ({ path: globalThis.location?.pathname ?? '/', fragment: globalThis.location?.hash.slice(1) ?? '' }))
  const page = entry.path.split('/').pop() ?? 'login'
  const pages: AuthPage[] = ['login', 'verify-email', 'forgot-password', 'reset-password', 'mfa']
  return (
    <main>
      <header className="brand"><h1>MinistrySprout</h1><p>Children&apos;s ministry, ready anywhere.</p></header>
      {page === 'teachers' ? <TeacherManagementScreen /> : page === 'teacher-invitation' ? <TeacherInvitationScreen fragment={entry.fragment} /> : page === 'application' ? <ApplicationScreen /> : page === 'platform-applications' ? <ApplicationReviewScreen /> : page === 'platform-login' || page === 'platform-setup'
        ? <PlatformAuthScreen setup={page === 'platform-setup'} fragment={entry.fragment} />
        : <AuthScreen initialPage={pages.includes(page as AuthPage) ? page as AuthPage : 'login'} fragment={entry.fragment} />}
      <footer><a href="/account/platform-login">Platform administration</a></footer>
    </main>
  )
}

export default App
