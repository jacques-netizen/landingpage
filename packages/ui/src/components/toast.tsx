'use client'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

type ToastApi = { toast: (message: string) => void }
const ToastContext = createContext<ToastApi>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

/** Black pill, bottom centre, one line, gone after 4 seconds. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toast = useCallback((next: string) => {
    if (timer.current) clearTimeout(timer.current)
    setMessage(next)
    timer.current = setTimeout(() => setMessage(null), 4000)
  }, [])

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4"
      >
        {message && (
          <p className="mde-fade max-w-full truncate rounded-pill bg-ink px-5 py-3 text-body-sm font-medium text-white">
            {message}
          </p>
        )}
      </div>
    </ToastContext.Provider>
  )
}
