import { createContext, useContext, type ReactNode } from 'react'

export interface ChurchWorkspace {
  church_id: string
  name: string
  role: 'owner' | 'teacher'
}

export const ChurchWorkspaceContext = createContext<ChurchWorkspace | null>(null)
// Navigation identity is online-verified only; encrypted profiles do not project a church name/role.
export const ChurchNavigationContext = createContext<{ workspace: ChurchWorkspace | null; assignments: string[]; selector: ReactNode }>({ workspace: null, assignments: [], selector: null })

export function useWorkspaceChurchId(initialChurchId = ''): string {
  return useContext(ChurchWorkspaceContext)?.church_id ?? initialChurchId
}
