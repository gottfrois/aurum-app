import { useMutation, useQuery } from 'convex/react'
import { useEffect, useRef } from 'react'
import { useBulkOperation } from '~/contexts/bulk-operation-context'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

const BATCH_LABELS: Record<string, string> = {
  'batch.labels.updating': 'Updating labels',
  'batch.category.updating': 'Updating category',
  'batch.exclusion.excluding': 'Excluding from budget',
  'batch.exclusion.including': 'Including in budget',
}

function resolveBatchLabel(key: string): string {
  return BATCH_LABELS[key] ?? key
}

export function useBatchOperationSync() {
  const { state, start, updateProgress, complete, setError } =
    useBulkOperation()
  const activeBatchOp = useQuery(api.batchOperations.getActiveBatchOperation)
  const deleteBatchOp = useMutation(api.batchOperations.deleteBatchOperation)

  const syncedOpRef = useRef<Id<'batchOperations'> | null>(null)
  const handledTerminalRef = useRef<Id<'batchOperations'> | null>(null)
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // No active server operation
    if (!activeBatchOp) {
      syncedOpRef.current = null
      handledTerminalRef.current = null
      return
    }

    // Don't overwrite an active client-side operation
    if (
      state.status !== 'idle' &&
      state.source === 'client' &&
      syncedOpRef.current !== activeBatchOp._id
    ) {
      return
    }

    // Already handled this operation's terminal state — don't re-trigger
    if (handledTerminalRef.current === activeBatchOp._id) {
      return
    }

    if (activeBatchOp.status === 'processing') {
      if (syncedOpRef.current !== activeBatchOp._id) {
        // New server operation detected
        start(
          resolveBatchLabel(activeBatchOp.label),
          activeBatchOp.total,
          'server',
        )
        syncedOpRef.current = activeBatchOp._id
      } else {
        // Progress update
        updateProgress(activeBatchOp.processed)
      }
    }

    if (activeBatchOp.status === 'complete') {
      complete(activeBatchOp.processed)
      handledTerminalRef.current = activeBatchOp._id

      // Clean up the record after the Dynamic Island auto-dismisses
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
      deleteTimerRef.current = setTimeout(() => {
        deleteBatchOp({ operationId: activeBatchOp._id })
        deleteTimerRef.current = null
      }, 4000)
    }

    if (activeBatchOp.status === 'error') {
      setError(activeBatchOp.error ?? 'Batch operation failed')
      handledTerminalRef.current = activeBatchOp._id

      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
      deleteTimerRef.current = setTimeout(() => {
        deleteBatchOp({ operationId: activeBatchOp._id })
        deleteTimerRef.current = null
      }, 5000)
    }
  }, [
    activeBatchOp,
    state.status,
    state.source,
    start,
    updateProgress,
    complete,
    setError,
    deleteBatchOp,
  ])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
    }
  }, [])
}
