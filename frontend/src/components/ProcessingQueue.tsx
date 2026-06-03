import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Loader2, CheckCircle2, XCircle, ImageDown } from 'lucide-react'
import { cn } from '../utils/cn'
import { Button } from './ui/button'
import ProgressBar from './ProgressBar'
import type { ImageItem, ProcessingStats } from '../hooks/useImageProcessing'

interface ProcessingQueueProps {
  images: ImageItem[]
  stats: ProcessingStats
  onRetryFailed: () => void
}

const statusIcon = {
  pending: null,
  uploading: Loader2,
  processing: Loader2,
  done: CheckCircle2,
  failed: XCircle,
}

const statusColor = {
  pending: 'border-muted',
  uploading: 'border-blue-500',
  processing: 'border-blue-500',
  done: 'border-green-500',
  failed: 'border-red-500',
}

export default function ProcessingQueue({
  images,
  stats,
  onRetryFailed,
}: ProcessingQueueProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set())
  const active = images.filter(
    (i) => i.status === 'uploading' || i.status === 'processing',
  )

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [active.length])

  const total = images.length
  const completed = stats.completed + stats.failed

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="rounded-lg border bg-card"
    >
      <div className="border-b p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            Processing Queue
          </h3>
          {stats.failed > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetryFailed}
              className="h-7 gap-1 text-xs"
            >
              <RefreshCw className="h-3 w-3" />
              Retry Failed
            </Button>
          )}
        </div>
        <ProgressBar
          value={completed}
          max={total}
          variant={stats.failed > 0 ? 'error' : 'success'}
          label={`${completed} / ${total} processed`}
        />
        <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
          <span>Uploaded: {stats.uploaded}</span>
          <span>Processing: {active.length}</span>
          <span>Completed: {stats.completed}</span>
          <span className={cn(stats.failed > 0 && 'text-destructive')}>
            Failed: {stats.failed}
          </span>
        </div>
      </div>
      {images.length > 0 && (
        <div
          ref={scrollRef}
          className="max-h-48 space-y-1 overflow-y-auto p-2"
        >
          <AnimatePresence>
            {images.map((img) => {
              const Icon = statusIcon[img.status]
              return (
                <motion.div
                  key={img.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className={cn(
                    'flex items-center gap-3 rounded-md border-l-2 p-2',
                    statusColor[img.status],
                  )}
                >
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded bg-secondary">
                    {brokenImages.has(img.id) || !img.originalUrl ? (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <ImageDown className="h-4 w-4" />
                      </div>
                    ) : (
                      <img
                        src={img.originalUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={() => setBrokenImages(prev => new Set(prev).add(img.id))}
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">
                      {img.file.name}
                    </p>
                    {img.status === 'processing' && (
                      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-secondary">
                        <motion.div
                          className="h-full rounded-full bg-primary"
                          initial={{ width: 0 }}
                          animate={{ width: `${img.progress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    )}
                    {img.status === 'failed' && img.error && (
                      <p className="truncate text-xs text-destructive">
                        {img.error}
                      </p>
                    )}
                  </div>
                  {Icon && (
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0',
                        img.status === 'processing' && 'animate-spin text-primary',
                        img.status === 'done' && 'text-green-500',
                        img.status === 'failed' && 'text-red-500',
                      )}
                    />
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
      {images.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-6 w-6" />
          <p className="text-sm">No images in queue</p>
        </div>
      )}
    </motion.div>
  )
}
