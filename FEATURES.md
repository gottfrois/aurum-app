# Bunkr — Top 10 Killer Features Roadmap

Ranked by **value/effort ratio**. Bunkr's zero-knowledge encryption is the core differentiator — these features lean into that advantage.

---

## 1. AI Financial Copilot (Local/Private LLM Chat) `[AI]` `[Differentiator]`

**Value: 10 | Effort: Medium**

A chat interface where users ask questions about their finances: _"How much did I spend on restaurants this month?"_, _"What's my savings rate?"_, _"Am I on track for retirement?"_. The killer differentiator: **all inference happens client-side or via a user-provided API key** — Bunkr never sees the prompts or answers. Finary has no AI features. This alone could be the reason people switch.

**Implementation**: Add a `/chat` route with a simple message UI. Decrypt financial data client-side, build a context prompt, call the user's configured LLM endpoint (OpenAI/Anthropic/Ollama). Store nothing server-side.

---

## 2. Transactions & Cash Flow `[Must-Have]`

**Value: 10 | Effort: Medium**

Powens already provides transaction data — we're just not syncing it yet. Add a transactions table, sync from Powens, and display a cash flow view with income vs. expenses over time. This is the #1 most-requested feature in every personal finance app.

**Implementation**: Add `transactions` table to schema, extend Powens sync to pull transactions, add `/transactions` route with filterable list + cash flow chart.

---

## 3. AI Spending Anomaly Detection `[AI]` `[Differentiator]`

**Value: 9 | Effort: Low**

Once transactions exist, run client-side anomaly detection: flag unusual charges, duplicate subscriptions, price increases, forgotten trials. Show a simple alert banner on the dashboard: _"Your Netflix went up €2/mo"_, _"Unusual €847 charge at XYZ"_. No AI model needed for basics — just statistical rules (Z-score on categories). Optionally, use the user's LLM key for natural language summaries.

**Implementation**: Pure client-side logic on decrypted transaction data. A `useAnomalies()` hook + alert component on the dashboard.

---

## 4. Financial Independence / FIRE Calculator `[Differentiator]`

**Value: 9 | Effort: Low**

A `/goals` page where users set a target number (e.g., €1M) and Bunkr projects when they'll hit it based on current savings rate and portfolio growth. Show a progress bar and projected date. Finary has a basic version — but ours runs **entirely client-side with encrypted data**, a privacy win.

**Implementation**: New route, simple compound growth math on current net worth + monthly savings rate derived from balance history. No backend changes needed.

---

## 5. Auto-Categorized Spending Breakdown `[Must-Have]`

**Value: 8 | Effort: Low-Medium**

Pie chart / Sankey diagram of spending by category (Housing, Food, Transport, Entertainment, etc.). Powens provides category data on transactions. This is table-stakes for any finance app but combined with E2E encryption it's a differentiator.

**Implementation**: Leverage Powens transaction categories. Add a spending breakdown chart component to dashboard using Recharts (already a dependency).

---

## 6. AI-Powered Monthly Financial Report `[AI]` `[Differentiator]`

**Value: 8 | Effort: Low**

Generate a monthly "financial health report" — a 1-page summary with net worth change, top spending categories, portfolio performance, savings rate, and actionable insights. Rendered as a beautiful shareable card. Uses the user's LLM key for the narrative, or falls back to template-based text.

**Implementation**: A `/reports` route that aggregates existing data (net worth history, category balances, investments P&L) and formats it. The AI part is just a prompt over structured data the client already has.

---

## 7. Recurring Expense & Subscription Tracker `[Differentiator]`

**Value: 8 | Effort: Low**

Detect recurring transactions (subscriptions, bills, memberships) and show them in a dedicated view with total monthly cost, renewal dates, and a "cancel" reminder. Finary doesn't have this. High-impact because people consistently underestimate subscription spend.

**Implementation**: Client-side pattern matching on transaction history (same merchant, similar amount, regular interval). New component + optional `/subscriptions` route.

---

## 8. Multi-Currency & Crypto Support `[Must-Have]`

**Value: 7 | Effort: Medium**

Support manual crypto wallet tracking (read-only, via public address) and multi-currency portfolios with automatic FX conversion. Many Finary users complain about poor crypto support. Keeping it read-only (public addresses only) aligns with the privacy-first approach — no API keys or exchange logins needed.

**Implementation**: Add `manualAssets` table, public blockchain API calls (Etherscan, Blockstream) for balances, FX rates from a free API. New `/crypto` or extend `/accounts`.

---

## 9. Shared Household Finance (Privacy-Preserving) `[Differentiator]`

**Value: 7 | Effort: Low**

Workspaces + members + encryption key slots already exist. Expose this as a "Household" feature: couples/families share a workspace where each member sees aggregated net worth but only their own transaction details. The E2E encryption makes this uniquely trustworthy vs. competitors.

**Implementation**: Mostly UI work — backend already exists. Add a household dashboard view that aggregates member profiles, a member onboarding flow, and granular visibility controls.

---

## 10. One-Click Data Export (Encrypted Backup) `[Differentiator]`

**Value: 6 | Effort: Very Low**

Export all data as an encrypted JSON/CSV file. Users own their data — they can back it up, move to another tool, or audit it. Finary locks data in. This is a trust signal that reinforces the privacy-first brand.

**Implementation**: A button in Settings that decrypts all data client-side, packages it as JSON/CSV, and triggers a browser download. Zero backend changes.

---

## Summary

| #   | Feature                       | Value | Effort   | Type                |
| --- | ----------------------------- | ----- | -------- | ------------------- |
| 1   | AI Financial Copilot          | 10    | Medium   | AI / Differentiator |
| 2   | Transactions & Cash Flow      | 10    | Medium   | Must-Have           |
| 3   | AI Spending Anomaly Detection | 9     | Low      | AI / Differentiator |
| 4   | FIRE Calculator               | 9     | Low      | Differentiator      |
| 5   | Spending Breakdown            | 8     | Low-Med  | Must-Have           |
| 6   | AI Monthly Report             | 8     | Low      | AI / Differentiator |
| 7   | Subscription Tracker          | 8     | Low      | Differentiator      |
| 8   | Multi-Currency & Crypto       | 7     | Medium   | Must-Have           |
| 9   | Household Finance             | 7     | Low      | Differentiator      |
| 10  | Encrypted Data Export         | 6     | Very Low | Differentiator      |

### Quick wins to ship first

- **#10** (hours of work)
- **#4** (1-2 days, pure client-side math)
- **#9** (mostly UI on existing infra)
- **#3 and #7** (once #2 is done)

### The Privacy Moat

Features 1, 3, 6, 9, and 10 all leverage E2E encryption as a competitive advantage. Finary can't easily replicate this because their architecture doesn't support client-side-only data processing. Every AI feature running on the user's own LLM key with decrypted-only-in-browser data is a story no competitor can tell.
