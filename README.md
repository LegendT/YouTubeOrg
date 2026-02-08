# YouTube Playlist Organiser

A full-stack web application that transforms fragmented YouTube playlists into an organised, findable reference library. It analyses your existing playlists, proposes consolidated categories via ML-powered clustering, auto-categorises thousands of Watch Later videos using client-side AI, and syncs the cleaned-up structure back to YouTube — all while respecting API quota limits.

## Features

### Playlist Analysis & Consolidation
- **AGNES clustering** with word-level Jaccard similarity analyses your playlists for overlap and duplication
- Proposes consolidation from 87+ fragmented playlists down to ~25-35 coherent categories
- Aggressive and conservative algorithm modes (25 vs 35 target clusters)
- Split wizard, duplicate resolver, and manual adjustment controls
- Resizable split-panel dashboard with keyboard navigation

### ML Auto-Categorisation
- **Transformers.js** (all-MiniLM-L6-v2) runs entirely in-browser via Web Workers — no server-side GPU needed
- Processes 4,000+ videos in batches of 32 with real-time progress
- Confidence scoring (HIGH/MEDIUM/LOW) with calibrated thresholds
- **IndexedDB embeddings cache** so re-runs skip already-processed videos
- Channel-name Jaccard boost for Topic/VEVO channels with generic titles

### Review & Approval
- Virtualised 3-column grid handles thousands of videos without UI freeze
- Review modal with embedded YouTube player for quick video previews
- Keyboard shortcuts: `A` accept, `R` reject, arrow keys navigate, `Tab`/`Enter` for grid
- Optimistic updates with auto-advance after each decision
- Filter by confidence level (High/Medium/Low) or review status

### Safety & Backup
- **Pre-operation JSON backups** with SHA-256 checksum verification
- Automatic archiving before any destructive operation (delete, merge)
- Transactional restore with pre-restore safety backup
- Immutable operation log tracking all changes with timestamps
- Pending changes summary before syncing

### YouTube Sync
- Preview changes before syncing (playlists to create, videos to add, playlists to delete)
- **Quota-aware multi-day batching** — pauses at 1,000 remaining units, resumes next day
- Stage-based state machine with checkpoint/resume at video granularity
- Idempotent operations (409 conflict = success, 404 on delete = success)
- Real-time progress with 3-second polling

### UX & Accessibility
- **Dark mode** with system preference detection and manual toggle
- **Phosphor Icons** with consistent weight/style across all pages
- Semantic colour tokens (oklch) for theme-aware styling
- **WCAG 2.2** compliance with focus indicators, ARIA labels, heading hierarchy
- Mobile-responsive layouts with collapsible sidebar and navigation drawer
- Global keyboard shortcuts overlay (`?` key)
- Toast notifications via Sonner for all user feedback

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 15](https://nextjs.org/) with App Router and Turbopack |
| Auth | [NextAuth v5](https://authjs.dev/) (beta) with Google OAuth 2.0 |
| Database | [PostgreSQL](https://www.postgresql.org/) with [Drizzle ORM](https://orm.drizzle.team/) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) |
| ML | [Transformers.js](https://huggingface.co/docs/transformers.js) (Xenova/all-MiniLM-L6-v2) |
| Virtualisation | [@tanstack/react-virtual](https://tanstack.com/virtual) |
| Icons | [Phosphor Icons](https://phosphoricons.com/) |
| Rate Limiting | [Bottleneck](https://github.com/SGrondin/bottleneck) |
| Clustering | [ml-hclust](https://github.com/mljs/hclust) (AGNES) |
| Theme | [next-themes](https://github.com/pacocoursey/next-themes) |

## Getting Started

### Prerequisites

- **Node.js** 18+
- **PostgreSQL** 14+ (local or Docker)
- **Google Cloud** project with YouTube Data API v3 enabled

### 1. Clone and install

```bash
git clone https://github.com/LegendT/YouTubeOrg.git
cd YouTubeOrg
npm install
```

### 2. Set up PostgreSQL

Using Docker:
```bash
docker run --name youtube-org-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=youtube_org \
  -p 5432:5432 \
  -d postgres:16
```

Or use an existing PostgreSQL instance.

### 3. Configure Google OAuth

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable the **YouTube Data API v3**
4. Go to **Credentials** > **Create Credentials** > **OAuth 2.0 Client ID**
5. Set application type to **Web application**
6. Add authorised redirect URI: `http://localhost:3000/api/auth/callback/google`
7. Copy the Client ID and Client Secret

### 4. Create environment file

Create `.env.local` in the project root:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/youtube_org

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-random-secret-here

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

Generate `NEXTAUTH_SECRET` with:
```bash
openssl rand -base64 32
```

### 5. Push database schema

```bash
npx drizzle-kit push
```

### 6. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with Google.

## Usage Workflow

The application guides you through a sequential workflow:

1. **Dashboard** (`/dashboard`) — Sign in, sync your YouTube data, view playlist overview and quota usage
2. **Analysis** (`/analysis`) — Run clustering algorithm, review proposed consolidations, approve/reject/split categories, resolve duplicates
3. **Categories** (`/videos`) — Browse videos by category, search, sort, move/copy between categories
4. **ML Categorisation** (`/ml-categorisation`) — Trigger ML auto-categorisation of uncategorised videos
5. **ML Review** (`/ml-review`) — Review ML suggestions with keyboard shortcuts, accept/reject/recategorise
6. **Safety** (`/safety`) — View backups, operation log, pending changes before sync
7. **Sync** (`/sync`) — Preview changes, start quota-aware sync to YouTube, monitor progress

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── actions/            # Server actions (analysis, backup, categories, ml, sync, videos)
│   ├── analysis/           # Playlist analysis & consolidation page
│   ├── api/                # API routes (auth, backup download)
│   ├── dashboard/          # Dashboard page
│   ├── ml-categorisation/  # ML categorisation trigger page
│   ├── ml-review/          # ML review interface page
│   ├── safety/             # Safety dashboard page
│   ├── sync/               # Sync preview & progress page
│   └── videos/             # Video browsing page
├── components/             # React components
│   ├── analysis/           # Analysis-specific components
│   ├── ml/                 # ML categorisation components
│   ├── ml-review/          # Review interface components
│   ├── safety/             # Safety dashboard components
│   ├── sync/               # Sync UI components
│   ├── ui/                 # shadcn/ui base components
│   └── videos/             # Video browsing components
├── lib/                    # Core business logic
│   ├── analysis/           # Clustering algorithms, duplicate detection
│   ├── auth/               # NextAuth config, session helpers, guards
│   ├── backup/             # Backup/restore logic with checksums
│   ├── categories/         # Category CRUD operations
│   ├── db/                 # Drizzle schema, connection pool
│   ├── ml/                 # ML engine, Web Worker, embeddings cache
│   ├── sync/               # Sync engine, stage executors, YouTube write ops
│   ├── videos/             # Video utilities (formatting, colours)
│   └── youtube/            # YouTube API client, quota tracking
├── middleware.ts            # Auth middleware for route protection
└── types/                  # Shared TypeScript types
```

## Keyboard Shortcuts

Press `?` anywhere to see the full shortcuts overlay.

| Shortcut | Context | Action |
|----------|---------|--------|
| `?` | Global | Toggle shortcuts overlay |
| `A` | ML Review modal | Accept suggestion |
| `R` | ML Review modal | Reject suggestion |
| `←` `→` | ML Review modal | Navigate previous/next |
| `Tab` / `Shift+Tab` | ML Review grid | Navigate between cards |
| `Enter` | ML Review grid | Open selected card |
| `Ctrl/Cmd+Z` | Videos, Categories | Undo last action |

## API Quota

YouTube Data API v3 has a default quota of **10,000 units/day**. The application tracks and manages quota automatically:

- **Read operations**: ~1 unit per request (cached with ETags for 0-cost re-fetches)
- **Write operations**: 50 units per playlist create, 50 per video insert, 50 per playlist delete
- Sync pauses when remaining quota drops below 1,000 units
- Quota resets at midnight Pacific Time
- Multi-day sync support with checkpoint/resume

## Known Limitations

- **Watch Later write access**: YouTube deprecated the Watch Later write API in 2020. Videos cannot be programmatically removed from Watch Later — they must be manually removed after sync.
- **OAuth testing mode**: Google Cloud OAuth consent screen must be in "Testing" mode during development (limited to configured test users). Production deployment with >100 users requires Google verification.
- **Single user**: Designed as a personal tool. No multi-user support.

## Licence

[MIT](LICENSE) — Copyright (c) 2026 Anthony George
