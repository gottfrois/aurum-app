'use client'

import {
  CheckCircle,
  ChevronDown,
  Loader2,
  Settings,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '~/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible'
import { cn } from '~/lib/utils'

export type ToolPart = {
  type: string
  state:
    | 'input-streaming'
    | 'input-available'
    | 'output-available'
    | 'output-error'
    | 'output-denied'
    | 'approval-requested'
    | 'approval-responded'
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  toolCallId?: string
  errorText?: string
}

export type ToolProps = {
  toolPart: ToolPart
  defaultOpen?: boolean
  className?: string
}

const Tool = ({ toolPart, defaultOpen = false, className }: ToolProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const { state, input, output, toolCallId } = toolPart

  const getStateIcon = () => {
    switch (state) {
      case 'input-streaming':
        return <Loader2 className="size-4 animate-spin text-info" />
      case 'input-available':
        return <Settings className="size-4 text-warning" />
      case 'output-available':
        return <CheckCircle className="size-4 text-success" />
      case 'output-error':
        return <XCircle className="size-4 text-destructive" />
      case 'output-denied':
        return <XCircle className="size-4 text-warning" />
      default:
        return <Settings className="text-muted-foreground size-4" />
    }
  }

  const getStateBadge = () => {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium'
    switch (state) {
      case 'input-streaming':
        return (
          <span className={cn(baseClasses, 'bg-info/10 text-info')}>
            Processing
          </span>
        )
      case 'input-available':
        return (
          <span className={cn(baseClasses, 'bg-warning/10 text-warning')}>
            Ready
          </span>
        )
      case 'output-available':
        return (
          <span className={cn(baseClasses, 'bg-success/10 text-success')}>
            Completed
          </span>
        )
      case 'output-error':
        return (
          <span
            className={cn(baseClasses, 'bg-destructive/10 text-destructive')}
          >
            Error
          </span>
        )
      case 'output-denied':
        return (
          <span className={cn(baseClasses, 'bg-warning/10 text-warning')}>
            Rejected
          </span>
        )
      default:
        return (
          <span className={cn(baseClasses, 'bg-muted text-muted-foreground')}>
            Pending
          </span>
        )
    }
  }

  const formatValue = (value: unknown): string => {
    if (value === null) return 'null'
    if (value === undefined) return 'undefined'
    if (typeof value === 'string') return value
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2)
    }
    return String(value)
  }

  return (
    <div
      className={cn(
        'border-border mt-3 overflow-hidden rounded-lg border',
        className,
      )}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="bg-background h-auto w-full justify-between rounded-b-none px-3 py-2 font-normal"
          >
            <div className="flex min-w-0 items-center gap-2">
              {getStateIcon()}
              <span className="truncate font-mono text-sm font-medium">
                {toolPart.type}
              </span>
              {getStateBadge()}
            </div>
            <ChevronDown
              className={cn('size-4 shrink-0', isOpen && 'rotate-180')}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent
          className={cn(
            'border-border border-t',
            'data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden',
          )}
        >
          <div className="bg-background space-y-3 p-3">
            {input && Object.keys(input).length > 0 && (
              <div>
                <h4 className="text-muted-foreground mb-2 text-sm font-medium">
                  Input
                </h4>
                <div className="bg-background rounded border p-2 font-mono text-sm">
                  {Object.entries(input).map(([key, value]) => (
                    <div key={key} className="mb-1">
                      <span className="text-muted-foreground">{key}:</span>{' '}
                      <span>{formatValue(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {output && (
              <div>
                <h4 className="text-muted-foreground mb-2 text-sm font-medium">
                  Output
                </h4>
                <div className="bg-background max-h-60 overflow-auto rounded border p-2 font-mono text-sm">
                  <pre className="whitespace-pre-wrap">
                    {formatValue(output)}
                  </pre>
                </div>
              </div>
            )}

            {state === 'output-error' && toolPart.errorText && (
              <div>
                <h4 className="mb-2 text-sm font-medium text-destructive">
                  Error
                </h4>
                <div className="rounded border border-destructive/20 bg-destructive/5 p-2 text-sm">
                  {toolPart.errorText}
                </div>
              </div>
            )}

            {state === 'input-streaming' && (
              <div className="text-muted-foreground text-sm">
                Processing tool call...
              </div>
            )}

            {toolCallId && (
              <div className="text-muted-foreground border-t border-border pt-2 text-xs">
                <span className="font-mono">Call ID: {toolCallId}</span>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

export { Tool }
