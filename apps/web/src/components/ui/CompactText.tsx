import { useState } from 'react'
import { compactLabel } from './compact-label'

/** Presentation only: never replace the stored value or submitted form value. */
export function CompactText({ value }: { value: string }) {
  const label = compactLabel(value)
  return <span className="compact-text" title={value}>{label === value ? value : <><span aria-hidden="true">{label}</span><span className="sr-only">{value}</span></>}</span>
}

export function ChurchName({ value }: { value: string }) {
  const [expanded, setExpanded] = useState(false)
  return <details className="church-name-details" onToggle={event => setExpanded(event.currentTarget.open)}><summary aria-label={`Church name: ${value}`}><CompactText value={value} /></summary>{expanded && <div className="church-name-expanded">{value}</div>}</details>
}
