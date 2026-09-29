import type { NavigationItem } from '../router'
import type { CSSProperties } from 'react'

function NavigationIcon({ name }: { name: NavigationItem['icon'] }) {
  const paths = {
    home: 'M4 11.5 12 5l8 6.5V20h-5v-5H9v5H4Z',
    attendance: 'M6 4h12v17H6Zm3 5 2 2 4-4m-6 9 2 2 4-4',
    birthday: 'M4 12h16v9H4Zm2-5h12v5H6Zm6 0v14M9 5c-2-2-1-4 1-3 1 .5 2 3 2 5Zm3 0c2-2 1-4-1-3-1 .5-2 3-2 5Z',
    ministries: 'M12 3v18M5 8h14M7 21h10',
    students: 'M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 1a3 3 0 1 0 0-6M2 21v-3a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v3m1-7a5 5 0 0 1 5 5v2',
    teachers: 'm4 9 8-5 8 5-8 5Zm3 3v5c3 2 7 2 10 0v-5',
    import: 'M12 3v12m-4-4 4 4 4-4M5 18v3h14v-3',
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d={paths[name]} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>
}

export function PhoneLayout({ items, activePath }: { items: NavigationItem[]; activePath: string }) {
  return (
    <>
      <header className="phone-header">
        <a className="brand-link" href="/account/dashboard" aria-label="MinistrySprout home">
          <span className="brand-mark" aria-hidden="true">M</span>
          <span>MinistrySprout</span>
        </a>
      </header>
      <nav className="phone-navigation" aria-label="Phone navigation" style={{ '--navigation-count': items.length } as CSSProperties}>
        {items.map((item) => (
          <a key={item.href} href={item.href} aria-current={activePath === item.href ? 'page' : undefined}>
            <NavigationIcon name={item.icon} />
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
    </>
  )
}
