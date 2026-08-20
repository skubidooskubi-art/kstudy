# TODO: Wire the Admin Settings Page to Real Effect

Status: PLANNING ONLY — not started. Do not implement until scheduled.
Owner: skubi
Created from the admin-page reconnaissance pass.

---

## Central finding

The admin page (`app/admin/`) is currently a **write-only island**. It saves to
MongoDB `system_settings.global_settings`, but **nothing reads that document**.
Every value it edits is hardcoded independently elsewhere in the live system.

Components that already work:
- `app/admin/page.tsx` — admin-gated (env `ADMIN_EMAILS` + fallback allowlist). Secure.
- `app/api/admin/config/route.ts` — GET/POST reads/writes `system_settings.global_settings`.
- `app/admin/AdminDashboardClient.tsx` — 3 tabs (Plans & Pricing, AI Models & Costs,
  Credits & Budgets) + live preview + save.

Where the values are ACTUALLY hardcoded today (the wiring targets):
- Price `₦2,000` → `AMOUNT_KOBO = 200000` in `app/page.tsx` (client), plus ~10 hardcoded
  "₦2,000" display strings across `app/page.tsx`, `app/dashboard/page.tsx`, `app/setup/page.tsx`.
- Monthly budget `$1.50` → webhook route (~L58), `quota_engine.py` `DEFAULT_LIMIT` (~L57),
  `lib/quota.ts` (~L31), `lib/auth.ts` default (~L67), `lib/provision.ts`, `app/api/hermes/connect/route.ts`.
- Models (`gemini-*`) → baked into each `cust_*` profile's `config.yaml` at provision time
  (`~/.hermes/scripts/provision_customer.sh`), NOT read live.
- Token pricing → `quota_engine.deduct_usage` hardcodes `$0.50/M` in, `$2.00/M` out (~L259).
- Signup bonus → NO consumer found. Currently a dead control.

---

## ⚠️ Data hazard to resolve before wiring the Models tab

The Models tab defaults show `0.075 / 0.30` per million (Gemini's real API COST).
But actual customer billing in `quota_engine` is `0.50 / 2.00` per million (retail RATE).
Wiring the admin numbers straight to billing without reconciling would **under-charge 6–25×**.
Decide the semantics (retail rate vs API cost) BEFORE this control goes live.

---

## Tab-by-tab: what works, what won't, when

### Tab 3 — Credits & Budgets  →  CLEANEST WIN, do first
- `monthlyBudgetUSD`: webhook sets `user.monthly_budget_usd` (currently hardcoded 1.50).
  If the webhook reads settings instead, every new sub/renewal gets the admin value;
  `quota_engine` + `quota.ts` pick it up automatically (they already read the user doc).
- Speed: no hot-path concern — quota is Redis-cached with 60s Mongo sync.
- Applies: new subs/renewals instantly; existing users on next renewal or via one-shot bulk update.
- `signupBonusCredits`: currently DEAD. Decide: wire to a real trial path, or remove the control.

### Tab 1 — Plans & Pricing  →  HIGH VALUE, tedious display cleanup
- `priceNGN` → checkout: `AMOUNT_KOBO` is hardcoded in a CLIENT component; Paystack inline needs
  the amount at render. Cleanest fix: server-read settings on the landing page and inject price as
  a prop (no flash, no extra round-trip).
- Then replace the ~10 hardcoded "₦2,000" display strings or they'll contradict the admin value. This is the grind.
- `credits` (per-plan USD) → should become `monthly_budget_usd` on subscribe (ties into Tab 3).
- `periodDays` → currently 30 everywhere (rolling cycle); can feed reset logic later.
- Trust note: Paystack amount must stay SERVER-validated — never trust the client. Webhook already
  keys off the event amount (fine).

### Tab 2 — AI Models & Costs  →  MIXED; one part awkward
- `inputCost/outputCostPerMillion`: today only powers the simulation calculator. To drive real billing,
  `quota_engine.deduct_usage` must read it — but that's the HOT path (every message), so it MUST read a
  cached value (mirror settings into Redis, refresh ~60s), never Mongo per call. Fix the number semantics first.
- `defaultModel/fallbackModel`: this is the "will NOT work as a live switch" item. Models are baked into each
  profile's `config.yaml` at provision time. Changing the admin value only affects NEW profiles (if the provision
  script reads settings). Existing customers need a per-profile `config.yaml` rewrite + gateway restart — a
  disruptive batch migration, not an instant toggle. Treat this as "default for newly provisioned profiles."

---

## Speed / caching strategy (cross-cutting)

Foundation is ONE cached accessor so settings never get read from Mongo on every request/LLM call:
- Web app: cache `global_settings` in-process with short TTL (~30–60s) or Next `unstable_cache` +
  `revalidateTag`; bust it on admin POST so changes show up in seconds without redeploy.
- Python/quota side: on admin save, mirror pricing/budget into Redis (e.g. `kstudy:settings:*`); have
  `quota_engine` read Redis on the hot path with a 60s refresh — same pattern quota already uses.

Net: admin edits propagate fast; no page or per-message path hits Mongo directly for settings.

---

## Recommended phasing

- **Phase 0** — Cached settings accessor (web + Redis mirror). Foundation, zero behavior change.
- **Phase 1** — Tab 3 `monthlyBudgetUSD` live (webhook + defaults read settings). Highest value, lowest risk.
- **Phase 2** — Tab 1 price → server-inject into checkout + replace hardcoded display strings.
- **Phase 3** — Tab 2 cost-per-million → `quota_engine` reads cached settings (after reconciling numbers).
- **Phase 4** — Tab 2 model = "default for new provisions" (provision reads settings) + migration job for
  existing profiles. Decide signup-bonus keep-or-cut.

---

## Open decisions needed before coding

1. Token pricing semantics: Models tab = YOUR retail rate (0.50/2.00) or underlying API cost (0.075/0.30)?
2. Signup bonus: wire to a real trial, or remove the dead control?
3. Model switching: accept "default for new profiles only," or also build batch migration for existing customers?
4. Starting point: Phase 0 foundation, or jump to Phase 1 (budget) as first visible win?
