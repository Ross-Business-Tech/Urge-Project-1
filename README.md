# Memo Drafter

**Live tool:** https://memo-drafter.onrender.com (team password from the team lead; never stored in the code)
**Test score:** 31 / 31 acceptance examples (`node tests/acceptance.mjs`) · 88 / 88 automated stress checks (`npm run stress`)
**Deliverables:** user guide, README and test results sheet in [`deliverables/`](deliverables/)

## 1. What it does
Drafts EBIARA's 15–20 page investment committee memo from a deal's underwriting data, to cut the 8–12 hours an underwriter spends writing it.

- **Enter the deal** by typing it, loading a saved spreadsheet, or **AI scan** of the term sheet, underwriting model and financials.
- **The memo follows the fund's format:** Request, Investment Merits with green/yellow/red evaluations, Project Breakdown, Sources & Uses, Mission Alignment, Neighborhood Impact, Financials, Repayment, Risks & Mitigants, Loan Sizing, Recommendation, Approvals and Exhibits.
- **The memo is checked:**
  - a verification report re-does the math and the ratings
  - every number can be tapped to see where it came from
  - red/yellow flags challenge the borrower's assumptions
- **Other features:**
  - recent news on the borrower and the site
  - one-tap link to the project address on walkscore.com
  - AI descriptions of the area and AI-drafted paragraphs
  - rough notes and bullets are rewritten into polished memo sentences (same facts and numbers; "Show my original wording" switches back)
  - users can add their own memo sections
  - export to Word or PDF

## 2. How it works
- **Front end** (React + Vite, `src/`) runs in the browser. Deal data stays in the user's browser; there is no database.
  - Memo layout: `src/components/Memo.jsx`
  - Calculations and flags: `src/lib/analysis.js`
  - Rating thresholds: `src/lib/verify/rubric.js`. An independent re-check in `src/lib/verify/ratings.js` must agree with them.
  - Neighborhood impact assumptions: `src/lib/impact.js`
- **Server** (`server.mjs`, Node 20+, no database) runs on Render. It:
  - serves the built app
  - enforces the shared password (`api/auth.js`)
  - relays AI and news requests so the AI key stays on the server (`api/_lib.js`)
- **AI service:** the key decides which one is used (U-M GPT Toolkit, OpenAI or OpenRouter). If the service can't search the web, the news search uses Bing/Google News plus an AI review instead.

## 3. What it can't do
- It writes a **first draft**. An underwriter must review every AI-filled value, AI-polished sentence, news item, mitigant and the recommendation; the committee decides.
- **Neighborhood impact figures are planning ranges** from general assumptions (e.g. 1.5%–3% property tax), not measured or client-provided numbers. Replace them before presenting impact.
- Free news ratings come from warning words in headlines, and news sites may limit requests from the server.
- There are no user accounts, only one shared password. Data and "all future memos" sections live in each user's browser.
- The firm financial model (another team) isn't connected yet. Refinance/cap-rate scenarios and the risk-rating sheet aren't included.
- The AI scan handles up to 20 files (about 12 MB) per request. Only share documents you are allowed to send to the AI service.

## 4. Running and maintaining it
| Task | How |
|---|---|
| Deploy a change | Merge a pull request into `main`. Render rebuilds automatically (`npm ci && npm run build`, then `npm start`). Check `/api/health` afterwards. |
| Render settings | `SITE_PASSWORD` (8+ characters; without it the site stays locked) · `OPENROUTER_API_KEY` (the AI key, for any of the three services) · optional `AI_ORGANIZATION` (U-M shortcode), `AI_MODEL`, `AI_BASE_URL`. Never put keys or the password in code, slides or GitHub. |
| Remove someone's access | Change `SITE_PASSWORD` in Render. Everyone is signed out and needs the new password. |
| AI key | U-M GPT Toolkit keys expire yearly: renew at toolkit.umgpt.umich.edu, paste the new key into Render, and redeploy. Usage is billed to the shortcode. |
| Test before merging | `npm run build` · `npm run stress` · `node tests/acceptance.mjs` (all must pass). |
| Change a rule or assumption | Edit `rubric.js` and the matching rule in `analysis.js` (the stress test fails if they disagree). Impact assumptions are in `impact.js`. |
| Cost | Render's free plan sleeps when idle, so the first visit takes about a minute; about $7/month keeps it awake. AI usage is charged per request. |

Built from the Business+Tech starter template; class workflow notes are in `START-HERE.md` and `CLAUDE.md`.
