import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Download,
  Maximize2,
  CheckCircle2,
  XCircle,
  Loader2,
  Paintbrush,
  Trash2,
  ImageDown,
  GripVertical,
} from 'lucide-react'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { cn } from '../utils/cn'
import type { ImageItem } from '../hooks/useImageProcessing'

interface ImageCardProps {
  image: ImageItem
  showOriginal?: boolean
  showSelection?: boolean
  onDownload: (id: string) => void
  onExpand: (id: string) => void
  onToggleSelect?: (id: string) => void
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  dragHandleProps?: {
    onDragStart: (e: React.DragEvent) => void
    onDragEnd: (e: React.DragEvent) => void
  }
  isDragging?: boolean
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
}

const statusConfig = {
  pending: { label: 'Pending', variant: 'outline' as const },
  uploading: { label: 'Uploading', variant: 'secondary' as const },
  processing: { label: 'Processing', variant: 'secondary' as const },
  done: { label: 'Done', variant: 'default' as const },
  failed: { label: 'Failed', variant: 'destructive' as const },
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function ImageCard({
  image, showOriginal = false, onDownload, onExpand, onEdit, onDelete,
  dragHandleProps, isDragging, onDragOver, onDrop,
}: ImageCardProps) {
  const cfg = statusConfig[image.status]
  const imgSrc = showOriginal ? image.originalUrl : (image.previewUrl || image.originalUrl)
  const [imgError, setImgError] = useState(false)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'group relative overflow-hidden rounded-lg border bg-card',
        isDragging && 'opacity-50 ring-2 ring-primary',
      )}
      draggable
      onDragStart={dragHandleProps?.onDragStart}
      onDragEnd={dragHandleProps?.onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="relative aspect-square overflow-hidden">
        {image.status === 'processing' || image.status === 'uploading' ? (
          <div className="flex h-full items-center justify-center bg-secondary/50">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : image.status === 'failed' ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-destructive/10">
            <XCircle className="h-10 w-10 text-destructive" />
            <span className="text-xs text-destructive">{image.error || 'Failed'}</span>
          </div>
        ) : (
          <>
            <button
              onClick={() => onExpand(image.id)}
              className="h-full w-full"
              title="Click to expand"
            >
              {imgError ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 bg-muted">
                  <ImageDown className="h-8 w-8 text-muted-foreground/50" />
                  <span className="text-xs text-muted-foreground">Unavailable</span>
                </div>
              ) : (
                <img
                  src={imgSrc}
                  alt={image.file.name}
                  className="h-full w-full object-contain"
                  onError={() => setImgError(true)}
                />
              )}
            </button>
            {image.status === 'done' && (
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute right-2 top-2 pointer-events-none"
              >
                <CheckCircle2 className="h-6 w-6 text-green-500 drop-shadow-md" />
              </motion.div>
            )}
          </>
        )}
        {showOriginal && image.status !== 'failed' && image.status !== 'uploading' && image.status !== 'processing' && (
          <div className="absolute left-2 top-2 rounded-md bg-amber-500/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
            Original
          </div>
        )}
        {image.status === 'done' && (
          <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              size="icon"
              variant="secondary"
              onClick={() => onExpand(image.id)}
              title="Expand"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            {onEdit && (
              <Button
                size="icon"
                variant="secondary"
                onClick={() => onEdit(image.id)}
                title="Edit with brush"
              >
                <Paintbrush className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="icon"
              variant="secondary"
              onClick={() => onDownload(image.id)}
              title="Download"
            >
              <Download className="h-4 w-4" />
            </Button>
            {onDelete && (
              <Button
                size="icon"
                variant="secondary"
                onClick={() => onDelete(image.id)}
                title="Delete"
                className="hover:bg-destructive/20 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
        {image.status === 'failed' && onEdit && (
          <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {onDelete && (
              <Button
                size="icon"
                variant="secondary"
                onClick={() => onDelete(image.id)}
                title="Delete"
                className="hover:bg-destructive/20 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="icon"
              variant="secondary"
              onClick={() => onEdit(image.id)}
              title="Edit with brush"
            >
              <Paintbrush className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 border-t p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-foreground">
            {image.file.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatSize(image.fileSize || image.file.size)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {onDelete && (
            <button
              onClick={() => onDelete(image.id)}
              title="Delete"
              className="rounded p-1 text-muted-foreground/50 transition-colors hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <GripVertical className="h-3.5 w-3.5 cursor-grab text-muted-foreground/40 active:cursor-grabbing" />
          <Badge variant={cfg.variant} className="shrink-0">
            {cfg.label}
          </Badge>
        </div>
      </div>
    </motion.div>
  )
}
