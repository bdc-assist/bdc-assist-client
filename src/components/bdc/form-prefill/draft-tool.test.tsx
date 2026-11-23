// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FormDef } from '@/lib/forms'

import { FieldList } from './draft-tool'
import type { Draft } from './use-form-draft'

// review findings: hand edits must survive a pending reply, and date/checkbox fields must keep focus
const FORM: FormDef = {
  id: 'costs',
  title: 'Usage Costs',
  url: 'https://bdc/help/costs/',
  fields: [
    { name: 'requester', label: 'Email', kind: 'text', required: true, personal: true },
    { name: 'start', label: 'Start date', kind: 'date', required: false },
    { name: 'support', label: 'Support during the course', kind: 'checkbox', required: false },
    { name: 'need', label: 'Estimated need', kind: 'number', required: false },
  ],
}

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let host: HTMLDivElement
let root: Root
beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

/** FieldList with its own draft state, as useFormDraft drives it: each edit is a new draft. */
function Harness({ onEdit, busy = false }: { onEdit?: (name: string, v: string) => void; busy?: boolean }) {
  const [draft, setDraft] = useState<Draft>({ values: {}, changed: [], edited: [] })
  const edit = (name: string, v: string) => {
    onEdit?.(name, v)
    setDraft((d) => ({ ...d, values: { ...d.values, [name]: v } }))
  }
  return <FieldList form={FORM} draft={draft} onEdit={edit} busy={busy} />
}

const setValue = (el: HTMLInputElement, value: string) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('FieldList', () => {
  it('keeps a typed date when the field is left, not on each keystroke', () => {
    const onEdit = vi.fn()
    act(() => root.render(<Harness onEdit={onEdit} />))
    const date = host.querySelector<HTMLInputElement>('input[type=date]')!
    act(() => setValue(date, '0002-03-01')) // the browser's value after typing the year's first digit
    expect(onEdit).not.toHaveBeenCalled()
    act(() => setValue(date, '2027-03-01'))
    act(() => date.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    expect(onEdit).toHaveBeenCalledWith('start', '2027-03-01')
  })

  it('keeps a checkbox (and its focus) when it changes', () => {
    act(() => root.render(<Harness />))
    const box = host.querySelector<HTMLInputElement>('input[type=checkbox]')!
    act(() => box.click())
    const after = host.querySelector<HTMLInputElement>('input[type=checkbox]')!
    expect(after.checked).toBe(true)
    expect(after).toBe(box) // the same element: a remount would drop the keyboard focus
  })

  it('locks every field while a reply is pending', () => {
    act(() => root.render(<Harness busy />))
    const controls = [...host.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea, select')]
    expect(controls.length).toBe(4)
    expect(controls.every((c) => c.disabled)).toBe(true)
  })
})
