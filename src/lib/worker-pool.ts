// Web Worker pool for off-main-thread decryption

import type { DecryptRequest, DecryptResponse } from '~/workers/decrypt-worker'

type PendingResolve = {
  resolve: (data: Record<string, unknown>) => void
  reject: (err: Error) => void
}

let workers: Array<Worker> = []
let nextWorkerIndex = 0
const pendingRequests = new Map<string, PendingResolve>()
let requestCounter = 0
let initialized = false
let currentKeyJwk: string | null = null

function getPoolSize(): number {
  if (typeof navigator === 'undefined') return 0
  return Math.min(navigator.hardwareConcurrency ?? 4, 4)
}

function ensureInitialized() {
  if (initialized) return
  initialized = true

  const poolSize = getPoolSize()
  if (poolSize === 0) return

  for (let i = 0; i < poolSize; i++) {
    const worker = new Worker(
      new URL('../workers/decrypt-worker.ts', import.meta.url),
      { type: 'module' },
    )
    worker.onmessage = (e: MessageEvent<DecryptResponse>) => {
      const { id, data, error } = e.data
      const pending = pendingRequests.get(id)
      if (!pending) return
      pendingRequests.delete(id)
      if (error) {
        pending.reject(new Error(error))
      } else {
        pending.resolve(data ?? {})
      }
    }
    worker.onerror = (e) => {
      console.error('[decrypt-worker] Error:', e)
    }
    workers.push(worker)
  }
}

function getNextWorker(): Worker | null {
  ensureInitialized()
  if (workers.length === 0) return null
  const worker = workers[nextWorkerIndex % workers.length]
  nextWorkerIndex++
  return worker
}

function generateRequestId(): string {
  return `req-${++requestCounter}-${Date.now()}`
}

function postToWorker(
  request: DecryptRequest,
): Promise<Record<string, unknown>> {
  const worker = getNextWorker()
  if (!worker) {
    return Promise.reject(new Error('No workers available'))
  }

  return new Promise((resolve, reject) => {
    pendingRequests.set(request.id, { resolve, reject })
    worker.postMessage(request)
  })
}

// Send the private key JWK to all workers once. Only re-sends if the key changes.
export function initWorkerKey(privateKeyJwk: string) {
  if (currentKeyJwk === privateKeyJwk) return
  currentKeyJwk = privateKeyJwk
  ensureInitialized()
  for (const worker of workers) {
    worker.postMessage({
      id: 'init',
      type: 'init',
      privateKeyJwk,
    } satisfies DecryptRequest)
  }
}

export function isWorkerAvailable(): boolean {
  return typeof Worker !== 'undefined' && typeof window !== 'undefined'
}

export async function decryptViaWorker(
  encryptedStr: string,
  context: string,
  fieldGroup?: string,
): Promise<Record<string, unknown>> {
  return postToWorker({
    id: generateRequestId(),
    type: 'decrypt' as const,
    encryptedStr,
    context,
    fieldGroup,
  })
}

export async function decryptFieldGroupsViaWorker(
  fields: Record<string, string | undefined>,
  recordId: string,
): Promise<Record<string, unknown>> {
  return postToWorker({
    id: generateRequestId(),
    type: 'decryptFieldGroups' as const,
    fields,
    recordId,
  })
}

export function terminateWorkers() {
  for (const worker of workers) {
    worker.terminate()
  }
  workers = []
  pendingRequests.clear()
  initialized = false
  currentKeyJwk = null
}
