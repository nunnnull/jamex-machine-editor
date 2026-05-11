import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ImageDown, AlertTriangle, RefreshCw, X, RotateCcw, Keyboard } from 'lucide-react'
import { useImageProcessing } from './hooks/useImageProcessing'
import UploadZone from './components/UploadZone'
import ProcessingQueue from './components/ProcessingQueue'
import PreviewGallery from './components/PreviewGallery'
import DownloadControls from './components/DownloadControls'

const hotkeys = [
  { keys: 'Ctrl+B', ctx: 'Editor', desc: 'Select blur tool' },
  { keys: 'Ctrl+Q', ctx: 'Editor', desc: 'Reset to original image' },
  { keys: 'Ctrl+Z', ctx: 'Editor', desc: 'Undo last brush stroke' },
  { keys: 'Ctrl+S', ctx: 'Editor', desc: 'Export as PNG' },
  { keys: '← →', ctx: 'Editor', desc: 'Navigate between images' },
  { keys: 'Ctrl+B', ctx: 'Lightbox', desc: 'Edit with blur preselected' },
  { keys: 'Ctrl+Q', ctx: 'Lightbox', desc: 'Edit from original (reset)' },
]

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.4 },
  }),
}

export default function App() {
  const [showHotkeys, setShowHotkeys] = useState(false)
  const {
    images,
    stats,
    jobId,
    uploadImages,
    downloadAll,
    downloadOne,
    retryFailed,
    rateLimited,
    resumePolling,
    clearRateLimited,
    restored,
    addLocalImages,
    saveEdit,
    reorderImages,
    deleteImage,
    clearState,
    downloadAllEdited,
  } = useImageProcessing()

  return (
    <div className="min-h-screen bg-background">
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Jamex" className="h-9 rounded-lg bg-white" />
            <div>
              <h1 className="text-sm font-bold text-foreground">
                Machinery Background Remover
              </h1>
              <p className="text-xs text-muted-foreground">
                Industrial-grade image processing
              </p>
            </div>
          </div>
          {images.length > 0 && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <button
                onClick={() => setShowHotkeys(true)}
                className="rounded-md p-1.5 text-muted-foreground/50 transition-colors hover:text-foreground"
                title="Keyboard shortcuts"
              >
                <Keyboard className="h-4 w-4" />
              </button>
              <span className="flex items-center gap-1">
                <ImageDown className="h-3.5 w-3.5" />
                {stats.completed}/{images.length} done
              </span>
              <span className="hidden sm:inline">
                {stats.processing > 0 && `${stats.processing} processing`}
              </span>
            </div>
          )}
        </div>
      </motion.header>

      <AnimatePresence>
        {rateLimited && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-amber-500/30 bg-amber-500/10"
          >
            <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
              <p className="flex-1 text-xs text-amber-600 dark:text-amber-400">
                Status updates are temporarily rate-limited. Your images may still be processing.
              </p>
              <button
                onClick={resumePolling}
                className="flex items-center gap-1.5 rounded-md bg-amber-500/20 px-2.5 py-1 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-500/30 dark:text-amber-400"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Resume
              </button>
              <button
                onClick={clearRateLimited}
                className="rounded-full p-1 text-amber-500/60 hover:text-amber-500"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {restored && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-blue-500/30 bg-blue-500/10"
          >
            <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
              <RotateCcw className="h-4 w-4 shrink-0 text-blue-500" />
              <p className="flex-1 text-xs text-blue-600 dark:text-blue-400">
                Restored {images.length} image{images.length !== 1 ? 's' : ''} from previous session.
              </p>
              <button
                onClick={clearState}
                className="flex items-center gap-1.5 rounded-md bg-blue-500/20 px-2.5 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-500/30 dark:text-blue-400"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <motion.div
          custom={0}
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
        >
          <UploadZone onUpload={uploadImages} onLocalUpload={addLocalImages} />
        </motion.div>

        {images.length > 0 && (
          <>
            <motion.div
              custom={1}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
            >
              <ProcessingQueue
                images={images}
                stats={stats}
                onRetryFailed={retryFailed}
              />
            </motion.div>

            <motion.div
              custom={2}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
            >
              <PreviewGallery
                images={images}
                onDownloadOne={downloadOne}
                onSaveEdit={saveEdit}
                onDelete={deleteImage}
                onReorder={reorderImages}
              />
            </motion.div>

            <motion.div
              custom={3}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
            >
              <DownloadControls
                stats={stats}
                totalImages={images.length}
                onDownloadAll={downloadAll}
                onDownloadAllEdited={downloadAllEdited}
                onRetryFailed={retryFailed}
              />
            </motion.div>
          </>
        )}
      </main>

      <AnimatePresence>
        {showHotkeys && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={() => setShowHotkeys(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-xl border bg-card p-5 shadow-xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-card-foreground">Keyboard Shortcuts</h2>
                <button
                  onClick={() => setShowHotkeys(false)}
                  className="rounded-full p-1 text-muted-foreground/50 hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">
                {hotkeys.map((hk, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2"
                  >
                    <span className="min-w-[72px] rounded border bg-background px-2 py-0.5 text-center font-mono text-xs font-medium text-foreground">
                      {hk.keys}
                    </span>
                    <span className="text-xs text-muted-foreground">{hk.desc}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
