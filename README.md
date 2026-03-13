# Price Guard

Intelligent AP Pricing & Monitoring. Automatically scan invoices via AI OCR, detect pricing leakage, and trigger credit memos in one click.

## Out-of-the-Box Experience (Mock Mode)

By default, **Price Guard runs perfectly out-of-the-box without any external services.**

If no API keys are provided, the application relies on an **In-Memory Service Layer**:
- **OCR Uploads:** Uploading any image will simulate a 1.5s extraction delay and return a structured mock invoice.
- **Database:** Approved, pending, and dismissed credit memos are stored in RAM. They will reset when the server restarts.
- **Emails:** Clicking "Approve & Send" logs the email body to your server console instead of actually emailing the vendor.

To run the app in Mock Mode right now:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see it in action.

Then visit [http://localhost:3000/setup](http://localhost:3000/setup) (or click **⚙ Setup** in the top-right corner of the dashboard) to launch the **Setup Wizard** — a guided, in-app configuration tool that walks you through connecting your own API keys.

---

## Production Setup (Real Backends)

Price Guard is fully configured to use real external SDKs automatically if the correct environment variables are provided.

### 1. Configure `.env.local`

Create a `.env.local` file in the root of the project to activate the real services:

```env
# 1. Real AI OCR Extraction (OpenAI Vision)
# Requires a funded OpenAI account
OPENAI_API_KEY=sk-your-openai-key-here

# 2. Real Email Dispatching (Resend)
# Creates real email drafts sent to vendors
RESEND_API_KEY=re_your_resend_key_here
FROM_EMAIL=accounts@your-domain.com 

# 3. Real Database Persistence (Supabase PostgreSQL)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
# Use the Service Role Key so the server can bypass RLS for now
SUPABASE_SERVICE_ROLE_KEY=ey...
```

### 2. Setup Supabase Database

If you provided the Supabase URLs above, you must initialize the database tables.

Copy the SQL from `supabase-schema.sql` (found in the root directory) and execute it in your Supabase project's SQL Editor to create the `vendors`, `invoices`, `product_pricing`, and `credit_memos` tables.

### 3. Run Production Server

Once configured, restart the Next.js server. The `src/lib/services.ts` locator will instantly transition the app from the In-Memory mock repositories to the real, stateful Supabase/OpenAI/Resend implementations.
