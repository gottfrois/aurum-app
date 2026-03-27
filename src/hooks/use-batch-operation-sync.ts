import { useMutation, useQuery } from 'convex/react'
import { useEffect, useRef } from 'react'
import { useBulkOperation } from '~/contexts/bulk-operation-context'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

export function useBatchOperationSync() {
  const { state, start, updateProgress, complete, setError } =
    useBulkOperation()
  const activeBatchOp = useQuery(api.batchOperations.getActiveBatchOperation)
  const deleteBatchOp = useMutation(api.batchOperations.deleteBatchOperation)

  const syncedOpRef = useRef<Id<'batchOperations'> | null>(null)
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // No active server operation
    if (!activeBatchOp) {
      syncedOpRef.current = null
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

    if (activeBatchOp.status === 'processing') {
      if (syncedOpRef.current !== activeBatchOp._id) {
        // New server operation detected
        start(activeBatchOp.label, activeBatchOp.total, 'server')
        syncedOpRef.current = activeBatchOp._id
      } else {
        // Progress update
        updateProgress(activeBatchOp.processed)
      }
    }

    if (activeBatchOp.status === 'complete') {
      complete(activeBatchOp.processed)
      syncedOpRef.current = null

      // Clean up the record after the Dynamic Island auto-dismisses
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
      deleteTimerRef.current = setTimeout(() => {
        deleteBatchOp({ operationId: activeBatchOp._id })
        deleteTimerRef.current = null
      }, 4000)
    }

    if (activeBatchOp.status === 'error') {
      setError(activeBatchOp.error ?? 'Batch operation failed')
      syncedOpRef.current = null

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
