import { motion } from 'framer-motion'
import { Download, RefreshCw, FileDown } from 'lucide-react'
import { cn } from '../utils/cn'
import { Button } from './ui/button'
import ProgressBar from './ProgressBar'
import type { ProcessingStats } from '../hooks/useImageProcessing'

interface DownloadControlsProps {
  stats: ProcessingStats
  totalImages: number
  onDownloadAll: () => void
  onDownloadAllEdited?: () => void
  onRetryFailed: () => void
}

function estimateSize(count: number): string {
  if (count === 0) return '0 B'
  const estimated = count * 1.5 * 1024 * 1024
  if (estimated < 1024 * 1024) return `${(estimated / 1024).toFixed(0)} KB`
  return `${(estimated / (1024 * 1024)).toFixed(1)} MB`
}

export default function DownloadControls({
  stats,
  totalImages,
  onDownloadAll,
  onDownloadAllEdited,
  onRetryFailed,
}: DownloadControlsProps) {
  const hasCompleted = stats.completed > 0
  const hasFailed = stats.failed > 0
  const isProcessing = stats.processing > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="rounded-lg border bg-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-4">
          <Button
            onClick={onDownloadAll}
            disabled={!hasCompleted || isProcessing}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download All as ZIP
          </Button>
          <Button
            variant="secondary"
            onClick={onDownloadAllEdited}
            disabled={!hasCompleted}
            className="gap-2"
          >
            <FileDown className="h-4 w-4" />
            Download Edited
          </Button>
          <Button
            variant="outline"
            onClick={onRetryFailed}
            disabled={!hasFailed}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Retry Failed
          </Button>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            Completed:{' '}
            <span className="font-medium text-foreground">
              {stats.completed}
            </span>
          </span>
          <span>
            Selected:{' '}
            <span className="font-medium text-foreground">
              {stats.completed}
            </span>
          </span>
          <span>
            Est. size:{' '}
            <span className="font-medium text-foreground">
              {estimateSize(stats.completed)}
            </span>
          </span>
        </div>
      </div>
      {totalImages > 0 && (
        <div className="border-t px-4 py-2">
          <ProgressBar
            value={stats.completed + stats.failed}
            max={totalImages}
            variant={hasFailed ? 'error' : 'success'}
            showLabel={false}
          />
        </div>
      )}
    </motion.div>
  )
}
