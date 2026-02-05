# Architecture Research

**Domain:** YouTube API Application with ML-based Content Processing
**Researched:** 2026-02-05
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ Review  │  │ Search  │  │ Export  │  │  Sync   │        │
│  │   UI    │  │   UI    │  │   UI    │  │Control  │        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
│       │            │            │            │              │
├───────┴────────────┴────────────┴────────────┴──────────────┤
│                    Web Framework Layer                       │
│             (FastAPI - Routes, Background Tasks)             │
├─────────────────────────────────────────────────────────────┤
│  ┌────────────────────┐  ┌────────────────────────────┐     │
│  │  Orchestration     │  │   Background Task Queue    │     │
│  │  Service Layer     │  │   (Celery/RQ - optional)   │     │
│  └──────┬────┬────────┘  └────────────┬───────────────┘     │
│         │    │                        │                     │
├─────────┼────┼────────────────────────┼─────────────────────┤
│         │    │                        │                     │
│  ┌──────▼────▼──────┐  ┌──────────────▼───────────────┐     │
│  │  YouTube API     │  │   ML Categorization Engine   │     │
│  │  Client Layer    │  │   (Sentence Transformers)    │     │
│  └────────┬─────────┘  └──────────────┬───────────────┘     │
│           │                           │                     │
├───────────┴───────────────────────────┴─────────────────────┤
│                  Data Persistence Layer                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           SQLite Database (Cache & State)            │   │
│  │  ┌──────────┐  ┌──────────┐  ┌────────────────────┐ │   │
│  │  │ Videos   │  │Playlists │  │  Categorizations   │ │   │
│  │  │  Cache   │  │  Cache   │  │   & Sync State     │ │   │
│  │  └──────────┘  └──────────┘  └────────────────────┘ │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                    External Services                         │
│  ┌──────────────────────────┐  ┌──────────────────────┐     │
│  │  YouTube Data API v3     │  │   Local ML Models    │     │
│  │  (10k units/day quota)   │  │   (embeddings cache) │     │
│  └──────────────────────────┘  └──────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Web Framework** | HTTP API, routing, background tasks, static file serving | FastAPI with async/await, BackgroundTasks for simple jobs |
| **YouTube API Client** | Fetch playlists/videos, sync changes back, quota management | google-api-python-client with ETags, conditional requests |
| **Data Cache Layer** | Store API responses, avoid quota waste, enable offline work | SQLite with timestamps, ETags, and sync status fields |
| **ML Categorization Engine** | Generate embeddings, compute similarity, suggest categories | sentence-transformers (all-MiniLM-L6-v2) with batch processing |
| **Orchestration Service** | Coordinate fetch → cache → categorize → sync workflows | Python service layer with state machine pattern |
| **Sync State Manager** | Track what's changed locally vs remotely, conflict resolution | SQLite tables with last_synced timestamps, dirty flags |
| **Frontend UI** | Review categorizations, search/filter, trigger operations | Static HTML/JS (React/Vue) or server-rendered (Jinja2) |
| **Background Task System** | Long-running ML inference, batch API fetches (optional) | Celery with Redis for complex scenarios, FastAPI BackgroundTasks for simple |

## Recommended Project Structure

```
youtube-playlist-organizer/
├── src/
│   ├── api/                    # FastAPI application
│   │   ├── __init__.py
│   │   ├── main.py            # FastAPI app instance, routes
│   │   ├── routes/            # Route handlers
│   │   │   ├── playlists.py
│   │   │   ├── videos.py
│   │   │   ├── categories.py
│   │   │   └── sync.py
│   │   └── dependencies.py    # Shared dependencies (DB connection)
│   │
│   ├── services/               # Business logic layer
│   │   ├── __init__.py
│   │   ├── youtube_client.py  # YouTube API wrapper with quota mgmt
│   │   ├── categorization.py  # ML inference service
│   │   ├── sync_engine.py     # Bidirectional sync orchestration
│   │   └── cache_manager.py   # Cache invalidation, ETags
│   │
│   ├── models/                 # Data models
│   │   ├── __init__.py
│   │   ├── database.py        # SQLAlchemy/SQLModel models
│   │   ├── youtube.py         # YouTube API response schemas
│   │   └── ml.py              # ML categorization schemas
│   │
│   ├── ml/                     # ML components
│   │   ├── __init__.py
│   │   ├── embeddings.py      # Embedding generation & caching
│   │   ├── clustering.py      # Unsupervised categorization
│   │   └── similarity.py      # Semantic search utilities
│   │
│   ├── storage/                # Data persistence
│   │   ├── __init__.py
│   │   ├── db.py              # Database connection, migrations
│   │   ├── repositories/      # Data access layer
│   │   │   ├── videos.py
│   │   │   ├── playlists.py
│   │   │   └── categories.py
│   │   └── migrations/        # Alembic or manual schema versions
│   │
│   ├── tasks/                  # Background tasks (if using Celery)
│   │   ├── __init__.py
│   │   ├── fetch.py           # Batch YouTube API fetches
│   │   ├── categorize.py      # Batch ML inference
│   │   └── sync.py            # Scheduled sync operations
│   │
│   └── config.py               # Configuration management
│
├── frontend/                   # Web UI (static or SPA)
│   ├── index.html
│   ├── static/
│   │   ├── css/
│   │   └── js/
│   └── templates/              # If using server-side rendering
│
├── data/                       # Local data storage
│   ├── cache.db                # SQLite database
│   └── models/                 # Downloaded ML model weights
│
├── tests/
│   ├── test_youtube_client.py
│   ├── test_categorization.py
│   └── test_sync_engine.py
│
├── scripts/                    # CLI utilities
│   ├── initial_fetch.py       # One-time bulk fetch
│   ├── recompute_embeddings.py
│   └── export_data.py
│
├── requirements.txt
├── pyproject.toml
└── README.md
```

### Structure Rationale

- **api/**: FastAPI routes and HTTP layer kept separate from business logic for testability
- **services/**: Core business logic isolated from framework, enables reuse in CLI scripts
- **models/**: Centralized data models with SQLAlchemy for database, Pydantic for validation
- **ml/**: ML components isolated for easy experimentation and model swapping
- **storage/**: Repository pattern provides abstraction over database queries
- **tasks/**: Optional - only if using Celery; otherwise use FastAPI BackgroundTasks
- **frontend/**: Separate concerns - API backend is independent of UI implementation
- **data/**: Local persistence outside source control (add to .gitignore)

## Architectural Patterns

### Pattern 1: Quota-Aware API Client with ETag Caching

**What:** Wrap YouTube API calls with intelligent caching and quota tracking to stay within the 10,000 units/day limit.

**When to use:** Essential for any YouTube API application processing large datasets.

**Trade-offs:**
- PRO: Reduces quota usage by 50-80% through caching and conditional requests
- PRO: Enables offline work with cached data
- CON: Adds complexity of cache invalidation logic
- CON: Requires ETags storage and timestamp management

**Example:**
```python
class QuotaAwareYouTubeClient:
    def __init__(self, api_key: str, db: Database):
        self.youtube = build('youtube', 'v3', developerKey=api_key)
        self.db = db
        self.quota_tracker = QuotaTracker(daily_limit=10000)

    def get_playlist_items(self, playlist_id: str) -> List[Video]:
        # Check cache first
        cached = self.db.get_cached_playlist(playlist_id)
        if cached and not self._is_stale(cached):
            return cached.videos

        # Use ETag for conditional request
        etag = cached.etag if cached else None
        headers = {'If-None-Match': etag} if etag else {}

        # Track quota cost (list: 1 unit per request)
        self.quota_tracker.check_available(cost=1)

        try:
            response = self.youtube.playlistItems().list(
                part='snippet,contentDetails',
                playlistId=playlist_id,
                maxResults=50,
                **headers
            ).execute()

            # 304 Not Modified - no quota charged
            if response.status == 304:
                return cached.videos

            # Cache the response with ETag
            self.quota_tracker.record_usage(cost=1)
            self.db.cache_playlist(playlist_id, response, response.get('etag'))
            return self._parse_videos(response)

        except HttpError as e:
            if e.resp.status == 403:  # Quota exceeded
                raise QuotaExceededError("Daily quota exhausted")
            raise
```

### Pattern 2: Batch ML Inference Pipeline

**What:** Process video metadata in batches for efficient ML inference, caching embeddings to avoid recomputation.

**When to use:** When categorizing thousands of videos where embedding generation is the bottleneck.

**Trade-offs:**
- PRO: 10-100x faster than per-item processing
- PRO: Embeddings cached = instant re-categorization with new rules
- CON: Higher memory usage during batch processing
- CON: Requires careful batch size tuning for available RAM

**Example:**
```python
class CategorizationEngine:
    def __init__(self, model_name: str = 'all-MiniLM-L6-v2'):
        self.model = SentenceTransformer(model_name)
        self.db = Database()

    def categorize_videos_batch(self, video_ids: List[str],
                                  category_definitions: Dict[str, str],
                                  batch_size: int = 32) -> Dict[str, str]:
        """
        Batch process videos for categorization.
        Returns: {video_id: category_name}
        """
        # Fetch video metadata
        videos = self.db.get_videos(video_ids)

        # Generate text for embedding (title + description + channel)
        texts = [self._build_text(v) for v in videos]

        # Check for cached embeddings
        embeddings = []
        to_compute = []

        for video, text in zip(videos, texts):
            cached_emb = self.db.get_embedding(video.id, text_hash=hash(text))
            if cached_emb:
                embeddings.append(cached_emb)
            else:
                to_compute.append((video, text))
                embeddings.append(None)

        # Compute missing embeddings in batches
        if to_compute:
            new_texts = [text for _, text in to_compute]
            new_embeddings = self.model.encode(
                new_texts,
                batch_size=batch_size,
                convert_to_tensor=True,
                show_progress_bar=True
            )

            # Cache new embeddings
            for (video, text), emb in zip(to_compute, new_embeddings):
                self.db.store_embedding(video.id, emb, hash(text))

            # Fill in embeddings list
            j = 0
            for i, emb in enumerate(embeddings):
                if emb is None:
                    embeddings[i] = new_embeddings[j]
                    j += 1

        # Generate category embeddings (cache these too)
        category_embeddings = self._get_category_embeddings(category_definitions)

        # Compute similarity matrix
        embeddings_tensor = torch.stack(embeddings)
        similarities = util.cos_sim(embeddings_tensor, category_embeddings)

        # Assign categories
        assignments = {}
        category_names = list(category_definitions.keys())
        for i, video in enumerate(videos):
            best_match_idx = similarities[i].argmax().item()
            assignments[video.id] = category_names[best_match_idx]

        return assignments
```

### Pattern 3: Bidirectional Sync Orchestrator

**What:** Coordinate local changes and remote updates with conflict resolution and retry logic.

**When to use:** When users can modify playlists both in the app and directly on YouTube.

**Trade-offs:**
- PRO: Prevents data loss from concurrent modifications
- PRO: Enables offline work with deferred sync
- CON: Complex conflict resolution logic
- CON: Requires careful state management (dirty flags, timestamps)

**Example:**
```python
class SyncOrchestrator:
    """
    Manages bidirectional sync between local cache and YouTube API.
    """
    def __init__(self, youtube_client: QuotaAwareYouTubeClient):
        self.youtube = youtube_client
        self.db = Database()

    def sync_playlist(self, playlist_id: str) -> SyncResult:
        """
        Three-phase sync: fetch remote → merge changes → push local
        """
        result = SyncResult()

        # Phase 1: Fetch remote state
        remote_state = self.youtube.get_playlist_items(playlist_id)
        local_state = self.db.get_playlist_local(playlist_id)

        # Phase 2: Detect conflicts
        conflicts = self._detect_conflicts(local_state, remote_state)

        if conflicts:
            # Use last-write-wins strategy (or prompt user)
            for conflict in conflicts:
                if conflict.local_timestamp > conflict.remote_timestamp:
                    result.pending_pushes.append(conflict.local_change)
                else:
                    result.remote_wins.append(conflict.remote_change)

        # Phase 3: Apply remote changes locally
        for item in remote_state:
            if not self.db.has_local_change(item.id):
                self.db.update_from_remote(item)
                result.updates_applied += 1

        # Phase 4: Push local changes to remote
        pending = self.db.get_pending_syncs(playlist_id)
        for change in pending:
            try:
                if change.type == 'DELETE':
                    self.youtube.delete_playlist_item(change.item_id)
                elif change.type == 'REORDER':
                    self.youtube.update_playlist_item_position(
                        change.item_id, change.new_position
                    )

                self.db.mark_synced(change.id)
                result.pushes_succeeded += 1
            except Exception as e:
                result.push_errors.append((change, e))

        return result

    def _detect_conflicts(self, local, remote) -> List[Conflict]:
        """
        Compare timestamps and modification flags.
        Conflict = both modified since last sync.
        """
        conflicts = []
        for local_item in local:
            remote_item = next((r for r in remote if r.id == local_item.id), None)
            if remote_item and local_item.is_dirty:
                if remote_item.updated_at > local_item.last_synced_at:
                    conflicts.append(Conflict(
                        local_change=local_item,
                        remote_change=remote_item,
                        local_timestamp=local_item.updated_at,
                        remote_timestamp=remote_item.updated_at
                    ))
        return conflicts
```

## Data Flow

### Request Flow: Initial Fetch

```
[User: "Fetch my playlists"]
    ↓
[API Route: GET /api/playlists/sync]
    ↓
[Orchestration Service: trigger_initial_fetch()]
    ↓ (background task or Celery)
[YouTube API Client: fetch playlists] → [Check quota: 1 unit]
    ↓ (paginated, 50 results/page)
[Cache Layer: store playlists + videos with ETags]
    ↓ (4000 videos = ~80 API requests = 80 units)
[ML Engine: batch categorize (optional)]
    ↓ (compute embeddings in batches of 32)
[Database: store embeddings + category assignments]
    ↓
[Response: {status: "complete", videos: 4000, quota_used: 80}]
```

### State Management Flow

```
[Local State: SQLite DB]
    ↑ (read for display)
[UI Components] ←→ [FastAPI Routes]
    ↓ (write categorization decisions)
[State Store: mark dirty flag = true]
    ↓ (user triggers sync)
[Sync Orchestrator: detect dirty records]
    ↓ (compare timestamps)
[YouTube API: push changes] → [Check quota: 50 units/write]
    ↓
[Update local: clear dirty flag, update last_synced]
```

### ML Categorization Flow

```
[Video Metadata: title, description, channel]
    ↓
[Text Preprocessing: clean, concatenate]
    ↓
[Embedding Cache Check: hash(text) → embedding?]
    ↓ NO
[Sentence Transformer: encode(texts, batch_size=32)]
    ↓
[Store Embeddings: {video_id, embedding, text_hash}]
    ↓ YES (cache hit or computed)
[Category Definitions: {category_name: description}]
    ↓
[Category Embeddings: encode categories (cache globally)]
    ↓
[Cosine Similarity: video_emb × category_emb]
    ↓
[Assignment: argmax(similarity scores)]
    ↓
[Store Results: {video_id, category, confidence, timestamp}]
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-10k videos | Monolith with FastAPI + SQLite, batch ML in-process |
| 10k-100k videos | Add Celery for background ML, consider PostgreSQL for better concurrency |
| 100k+ videos | Split ML service, use FAISS for embedding search, add Redis cache layer |

### Scaling Priorities

1. **First bottleneck: YouTube API quota (10k units/day)**
   - **Fix:** Aggressive caching with ETags (reduces by 60-80%)
   - **Fix:** Pagination awareness - fetch only changed playlists
   - **Fix:** Request quota extension from Google (can get up to 1M units)

2. **Second bottleneck: ML inference time (4000 videos × 20ms = 80 seconds)**
   - **Fix:** Batch processing with sentence-transformers (reduces to ~10 seconds)
   - **Fix:** Cache embeddings - recompute only on text changes
   - **Fix:** Use smaller models (all-MiniLM-L6-v2 instead of all-mpnet-base-v2)

3. **Third bottleneck: SQLite write concurrency (multiple sync operations)**
   - **Fix:** Use WAL mode for better concurrent reads
   - **Fix:** Queue write operations through single writer thread
   - **Fix:** Migrate to PostgreSQL only if truly needed (>10k concurrent users)

## Anti-Patterns

### Anti-Pattern 1: Fetching All Videos on Every Run

**What people do:** Call YouTube API for all playlists every time the app starts, ignoring cached data.

**Why it's wrong:**
- Wastes quota (10k units = ~10k video fetches, enough for only 2-3 full runs/day)
- Slow (80+ API calls for 4000 videos = 2-3 minutes with rate limits)
- Ignores ETag optimization - YouTube returns 304 if unchanged

**Do this instead:**
- Store ETags with cached data
- Use conditional requests (If-None-Match header)
- Only fetch playlists modified since last sync (check timestamp)
- Implement incremental sync - fetch only new/changed videos

### Anti-Pattern 2: Per-Video ML Inference in Loop

**What people do:**
```python
for video in videos:
    embedding = model.encode(video.title)
    category = categorize(embedding)
```

**Why it's wrong:**
- Model loading overhead repeated (or worse, model loaded per iteration)
- No GPU batching benefits (10-100x slower)
- Misses caching opportunities

**Do this instead:**
```python
# Batch process
texts = [v.title for v in videos]
embeddings = model.encode(texts, batch_size=32, convert_to_tensor=True)
categories = categorize_batch(embeddings)
```

### Anti-Pattern 3: Synchronous API Calls in Web Requests

**What people do:** Call YouTube API directly from FastAPI route handler, blocking response.

**Why it's wrong:**
- HTTP timeout (30-60s) hits before large fetches complete
- User sees frozen UI during API calls
- No progress indication or cancellation

**Do this instead:**
- Use FastAPI BackgroundTasks for simple operations
- Return 202 Accepted with job ID immediately
- Poll status endpoint or use WebSocket for progress updates
- Use Celery for complex workflows requiring retries/scheduling

### Anti-Pattern 4: Storing Embeddings as JSON

**What people do:** Serialize numpy arrays to JSON in database.

**Why it's wrong:**
- 5-10x larger storage (text vs binary)
- Slow serialization/deserialization
- Precision loss with JSON floats

**Do this instead:**
- Store embeddings as BLOB in SQLite (pickle or numpy .npy format)
- Use vector databases (Qdrant, ChromaDB) for large-scale semantic search
- For this project: SQLite BLOB is sufficient (4000 videos × 384 dimensions × 4 bytes = ~6MB)

### Anti-Pattern 5: Optimistic Sync Without Conflict Detection

**What people do:** Push all local changes to YouTube, assuming no remote modifications.

**Why it's wrong:**
- User edits playlist on YouTube mobile app → changes lost
- No handling of concurrent modifications
- Sync failures are silent (no retry logic)

**Do this instead:**
- Three-way merge: compare local state, remote state, last synced state
- Timestamp-based conflict detection
- Last-write-wins or user prompt for conflicts
- Retry queue for failed syncs with exponential backoff

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| YouTube Data API v3 | REST client with OAuth 2.0 or API key | Use google-api-python-client, implement quota tracking, enable ETag caching |
| Sentence Transformers | Local model inference (CPU/GPU) | Download model weights to data/models/, first run downloads ~100MB |
| SQLite | File-based database | Enable WAL mode for concurrency, use migrations for schema changes |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| API ↔ Services | Direct function calls | Services are pure Python, no HTTP overhead |
| Services ↔ Storage | Repository pattern (methods return domain models) | Isolates SQLAlchemy details from business logic |
| API ↔ Frontend | REST JSON / Server-Sent Events for progress | Keep API stateless, use WebSocket for real-time updates |
| Services ↔ ML Engine | Synchronous batch calls or async task queue | In-process for small batches (<1000), Celery for large |
| Background Tasks ↔ Services | Shared database for state, no direct coupling | Tasks read job specs from DB, write results back |

## Build Order & Dependencies

### Phase 1: Foundation (Build First)
**What:** Data models, database schema, YouTube API client wrapper

**Why first:** Every other component depends on data structures and API client

**Build order:**
1. SQLite schema with migrations
2. SQLAlchemy models (Playlist, Video, Category, SyncState)
3. YouTube API client with quota tracking
4. Basic cache layer (store/retrieve with ETags)

**Success criteria:** Can fetch a playlist and store in database

---

### Phase 2: ML Engine (Build Second)
**What:** Embedding generation, semantic similarity, categorization logic

**Why second:** Independent of web UI, can test via scripts

**Build order:**
1. Download and test sentence-transformers model
2. Batch embedding generation with caching
3. Category definition schema and storage
4. Similarity computation and assignment logic

**Success criteria:** Can categorize cached videos from CLI

---

### Phase 3: Web API (Build Third)
**What:** FastAPI routes, background tasks, API endpoints

**Why third:** Needs working data layer and ML engine to expose

**Build order:**
1. FastAPI app skeleton with health check
2. Read-only routes (list playlists, videos, categories)
3. Write routes (update categories, create definitions)
4. Background task integration for fetch/categorize

**Success criteria:** Can trigger operations via HTTP API

---

### Phase 4: Sync Orchestration (Build Fourth)
**What:** Bidirectional sync logic, conflict resolution, state management

**Why fourth:** Most complex component, needs stable foundation

**Build order:**
1. Dirty flag tracking on local changes
2. Fetch remote changes and compare
3. Conflict detection with timestamps
4. Push local changes with retry logic

**Success criteria:** Local edits sync back to YouTube

---

### Phase 5: Frontend UI (Build Fifth - Can Parallel with Phase 4)
**What:** Web interface for review, search, export

**Why fifth:** Independent of backend internals, can build in parallel

**Build order:**
1. Static HTML/CSS/JS shell
2. API client (fetch.js wrapper)
3. Video list/grid with filtering
4. Category assignment UI
5. Sync status and progress indicators

**Success criteria:** Full workflow via web UI

## Sources

**Official Documentation (HIGH confidence):**
- YouTube Data API v3: https://developers.google.com/youtube/v3/getting-started
- YouTube API Implementation Guide: https://developers.google.com/youtube/v3/guides/implementation
- FastAPI Documentation: https://fastapi.tiangolo.com (via Context7)
- Celery Documentation: https://docs.celeryq.dev/en/stable (via Context7)
- Sentence Transformers: https://www.sbert.net (via Context7)

**Best Practices (MEDIUM-HIGH confidence):**
- YouTube API Quota Management: https://getlate.dev/blog/youtube-api-limits-how-to-calculate-api-usage-cost-and-fix-exceeded-api-quota (2025)
- Python Background Task Processing: https://danielsarney.com/blog/python-background-task-processing-2025-handling-asynchronous-work-modern-applications/ (2025)
- ML Pipeline Architecture: https://neptune.ai/blog/ml-pipeline-architecture-design-patterns

**Community Patterns (MEDIUM confidence):**
- Bidirectional Sync: https://medium.com/@janvi34334/how-i-implemented-bidirectional-data-sync-in-a-flutter-retail-app-060aa2f69c9f (2025)
- SQLite Caching Layer: https://nerdleveltech.com/sqlite-in-2025-the-unsung-hero-powering-modern-apps (2025)

---
*Architecture research for: YouTube Playlist Organizer with ML Categorization*
*Researched: 2026-02-05*
