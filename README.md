# Price Guard

Intelligent AP Pricing & Monitoring. Automatically scan invoices via AI OCR, detect pricing leakage, and trigger credit memos in one click.

## Quick Start (Local Development)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Default login password is `admin`.

Then visit [http://localhost:3000/setup](http://localhost:3000/setup) (or click **⚙ Setup** in the top-right corner of the dashboard) to launch the **Setup Wizard**. It's a guided (in-app) configuration tool that will walk you through connecting your API keys.

---

## Authentication

The app is password-protected. On first run the default password is `admin`(without the 's)

### Changing the Password

1. Generate a hash for your new password:
   ```bash
   node -e "const c=require('crypto');console.log(c.createHash('sha256').update('pg-salt:YOUR_PASSWORD_HERE').digest('hex'))"
   ```
2. Set it in your `.env.local`:
   ```env
   ADMIN_PASSWORD_HASH=<hash from step 1>
   ```
3. Optionally set a signing secret (auto-generated if omitted):
   ```env
   AUTH_SECRET=any-random-string-here
   ```

---

## Data Export

CSV exports are available from the dashboard:
- **Audit Log** — Auditor tab → "Export CSV"
- **Credit Memos** — History tab → "Export CSV"  
- **Vendors & Pricing** — Vendors page → "Export CSV"

---

## Deployment

### Option 1: Docker (Recommended for VPS / On-Premise)

```bash
# Build the image
docker build -t price-guard .

# Run with SQLite persistence
docker run -d \
  --name price-guard \
  -p 3000:3000 \
  -v price-guard-data:/app/data \
  -e ADMIN_PASSWORD_HASH=your_hash_here \
  -e AUTH_SECRET=your_secret_here \
  price-guard
```

SQLite data persists in the `price-guard-data` Docker volume.

### Option 2: Vercel + Supabase (Serverless)

1. Push to GitHub
2. Import in [Vercel](https://vercel.com)
3. Set environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=ey...
   ADMIN_PASSWORD_HASH=your_hash
   AUTH_SECRET=your_secret
   ```
4. Run `supabase-schema.sql` in your Supabase SQL Editor

> **Note:** SQLite won't persist on Vercel. You must use Supabase for the database when deploying serverless.

### Option 3: VPS / Bare Metal

```bash
npm install
npm run build
ADMIN_PASSWORD_HASH=your_hash AUTH_SECRET=your_secret npm start
```

---

## Production Setup (Real Backends)

### Configure `.env.local`

```env
# AI OCR Extraction (OpenAI Vision)
OPENAI_API_KEY=sk-your-openai-key-here

# Email Dispatching (Resend)
RESEND_API_KEY=re_your_resend_key_here
FROM_EMAIL=accounts@your-domain.com 

# Database Persistence (Supabase PostgreSQL)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=ey...

# Authentication
ADMIN_PASSWORD_HASH=your_sha256_hash
AUTH_SECRET=any-random-string
```

### Setup Supabase Database

Copy the SQL from `supabase-schema.sql` and execute it in your Supabase project's SQL Editor.
