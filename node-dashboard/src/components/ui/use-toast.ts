import * as React from "react"
import { Toaster, Toast } from "./toast" // Assuming you have a toast component in toast.tsx

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1000000 // A very long delay to simulate no auto-removal

type ToastState = {
  toasts: Toast[]
}

const toastState: ToastState = {
  toasts: [],
}

type Action =
  | {
      type: "ADD_TOAST"
      toast: Toast
    }
  | {
      type: "UPDATE_TOAST"
      toast: Partial<Toast>
    }
  | {
      type: "DISMISS_TOAST"
      toastId?: string
    }
  | {
      type: "REMOVE_TOAST"
      toastId?: string
    }

let listeners: ((state: ToastState) => void)[] = []

function reducer(state: ToastState, action: Action): ToastState {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST":
      const { toastId } = action
      // ! Side effects ! - This gets executed in a separate queue, so it will be batched and executed
      // after the SET_TOASTS goes through
      if (toastId) {
        // Find the toast and update it to be dismissed
        // This will animate the toast out and then remove it after the transition
        const foundToast = state.toasts.find((t) => t.id === toastId)
        if (foundToast) {
          return {
            ...state,
            toasts: state.toasts.map((t) =>
              t.id === toastId ? { ...t, open: false } : t
            ),
          }
        }
      }
      return {
        ...state,
        toasts: state.toasts.map((t) => ({ ...t, open: false })),
      }

    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
    default:
      return state
  }
}

function dispatch(action: Action) {
  toastState.toasts = reducer(toastState, action).toasts
  listeners.forEach((listener) => listener(toastState))
}

const genId = (() => {
  let count = 0
  return () => {
    count += 1
    return `toast-${count}`
  }
})()

function toast({ ...props }: Omit<Toast, "id">) {
  const id = genId()

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) {
          dispatch({ type: "DISMISS_TOAST", toastId: id })
        }
      },
    },
  })

  return {
    id: id,
    dismiss: () => dispatch({ type: "DISMISS_TOAST", toastId: id }),
    update: (props: Partial<Toast>) =>
      dispatch({ type: "UPDATE_TOAST", toast: { ...props, id } }),
  }
}

function useToast() {
  const [state, setState] = React.useState(toastState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      listeners = listeners.filter((listener) => listener !== setState)
    }
  }, [])

  return {
    ...state,
    toast,
    dismiss: React.useCallback(
      (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
      []
    ),
  }
}

export { Toaster, toast, useToast } 