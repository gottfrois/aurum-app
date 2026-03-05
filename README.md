# Aurum

A self-hosted personal finance app — a privacy-focused alternative to [Finary](https://finary.com). Track your wealth, investments, and cash flow without leaking your financial data to third parties.

## Why Aurum?

Finary is a great product, but it requires trusting a third party with all your personal financial information. Aurum gives you the same features while keeping your data under your control.

## Features (Planned)

- **Account Aggregation** — Connect bank accounts, brokers, and crypto wallets via [Powens](https://www.powens.com/) (the same open banking provider Finary uses)
- **Net Worth Tracking** — Real-time overview of all your assets and liabilities
- **Portfolio Analytics** — Performance reports, diversification scoring, fee analysis
- **Cash Flow & Budget** — Transaction categorization, spending analytics, Sankey charts
- **Investment Tracking** — Stocks, ETFs, crypto, real estate, and more
- **Dividend Tracking** — Track dividend income across your portfolio
- **Financial Independence** — Goal setting and progress tracking

## Tech Stack

- **Frontend**: [TanStack Start](https://tanstack.com/start) (React SSR framework), [TailwindCSS](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/), [Lucide Icons](https://lucide.dev/)
- **Backend**: [Convex](https://convex.dev/) (real-time backend-as-a-service)
- **Auth**: [Clerk](https://clerk.com/)
- **Banking Data**: [Powens](https://www.powens.com/) (open banking aggregation API, formerly Budget Insight)

## Getting Started

### Prerequisites

- Node.js 20+
- A Convex account
- A Clerk account
- A Powens account (for banking data aggregation)

### Setup

```bash
# Install dependencies
npm install

# Start the dev server (Convex + Vite)
npm run dev
```

This runs both the Vite dev server and the Convex dev process concurrently.

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Convex + Vite) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Type-check and lint |
| `npm run format` | Format code with Prettier |

## Project Structure

```
src/
  routes/        # TanStack Router file-based routes
  styles/        # Global styles (TailwindCSS)
  router.tsx     # Router configuration
  start.ts       # TanStack Start entry point
convex/
  schema.ts      # Convex database schema
  *.ts           # Backend functions (queries, mutations, actions)
```

## License

Private — not open source.
