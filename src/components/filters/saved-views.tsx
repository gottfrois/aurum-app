import { Link } from '@tanstack/react-router'
import { Layers } from 'lucide-react'
import { Button } from '~/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/tooltip'

export function SavedViews() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" asChild>
          <Link to="/views">
            <Layers />
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Views</TooltipContent>
    </Tooltip>
  )
}
