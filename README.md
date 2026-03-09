# Bunkr

A self-hosted personal finance app — a privacy-focused alternative to [Finary](https://finary.com). Track your wealth, investments, and cash flow without leaking your financial data to third parties.

## Why Bunkr?

Finary is a great product, but it requires trusting a third party with all your personal financial information. Bunkr gives you the same features while keeping your data under your control.

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

| Command          | Description                      |
| ---------------- | -------------------------------- |
| `npm run dev`    | Start dev server (Convex + Vite) |
| `npm run build`  | Production build                 |
| `npm run start`  | Start production server          |
| `npm run lint`   | Type-check and lint              |
| `npm run format` | Format code with Prettier        |

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

## Security

### Encryption Model

Bunkr uses **client-held key encryption at rest** to protect your financial data. This is sometimes called "zero-knowledge encryption" — the server stores only ciphertext and public keys, never decryption keys.

**What this means:**
- Your financial data (balances, IBANs, transactions, investments) is encrypted before being stored in the database
- Decryption keys never leave your browser — only you (and workspace members you grant access to) can read your data
- Even if the database is compromised, the attacker gets only ciphertext

**What this does NOT mean:**
- This is NOT end-to-end encryption in the traditional sense. When Powens sends webhook data to the server, the data is briefly in plaintext on the Convex runtime before being encrypted with your public key. A compromised server runtime could theoretically intercept data during this window.
- The server infrastructure (Convex) could theoretically be modified to exfiltrate plaintext during webhook processing. This is an inherent limitation of receiving third-party webhooks — the client isn't online when data arrives.

### Threat Model

| Threat | Protected? | Notes |
|--------|-----------|-------|
| Database breach | Yes | All sensitive data encrypted at rest |
| Server admin reads stored data | Yes | Only ciphertext and public keys stored |
| Compromised server runtime | Partial | Webhook data briefly in plaintext during processing |
| XSS attack on client | Partial | Private keys are non-extractable (can't be exfiltrated) but an active XSS session could invoke decryption |
| User forgets passphrase | No recovery | Zero-knowledge means no password reset |

### Cryptographic Details

- **Asymmetric**: RSA-OAEP 4096-bit with SHA-256
- **Symmetric**: AES-256-GCM with random 12-byte IV per record
- **Key derivation**: PBKDF2 with 600,000 iterations (SHA-256)
- **Envelope encryption**: Each record encrypted with a random AES key, which is wrapped with the workspace RSA public key
- **Authenticated data**: Record IDs used as AES-GCM Additional Authenticated Data (AAD) to prevent ciphertext swapping
- **Key hierarchy**: User passphrase → PBKDF2 → personal RSA keypair → workspace RSA keypair → per-record AES keys

## License

Private — not open source.
