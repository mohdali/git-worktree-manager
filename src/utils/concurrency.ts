/**
 * Simple concurrency limiter for async operations
 * Ensures only N operations run simultaneously
 */
export function createLimiter(concurrency: number) {
  let running = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    if (queue.length > 0 && running < concurrency) {
      running++;
      const task = queue.shift()!;
      task();
    }
  };

  return async <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise((resolve, reject) => {
      const task = async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (err) {
          reject(err);
        } finally {
          running--;
          next();
        }
      };

      queue.push(task);
      next();
    });
  };
}
