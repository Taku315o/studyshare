# StudyShare Project Overview

StudyShare is a comprehensive platform designed for university students to share, browse, and search for assignment answers, notes, reviews, and questions. It leverages a modern tech stack centered around Next.js, Express, and Supabase.

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js (App Router), TypeScript, Tailwind CSS, React Hook Form, Lucide React |
| **Backend** | Node.js, Express, TypeScript, Multer, Zod, Jose (JWT) |
| **Database/Auth/Storage** | Supabase (PostgreSQL, Auth, Storage) |
| **Package Management** | pnpm (Workspaces) |
| **Testing** | Jest, React Testing Library (Frontend), Supertest (Backend) |

## Project Structure

```text
studyshare/
├── frontend/           # Next.js Application
│   ├── src/app/        # App Router pages and layouts
│   ├── src/components/ # UI Components (organized by feature)
│   ├── src/context/    # Authentication and global context
│   ├── src/lib/        # API clients, Supabase wrappers, and validation logic
│   └── src/types/      # TypeScript type definitions
├── backend/            # Express API Server
│   ├── src/controllers # Route handlers
│   ├── src/services    # Business logic layer
│   ├── src/middleware  # Auth, validation, and idempotency middleware
│   ├── src/routes/     # API route definitions
│   └── src/scripts/    # Database seeding and utility scripts
├── supabase/           # Supabase configuration and migrations
│   ├── migrations/     # SQL migration files
│   └── seeds/          # SQL and CSV seed data
└── docs/               # Detailed documentation (Architecture, Testing, Security, etc.)
```

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm 10+
- A Supabase project with Auth, PostgreSQL, and Storage enabled.

### Setup
1. **Install dependencies:**
   ```bash
   pnpm install
   ```
2. **Configure environment variables:**
   - Copy `frontend/.env.example` to `frontend/.env.local`.
   - Copy `backend/.env.development.example` to `backend/.env.development`.
3. **Seed the database:**
   ```bash
   pnpm --filter backend seed
   ```

### Running the Project
- **Frontend:** `pnpm dev:frontend` (Runs on [http://localhost:3000](http://localhost:3000))
- **Backend:** `pnpm dev:backend` (Runs on [http://localhost:3001](http://localhost:3001))

## Development Conventions

### Architecture & Data Flow
- **Supabase Direct Access:** The frontend often interacts directly with Supabase via RPCs and RLS-protected queries for performance and simplicity (e.g., search, timetable, community).
- **Backend API:** Used for tasks requiring higher privileges or specific server-side processing, such as file uploads (using Multer to Supabase Storage) and administrative deletions (using the Service Role Key).
- **Authentication:** Managed via Supabase Auth (Google OAuth). The frontend uses an `AuthContext` to distribute session state. The backend validates JWTs from the frontend.

### Testing Strategy
- **Frontend:** Focuses on user behavior using Jest and React Testing Library. Key areas include the assignment submission flow, timetable interactions, and community messaging.
- **Backend:** Uses Jest and Supertest for API integration and unit testing. Focuses on validation, authorization, and error handling.
- **Validation:** Zod is used consistently across both frontend and backend for schema validation.

### Database & Storage
- **RLS (Row Level Security):** Crucial for ensuring users can only modify their own data and see data within their university's scope.
- **Storage Buckets:** `notes` (for assignment images), `avatars` (for profile pictures), and `assignments` (legacy).

## Key Commands
- `pnpm build`: Build all projects in the workspace.
- `pnpm test`: Run frontend tests.
- `pnpm --filter backend test`: Run backend tests.
- `pnpm lint`: Run linting for the frontend.
- `pnpm supabase:seed:rebuild`: Rebuild Supabase seeds (custom script).

For more detailed information, refer to the files in the `docs/` directory.
