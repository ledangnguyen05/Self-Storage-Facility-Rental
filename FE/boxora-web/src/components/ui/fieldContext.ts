import { createContext, useContext } from 'react'

export interface FieldContextValue {
  id: string
  describedBy?: string
  invalid: boolean
  required: boolean
  disabled: boolean
}

export const FieldContext = createContext<FieldContextValue | null>(null)

interface ControlProps {
  id?: string
  invalid?: boolean
  required?: boolean
  disabled?: boolean
  'aria-describedby'?: string
}

/** Merges a control's own props with the surrounding <Field> (id, hint/error wiring, invalid). */
export function useFieldControl(props: ControlProps) {
  const field = useContext(FieldContext)
  const describedBy = [props['aria-describedby'], field?.describedBy].filter(Boolean).join(' ') || undefined
  const invalid = Boolean(props.invalid ?? field?.invalid)
  return {
    invalid,
    /** Spread onto the native control. */
    controlProps: {
      id: props.id ?? field?.id,
      required: props.required ?? field?.required,
      disabled: props.disabled ?? field?.disabled,
      'aria-describedby': describedBy,
      'aria-invalid': invalid || undefined,
    },
  }
}
