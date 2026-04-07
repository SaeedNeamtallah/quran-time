# Quranic Pomodoro Next

This is the active Quranic Pomodoro application.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Zustand
- TanStack Query

## Notes

- All API logic now runs through Next route handlers in `src/app/api`.
- Legacy FastAPI backend is no longer required.
- Reader content and recitation/tafsir data are served through the current Next server logic.

## Documentation

- Feature documentation: `docs/feature-documentation.md`
- Algorithm documentation: `docs/algorithm-documentation.md`

## Run

```bash
npm install
npm run dev
```

## Tests

```bash
npm run test
npm run test:e2e
```

## Environment

Create `.env.local` from `.env.example` and fill needed values.

Key variables:

- `CLIENT_ID`
- `CLIENT_SECRET`
- `OAUTH_ENDPOINT`
- `NEXT_PUBLIC_SITE_URL`

`quran-api` also has public API fallbacks for recitation and tafsir endpoints when OAuth responses are unavailable.

## Download Local Mushaf Data (Pages + Rubs)

To speed up reader page/rub loading and reduce upstream API requests, generate a local mushaf dataset:

```bash
npm run download:mushaf
```

This creates `quran_offline.json` in the repository root (one level above `new q`).

Optional flags:

```bash
npm run download:mushaf -- --concurrency=8 --retries=4 --output=../quran_offline.json
```

At runtime, `GET /api/page`, `GET /api/rub`, `GET /api/chapter_index`, and `GET /api/verse_sequence` are served from this downloaded mushaf data. The reader no longer falls back to remote Quran APIs for these endpoints.
