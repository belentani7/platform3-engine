# platform3-engine — local-first job normalization

**Private prototype; not a deployed CRM or Google Places scraper.** The old manifest called this `figura-engine` and referenced four nonexistent `src/` entrypoints. This branch restores a real, bounded BullMQ producer and worker with a pure offline transformation. It does **not** contact Google Places, search the web, send webhooks or charge external APIs.

## What works in this branch

- `src/contract.ts` validates `sourceId`, `name`, optional `city` and optional HTTPS `website`; rejects unrecognized fields instead of retaining arbitrary personal data.
- `src/queues.ts` runs in **dry-run by default** and only writes a persistent BullMQ job with `--enqueue`. Jobs use a stable ID to avoid accidental duplicate submissions while retained.
- `src/workers/enrich.worker.ts` consumes Redis jobs and returns `status: normalized-offline`; this is formatting, **not** a verified business profile. The worker never performs external requests.
- Redis connections are local-only unless `ALLOW_REMOTE_REDIS=1` is explicitly set. Never use a production Redis or real customer data for a demo.

Node.js >=22.13 is required. With dependencies installed from `package.json`:

```sh
npm install
npm test
npm run check
npm run build
npm run dev -- --dry-run --json '{"sourceId":"demo-1","name":" Example "}'
# Only when a local Redis is available:
npm run worker
npm run enqueue -- --json '{"sourceId":"demo-1","name":" Example "}'
```

The existing `docker-compose.yml` is **not release-ready**: it references an absent Dockerfile, and Redis was previously bound on all interfaces. Do not launch it on an exposed machine. The existing `wrangler.toml` references a nonexistent `src/edge.ts`; no edge/webhook deployment is configured. There is no committed npm lockfile, so installs/builds are not reproducible yet. These are **known blockers**, not verified working components.

## Privacy and delivery gates

Repository is private. Do not publish any dataset, internal ZIP or customer data. Git mirror/LFS/issue metadata, encrypted Drive backup and independent restore have not been verified. Production deployment, Redis integration, full TypeScript build, dependency security, browser tests (not applicable: no UI), and GitHub CI with runner steps must be checked before release. The included offline tests do not prove Redis integration or remote connectivity. No external API key is needed for this offline stage.
