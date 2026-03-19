# Bunkr — Claude Code Guidelines

## Project Overview

Bunkr is a self-hosted personal finance app (Finary clone). It aggregates banking and financial data via Powens and displays wealth tracking, portfolio analytics, cash flow, and investment data.

## Tech Stack

- **Framework**: TanStack Start (React SSR with file-based routing)
- **Backend**: Convex (real-time database, serverless functions)
- **Auth**: Clerk (via `@clerk/tanstack-react-start`)
- **Styling**: TailwindCSS v4 (using `@tailwindcss/vite` plugin)
- **UI Components**: shadcn/ui
- **Icons**: Lucide React
- **Banking Data**: Powens API (open banking aggregation)

## Commands

- `npm run dev` — Start dev server (runs Convex dev + Vite concurrently)
- `npm run build` — Production build (`vite build && tsc --noEmit`)
- `npm run check` — Biome check (lint + format + imports)
- `npm run check:fix` — Biome check with auto-fix
- `npm run lint` — Biome lint only
- `npm run format` — Biome format

## Project Structure

- `src/routes/` — TanStack Router file-based routes
- `src/routes/__root.tsx` — Root layout
- `src/router.tsx` — Router configuration
- `src/start.ts` — TanStack Start entry
- `src/styles/app.css` — Global styles
- `convex/schema.ts` — Database schema
- `convex/*.ts` — Backend functions (queries, mutations, actions)

## Conventions

- Use TypeScript strictly — no `any` types
- Use Convex validators (`v.*`) for all function arguments and schema definitions
- Use TanStack Router for all routing — file-based routes in `src/routes/`
- Use shadcn/ui components — do not create custom UI primitives when shadcn has one
- Use Lucide for icons (`lucide-react`)
- Use TailwindCSS utility classes — avoid custom CSS unless absolutely necessary
- Backend logic belongs in `convex/` — keep `src/` focused on UI and routing
- Use `@convex-dev/react-query` for data fetching in components

## Commands & Hotkeys

The app uses a centralized command system (`src/lib/commands.ts`, `src/hooks/use-command.ts`) with `react-hotkeys-hook` for keyboard shortcuts.

- **Register commands via `useCommand()`** when an action should be discoverable in the command palette (Cmd+K). Define the command in `COMMAND_DEFINITIONS` in `src/lib/commands.ts` with its metadata (label, group, icon, hotkey), then call `useCommand('command.id', { handler })` in the component that owns the action.
- **Buttons in dialogs should show hotkey hints** using the `<Kbd>` component from shadcn (e.g. `<Button>Cancel <Kbd>Esc</Kbd></Button>`). Bind the hotkey with `useHotkeys()` from `react-hotkeys-hook`. Common pattern: `Esc` for cancel, `↵` (Enter) for the primary action.
- **Dropdown menu items should not have icons** — keep them text-only for visual consistency.
