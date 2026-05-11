import { useState, useRef, useCallback, useEffect } from 'react'
import JSZip from 'jszip'
import { uploadImages, pollStatus, getDownloadUrl, getStatus, type StatusItem } from '../services/api'

export interface ImageItem {
  id: string
  file: File
  originalUrl: string
  previewUrl?: string
  status: 'pending' | 'uploading' | 'processing' | 'done' | 'failed'
  progress: number
  error?: string
  selected?: boolean
}

export interface ProcessingStats {
  uploaded: number
  processing: number
  completed: number
  failed: number
}

function genId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

const MAX_FILE_SIZE = 500 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/zip', 'application/x-zip-compressed']
const PERSIST_KEY = 'jamex_state'

function isPersistable(url: string | undefined): string | null {
  if (!url) return null
  if (url.startsWith('data:') || url.startsWith('/processed/') || url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  return null
}

function serializeImages(images: ImageItem[]): any[] {
  return images.map(img => ({
    id: img.id,
    fileName: img.file.name,
    fileSize: img.file.size,
    fileType: img.file.type,
    originalUrl: isPersistable(img.originalUrl),
    previewUrl: isPersistable(img.previewUrl),
    status: img.status,
    progress: img.progress,
    error: img.error,
    selected: img.selected,
  }))
}

function deserializeImages(data: any[]): ImageItem[] {
  return data.map((d: any) => ({
    id: d.id,
    file: new File([], d.fileName, { type: d.fileType }),
    originalUrl: d.originalUrl || '',
    previewUrl: d.previewUrl || undefined,
    status: d.status,
    progress: d.progress,
    error: d.error,
    selected: d.selected,
  }))
}

export function useImageProcessing() {
  const [images, setImages] = useState<ImageItem[]>([])
  const [jobId, setJobId] = useState<string | null>(null)
  const [rateLimited, setRateLimited] = useState(false)
  const [restored, setRestored] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const pollingRef = useRef<{ cancel: () => void } | null>(null)
  const jobBatchIdsRef = useRef<Set<string> | null>(null)
  const persistTimerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PERSIST_KEY)
      if (saved) {
        const { images: savedImages, jobId: savedJobId } = JSON.parse(saved)
        if (savedImages?.length > 0) {
          setImages(deserializeImages(savedImages))
          setRestored(true)
        }
        if (savedJobId) {
          setJobId(savedJobId)
        }
      }
    } catch {}
    setInitialized(true)
  }, [])

  useEffect(() => {
    if (!initialized || !jobId || !restored) return
    getStatus(jobId).then((response) => {
      const items = response.items || []
      setImages((prev) =>
        prev.map((img) => {
          const serverItem = items.find((item) => item.filename === img.file.name)
          if (!serverItem) return img
          const newStatus = serverItem.status
          if (newStatus === 'pending' && (img.status === 'uploading' || img.status === 'processing')) return img
          return {
            ...img,
            status: newStatus as ImageItem['status'],
            progress: serverItem.progress || 0,
            previewUrl: serverItem.preview_url || img.previewUrl,
            error: serverItem.error,
          }
        }),
      )
    }).catch(() => {
      // server unreachable, keep restored state as-is
    })
  }, [initialized, jobId, restored])

  useEffect(() => {
    if (!initialized) return
    clearTimeout(persistTimerRef.current)
    persistTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(PERSIST_KEY, JSON.stringify({
          images: serializeImages(images),
          jobId,
        }))
      } catch {}
    }, 500)
  }, [images, jobId, initialized])

  const stats: ProcessingStats = {
    uploaded: images.filter((i) => i.status === 'uploading' || i.status === 'processing' || i.status === 'done' || i.status === 'failed').length,
    processing: images.filter((i) => i.status === 'processing' || i.status === 'uploading').length,
    completed: images.filter((i) => i.status === 'done').length,
    failed: images.filter((i) => i.status === 'failed').length,
  }

  const uploadImageFiles = useCallback(async (files: File[], isRetry = false) => {
    const validFiles = files.filter((f) => {
      const ext = '.' + f.name.split('.').pop()?.toLowerCase()
      const isZip = ext === '.zip' && (f.type.includes('zip') || !f.type)
      if (!ALLOWED_TYPES.includes(f.type) && !isZip) {
        return false
      }
      if (f.size > MAX_FILE_SIZE) {
        return false
      }
      return true
    })

    if (validFiles.length === 0) return

    const newImages: ImageItem[] = validFiles.map((file) => ({
      id: genId(),
      file,
      originalUrl: URL.createObjectURL(file),
      status: 'uploading' as const,
      progress: 0,
    }))

    const batchIds = new Set(newImages.map(n => n.id))

    if (!isRetry) {
      setImages((prev) => [...prev, ...newImages])
    } else {
      setImages((prev) =>
        prev.map((img) =>
          batchIds.has(img.id)
            ? { ...img, status: 'uploading' as const }
            : img,
        ),
      )
    }

    const formData = new FormData()
    validFiles.forEach((file) => formData.append('images', file))

    try {
      const { jobId: jid } = await uploadImages(formData)
      setJobId(jid)

      setImages((prev) =>
        prev.map((img) =>
          batchIds.has(img.id)
            ? { ...img, status: 'processing' as const }
            : img,
        ),
      )

      setRateLimited(false)
      jobBatchIdsRef.current = batchIds
      if (pollingRef.current) pollingRef.current.cancel()
      pollingRef.current = pollStatus(jid, (response) => {
        const items = response.items || []
        setImages((prev) => {
          const thisBatchIds = batchIds
          const batchImgIds = [...prev].filter(i => thisBatchIds.has(i.id))

          const isZipBatch = batchImgIds.length === 1 && (
            batchImgIds[0]?.file.name.endsWith('.zip') ||
            batchImgIds[0]?.file.type.includes('zip')
          )

          let updated = prev.map((img) => {
            if (!thisBatchIds.has(img.id)) return img
            const batchIndex = batchImgIds.indexOf(img)
            const serverItem = items.find(item => item.filename === img.file.name)
              || items[batchIndex]
            if (!serverItem || serverItem.status === img.status) return img
            const newStatus = serverItem.status
            if (newStatus === 'pending' && (img.status === 'uploading' || img.status === 'processing')) return img
            return {
              ...img,
              status: newStatus as ImageItem['status'],
              progress: serverItem.progress || 0,
              previewUrl: serverItem.preview_url || img.previewUrl,
              error: serverItem.error,
            }
          })

          if (isZipBatch && items.length > 1) {
            const zipId = batchImgIds[0]!.id
            URL.revokeObjectURL(batchImgIds[0]!.originalUrl)
            updated = updated.filter(img => img.id !== zipId)
            thisBatchIds.delete(zipId)

            const extracted: ImageItem[] = items.map(item => {
              const id = genId()
              thisBatchIds.add(id)
              return {
                id,
                file: new File([], item.filename, { type: 'image/png' }),
                originalUrl: '',
                previewUrl: item.preview_url || undefined,
                status: item.status as ImageItem['status'],
                progress: item.progress || 0,
              }
            })
            updated = [...updated, ...extracted]
          }

          return updated
        })
        if (response.completed + response.failed >= response.total) {
          setRateLimited(false)
        }
      }, (status) => {
        if (status === 429) {
          setRateLimited(true)
        }
      })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Upload failed'

      if (validFiles.length > 1 && errMsg !== 'Upload failed') {
        console.warn(`[upload] Batch failed (${errMsg}), falling back to per-file upload`)
        setImages((prev) => prev.filter((img) => !batchIds.has(img.id)))
        for (const file of validFiles) {
          await uploadImageFiles([file], false).catch(() => {})
        }
        return
      }

      setImages((prev) =>
        prev.map((img) =>
          batchIds.has(img.id)
            ? { ...img, status: 'failed' as const, error: errMsg }
            : img,
        ),
      )
    }
  }, [])

  async function urlToBlob(url: string): Promise<Blob> {
    if (url.startsWith('data:')) {
      const [header, base64] = url.split(',', 2)
      const mime = header?.split(':')[1]?.split(';')[0] || 'image/png'
      const binary = atob(base64!)
      const array = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i)
      }
      return new Blob([array], { type: mime })
    }
    const resp = await fetch(url)
    return resp.blob()
  }

  const downloadAll = useCallback(async () => {
    const done = images.filter((i) => i.status === 'done' && i.previewUrl)
    if (done.length === 0) return
    const zip = new JSZip()
    for (const img of done) {
      try {
        const blob = await urlToBlob(img.previewUrl!)
        zip.file(img.file.name.replace(/\.[^.]+$/, '.png'), blob)
      } catch {
        console.warn('Failed to fetch image:', img.file.name)
      }
    }
    if (Object.keys(zip.files).length === 0) return
    const content = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(content)
    const a = document.createElement('a')
    a.href = url
    a.download = jobId ? `processed-${jobId}-${Date.now()}.zip` : `edited-${Date.now()}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [images, jobId])

  const downloadOne = useCallback(
    (imageId: string) => {
      const image = images.find((i) => i.id === imageId)
      if (!image?.previewUrl) return
      const a = document.createElement('a')
      a.href = image.previewUrl
      a.download = `processed-${image.file.name}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    },
    [images],
  )

  const retryFailed = useCallback(async () => {
    const failed = images.filter((i) => i.status === 'failed')
    if (failed.length === 0) return
    const files = failed.map((i) => i.file)
    setImages((prev) =>
      prev.filter((img) => !failed.some((f) => f.id === img.id)),
    )
    await uploadImageFiles(files)
  }, [images, uploadImageFiles])

  const toggleSelect = useCallback((id: string) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === id ? { ...img, selected: !img.selected } : img,
      ),
    )
  }, [])

  const selectAll = useCallback(() => {
    setImages((prev) =>
      prev.map((img) =>
        img.status === 'done' || img.selected !== undefined
          ? { ...img, selected: true }
          : img,
      ),
    )
  }, [])

  const deselectAll = useCallback(() => {
    setImages((prev) =>
      prev.map((img) => ({ ...img, selected: false })),
    )
  }, [])

  const getSelectedIds = useCallback((): string[] => {
    return images
      .filter((i) => i.status === 'done' && i.selected !== false)
      .map((i) => i.id)
  }, [images])

  const downloadSelected = useCallback(() => {
    if (!jobId) return
    const selected = getSelectedIds()
    if (selected.length === 0) return
    const baseUrl = getDownloadUrl(jobId)
    const url = `${baseUrl}?selected=${selected.join(',')}`
    const a = document.createElement('a')
    a.href = url
    a.download = 'selected-processed-images.zip'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [jobId, getSelectedIds])

  const addLocalImages = useCallback(async (files: File[]) => {
    const allImages: ImageItem[] = []
    const imgExts = new Set(['.jpg', '.jpeg', '.png', '.webp'])

    async function toDataUrl(blob: Blob): Promise<string> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    }

    for (const file of files) {
      const isZip = file.type.includes('zip') || (file.name.toLowerCase().endsWith('.zip') && !file.type)
      if (isZip) {
        const buf = await file.arrayBuffer()
        const zip = await JSZip.loadAsync(buf)
        const imgEntries = zip.filter((_relPath, entry) => {
          if (entry.dir) return false
          const ext = '.' + entry.name.split('.').pop()?.toLowerCase()
          return imgExts.has(ext)
        })
        for (const entry of imgEntries) {
          const blob = await entry.async('blob')
          const imgFile = new File([blob], entry.name, { type: blob.type })
          const url = await toDataUrl(blob)
          allImages.push({
            id: genId(),
            file: imgFile,
            originalUrl: url,
            previewUrl: url,
            status: 'done' as const,
            progress: 100,
            selected: true,
          })
        }
      } else {
        const url = await toDataUrl(file)
        allImages.push({
          id: genId(),
          file,
          originalUrl: url,
          previewUrl: url,
          status: 'done' as const,
          progress: 100,
          selected: true,
        })
      }
    }

    if (allImages.length > 0) {
      setImages((prev) => [...prev, ...allImages])
    }
  }, [])

  const saveEdit = useCallback((imageId: string, dataUrl: string) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === imageId ? { ...img, previewUrl: dataUrl } : img,
      ),
    )
  }, [])

  const downloadAllEdited = useCallback(async () => {
    const done = images.filter((i) => i.status === 'done' && i.previewUrl)
    if (done.length === 0) return
    const zip = new JSZip()
    for (const img of done) {
      try {
        const blob = await urlToBlob(img.previewUrl!)
        zip.file(img.file.name.replace(/\.[^.]+$/, '.png'), blob)
      } catch {
        console.warn('Failed to fetch image:', img.file.name)
      }
    }
    if (Object.keys(zip.files).length === 0) return
    const content = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(content)
    const a = document.createElement('a')
    a.href = url
    a.download = `edited-${Date.now()}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [images])

  const resumePolling = useCallback(() => {
    if (!jobId || !jobBatchIdsRef.current) return
    setRateLimited(false)
    const batchIds = jobBatchIdsRef.current
    pollingRef.current = pollStatus(jobId, (response) => {
      const items = response.items || []
      setImages((prev) => {
        const batchImgIds = [...prev].filter(i => batchIds.has(i.id))
        return prev.map((img) => {
          if (!batchIds.has(img.id)) return img
          const batchIndex = batchImgIds.indexOf(img)
          const serverItem = items.find(item => item.filename === img.file.name)
            || items[batchIndex]
          if (!serverItem || serverItem.status === img.status) return img
          const newStatus = serverItem.status
          if (newStatus === 'pending' && (img.status === 'uploading' || img.status === 'processing')) return img
          return {
            ...img,
            status: newStatus as ImageItem['status'],
            progress: serverItem.progress || 0,
            previewUrl: serverItem.preview_url || img.previewUrl,
            error: serverItem.error,
          }
        })
      })
      if (response.completed + response.failed >= response.total) {
        setRateLimited(false)
      }
    }, (status) => {
      if (status === 429) {
        setRateLimited(true)
      }
    })
  }, [jobId])

  const reorderImages = useCallback((reordered: ImageItem[]) => {
    setImages(reordered)
  }, [])

  const deleteImage = useCallback((imageId: string) => {
    setImages((prev) => prev.filter((img) => img.id !== imageId))
  }, [])

  const clearState = useCallback(() => {
    localStorage.removeItem(PERSIST_KEY)
    setImages([])
    setJobId(null)
    setRestored(false)
  }, [])

  return {
    images,
    stats,
    jobId,
    restored,
    uploadImages: uploadImageFiles,
    addLocalImages,
    saveEdit,
    reorderImages,
    deleteImage,
    clearState,
    downloadAllEdited,
    pollStatus: useCallback(() => {}, []),
    downloadAll,
    downloadOne,
    retryFailed,
    toggleSelect,
    selectAll,
    deselectAll,
    getSelectedIds,
    downloadSelected,
    rateLimited,
    resumePolling,
    clearRateLimited: useCallback(() => setRateLimited(false), []),
  }
}
