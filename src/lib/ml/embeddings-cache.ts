/**
 * IndexedDB wrapper for persistent embedding storage.
 * Provides efficient caching of video embeddings to avoid recomputation.
 *
 * Storage structure:
 * - Database: "ml-embeddings"
 * - Object store: "embeddings"
 * - Compound key: [videoId, modelVersion]
 * - Index: generatedAt (for cleanup queries)
 *
 * Browser storage limits: 50-100MB (sufficient for ~4,000 embeddings at 1.5KB each = 6MB)
 */

export interface EmbeddingRecord {
  videoId: number;
  modelVersion: string;
  embedding: Float32Array;
  generatedAt: Date;
}

export class EmbeddingsCache {
  private dbName = 'ml-embeddings';
  private storeName = 'embeddings';
  private version = 1;
  private db: IDBDatabase | null = null;

  /**
   * Initialize IndexedDB connection and schema.
   * Creates database and object store on first run.
   */
  private async initDB(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store with compound key [videoId, modelVersion]
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, {
            keyPath: ['videoId', 'modelVersion'],
          });

          // Index on generatedAt for cleanup queries (e.g., delete old model versions)
          store.createIndex('generatedAt', 'generatedAt', { unique: false });
        }
      };
    });
  }

  /**
   * Get embedding for a single video.
   * @param videoId - Database video ID
   * @param modelVersion - Model identifier (e.g., "all-MiniLM-L6-v2")
   * @returns Embedding vector or null if not cached
   */
  async get(videoId: number, modelVersion: string): Promise<Float32Array | null> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);

      return new Promise((resolve, reject) => {
        const request = store.get([videoId, modelVersion]);

        request.onsuccess = () => {
          const record = request.result as EmbeddingRecord | undefined;
          resolve(record ? record.embedding : null);
        };

        request.onerror = () => {
          reject(new Error(`Failed to get embedding: ${request.error?.message}`));
        };
      });
    } catch (error) {
      console.error('EmbeddingsCache.get error:', error);
      return null;
    }
  }

  /**
   * Store embedding for a single video.
   * @param videoId - Database video ID
   * @param modelVersion - Model identifier
   * @param embedding - Embedding vector (Float32Array)
   */
  async set(videoId: number, modelVersion: string, embedding: Float32Array): Promise<void> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const record: EmbeddingRecord = {
        videoId,
        modelVersion,
        embedding,
        generatedAt: new Date(),
      };

      return new Promise((resolve, reject) => {
        const request = store.put(record);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          // Check for quota exceeded error
          if (request.error?.name === 'QuotaExceededError') {
            reject(new Error('Storage quota exceeded. Browser limit is 50-100MB.'));
          } else {
            reject(new Error(`Failed to store embedding: ${request.error?.message}`));
          }
        };
      });
    } catch (error) {
      console.error('EmbeddingsCache.set error:', error);
      throw error;
    }
  }

  /**
   * Get embeddings for multiple videos in a single transaction.
   * More efficient than multiple get() calls.
   * @param videoIds - Array of database video IDs
   * @param modelVersion - Model identifier
   * @returns Map of videoId to embedding (only includes cached entries)
   */
  async getBatch(videoIds: number[], modelVersion: string): Promise<Map<number, Float32Array>> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);

      const results = new Map<number, Float32Array>();

      return new Promise((resolve, reject) => {
        let completed = 0;
        let hasError = false;

        for (const videoId of videoIds) {
          const request = store.get([videoId, modelVersion]);

          request.onsuccess = () => {
            const record = request.result as EmbeddingRecord | undefined;
            if (record) {
              results.set(videoId, record.embedding);
            }

            completed++;
            if (completed === videoIds.length && !hasError) {
              resolve(results);
            }
          };

          request.onerror = () => {
            hasError = true;
            reject(new Error(`Failed to get batch embedding: ${request.error?.message}`));
          };
        }

        // Handle empty input
        if (videoIds.length === 0) {
          resolve(results);
        }
      });
    } catch (error) {
      console.error('EmbeddingsCache.getBatch error:', error);
      return new Map();
    }
  }

  /**
   * Store embeddings for multiple videos in a single transaction.
   * More efficient than multiple set() calls. Avoids transaction deadlocks.
   * @param entries - Array of { videoId, embedding } pairs
   * @param modelVersion - Model identifier
   */
  async setBatch(
    entries: Array<{ videoId: number; embedding: Float32Array }>,
    modelVersion: string
  ): Promise<void> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const promises: Promise<void>[] = [];

      for (const { videoId, embedding } of entries) {
        const record: EmbeddingRecord = {
          videoId,
          modelVersion,
          embedding,
          generatedAt: new Date(),
        };

        const promise = new Promise<void>((resolve, reject) => {
          const request = store.put(record);

          request.onsuccess = () => resolve();
          request.onerror = () => {
            if (request.error?.name === 'QuotaExceededError') {
              reject(new Error('Storage quota exceeded. Browser limit is 50-100MB.'));
            } else {
              reject(new Error(`Failed to store batch embedding: ${request.error?.message}`));
            }
          };
        });

        promises.push(promise);
      }

      await Promise.all(promises);
    } catch (error) {
      console.error('EmbeddingsCache.setBatch error:', error);
      throw error;
    }
  }

  /**
   * Clear all embeddings, optionally filtered by model version.
   * Useful for cleaning up after model upgrades.
   * @param modelVersion - Optional: only clear embeddings for this model version
   */
  async clear(modelVersion?: string): Promise<void> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);

      if (!modelVersion) {
        // Clear all embeddings
        return new Promise((resolve, reject) => {
          const request = store.clear();

          request.onsuccess = () => resolve();
          request.onerror = () => {
            reject(new Error(`Failed to clear embeddings: ${request.error?.message}`));
          };
        });
      } else {
        // Clear only specific model version
        return new Promise((resolve, reject) => {
          const request = store.openCursor();
          const keysToDelete: IDBValidKey[] = [];

          request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) {
              const record = cursor.value as EmbeddingRecord;
              if (record.modelVersion === modelVersion) {
                keysToDelete.push(cursor.key);
              }
              cursor.continue();
            } else {
              // Delete collected keys
              const deletePromises = keysToDelete.map(
                (key) =>
                  new Promise<void>((res, rej) => {
                    const delRequest = store.delete(key);
                    delRequest.onsuccess = () => res();
                    delRequest.onerror = () => rej(delRequest.error);
                  })
              );

              Promise.all(deletePromises)
                .then(() => resolve())
                .catch((error) =>
                  reject(new Error(`Failed to delete model embeddings: ${error}`))
                );
            }
          };

          request.onerror = () => {
            reject(new Error(`Failed to clear model embeddings: ${request.error?.message}`));
          };
        });
      }
    } catch (error) {
      console.error('EmbeddingsCache.clear error:', error);
      throw error;
    }
  }
}

export default EmbeddingsCache;
