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

// Configure Transformers.js for browser environment
// Use JSDelivr CDN for WASM files to avoid bundling issues
env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/';
env.backends.onnx.wasm.numThreads = 1; // Disable multithreading to avoid SharedArrayBuffer requirements
env.allowLocalModels = false;
env.allowRemoteModels = true;
env.useBrowserCache = true;
env.useFS = false;
env.useFSCache = false;

console.log('[Worker] Transformers.js environment configured:', {
  allowLocalModels: env.allowLocalModels,
  allowRemoteModels: env.allowRemoteModels,
  useBrowserCache: env.useBrowserCache,
  useFS: env.useFS,
  wasmPaths: env.backends.onnx.wasm.wasmPaths
});

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
      try {
        console.log('[Worker] Loading model:', this.model);

        // Type assertion needed due to complex Transformers.js overload types
        const pipelinePromise = progress_callback
          ? pipeline(this.task, this.model, {
              progress_callback,
              dtype: 'q8' // Explicitly set quantization to avoid warnings
            } as any)
          : pipeline(this.task, this.model, { dtype: 'q8' } as any);

        this.instance = (await pipelinePromise) as FeatureExtractionPipeline;
        console.log('[Worker] Model loaded successfully');
      } catch (error) {
        console.error('[Worker] Failed to load model:', error);
        throw new Error(`Failed to load ML model: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
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

        // Always treat output as a tensor with shape [batch_size, embedding_dim]
        // Extract the raw data array
        let data: number[];

        console.log('[Worker] Output type:', Array.isArray(output) ? 'array' : 'tensor', 'length:', Array.isArray(output) ? output.length : 'N/A');

        if (Array.isArray(output)) {
          // If output is an array of tensors, flatten them
          console.log('[Worker] Processing array of', output.length, 'tensors');
          data = output.flatMap((tensor, i) => {
            if (!tensor || !tensor.data) {
              console.error('[Worker] Tensor', i, 'is invalid:', tensor);
              throw new Error(`Invalid tensor at index ${i}`);
            }
            return Array.from(tensor.data as number[]);
          });
        } else {
          // Single tensor - extract data
          if (!output || !output.data) {
            console.error('[Worker] Output tensor is invalid:', output);
            throw new Error('Invalid output tensor from model');
          }
          console.log('[Worker] Processing single tensor with data length:', (output.data as any).length);
          data = Array.from(output.data as number[]);
        }

        const batchSize = texts.length;
        const expectedLength = batchSize * EMBEDDING_DIM;

        console.log('[Worker] Extracted data length:', data.length, 'Expected:', expectedLength, 'Batch size:', batchSize);

        // Validate data length
        if (data.length !== expectedLength) {
          throw new Error(
            `Unexpected embedding data length: ${data.length}, expected ${expectedLength} (${batchSize} × ${EMBEDDING_DIM})`
          );
        }

        // Slice data into individual embeddings
        for (let i = 0; i < batchSize; i++) {
          const start = i * EMBEDDING_DIM;
          const end = start + EMBEDDING_DIM;
          const embedding = new Float32Array(data.slice(start, end));
          embeddings.push(embedding);
        }

        console.log('[Worker] Generated', embeddings.length, 'embeddings, each', embeddings[0]?.length, 'dims');

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
