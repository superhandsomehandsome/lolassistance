export class RateLimiter {
  private queue: Array<() => void> = []
  private running = 0
  private readonly maxConcurrent: number
  private readonly minIntervalMs: number
  private lastRunAt = 0

  constructor(maxConcurrent = 5, minIntervalMs = 60) {
    this.maxConcurrent = maxConcurrent
    this.minIntervalMs = minIntervalMs
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(() => {
        void (async () => {
          try {
            const now = Date.now()
            const wait = Math.max(0, this.minIntervalMs - (now - this.lastRunAt))
            if (wait > 0) await new Promise((r) => setTimeout(r, wait))
            this.lastRunAt = Date.now()
            resolve(await fn())
          } catch (error) {
            reject(error)
          } finally {
            this.running--
            this.pump()
          }
        })()
      })
      this.pump()
    })
  }

  private pump(): void {
    while (this.running < this.maxConcurrent && this.queue.length > 0) {
      const job = this.queue.shift()
      if (!job) break
      this.running++
      job()
    }
  }
}
