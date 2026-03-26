import type { ReactNode } from 'react'

function PageHeader({
  title,
  description,
  icon,
  action,
}: {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
}) {
  return (
    <header>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {icon}
          <h1 className="text-3xl font-semibold">{title}</h1>
        </div>
        {action}
      </div>
      {description && !icon && (
        <p className="mt-1 text-muted-foreground">{description}</p>
      )}
    </header>
  )
}

export { PageHeader }
