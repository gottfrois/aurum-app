import { ColorPicker } from '~/components/ui/color-picker'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'

interface CategoryFormFieldsProps {
  label: string
  description: string
  color: string
  onLabelChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onColorChange: (value: string) => void
}

export function CategoryFormFields({
  label,
  description,
  color,
  onLabelChange,
  onDescriptionChange,
  onColorChange,
}: CategoryFormFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cat-label" className="flex items-center">
          Name
          <span className="ml-auto font-normal text-muted-foreground">
            Required
          </span>
        </Label>
        <Input
          id="cat-label"
          value={label}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder="e.g. Coffee Shops"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cat-description">Description</Label>
        <Textarea
          id="cat-description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="e.g. Daily coffee expenses"
          rows={2}
        />
      </div>
      <div className="space-y-2">
        <Label>Color</Label>
        <ColorPicker color={color} onChange={onColorChange} />
      </div>
    </div>
  )
}
