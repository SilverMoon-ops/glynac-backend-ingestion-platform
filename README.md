# Glynac Backend Ingestion Platform (BE-1)

## Demo Video

Watch the 3-5 minute technical walkthrough here: [Loom Video Demo](https://www.loom.com/share/3b35b9162afd4063bb9569b207a09ded)

A mock Salesforce Bulk API ingestion pipeline. Generates mock records for
10 Salesforce object types, lands them as JSON in MinIO (S3-compatible
object storage), then loads them into ClickHouse for analytics — with a
small dashboard to trigger syncs and watch job history.

## Architecture

```
mock_generator.js  -->  bulk_ingest.js  -->  MinIO (raw JSON landing zone)
                                        -->  ClickHouse (queryable tables)
                     ^
                     |
                  server.js (Express API) <--> index.html (dashboard)
```

- `src/generator/mock_generator.js` — produces mock records for 10 objects
  (Accounts, Contacts, Opportunities, Leads, Tasks, Cases, Products,
  PricebookEntries, Contracts, Assets).
- `src/ingestion/minio_client.js` — configured MinIO client.
- `src/ingestion/bulk_ingest.js` — runs a full sync: writes each object's
  batch to MinIO, ensures its ClickHouse table exists, and inserts the
  records. Each object is isolated in its own try/catch, so one failing
  object doesn't take down the rest of the job.
- `src/ui/server.js` + `src/ui/index.html` — Express API and dashboard
  for triggering syncs and viewing job history.

## Prerequisites

- Node.js 18+
- Docker (for MinIO and ClickHouse)

## Setup

1. Copy the environment template and adjust if needed:

   ```bash
   cp .env.example .env
   ```

2. Start MinIO and ClickHouse:

   ```bash
   docker compose up -d
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the server:

   ```bash
   npm start
   ```

5. Open the dashboard at [http://localhost:3000](http://localhost:3000).

## API

- `POST /api/sync` — runs a full ingestion job across all 10 objects.
  Returns `409` if a sync is already in progress. Response includes a
  per-object summary (`success` / `failed`, row count, MinIO path or
  error message) and an overall job status (`success` / `partial` /
  `failed`).
- `GET /api/status` — returns job history (most recent first) and
  whether a sync is currently running.

## Notes

- ClickHouse tables use `ReplacingMergeTree`, keyed on `id` with
  `created_date` as the version column, so re-ingesting the same record
  ID dedupes instead of accumulating duplicate rows.
- Job history is kept in memory and resets when the server restarts —
  fine for this exercise, but a real deployment would persist it (e.g.
  a ClickHouse table of its own, or Redis).
