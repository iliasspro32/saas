# IvoMarket AI

Production-oriented AI SaaS for creators, marketers, digital product sellers and PLR sellers. Built with Next.js App Router, TypeScript, Tailwind CSS, Supabase, Stripe Billing and OpenRouter.

## Features

- Premium landing page, pricing, auth, dashboard, generator, history, billing, settings, admin, terms and privacy pages.
- Secure server-side AI route with validation, input sanitizing, rate limiting, credit checks and post-success credit deduction.
- Flexible AI provider layer currently wired to OpenRouter and structured for OpenAI, Anthropic, Gemini, DeepSeek, Mistral and custom providers.
- Stripe Checkout subscriptions, Customer Portal and signed webhook handling.
- Supabase schema with RLS policies for profiles, subscriptions, plans, credits, generations, templates, models, usage, admin logs, payments and settings.
- Admin dashboard for user, payment, generation, API usage, template, model and revenue oversight.
- Cloudflare deployment using the current `@opennextjs/cloudflare` adapter for full-stack Next.js on Cloudflare Workers.

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set both server and browser Supabase values:

```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENROUTER_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Supabase Setup

1. Create a Supabase project.
2. Run `supabase/migrations/001_initial_schema.sql` in the SQL editor or through the Supabase CLI.
3. Run `supabase/seed.sql` for development demo data.
4. Enable Email auth in Supabase Auth.
5. To make an admin, update your profile after registration:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

RLS is enabled on all app tables. Users can only read their own profile, credits, subscriptions, generations, usage and payments unless their profile role is `admin`.

## Stripe Setup

1. Create recurring Prices for Starter, Pro and Agency in Stripe.
2. Replace `price_starter`, `price_pro` and `price_agency` in `lib/plans.ts` and the `plans` table.
3. Add webhook endpoint:

```text
https://your-domain.com/api/stripe/webhook
```

4. Subscribe to `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded` and `invoice.payment_failed`.
5. Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.

The app uses Stripe Billing with Checkout Sessions for subscriptions and the Stripe Customer Portal for self-service plan management.

## OpenRouter Setup

1. Create an OpenRouter API key.
2. Set `OPENROUTER_API_KEY`.
3. Confirm the model slugs in `lib/ai/providers.ts` are available for your OpenRouter account.

All AI calls are server-side through `/api/generate`; API keys are never exposed to the browser.

## Cloudflare Deployment

This app uses API routes for AI, Stripe and admin actions, so deploy it as a full-stack Next.js app on Cloudflare Workers through OpenNext. Cloudflare's current Next.js guide sends full-stack SSR apps to the Workers/OpenNext flow; static-only Pages is only for apps without server routes.

If you only need the page to open immediately in Cloudflare Pages, the repository also includes a static fallback:

```text
Build command: leave empty
Output directory: /
```

or:

```text
Build command: leave empty
Output directory: out
```

That fallback prevents a 404, but the full SaaS features require the Workers/OpenNext deployment below.

Install and preview:

```bash
npm install
npm run preview
```

Deploy:

```bash
npm run deploy
```

Required Cloudflare settings are already in `wrangler.jsonc`:

- `main`: `.open-next/worker.js`
- `assets.directory`: `.open-next/assets`
- compatibility flag: `nodejs_compat`
- compatibility date: `2026-05-26`

Add all environment variables in Cloudflare Workers before deploying.

## Security Notes

- Server routes validate inputs with Zod and cap input size.
- AI generation checks bans, credits and rate limits before calling providers.
- Credits are deducted only after output is saved.
- Admin routes require a Supabase profile role of `admin`.
- Stripe webhooks validate the Stripe signature.
- Supabase RLS prevents users from reading other users' data.
- Security headers are configured in `next.config.mjs`.
- Failed AI requests are logged to `api_usage`.

## Next Production Steps

- Replace demo Stripe price IDs.
- Add your legal terms and privacy text.
- Configure transactional email in Supabase.
- Add persistent distributed rate limiting for multi-region production, such as Upstash Redis or Cloudflare KV.
- Expand admin edit forms for templates, models and plans if non-technical admins need direct CRUD controls.
