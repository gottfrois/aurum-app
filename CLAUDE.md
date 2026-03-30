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

## Design Philosophies

These principles guide all development decisions. When in doubt, refer back to these.

### 1. Performance Above All Else

Always do the thing that makes the app feel the fastest to use.

- Use **optimistic updates** for mutations — the UI should reflect changes immediately, not after a server round-trip.
- Use custom data loader patterns and custom link components with **prewarm on hover** to eliminate perceived latency.
- Avoid **waterfalls** in everything — JS bundles, data fetching, file loading. Parallelize aggressively.
- Minimize blocking states — let users get into the app as fast as possible.

### 2. Good Defaults

Users should expect things to behave well out of the box. Less config is best. Don't add settings or options when a sensible default will do.

### 3. Convenience

Simplicity and good UX are non-negotiable. The app should be pleasant to use with minimal friction.

- All links are "share" links by default.
- Getting from homepage to the target content should always be fewer than 4 clicks.
- Minimize blocking states and loading spinners — use skeletons, optimistic UI, and progressive loading instead.

### 4. Security

Convenience must not come at the cost of security. Be thoughtful about implementation.

- Always check team status and user status before committing changes.
- Be **very** careful about endpoints exposed publicly — default to authenticated.
- Use auth and authorization checks where they make sense.

### 5. UI/UX Excellence

Take inspiration from best-in-class web apps like **Linear** as a general rule. Aim for their level of polish, responsiveness, and attention to detail in interactions, animations, and layout.

## Agent Behavior

- Browse the codebase to understand existing patterns before making changes. Don't assume — read the code first.
- Always use `npm run` scripts (e.g. `npm run check`, `npm run format`) instead of invoking tools directly via `npx` (e.g. `npx biome check`).

## Conventions

- Use TypeScript strictly — no `any` types
- Use Convex validators (`v.*`) for all function arguments and schema definitions
- Use TanStack Router for all routing — file-based routes in `src/routes/`
- Use shadcn/ui components — do not create custom UI primitives when shadcn has one
- When installing a UI component that would override an existing shadcn component, keep the original file to avoid breaking customizations on it
- Use Lucide for icons (`lucide-react`)
- Use TailwindCSS utility classes — avoid custom CSS unless absolutely necessary
- Backend logic belongs in `convex/` — keep `src/` focused on UI and routing
- Use `useQuery`/`useMutation`/`useAction` from `convex/react` for data fetching in components (`@convex-dev/react-query` is only used as plumbing in `src/router.tsx` for TanStack Router SSR/preloading)

## Commands & Hotkeys

The app uses a centralized command system (`src/lib/commands.ts`, `src/hooks/use-command.ts`) with `react-hotkeys-hook` for keyboard shortcuts.

- **Register commands via `useCommand()`** when an action should be discoverable in the command palette (Cmd+K). Define the command in `COMMAND_DEFINITIONS` in `src/lib/commands.ts` with its metadata (label, group, icon, hotkey), then call `useCommand('command.id', { handler })` in the component that owns the action.
- **Dropdown menu items should not have icons** — keep them text-only for visual consistency.

## Storybook

When creating or modifying reusable components in `src/components/`, add or update a corresponding Storybook story in `src/components/stories/`. Stories should cover the main variants and states of the component. Use the existing stories as reference for patterns (decorators, mock data, context providers). Stories are organized by category: `Data Display`, `Charts`, `Forms`, `Navigation`, `Feedback`, `Overlays`, `Elements`.

## Dialog Conventions

All dialogs must follow these patterns for consistency:

- **Always include a Cancel button** with `<Kbd>Esc</Kbd>` hint and an `Esc` hotkey via `useHotkeys('escape', onCancel, { enableOnFormTags: true, preventDefault: true })`.
- **Primary action uses `mod+enter`** (not plain Enter) to avoid conflicts with form inputs. Display with `<HotkeyDisplay hotkey={{ keys: 'mod+enter' }} />`. Bind via `useHotkeys('mod+enter', handler, { enabled: !disabled, enableOnFormTags: true, preventDefault: true })`.
- **Extract footer into a separate component** (e.g. `CreateFooFooter`) that owns the hotkey bindings, to keep the main dialog component clean.
- **Use the Button `loading` prop** instead of custom `{loading ? 'Saving...' : 'Save'}` text patterns.
- **Hide the close button** with `<DialogContent showCloseButton={false}>` — the Cancel button with Esc replaces it.
- **Use `<Kbd>` from shadcn** (`src/components/ui/kbd.tsx`) for single keys and `<HotkeyDisplay>` for key combos. The `Kbd` component auto-adapts its colors inside primary and destructive buttons.
