import { createContext, useContext } from 'react'

export interface ChurchWorkspace {
  church_id: string
  name: string
  role: 'owner' | 'teacher'
}

export const ChurchWorkspaceContext = createContext<ChurchWorkspace | null>(null)

export function useWorkspaceChurchId(initialChurchId = ''): string {
  return useContext(ChurchWorkspaceContext)?.church_id ?? initialChurchId
}
