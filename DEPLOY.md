# Deploying the private development version

This creates only `homeopathy-library-dev` resources. It never reads, changes or deletes any other Worker, database, bucket, Access application or policy in the account.

Expected cost: $0. This fits within Workers Free, D1 Free, R2's free tier (10 GB-month, 1M Class A and 10M Class B operations per month) and Zero Trust Free (up to 50 users). R2 and Zero Trust ask for a payment card even on their free plans.

## How access is enforced

1. **Cloudflare Access** on the Worker's `workers.dev` URL asks for sign-in before any request reaches the Worker. Preview URLs are disabled.
2. **The Worker itself** (`worker/access.ts`) runs first on every path, including pages, `/api/*` and `/api/sources/<id>/original`. It verifies the `Cf-Access-Jwt-Assertion` token against your team's signing keys and the application's AUD tag, then checks the email against `ALLOWED_EMAILS`.
3. Until the three Access secrets are set, the Worker refuses every request ("Access is not configured"), so a freshly deployed URL exposes nothing.

## Steps (PowerShell, in `Documents\homeopathy-library`)

Before you start: enable R2 in the dashboard, and set up Zero Trust (team name, Free plan) if you haven't already.

```powershell
git clone https://github.com/ayricw/homeopathy-library.git .   # only if the folder is empty
npm install
npx wrangler login            # opens your browser
npx wrangler whoami           # confirm the right account
```

Look before creating anything (read-only):

```powershell
npx wrangler d1 list
npx wrangler r2 bucket list
```

Create the dev resources:

```powershell
npx wrangler d1 create homeopathy-library-dev
#   copy the printed database_id into wrangler.jsonc -> env.dev -> d1_databases[0].database_id
npx wrangler r2 bucket create homeopathy-library-dev
npm run db:migrate:dev
npm run deploy:dev            # prints https://homeopathy-library-dev.<your-subdomain>.workers.dev
```

Opening the URL now shows "Access is not configured for this deployment yet." That's expected.

### Turn on Cloudflare Access (dashboard)

1. Go to **Workers & Pages → homeopathy-library-dev → Settings → Domains & Routes**.
2. On the **workers.dev** row, choose **Enable Cloudflare Access**. Note the **AUD tag** and the **team domain** (`https://<team>.cloudflareaccess.com`) shown in the dialog.
3. Choose **Manage Cloudflare Access**. Make the application's policy an **Allow** policy that includes **Emails**: your address and your wife's. If the application points at a shared, reusable policy that another app also uses, create a new policy named `homeopathy-library-dev-allow` instead of editing the shared one.
4. Leave Preview URLs disabled.

### Set the Worker's Access secrets

Type each value when prompted. Values are stored encrypted in Cloudflare and never appear in Git or logs.

```powershell
npx wrangler secret put TEAM_DOMAIN --env dev      # https://<team>.cloudflareaccess.com
npx wrangler secret put POLICY_AUD --env dev       # the AUD tag
npx wrangler secret put ALLOWED_EMAILS --env dev   # you@example.com,wife@example.com
```

### Check, import, check again

```powershell
npm run check:deployed -- --env dev --url https://homeopathy-library-dev.<your-subdomain>.workers.dev
```

Then open the URL, sign in with the emailed code, and go to **Import**. Choose `library/originals/pg38757.txt`; the form is already filled in for that book. Run the check command again afterwards. It verifies the import, the passage offsets against R2, the original file's SHA-256 and the keyword index.

## Review checklist

- **Access:** a private browser window that isn't signed in sees the Cloudflare sign-in page, and so do `/api/sources` and `/api/sources/anshutz-1900-new-old-forgotten-remedies/original`. An email that isn't on the list is refused.
- **Import:** the import completes, and the Sources page shows the title, author, year, source URL, attribution and reuse terms, plus "complete" with a passage count. Importing the same file again reports a duplicate.
- **Search:** `cough` returns highlighted results. `"burning pain"` matches only that exact phrase. `rheumat*` matches word prefixes.
- **Filters:** the source and author filters narrow the results. Edition shows "No editions recorded" because the edition is unknown.
- **References:** opening a result shows the remedy heading, line numbers, "This file has no page numbers" and the surrounding passages. "Source page" opens the Gutenberg page, and "Original file" shows the untouched text.

## Client records in dev (made-up clients only)

Client records need their own database. Until it exists, `npm run deploy:dev` fails, because `wrangler.jsonc` names it.

```powershell
npx wrangler d1 create homeopathy-library-dev-clients
#   copy the printed database_id into wrangler.jsonc -> env.dev -> d1_databases[1].database_id
npm run db:migrate:clients:dev
```

Then set two secrets. The key only encrypts test clients in dev, so it doesn't need to be kept.

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" | npx wrangler secret put CLIENT_KEY --env dev
npx wrangler secret put CLIENT_EMAILS --env dev    # the email(s) allowed to see client records
npm run deploy:dev
```

A **Clients** link then appears for those emails. Use made-up names only: the dev page says so.

# Production (real client records)

The production Worker is `homeopathy-library-prod`, served on its own workers.dev URL behind its own Access application. It uses only `homeopathy-library-prod-*` resources. Expected cost: $0 on the free plans.

Look first (read-only), then create:

```powershell
npx wrangler d1 list
npx wrangler r2 bucket list
npx wrangler d1 create homeopathy-library-prod
#   copy the database_id into wrangler.jsonc -> env.production -> d1_databases[0].database_id
npx wrangler d1 create homeopathy-library-prod-clients
#   copy the database_id into wrangler.jsonc -> env.production -> d1_databases[1].database_id
npx wrangler r2 bucket create homeopathy-library-prod
npm run db:migrate:prod
npm run db:migrate:clients:prod
npm run build:repertory -- library/originals/oorep.sql.gz library/repertories/publicum.json
npm run deploy:prod
```

Turn on Access exactly as for dev (above), on `homeopathy-library-prod`, with a new policy named `homeopathy-library-prod-allow`. Then set the secrets:

```powershell
npx wrangler secret put TEAM_DOMAIN --env production
npx wrangler secret put POLICY_AUD --env production       # the prod application's AUD tag
npx wrangler secret put ALLOWED_EMAILS --env production
npx wrangler secret put CLIENT_EMAILS --env production    # suggested: Robyn's email only
```

### The client records key

Every client name and note is encrypted with this key. **If it is lost, the records cannot be read by anyone, including you.** Generate it, save it in your password manager, then store it in Cloudflare:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
#   save the printed value in your password manager first
npx wrangler secret put CLIENT_KEY --env production       # paste the same value
```

Never paste it into chat, Git or a file in this folder.

### Production checklist

- A private window that isn't signed in sees the Cloudflare sign-in page.
- An allowed email that isn't in `CLIENT_EMAILS` sees no **Clients** link, and `/api/clients` answers 403.
- Robyn can add a test client, start a visit, add rubrics, write a note, reload and see it saved, download the record, and delete the client.
- Backups: D1 Time Travel can restore the clients database to any point in the last 7 days (`npx wrangler d1 time-travel info homeopathy-library-prod-clients --env production`).
