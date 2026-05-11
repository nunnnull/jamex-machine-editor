import { motion } from 'framer-motion'
import { cn } from '../utils/cn'

interface ProgressBarProps {
  value: number
  max?: number
  variant?: 'default' | 'success' | 'error'
  label?: string
  showLabel?: boolean
  className?: string
}

const variantStyles = {
  default: 'from-blue-500 to-blue-600',
  success: 'from-green-500 to-green-600',
  error: 'from-red-500 to-red-600',
}

export default function ProgressBar({
  value,
  max = 100,
  variant = 'default',
  label,
  showLabel = true,
  className,
}: ProgressBarProps) {
  const pct = Math.min(Math.round((value / max) * 100), 100)

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {label || `${value}/${max}`}
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {pct}%
          </span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <motion.div
          className={cn('h-full rounded-full bg-gradient-to-r', variantStyles[variant])}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}
