# Phase 5: ML Categorization Engine - Research

**Researched:** 2026-02-06
**Domain:** Client-side ML with Transformers.js, Web Workers, and IndexedDB
**Confidence:** MEDIUM

## Summary

Phase 5 implements client-side ML categorization for Watch Later videos (3,932 videos) using Transformers.js with the all-MiniLM-L6-v2 embedding model. The system must run entirely in the browser using Web Workers to prevent UI freezing, process videos in batches of 32 for optimal performance, cache embeddings in IndexedDB to avoid recomputation, and assign confidence scores (HIGH/MEDIUM/LOW) based on cosine similarity thresholds.

The standard approach uses Transformers.js (v3.8.1+) with a singleton pattern for pipeline management, Web Workers with transferable objects for non-blocking execution, and IndexedDB for persistent embedding storage. Batch processing with progress callbacks enables real-time feedback during categorization of thousands of videos.

Key architectural decisions: embeddings are generated once and cached permanently, category embeddings are pre-computed from category names, and similarity matching uses cosine similarity with empirically-determined thresholds for confidence levels.

**Primary recommendation:** Use Transformers.js feature-extraction pipeline with Xenova/all-MiniLM-L6-v2 in a dedicated Web Worker, batch process 32 videos at a time with progress callbacks, cache embeddings in IndexedDB with compound keys (videoId + modelVersion), and calculate cosine similarity against category embeddings with thresholds: HIGH ≥0.75, MEDIUM 0.60-0.74, LOW <0.60.

## Standard Stack

The established libraries/tools for client-side ML embeddings and semantic categorization:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @huggingface/transformers | 3.8.1+ | Client-side ML inference | Official Hugging Face library, WASM/WebGPU support, 779K monthly downloads for all-MiniLM-L6-v2 |
| Xenova/all-MiniLM-L6-v2 | Latest | Sentence embeddings (384-dim) | Browser-optimized ONNX weights, fast inference, proven semantic similarity performance |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| IndexedDB (native) | Browser API | Embedding cache storage | Persistent storage for 4,000+ video embeddings, supports bulk operations |
| Web Workers (native) | Browser API | Non-blocking ML execution | Prevent main thread freeze during model loading and inference |
| Float32Array | JavaScript native | Efficient vector storage | Transferable objects for zero-copy Web Worker communication |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| all-MiniLM-L6-v2 | all-mpnet-base-v2 | 5x slower but higher quality (SBERT benchmark) - rejected due to browser performance constraints |
| all-MiniLM-L6-v2 | text-embedding-3-large (OpenAI) | Server-side cost + privacy issues vs free client-side processing |
| IndexedDB | LocalStorage | 5MB limit vs unlimited IndexedDB - inadequate for 4,000 x 384 float32 embeddings |

**Installation:**
```bash
npm install @huggingface/transformers
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── ml/
│   │   ├── worker.ts              # Web Worker script with singleton pipeline
│   │   ├── embeddings-cache.ts    # IndexedDB wrapper for embeddings CRUD
│   │   ├── similarity.ts          # Cosine similarity calculations
│   │   ├── confidence.ts          # Threshold-based confidence scoring
│   │   └── batch-processor.ts     # Batch processing with progress tracking
│   └── db/
│       └── schema.ts               # Add embeddings and mlCategorizations tables
└── components/
    └── ml/
        ├── categorization-trigger.tsx    # UI button to start ML process
        └── progress-display.tsx          # "Processing 247/4000 (6%)" indicator
```

### Pattern 1: Singleton Pipeline in Web Worker
**What:** Lazy initialization of Transformers.js pipeline to avoid repeated model downloads
**When to use:** Always for Transformers.js in Web Workers - model loading is expensive (50-100MB download)
**Example:**
```typescript
// Source: https://github.com/huggingface/transformers.js/blob/main/docs/source/tutorials/next.md
import { pipeline, env } from '@huggingface/transformers';

// Skip local model checks in browser environment
env.allowLocalModels = false;

class PipelineSingleton {
  static task = 'feature-extraction';
  static model = 'Xenova/all-MiniLM-L6-v2';
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      this.instance = pipeline(this.task, this.model, { progress_callback });
    }
    return this.instance;
  }
}

// Worker message handler
self.addEventListener('message', async (event) => {
  const { type, text, id } = event.data;

  if (type === 'GENERATE_EMBEDDING') {
    // Pass progress callback to track model loading
    const extractor = await PipelineSingleton.getInstance(progress => {
      self.postMessage({ type: 'LOAD_PROGRESS', progress });
    });

    // Generate embedding with mean pooling and normalization
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    const embedding = Array.from(output.data); // Convert to serializable array

    self.postMessage({ type: 'EMBEDDING_RESULT', id, embedding });
  }
});
```

### Pattern 2: Batch Processing with Progress Callbacks
**What:** Process videos in chunks with real-time progress updates to prevent browser hangs
**When to use:** Any operation processing 1000+ items in browser
**Example:**
```typescript
// Source: Synthesized from https://medium.com/@leonardoacrg.dev/javascript-how-to-process-tasks-in-batches-with-progress-tracking-6e3b1a82241a
async function batchProcess<T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R[]>,
  onProgress?: (current: number, total: number, percentage: number) => void
): Promise<R[]> {
  const results: R[] = [];
  const total = items.length;

  for (let i = 0; i < total; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await processor(batch);
    results.push(...batchResults);

    const current = Math.min(i + batchSize, total);
    const percentage = Math.round((current / total) * 100);
    onProgress?.(current, total, percentage);
  }

  return results;
}

// Usage for video categorization
await batchProcess(
  videos,
  32, // Optimal batch size for browser embeddings (hardware-dependent)
  async (batch) => {
    // Send batch to worker
    return await generateEmbeddings(batch.map(v => v.title + ' ' + v.description));
  },
  (current, total, percentage) => {
    setProgress(`Processing video ${current}/${total}, ${percentage}%`);
  }
);
```

### Pattern 3: IndexedDB Embeddings Cache
**What:** Persistent storage for video embeddings keyed by videoId + modelVersion
**When to use:** Any reusable computation result that's expensive to regenerate
**Example:**
```typescript
// IndexedDB schema for embeddings
interface EmbeddingRecord {
  videoId: number;
  modelVersion: string; // 'all-MiniLM-L6-v2' - allows model upgrades
  embedding: Float32Array;
  generatedAt: Date;
}

class EmbeddingsCache {
  private db: IDBDatabase;

  async get(videoId: number, modelVersion: string): Promise<Float32Array | null> {
    const record = await this.db.get(['embeddings'], [videoId, modelVersion]);
    return record?.embedding || null;
  }

  async set(videoId: number, modelVersion: string, embedding: Float32Array): Promise<void> {
    await this.db.put(['embeddings'], {
      videoId,
      modelVersion,
      embedding,
      generatedAt: new Date()
    });
  }

  async getBatch(videoIds: number[], modelVersion: string): Promise<Map<number, Float32Array>> {
    // Use compound index for efficient batch retrieval
    const results = new Map();
    const tx = this.db.transaction(['embeddings'], 'readonly');
    const store = tx.objectStore('embeddings');

    for (const videoId of videoIds) {
      const record = await store.get([videoId, modelVersion]);
      if (record) results.set(videoId, record.embedding);
    }

    return results;
  }

  async setBatch(entries: Array<{ videoId: number; embedding: Float32Array }>, modelVersion: string): Promise<void> {
    const tx = this.db.transaction(['embeddings'], 'readwrite');
    const store = tx.objectStore('embeddings');

    for (const entry of entries) {
      store.put({
        videoId: entry.videoId,
        modelVersion,
        embedding: entry.embedding,
        generatedAt: new Date()
      });
    }

    await tx.complete;
  }
}
```

### Pattern 4: Cosine Similarity for Semantic Matching
**What:** Calculate similarity between video and category embeddings to determine best fit
**When to use:** All semantic search and categorization tasks with normalized embeddings
**Example:**
```typescript
// Cosine similarity for normalized vectors (dot product)
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error('Vector dimensions must match');
  }

  let dotProduct = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
  }

  // Vectors are already normalized by Transformers.js (normalize: true)
  return dotProduct;
}

// Find best category match
function categorizeVideo(
  videoEmbedding: Float32Array,
  categoryEmbeddings: Map<number, Float32Array>
): { categoryId: number; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; score: number } {
  let bestMatch = { categoryId: -1, score: -1 };

  for (const [categoryId, catEmbedding] of categoryEmbeddings) {
    const similarity = cosineSimilarity(videoEmbedding, catEmbedding);
    if (similarity > bestMatch.score) {
      bestMatch = { categoryId, score: similarity };
    }
  }

  // Threshold-based confidence (empirical values for all-MiniLM-L6-v2)
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  if (bestMatch.score >= 0.75) confidence = 'HIGH';
  else if (bestMatch.score >= 0.60) confidence = 'MEDIUM';
  else confidence = 'LOW';

  return { ...bestMatch, confidence };
}
```

### Pattern 5: Transferable Objects for Worker Communication
**What:** Zero-copy transfer of Float32Array between main thread and worker
**When to use:** Passing large arrays (embeddings, audio buffers) to/from Web Workers
**Example:**
```typescript
// Main thread: Send video titles to worker with transferable response
const buffer = new SharedArrayBuffer(384 * 4); // 384 dimensions * 4 bytes per float32
const embedding = new Float32Array(buffer);

worker.postMessage(
  { type: 'GENERATE', text: videoTitle },
  [buffer] // Transfer ownership to worker (zero-copy)
);

// Worker: Return embedding via transfer
self.addEventListener('message', async (event) => {
  const extractor = await PipelineSingleton.getInstance();
  const output = await extractor(event.data.text, { pooling: 'mean', normalize: true });

  // Transfer back to main thread
  self.postMessage(
    { type: 'RESULT', embedding: output.data },
    [output.data.buffer]
  );
});
```

### Anti-Patterns to Avoid
- **Loading model on every request:** Always use singleton pattern - model is 50-100MB and takes 5-10 seconds to initialize
- **Processing all videos without batching:** Browser will freeze for minutes - always batch with progress callbacks
- **Not caching embeddings:** Embeddings never change for a given model - cache in IndexedDB on first generation
- **Running ML on main thread:** Model loading and inference blocks UI - always use Web Worker
- **Using raw text for category matching:** Embedding-based similarity vastly outperforms keyword matching for semantic categorization
- **Not handling model loading failures gracefully:** Network errors during model download are common - implement retry logic with exponential backoff

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sentence embeddings | Custom word2vec implementation | Transformers.js + all-MiniLM-L6-v2 | Pre-trained on 1B sentence pairs, 384-dim optimized embeddings, proven performance on MTEB benchmarks |
| Batch processing with progress | Custom queue system | Established batch processor pattern | Handles edge cases: partial batch completion, error recovery, cancelation |
| IndexedDB transactions | Raw IndexedDB API | Wrapper library (idb by Jake Archibald) or structured abstraction | IndexedDB API is verbose and error-prone - use proven wrappers |
| Vector similarity search | Linear scan with cosine | Keep linear for <10K vectors | FAISS/vector DBs overkill for ~100 categories - simple iteration is fast enough |
| Web Worker lifecycle | Manual worker creation/termination | Singleton worker with message routing | Avoid worker creation overhead, maintain model in memory |
| Confidence thresholding | Percentile-based bucketing | Fixed empirical thresholds | Cosine similarity [0,1] is stable across datasets - fixed thresholds are interpretable |

**Key insight:** Client-side ML is constrained by browser performance limits. Established patterns from Transformers.js examples handle memory management, model caching, and worker communication edge cases that will crash browsers if hand-rolled.

## Common Pitfalls

### Pitfall 1: Model Cache Miss on Page Reload
**What goes wrong:** Transformers.js downloads 50-100MB model on every page load, causing 5-10 second wait time
**Why it happens:** Browser cache may evict large files, or model isn't properly cached by service worker
**How to avoid:**
- Show loading indicator: "First-time setup: Downloading ML model (50MB)..."
- Check if model is cached: `await pipeline(..., { progress_callback })` and detect download vs cache hit
- Use Cache API or service worker to persist model files across sessions
**Warning signs:** Users report "app is slow on first load" but fast afterward

### Pitfall 2: GPU Out of Memory Errors on WebGPU
**What goes wrong:** Browser crashes with "GPUOutOfMemoryError" when processing large batches
**Why it happens:** WebGPU has device-specific memory limits, and memory isn't released between batches
**How to avoid:**
- Default to WASM (CPU) execution - more reliable across devices
- If using WebGPU, reduce batch size to 8-16 (vs 32 for WASM)
- Test on low-end devices (8GB RAM laptops) before deploying
**Warning signs:** Works on developer machines but crashes for subset of users

### Pitfall 3: IndexedDB Transaction Deadlocks
**What goes wrong:** Batch writes to IndexedDB hang indefinitely, progress bar freezes
**Why it happens:** Opening multiple read/write transactions on same object store causes deadlock
**How to avoid:**
- Use single transaction for batch operations: `tx = db.transaction(['store'], 'readwrite')`
- Complete transactions explicitly: `await tx.complete` or `await tx.done`
- Don't open new transactions inside existing transactions
**Warning signs:** Progress bar stops at specific percentage (e.g., 47%) and never recovers

### Pitfall 4: Memory Leaks from Unclosed Workers
**What goes wrong:** App memory usage grows to 1GB+, browser tabs become unresponsive
**Why it happens:** Web Workers hold loaded models in memory, not terminated after categorization completes
**How to avoid:**
- Reuse single worker instance (singleton pattern) for entire app session
- If terminating worker: ensure model is reloaded on next use (expensive)
- Monitor memory in DevTools during development
**Warning signs:** Chrome DevTools shows worker memory growing with each categorization run

### Pitfall 5: JavaScript 2GB ArrayBuffer Limit
**What goes wrong:** Cannot store all 4,000 video embeddings in single Float32Array
**Why it happens:** JavaScript ArrayBuffer limited to ~2GB (4,000 * 384 * 4 bytes = 6.1MB - safe here, but issue for larger datasets)
**How to avoid:**
- For this project: not an issue (embeddings are only 6MB)
- For 100K+ videos: use chunked storage or ReadableStreamDefaultReader pattern
- Store embeddings individually in IndexedDB, not as single array
**Warning signs:** "RangeError: ArrayBuffer allocation failed" when scaling beyond 10K videos

### Pitfall 6: Stale Similarity Thresholds Across Models
**What goes wrong:** Confidence scores become inaccurate after upgrading embedding model
**Why it happens:** Thresholds (0.75, 0.60) are model-specific - different models have different similarity distributions
**How to avoid:**
- Include model version in confidence score logic: `getThresholds(modelVersion)`
- Re-calibrate thresholds empirically when changing models
- Store model version with each cached embedding
**Warning signs:** Users report "AI is worse after update" - model changed but thresholds didn't

### Pitfall 7: Blocking Main Thread During Batch Processing
**What goes wrong:** UI freezes for 30+ seconds while processing 4,000 videos, appears crashed
**Why it happens:** Even with Web Worker, synchronous operations on main thread (UI updates, IndexedDB writes) can block
**How to avoid:**
- Use `requestIdleCallback` for non-critical UI updates
- Batch IndexedDB writes (write 32 at once, not 1 at a time)
- Yield to main thread every N iterations: `await new Promise(resolve => setTimeout(resolve, 0))`
**Warning signs:** Progress bar updates in chunks (e.g., jumps from 0% to 15% to 30%) rather than smoothly

## Code Examples

Verified patterns from official sources:

### Full Worker Implementation
```typescript
// Source: https://github.com/huggingface/transformers.js/blob/main/docs/source/tutorials/next.md
// ml-worker.ts
import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;

class PipelineSingleton {
  static task = 'feature-extraction';
  static model = 'Xenova/all-MiniLM-L6-v2';
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      this.instance = pipeline(this.task, this.model, { progress_callback });
    }
    return this.instance;
  }
}

self.addEventListener('message', async (event) => {
  const { type, texts, id } = event.data;

  switch (type) {
    case 'GENERATE_EMBEDDINGS':
      const extractor = await PipelineSingleton.getInstance(progress => {
        self.postMessage({ type: 'LOAD_PROGRESS', progress });
      });

      // Batch processing: all texts in one call
      const output = await extractor(texts, { pooling: 'mean', normalize: true });

      // Convert to serializable format
      const embeddings = Array.from(output).map(tensor => Array.from(tensor.data));

      self.postMessage({ type: 'EMBEDDINGS_RESULT', id, embeddings });
      break;

    case 'TERMINATE':
      self.close();
      break;
  }
});
```

### Main Thread Orchestration
```typescript
// categorization-engine.ts
class MLCategorizationEngine {
  private worker: Worker;
  private embeddingsCache: EmbeddingsCache;

  constructor() {
    this.worker = new Worker(new URL('./ml-worker.ts', import.meta.url));
    this.embeddingsCache = new EmbeddingsCache();
  }

  async categorizeVideos(
    videos: VideoCardData[],
    categories: Category[],
    onProgress: (current: number, total: number, percentage: number) => void
  ): Promise<CategorizationResult[]> {
    // Step 1: Pre-compute category embeddings
    const categoryEmbeddings = await this.getCategoryEmbeddings(categories);

    // Step 2: Process videos in batches of 32
    const BATCH_SIZE = 32;
    const results: CategorizationResult[] = [];

    for (let i = 0; i < videos.length; i += BATCH_SIZE) {
      const batch = videos.slice(i, i + BATCH_SIZE);

      // Check cache first
      const cachedEmbeddings = await this.embeddingsCache.getBatch(
        batch.map(v => v.id),
        'all-MiniLM-L6-v2'
      );

      // Generate missing embeddings
      const uncachedVideos = batch.filter(v => !cachedEmbeddings.has(v.id));
      if (uncachedVideos.length > 0) {
        const newEmbeddings = await this.generateEmbeddings(
          uncachedVideos.map(v => `${v.title} ${v.channelTitle}`)
        );

        // Cache new embeddings
        await this.embeddingsCache.setBatch(
          uncachedVideos.map((v, idx) => ({
            videoId: v.id,
            embedding: newEmbeddings[idx]
          })),
          'all-MiniLM-L6-v2'
        );

        // Merge with cached
        uncachedVideos.forEach((v, idx) => {
          cachedEmbeddings.set(v.id, newEmbeddings[idx]);
        });
      }

      // Categorize batch
      for (const video of batch) {
        const videoEmbedding = cachedEmbeddings.get(video.id)!;
        const match = this.findBestCategory(videoEmbedding, categoryEmbeddings);
        results.push({
          videoId: video.id,
          categoryId: match.categoryId,
          confidence: match.confidence,
          score: match.score
        });
      }

      // Update progress
      const current = Math.min(i + BATCH_SIZE, videos.length);
      const percentage = Math.round((current / videos.length) * 100);
      onProgress(current, videos.length, percentage);
    }

    return results;
  }

  private async generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36);

      const handler = (event: MessageEvent) => {
        if (event.data.type === 'EMBEDDINGS_RESULT' && event.data.id === id) {
          this.worker.removeEventListener('message', handler);
          resolve(event.data.embeddings.map(e => new Float32Array(e)));
        }
      };

      this.worker.addEventListener('message', handler);
      this.worker.postMessage({ type: 'GENERATE_EMBEDDINGS', texts, id });

      setTimeout(() => reject(new Error('Worker timeout')), 60000);
    });
  }

  private findBestCategory(
    videoEmbedding: Float32Array,
    categoryEmbeddings: Map<number, Float32Array>
  ): { categoryId: number; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; score: number } {
    let bestMatch = { categoryId: -1, score: -1 };

    for (const [categoryId, catEmbedding] of categoryEmbeddings) {
      const similarity = this.cosineSimilarity(videoEmbedding, catEmbedding);
      if (similarity > bestMatch.score) {
        bestMatch = { categoryId, score: similarity };
      }
    }

    // Thresholds based on empirical testing (need validation with real data)
    let confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    if (bestMatch.score >= 0.75) confidence = 'HIGH';
    else if (bestMatch.score >= 0.60) confidence = 'MEDIUM';
    else confidence = 'LOW';

    return { ...bestMatch, confidence };
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
    }
    return dotProduct; // Already normalized
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Server-side embeddings APIs (OpenAI, Cohere) | Client-side Transformers.js | 2024-2025 | Zero API costs, privacy-preserving, offline-capable, but 20% slower than native |
| Manual keyword matching | Semantic similarity via embeddings | 2023+ | Higher accuracy for fuzzy categorization (e.g., "coding tutorial" matches "programming lessons") |
| CPU-only WASM | WebGPU acceleration | 2025+ (limited) | 3-5x faster when available, but 35% browser incompatibility and memory issues |
| localStorage caching | IndexedDB for embeddings | Always | localStorage 5MB limit insufficient for 4,000 embeddings (6MB uncompressed) |

**Deprecated/outdated:**
- **TensorFlow.js for NLP:** Transformers.js now standard for browser-based transformers (better ONNX integration, smaller models)
- **Universal Sentence Encoder (TensorFlow.js):** Replaced by sentence-transformers models (all-MiniLM-L6-v2) - smaller size, better multilingual support
- **ml5.js:** Focused on beginner education, not production-ready for large-scale categorization

## Open Questions

Things that couldn't be fully resolved:

1. **all-MiniLM-L6-v2 Accuracy on YouTube Titles**
   - What we know: Model trained on 1B sentence pairs, SBERT reports "good quality" for semantic similarity
   - What's unclear: No published benchmarks for YouTube video title categorization specifically
   - Recommendation: Validate during implementation with sample categorization of 100 videos, compare with manual categorization. If accuracy <80%, consider all-mpnet-base-v2 (slower but higher quality) or fine-tuning approach

2. **Optimal Batch Size for Browser Environment**
   - What we know: Server-side recommends 16-64 for transformer embeddings, browser constraints are different
   - What's unclear: Optimal batch size varies by device (8GB laptop vs 32GB desktop, CPU vs WebGPU)
   - Recommendation: Start with batch size 32 (conservative), add telemetry to detect crashes/hangs, make batch size configurable in settings for power users

3. **Cosine Similarity Thresholds for Confidence Levels**
   - What we know: Thresholds are context-dependent, no universal values, existing research shows 0.79 for ada-002 but different for other models
   - What's unclear: Specific thresholds for all-MiniLM-L6-v2 on this dataset (87 categories, YouTube video titles)
   - Recommendation: Start with conservative thresholds (HIGH≥0.75, MEDIUM≥0.60, LOW<0.60), collect histogram of similarity scores during first run, adjust thresholds based on distribution. Add "recalibrate thresholds" feature for user feedback loop

4. **Category Embedding Strategy**
   - What we know: Can embed category names directly (simple) or aggregate video embeddings in category (complex but potentially more accurate)
   - What's unclear: Whether category name alone provides sufficient semantic signal (e.g., "CSS" vs "Web Development")
   - Recommendation: Start with category name embeddings (simple, fast), add optional "category refinement" where user provides description/keywords to improve embedding quality

5. **IndexedDB Storage Limits**
   - What we know: IndexedDB theoretically unlimited, but browsers prompt user for permission beyond 50-100MB
   - What's unclear: Will 4,000 embeddings (6MB) trigger permission prompts? What about future growth to 10K+ videos?
   - Recommendation: Monitor storage usage, compress embeddings if needed (quantization to float16), implement storage cleanup for old model versions

6. **Handling New Categories Post-Categorization**
   - What we know: User may create new categories after initial ML categorization
   - What's unclear: Should system re-categorize all videos or only uncategorized ones? How to handle videos with low confidence?
   - Recommendation: Store ML suggestions alongside user assignments, allow "re-run ML for this category" on demand, auto-categorize only new videos (not reassign existing)

## Sources

### Primary (HIGH confidence)
- Transformers.js Official Docs (https://huggingface.co/docs/transformers.js/en/index) - Installation, API, quantization options
- Xenova/all-MiniLM-L6-v2 Model Card (https://huggingface.co/Xenova/all-MiniLM-L6-v2) - ONNX weights, usage example, 779K monthly downloads
- Transformers.js Next.js Tutorial (https://github.com/huggingface/transformers.js/blob/main/docs/source/tutorials/next.md) - Singleton pattern, Web Worker implementation
- MDN Web Workers API (https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) - Transferable objects, message passing

### Secondary (MEDIUM confidence)
- RxDB JavaScript Vector Database article (https://rxdb.info/articles/javascript-vector-database.html) - IndexedDB performance characteristics, 88ms query time for vector search (WebSearch verified with technical article)
- Worldline Tech Blog "Running AI models in the browser with Transformers.js" (January 2026) - Recent best practices, WebGPU limitations (https://blog.worldline.tech/2026/01/13/transformersjs-intro.html)
- Medium article "Web Workers II — Internals and Data Transfer" (https://medium.com/@ayushmaurya461/web-workers-ii-internals-and-data-transfer-fe960e45e274) - Transferable objects zero-copy transfer explanation
- Zilliz "Optimal batch size for generating embeddings" (https://zilliz.com/ai-faq/what-is-the-optimal-batch-size-for-generating-embeddings) - Batch size 16-64 for transformers, hardware-specific considerations

### Tertiary (LOW confidence)
- WebGPU memory errors blog post (Medium @marcelo.emmerich) - Anecdotal reports of GPUOutOfMemoryError, memory leaks in production (https://medium.com/@marcelo.emmerich/webgpu-bugs-are-holding-back-the-browser-ai-revolution-27d5f8c1dfca)
- Community discussions on cosine similarity thresholds (OpenAI forums, ResearchGate) - No consensus, highly context-dependent, requires empirical validation
- WebSearch results for "all-MiniLM-L6-v2 YouTube video title categorization accuracy" - No specific benchmarks found, need validation during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Transformers.js and all-MiniLM-L6-v2 are well-documented with official sources and 779K monthly downloads
- Architecture: MEDIUM - Web Worker patterns verified from official tutorial, but batch processing implementation synthesized from general patterns (not Transformers.js-specific)
- Pitfalls: MEDIUM - WebGPU issues verified from recent 2026 articles, IndexedDB pitfalls based on established browser API knowledge, but not all tested with Transformers.js specifically
- Thresholds: LOW - Cosine similarity thresholds are context-dependent, no published benchmarks for this specific use case (YouTube titles + 87 categories)

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (30 days - stable ecosystem, but fast-moving browser AI space)

**Critical validation needed during planning:**
1. Empirical threshold calibration for confidence levels (HIGH/MEDIUM/LOW)
2. Batch size testing on representative hardware (8GB laptop minimum)
3. Sample categorization accuracy test (100 videos manually verified)
4. IndexedDB storage permission thresholds on different browsers
