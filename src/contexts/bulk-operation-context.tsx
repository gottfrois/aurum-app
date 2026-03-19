import { Check, Loader2, Pause, Play, X, XCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import * as React from 'react'

type BulkOperationStatus =
  | 'idle'
  | 'processing'
  | 'paused'
  | 'complete'
  | 'cancelled'
  | 'error'

interface BulkOperationState {
  status: BulkOperationStatus
  label: string
  processed: number
  total: number
  updated?: number
  error?: string
}

interface BulkOperationContextValue {
  state: BulkOperationState
  pauseRef: React.RefObject<boolean>
  cancelRef: React.RefObject<boolean>
  start: (label: string, total: number) => void
  updateProgress: (processed: number) => void
  pause: () => void
  resume: () => void
  cancel: () => void
  complete: (updated?: number) => void
  setError: (msg: string) => void
  reset: () => void
}

const BulkOperationContext =
  React.createContext<BulkOperationContextValue | null>(null)

const initialState: BulkOperationState = {
  status: 'idle',
  label: '',
  processed: 0,
  total: 0,
}

export function BulkOperationProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [state, setState] = React.useState<BulkOperationState>(initialState)
  const pauseRef = React.useRef(false)
  const cancelRef = React.useRef(false)

  const start = React.useCallback((label: string, total: number) => {
    pauseRef.current = false
    cancelRef.current = false
    setState({ status: 'processing', label, processed: 0, total })
  }, [])

  const updateProgress = React.useCallback((processed: number) => {
    setState((s) => ({ ...s, processed }))
  }, [])

  const pause = React.useCallback(() => {
    pauseRef.current = true
    setState((s) => ({ ...s, status: 'paused' }))
  }, [])

  const resume = React.useCallback(() => {
    pauseRef.current = false
    setState((s) => ({ ...s, status: 'processing' }))
  }, [])

  const cancel = React.useCallback(() => {
    cancelRef.current = true
    setState((s) => ({ ...s, status: 'cancelled' }))
  }, [])

  const complete = React.useCallback((updated?: number) => {
    setState((s) => ({ ...s, status: 'complete', updated }))
  }, [])

  const setError = React.useCallback((msg: string) => {
    setState((s) => ({ ...s, status: 'error', error: msg }))
  }, [])

  const reset = React.useCallback(() => {
    setState(initialState)
  }, [])

  const value = React.useMemo(
    () => ({
      state,
      pauseRef,
      cancelRef,
      start,
      updateProgress,
      pause,
      resume,
      cancel,
      complete,
      setError,
      reset,
    }),
    [
      state,
      start,
      updateProgress,
      pause,
      resume,
      cancel,
      complete,
      setError,
      reset,
    ],
  )

  return (
    <BulkOperationContext.Provider value={value}>
      {children}
      <DynamicIsland />
    </BulkOperationContext.Provider>
  )
}

export function useBulkOperation() {
  const ctx = React.useContext(BulkOperationContext)
  if (!ctx) {
    throw new Error(
      'useBulkOperation must be used within BulkOperationProvider',
    )
  }
  return ctx
}

export function useBulkOperationOptional() {
  return React.useContext(BulkOperationContext)
}

function DynamicIsland() {
  const { state, pause, resume, cancel, reset } = useBulkOperation()
  const visible = state.status !== 'idle'

  React.useEffect(() => {
    if (state.status === 'complete') {
      const timer = setTimeout(reset, 3000)
      return () => clearTimeout(timer)
    }
  }, [state.status, reset])

  const progress = state.total > 0 ? (state.processed / state.total) * 100 : 0

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed top-4 left-1/2 z-50 -translate-x-1/2"
        >
          <div className="flex items-center gap-3 rounded-full bg-zinc-900 px-4 py-2.5 text-sm text-white shadow-lg">
            <StatusIcon status={state.status} />

            <div className="flex flex-col gap-1">
              <span className="whitespace-nowrap">
                {state.status === 'complete' && (
                  <>
                    Done &mdash;{' '}
                    {(state.updated ?? state.processed).toLocaleString()}{' '}
                    transactions updated
                  </>
                )}
                {state.status === 'cancelled' && <>Cancelled</>}
                {state.status === 'error' &&
                  (state.error ?? 'An error occurred')}
                {(state.status === 'processing' ||
                  state.status === 'paused') && (
                  <>
                    {state.processed.toLocaleString()} of{' '}
                    {state.total.toLocaleString()}
                  </>
                )}
              </span>

              {(state.status === 'processing' || state.status === 'paused') && (
                <div className="h-1 w-32 overflow-hidden rounded-full bg-zinc-700">
                  <motion.div
                    className="h-full rounded-full bg-white"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              )}
            </div>

            {state.status === 'processing' && (
              <button
                type="button"
                onClick={pause}
                className="rounded-full p-1 transition-colors hover:bg-zinc-700"
              >
                <Pause className="size-3.5" />
              </button>
            )}

            {state.status === 'paused' && (
              <button
                type="button"
                onClick={resume}
                className="rounded-full p-1 transition-colors hover:bg-zinc-700"
              >
                <Play className="size-3.5" />
              </button>
            )}

            {(state.status === 'processing' || state.status === 'paused') && (
              <button
                type="button"
                onClick={cancel}
                className="rounded-full p-1 transition-colors hover:bg-zinc-700"
              >
                <X className="size-3.5" />
              </button>
            )}

            {(state.status === 'cancelled' || state.status === 'error') && (
              <button
                type="button"
                onClick={reset}
                className="rounded-full p-1 transition-colors hover:bg-zinc-700"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function StatusIcon({ status }: { status: BulkOperationStatus }) {
  switch (status) {
    case 'processing':
      return <Loader2 className="size-4 animate-spin" />
    case 'paused':
      return <Pause className="size-4" />
    case 'complete':
      return <Check className="size-4 text-green-400" />
    case 'cancelled':
      return <XCircle className="size-4 text-yellow-400" />
    case 'error':
      return <XCircle className="size-4 text-red-400" />
    default:
      return null
  }
}
