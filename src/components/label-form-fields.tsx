import { useTranslation } from 'react-i18next'
import { ColorPicker } from '~/components/ui/color-picker'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'

interface LabelFormFieldsProps {
  name: string
  description: string
  color: string
  onNameChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onColorChange: (value: string) => void
}

export function LabelFormFields({
  name,
  description,
  color,
  onNameChange,
  onDescriptionChange,
  onColorChange,
}: LabelFormFieldsProps) {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="label-name" className="flex items-center">
          {t('form.name')}
          <span className="ml-auto font-normal text-muted-foreground">
            {t('form.required')}
          </span>
        </Label>
        <Input
          id="label-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={t('form.labelNamePlaceholder')}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="label-description">{t('form.description')}</Label>
        <Textarea
          id="label-description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder={t('form.labelDescriptionPlaceholder')}
          rows={2}
        />
      </div>
      <div className="space-y-2">
        <Label>{t('form.color')}</Label>
        <ColorPicker color={color} onChange={onColorChange} />
      </div>
    </div>
  )
}
