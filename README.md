# Homeopathy Library

A private, searchable library of homeopathy books. See `AGENTS.md` for the rules and the plan.

## Run it locally (Windows, macOS or Linux)

You need Node.js 20 or newer and Git. Nothing here touches your Cloudflare account: local D1 and R2 data lives in `.wrangler/` inside this folder.

```
npm install
npm run db:migrate:local
npm run dev
```

Open http://localhost:5173. Leave it running, and in a second terminal import the first book:

1. Download the plain-text UTF-8 file of *New, Old, and Forgotten Remedies* from its Project Gutenberg page, https://www.gutenberg.org/ebooks/38757 ("Plain Text UTF-8"). Save it as `library/originals/pg38757.txt`.
2. Run:

```
npm run import -- library/originals/pg38757.txt library/sources/anshutz-1900-new-old-forgotten-remedies.json
```

If the import is interrupted, run the same command again to resume. Running it after it has finished reports a duplicate and changes nothing.

## Checks

```
npm run check   # types + unit tests
npm run smoke   # end-to-end checks with throwaway local data
```

## Adding another source

Check the source's reuse terms first. Then copy a file in `library/sources/`, give it a new `id`, fill in every field you can verify (use `null` for anything unknown), and import it as above.
