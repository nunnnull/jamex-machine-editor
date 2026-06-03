import { useCallback, useRef, useState } from 'react'
import { useDropzone, type FileRejection } from 'react-dropzone'
import { motion } from 'framer-motion'
import { Upload, Image, FileWarning, Paintbrush } from 'lucide-react'
import { cn } from '../utils/cn'

interface UploadZoneProps {
  onUpload: (files: File[]) => void
  onLocalUpload?: (files: File[]) => void | Promise<void>
  disabled?: boolean
}

const MAX_SIZE = 500 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/zip', 'application/x-zip-compressed']

export default function UploadZone({ onUpload, onLocalUpload, disabled }: UploadZoneProps) {
  const [rejection, setRejection] = useState<string | null>(null)
  const localInputRef = useRef<HTMLInputElement>(null)

  const onDrop = useCallback(
    (acceptedFiles: File[], rejections: FileRejection[]) => {
      setRejection(null)
      if (rejections.length > 0) {
        const msg = rejections[0]?.errors[0]?.message || 'Invalid file'
        if (msg.includes('type')) {
          setRejection('Only JPG, PNG, and WEBP files are accepted.')
        } else if (msg.includes('size')) {
          setRejection('File exceeds 25MB limit.')
        } else {
          setRejection(msg)
        }
        return
      }
      if (acceptedFiles.length > 0) {
        onUpload(acceptedFiles)
      }
    },
    [onUpload],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip'],
    },
    maxSize: MAX_SIZE,
    disabled,
    multiple: true,
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div
        {...getRootProps()}
        className={cn(
          'relative cursor-pointer overflow-hidden rounded-lg border-2 border-dashed p-12 text-center transition-colors',
          isDragActive
            ? 'border-primary bg-primary/10'
            : 'border-muted-foreground/30 hover:border-muted-foreground/50',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <input {...getInputProps()} />
        {isDragActive && (
          <motion.div
            className="absolute inset-0 bg-primary/5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            layout
          />
        )}
        <motion.div
          animate={isDragActive ? { scale: 1.1 } : { scale: 1 }}
          className="relative z-10 flex flex-col items-center gap-3"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
            {isDragActive ? (
              <Image className="h-8 w-8 text-primary" />
            ) : (
              <Upload className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="text-lg font-medium text-foreground">
              {isDragActive
                ? 'Drop machinery images here'
                : 'Drop machinery images here'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              or click to browse
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>JPG</span>
            <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
            <span>PNG</span>
            <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
            <span>WEBP</span>
            <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
            <span>ZIP</span>
            <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
            <span>max 500MB</span>
          </div>
        </motion.div>
      </div>
      {onLocalUpload && (
        <div className="mt-4 flex items-center gap-4">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>
      )}

      {onLocalUpload && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <input
            ref={localInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/zip,application/x-zip-compressed"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || [])
              if (files.length > 0) {
                onLocalUpload(files)
                e.target.value = ''
              }
            }}
          />
          <div
            onClick={() => localInputRef.current?.click()}
            className={cn(
              'flex cursor-pointer items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-4 text-center transition-colors',
              'border-muted-foreground/20 hover:border-primary/40 hover:bg-primary/5',
              disabled && 'pointer-events-none opacity-50',
            )}
          >
            <Paintbrush className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Edit images locally
              </p>
              <p className="text-xs text-muted-foreground">
                Browse images &amp; use the brush tool — no API needed
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {rejection && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-2 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <FileWarning className="h-4 w-4 shrink-0" />
          {rejection}
        </motion.div>
      )}
    </motion.div>
  )
}
