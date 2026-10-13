import type { NavigationItem } from '../../app/navigation'
type HomeIconId = NavigationItem['id'] | 'device' | 'info' | 'arrow' | 'verified'

// Small, local SVGs keep the Home reference language independent of icon packages.
export function HomeIcon({ id, solid = false }: { id: HomeIconId; solid?: boolean }) {
  if (solid && id === 'conflicts') return <svg aria-hidden="true" viewBox="0 0 24 24"><path fill="currentColor" d="M5 2h9l6 6v14H5Z" /><path d="M14 3v6h5M9 13h7m-7 4h7" fill="none" stroke="white" strokeWidth="1.6" /></svg>
  if (id === 'home') return <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M2 10 12 2l10 8-2 2-1-1v11h-5v-8h-4v8H5V11l-1 1Z" /></svg>
  if (['people', 'ministries', 'teachers'].includes(id)) return <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="7" r="3.5" /><circle cx="18" cy="8" r="2.5" /><path d="M2 21v-4a7 7 0 0 1 14 0v4Zm15-8a5 5 0 0 1 6 5v3h-5v-4a9 9 0 0 0-1-4Z" /></svg>
  const paths: Partial<Record<HomeIconId, string>> = {
    home: 'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
    attendance: 'M5 5h14v16H5ZM5 10h14M8 3v4m8-4v4M8 14h2m4 0h2m-8 3h2',
    device: 'M4 4h16v13H4ZM2 21h20M9 17v4m6-4v4',
    people: 'M8 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20v-3a6 6 0 0 1 12 0v3Zm14-16a3 3 0 0 1 0 6m1 3a5 5 0 0 1 5 5v2',
    ministries: 'M8 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20v-3a6 6 0 0 1 12 0v3Zm14-16a3 3 0 0 1 0 6m1 3a5 5 0 0 1 5 5v2',
    teachers: 'M8 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20v-3a6 6 0 0 1 12 0v3Zm14-16a3 3 0 0 1 0 6m1 3a5 5 0 0 1 5 5v2',
    students: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21v-3a8 8 0 0 1 16 0v3Z',
    conflicts: 'M5 3h9l5 5v13H5ZM14 3v6h5M9 13h6m-6 4h6',
    imports: 'M5 3h9l5 5v13H5ZM14 3v6h5M8 15h8m-4-3v6',
    reports: 'M4 20v-6m5 6V9m5 11V5m5 15V2',
    birthdays: 'M3 8h18v4H3Zm2 4v9h14v-9M12 8v13m0-13C3 8 5 1 9 3l3 5Zm0 0c9 0 7-7 3-5Z',
    audit: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l4 3',
    sync: 'M7 19H6a4 4 0 0 1-1-8 7 7 0 0 1 13-2 5 5 0 0 1 0 10H7',
    account: 'M9 3h6l1 3 3 1 2 5-2 3-3 1-1 5H9l-1-4-3-1-2-4 2-4 3-1ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
    more: 'M4 6h16M4 12h16M4 18h16',
    info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 8v6m0-10h.01',
    arrow: 'M4 12h16m-6-6 6 6-6 6',
    verified: 'm12 2 3 2 4 1 1 4 2 3-2 3-1 4-4 1-3 2-3-2-4-1-1-4-2-3 2-3 1-4 4-1Zm-5 10 3 3 7-7',
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={paths[id] ?? paths.conflicts} /></svg>
}
