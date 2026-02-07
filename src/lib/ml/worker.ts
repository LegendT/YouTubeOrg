/**
 * Web Worker for ML embeddings generation using Transformers.js.
 * Runs inference off the main thread to prevent UI blocking.
 *
 * Model: Xenova/all-MiniLM-L6-v2 (sentence transformers)
 * - 384-dimensional embeddings
 * - ~50MB model size (cached in browser after first download)
 * - Mean pooling + normalization for cosine similarity
 *
 * Message API:
 * - GENERATE_EMBEDDINGS: Batch processing of texts
 * - LOAD_PROGRESS: Model download progress updates
 * - TERMINATE: Clean shutdown
 */

import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers';

// Disable local model checks in browser environment
// Models are loaded from Hugging Face CDN and cached via Cache API
env.allowLocalModels = false;

/**
 * Singleton pattern for pipeline initialization.
 * Ensures model is loaded once per worker lifetime.
 */
class PipelineSingleton {
  static task = 'feature-extraction' as const;
  static model = 'Xenova/all-MiniLM-L6-v2';
  static instance: FeatureExtractionPipeline | null = null;

  /**
   * Get or create feature extraction pipeline.
   * First call downloads model (~50MB), subsequent calls return cached instance.
   * @param progress_callback - Optional callback for download progress
   */
  static async getInstance(
    progress_callback?: (progress: any) => void
  ): Promise<FeatureExtractionPipeline> {
    if (this.instance === null) {
      // Type assertion needed due to complex Transformers.js overload types
      const pipelinePromise = progress_callback
        ? pipeline(this.task, this.model, { progress_callback } as any)
        : pipeline(this.task, this.model);

      this.instance = (await pipelinePromise) as FeatureExtractionPipeline;
    }
    return this.instance;
  }
}

// Message types for type-safe worker communication
interface GenerateEmbeddingsMessage {
  type: 'GENERATE_EMBEDDINGS';
  texts: string[];
  id: string; // Correlation ID for response matching
}

interface LoadProgressMessage {
  type: 'LOAD_PROGRESS';
  data: any;
}

interface TerminateMessage {
  type: 'TERMINATE';
}

type WorkerMessage = GenerateEmbeddingsMessage | LoadProgressMessage | TerminateMessage;

interface EmbeddingsResultMessage {
  type: 'EMBEDDINGS_RESULT';
  id: string;
  embeddings: Float32Array[];
}

interface ProgressUpdateMessage {
  type: 'LOAD_PROGRESS';
  progress: any;
}

interface ErrorMessage {
  type: 'ERROR';
  id?: string;
  error: string;
}

type WorkerResponse = EmbeddingsResultMessage | ProgressUpdateMessage | ErrorMessage;

/**
 * Worker message handler.
 * Processes incoming messages and generates embeddings.
 */
self.addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  try {
    switch (message.type) {
      case 'GENERATE_EMBEDDINGS': {
        const { texts, id } = message;

        // Get pipeline instance (with progress callback for initial load)
        const extractor = await PipelineSingleton.getInstance((progress) => {
          const progressMessage: ProgressUpdateMessage = {
            type: 'LOAD_PROGRESS',
            progress,
          };
          self.postMessage(progressMessage);
        });

        // Generate embeddings with mean pooling and normalization
        // normalize: true ensures vectors are unit length (cosine similarity = dot product)
        // pooling: 'mean' converts token embeddings to single sentence embedding
        const output = await extractor(texts, {
          pooling: 'mean',
          normalize: true,
        });

        // Convert tensors to Float32Array for efficient storage and transfer
        // Note: Transformers.js returns a single tensor with shape [batch_size, embedding_dim]
        // We need to slice it into individual 384-dim vectors
        const embeddings: Float32Array[] = [];
        const EMBEDDING_DIM = 384; // all-MiniLM-L6-v2 output dimension

        if (Array.isArray(output)) {
          // Batch processing: multiple texts
          // Each output is a separate tensor (one per text)
          for (const tensor of output) {
            const data = Array.from(tensor.data as number[]);
            // Handle case where tensor might have batch dimension
            if (data.length === EMBEDDING_DIM) {
              embeddings.push(new Float32Array(data));
            } else {
              // If data is larger, extract the first EMBEDDING_DIM elements
              embeddings.push(new Float32Array(data.slice(0, EMBEDDING_DIM)));
            }
          }
        } else {
          // Single tensor containing all batch embeddings
          // Shape is [batch_size, embedding_dim], data is flattened
          const data = Array.from(output.data as number[]);
          const batchSize = texts.length;

          for (let i = 0; i < batchSize; i++) {
            const start = i * EMBEDDING_DIM;
            const end = start + EMBEDDING_DIM;
            embeddings.push(new Float32Array(data.slice(start, end)));
          }
        }

        // Send result back to main thread
        const resultMessage: EmbeddingsResultMessage = {
          type: 'EMBEDDINGS_RESULT',
          id,
          embeddings,
        };

        // Note: Structured cloning (default postMessage behavior) is used instead of transferable objects
        // as transferable objects require detaching buffers which makes embeddings unusable in worker
        self.postMessage(resultMessage);
        break;
      }

      case 'LOAD_PROGRESS': {
        // Forward progress updates to main thread
        const progressMessage: ProgressUpdateMessage = {
          type: 'LOAD_PROGRESS',
          progress: message.data,
        };
        self.postMessage(progressMessage);
        break;
      }

      case 'TERMINATE': {
        // Clean shutdown
        self.close();
        break;
      }

      default: {
        const errorMessage: ErrorMessage = {
          type: 'ERROR',
          error: `Unknown message type: ${(message as any).type}`,
        };
        self.postMessage(errorMessage);
      }
    }
  } catch (error) {
    // Send error back to main thread
    const errorMessage: ErrorMessage = {
      type: 'ERROR',
      id: message.type === 'GENERATE_EMBEDDINGS' ? message.id : undefined,
      error: error instanceof Error ? error.message : 'Unknown error in worker',
    };
    self.postMessage(errorMessage);
  }
});
