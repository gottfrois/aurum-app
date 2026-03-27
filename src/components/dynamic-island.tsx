import { Check, Loader2, Pause, Play, X, XCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

type BulkOperationStatus =
  | 'idle'
  | 'processing'
  | 'paused'
  | 'complete'
  | 'cancelled'
  | 'error'

export interface DynamicIslandProps {
  status: BulkOperationStatus
  label: string
  processed: number
  total: number
  updated?: number
  error?: string
  source?: 'client' | 'server'
  onPause?: () => void
  onResume?: () => void
  onCancel?: () => void
  onDismiss?: () => void
}

export function DynamicIsland({
  status,
  processed,
  total,
  updated,
  error,
  source,
  onPause,
  onResume,
  onCancel,
  onDismiss,
}: DynamicIslandProps) {
  const visible = status !== 'idle'
  const progress = total > 0 ? (processed / total) * 100 : 0

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
            <StatusIcon status={status} />

            <div className="flex flex-col gap-1">
              <span className="whitespace-nowrap">
                {status === 'complete' && (
                  <>
                    Done &mdash; {(updated ?? processed).toLocaleString()}{' '}
                    transactions updated
                  </>
                )}
                {status === 'cancelled' && <>Cancelled</>}
                {status === 'error' && (error ?? 'An error occurred')}
                {(status === 'processing' || status === 'paused') && (
                  <>
                    {processed.toLocaleString()} of {total.toLocaleString()}
                  </>
                )}
              </span>

              {(status === 'processing' || status === 'paused') && (
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

            {status === 'processing' && source !== 'server' && (
              <button
                type="button"
                onClick={onPause}
                className="rounded-full p-1 transition-colors hover:bg-zinc-700"
              >
                <Pause className="size-3.5" />
              </button>
            )}

            {status === 'paused' && source !== 'server' && (
              <button
                type="button"
                onClick={onResume}
                className="rounded-full p-1 transition-colors hover:bg-zinc-700"
              >
                <Play className="size-3.5" />
              </button>
            )}

            {(status === 'processing' || status === 'paused') &&
              source !== 'server' && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded-full p-1 transition-colors hover:bg-zinc-700"
                >
                  <X className="size-3.5" />
                </button>
              )}

            {(status === 'cancelled' || status === 'error') && (
              <button
                type="button"
                onClick={onDismiss}
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
