import { useConvexAuth } from 'convex/react'
import * as React from 'react'
import { DynamicIsland } from '~/components/dynamic-island'
import { useBatchOperationSync } from '~/hooks/use-batch-operation-sync'

type BulkOperationStatus =
  | 'idle'
  | 'processing'
  | 'paused'
  | 'complete'
  | 'cancelled'
  | 'error'

type BulkOperationSource = 'client' | 'server'

interface BulkOperationState {
  status: BulkOperationStatus
  label: string
  processed: number
  total: number
  updated?: number
  error?: string
  source?: BulkOperationSource
}

interface BulkOperationContextValue {
  state: BulkOperationState
  pauseRef: React.RefObject<boolean>
  cancelRef: React.RefObject<boolean>
  start: (label: string, total: number, source?: BulkOperationSource) => void
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

  const start = React.useCallback(
    (label: string, total: number, source?: BulkOperationSource) => {
      pauseRef.current = false
      cancelRef.current = false
      setState({ status: 'processing', label, processed: 0, total, source })
    },
    [],
  )

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
      <BatchOperationSyncBridge />
      <ConnectedDynamicIsland />
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

function BatchOperationSyncBridge() {
  const { isAuthenticated } = useConvexAuth()
  if (!isAuthenticated) return null
  return <BatchOperationSyncInner />
}

function BatchOperationSyncInner() {
  useBatchOperationSync()
  return null
}

function ConnectedDynamicIsland() {
  const { state, pause, resume, cancel, reset } = useBulkOperation()

  React.useEffect(() => {
    if (state.status === 'complete') {
      const timer = setTimeout(reset, 3000)
      return () => clearTimeout(timer)
    }
  }, [state.status, reset])

  return (
    <DynamicIsland
      status={state.status}
      label={state.label}
      processed={state.processed}
      total={state.total}
      updated={state.updated}
      error={state.error}
      source={state.source}
      onPause={pause}
      onResume={resume}
      onCancel={cancel}
      onDismiss={reset}
    />
  )
}
