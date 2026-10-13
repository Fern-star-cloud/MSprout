import { useEffect, useRef, useState } from 'react'
import { Button, Dialog } from './Foundations'
import { HomeIcon } from './HomeIcon'

/** Visual bounds only. Keep the complete name in the heading and full-name view. */
export function CompactNameHeading({ id, value, kind }: { id: string; value: string; kind: string }) {
  const text = useRef<HTMLSpanElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const [clipped, setClipped] = useState(false)
  const [open, setOpen] = useState(false)
  const closeName = () => {
    setOpen(false)
    // If reflow removed the disclosure, return keyboard focus to its full name.
    requestAnimationFrame(() => { if (!trigger.current) heading.current?.focus() })
  }
  useEffect(() => {
    const element = text.current
    if (!element) return
    const measure = () => setClipped(element.scrollHeight > element.clientHeight + 1)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(element)
    window.addEventListener('resize', measure)
    const frame = requestAnimationFrame(measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); cancelAnimationFrame(frame) }
  }, [value])
  return <>
    <div className="compact-name-heading">
      <h2 ref={heading} id={id} tabIndex={-1}><span ref={text} className="compact-name-text">{value}</span></h2>
      {(clipped || open) && <Button ref={trigger} variant="secondary" className="compact-name-reveal" aria-label={`Show full ${kind} name`} aria-haspopup="dialog" onClick={() => setOpen(true)}><HomeIcon id="info" /></Button>}
    </div>
    <Dialog open={open} title={`Full ${kind} name`} initialFocus={close} returnFocus={trigger} onClose={closeName}>
      <p className="full-name-value">{value}</p>
      <Button ref={close} variant="secondary" onClick={closeName}>Close full name</Button>
    </Dialog>
  </>
}
