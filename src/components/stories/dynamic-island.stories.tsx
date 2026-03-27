import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useRef, useState } from 'react'
import { DynamicIsland, type DynamicIslandProps } from '../dynamic-island'

const meta = {
  title: 'Feedback/DynamicIsland',
  component: DynamicIsland,
  args: {
    label: 'Updating labels',
    processed: 0,
    total: 500,
  },
} satisfies Meta<typeof DynamicIsland>

export default meta
type Story = StoryObj<typeof meta>

// --- Static states ---

export const Processing: Story = {
  args: {
    status: 'processing',
    processed: 150,
    total: 500,
  },
}

export const ProcessingEarly: Story = {
  args: {
    status: 'processing',
    processed: 12,
    total: 1200,
    label: 'Updating category',
  },
}

export const ProcessingNearComplete: Story = {
  args: {
    status: 'processing',
    processed: 480,
    total: 500,
    label: 'Excluding from budget',
  },
}

export const Paused: Story = {
  args: {
    status: 'paused',
    processed: 250,
    total: 500,
  },
}

export const Complete: Story = {
  args: {
    status: 'complete',
    processed: 500,
    total: 500,
    updated: 500,
  },
}

export const CompletePartial: Story = {
  args: {
    status: 'complete',
    processed: 500,
    total: 500,
    updated: 342,
    label: 'Updating category',
  },
}

export const Cancelled: Story = {
  args: {
    status: 'cancelled',
    processed: 200,
    total: 500,
  },
}

export const ErrorState: Story = {
  args: {
    status: 'error',
    processed: 100,
    total: 500,
    error: 'Failed to update transactions',
  },
}

export const ErrorDefault: Story = {
  args: {
    status: 'error',
    processed: 0,
    total: 500,
  },
}

// --- Server-side operation (no pause/cancel controls) ---

export const ServerSideProcessing: Story = {
  args: {
    status: 'processing',
    processed: 200,
    total: 500,
    source: 'server',
    label: 'Updating labels',
  },
}

export const ServerSideComplete: Story = {
  args: {
    status: 'complete',
    processed: 500,
    total: 500,
    updated: 500,
    source: 'server',
  },
}

// --- Interactive demos ---

function SimulatedProgressDemo(props: DynamicIslandProps) {
  const [processed, setProcessed] = useState(0)
  const [status, setStatus] = useState<DynamicIslandProps['status']>('idle')
  const pausedRef = useRef(false)
  const cancelledRef = useRef(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const total = props.total || 500

  function startProcessing() {
    setProcessed(0)
    setStatus('processing')
    pausedRef.current = false
    cancelledRef.current = false
  }

  useEffect(() => {
    if (status !== 'processing') {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }

    intervalRef.current = setInterval(() => {
      if (pausedRef.current || cancelledRef.current) return

      setProcessed((prev) => {
        const next = prev + Math.floor(Math.random() * 30) + 10
        if (next >= total) {
          setStatus('complete')
          return total
        }
        return next
      })
    }, 300)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [status, total])

  return (
    <div className="flex flex-col items-center gap-6 pt-20">
      <DynamicIsland
        {...props}
        status={status}
        processed={processed}
        total={total}
        updated={status === 'complete' ? processed : undefined}
        onPause={() => {
          pausedRef.current = true
          setStatus('paused')
        }}
        onResume={() => {
          pausedRef.current = false
          setStatus('processing')
        }}
        onCancel={() => {
          cancelledRef.current = true
          setStatus('cancelled')
        }}
        onDismiss={() => setStatus('idle')}
      />

      {status === 'idle' && (
        <button
          type="button"
          onClick={startProcessing}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800"
        >
          Start batch operation
        </button>
      )}

      {(status === 'complete' ||
        status === 'cancelled' ||
        status === 'error') && (
        <button
          type="button"
          onClick={startProcessing}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800"
        >
          Run again
        </button>
      )}
    </div>
  )
}

export const Interactive: Story = {
  args: {
    status: 'idle',
    label: 'Updating labels',
    processed: 0,
    total: 500,
  },
  render: (args) => <SimulatedProgressDemo {...args} />,
}

export const InteractiveServerSide: Story = {
  args: {
    status: 'idle',
    label: 'Updating category',
    processed: 0,
    total: 300,
    source: 'server',
  },
  render: (args) => <SimulatedProgressDemo {...args} />,
}
