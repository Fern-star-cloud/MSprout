import { ConnectivityStatus } from '../../components/ConnectivityStatus'
import type { NavigationItem } from '../router'

export function WideLayout({ items, activePath }: { items: NavigationItem[]; activePath: string }) {
  return (
    <aside className="wide-layout">
      <a className="brand-link" href="/account/dashboard" aria-label="MinistrySprout home">
        <span className="brand-mark" aria-hidden="true">M</span>
        <span><strong>MinistrySprout</strong><small>Children&apos;s ministry, ready anywhere.</small></span>
      </a>
      <nav className="wide-navigation" aria-label="Main navigation">
        {items.map((item) => (
          <a key={item.href} href={item.href} aria-current={activePath === item.href.split('?')[0] ? 'page' : undefined}>
            <span aria-hidden="true" className="navigation-dot" />
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
      <ConnectivityStatus />
    </aside>
  )
}
