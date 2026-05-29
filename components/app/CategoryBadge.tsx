import * as LucideIcons from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  name: string
  iconName: string | null
  color: string | null
  size?: 'sm' | 'md'
}

export function CategoryBadge({ name, iconName, color, size = 'md' }: Props) {
  const Icon = iconName
    ? ((LucideIcons as unknown as Record<string, React.ElementType>)[
        iconName.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')
      ] ?? LucideIcons.Circle)
    : LucideIcons.Circle

  return (
    <span className={cn('inline-flex items-center gap-1.5 font-medium', size === 'sm' ? 'text-xs' : 'text-sm')}>
      <span
        className={cn('flex items-center justify-center rounded-full', size === 'sm' ? 'w-5 h-5' : 'w-7 h-7')}
        style={{ backgroundColor: color ? `${color}20` : '#9CA3AF20' }}
      >
        <Icon size={size === 'sm' ? 10 : 14} style={{ color: color ?? '#9CA3AF' }} />
      </span>
      {name}
    </span>
  )
}
