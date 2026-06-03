/// <reference types="vite/client" />
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || ''

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 120000,
})

api.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error),
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const data = error.response?.data
    const message =
      data?.error || data?.message || data?.detail || error.message || 'An error occurred'
    const wrapped = new Error(message)
    ;(wrapped as any).status = error.response?.status
    ;(wrapped as any).data = data
    return Promise.reject(wrapped)
  },
)

export interface StatusItem {
  id: string
  filename: string
  status: 'pending' | 'uploading' | 'processing' | 'done' | 'failed'
  progress: number
  original_url?: string
  preview_url?: string
  error?: string
}

export interface StatusResponse {
  jobId: string
  items: StatusItem[]
  total: number
  completed: number
  failed: number
}

export async function uploadImages(formData: FormData): Promise<{ jobId: string }> {
  const { data } = await api.post('/upload', formData)
  return data
}

export async function getStatus(jobId: string): Promise<StatusResponse> {
  const { data } = await api.get(`/status/${jobId}`)
  return data
}

export function getDownloadUrl(jobId: string): string {
  return `${API_BASE}/api/download/${jobId}`
}

export function pollStatus(
  jobId: string,
  onProgress: (response: StatusResponse) => void,
  onError?: (status: number, message: string) => void,
  interval = 2000,
): { cancel: () => void } {
  let cancelled = false

  async function poll() {
    while (!cancelled) {
      try {
        const response = await getStatus(jobId)
        onProgress(response)
        if (response.completed + response.failed >= response.total) {
          break
        }
      } catch (err: unknown) {
        const status = (err as any)?.status || 0
        onError?.(status, (err as any)?.message || 'Status check failed')
        break
      }
      if (!cancelled) {
        await new Promise((resolve) => setTimeout(resolve, interval))
      }
    }
  }

  poll()

  return { cancel: () => { cancelled = true } }
}
