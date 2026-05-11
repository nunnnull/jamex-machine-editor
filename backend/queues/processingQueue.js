class ProcessingQueue {
  constructor(concurrency = 3, timeoutMs = 60000) {
    this.concurrency = concurrency;
    this.timeoutMs = timeoutMs;
    this.queue = [];
    this.activeCount = 0;
    this.handlers = {
      onComplete: null,
      onError: null,
      onProgress: null,
    };
  }

  on(event, handler) {
    if (this.handlers.hasOwnProperty(event)) {
      this.handlers[event] = handler;
    }
  }

  addJob(jobFn) {
    return new Promise((resolve, reject) => {
      const job = { fn: jobFn, resolve, reject, attempts: 0, maxAttempts: 3 };
      this.queue.push(job);
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.activeCount >= this.concurrency || this.queue.length === 0) return;

    const job = this.queue.shift();
    this.activeCount++;

    try {
      job.attempts++;
      console.log(`[Queue] Processing job (attempt ${job.attempts}/${job.maxAttempts}), active: ${this.activeCount}, pending: ${this.queue.length}`);

      const result = await Promise.race([
        job.fn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Job timed out after ${this.timeoutMs}ms`)), this.timeoutMs)
        ),
      ]);

      if (this.handlers.onComplete) {
        this.handlers.onComplete(result);
      }

      job.resolve(result);
    } catch (err) {
      console.error(`[Queue] Job failed (attempt ${job.attempts}/${job.maxAttempts}):`, err.message);
      if (job.attempts < job.maxAttempts) {
        const delay = Math.pow(2, job.attempts) * 200;
        await new Promise(r => setTimeout(r, delay));
        this.queue.unshift(job);
      } else {
        console.error(`[Queue] Job failed after ${job.maxAttempts} attempts:`, err.message);
        if (this.handlers.onError) {
          this.handlers.onError(err);
        }
        job.reject(err);
      }
    } finally {
      this.activeCount--;
      this.processQueue();
    }

    if (this.handlers.onProgress) {
      this.handlers.onProgress({
        active: this.activeCount,
        pending: this.queue.length,
      });
    }
  }

  get pending() {
    return this.queue.length;
  }

  get active() {
    return this.activeCount;
  }

  get total() {
    return this.pending + this.active;
  }
}

const globalQueue = new ProcessingQueue(3, 120000);

export default globalQueue;
export { ProcessingQueue };
