# Universal Queue Service

Queue worker service for background jobs, email delivery, social posting, and job monitoring.

## What This Service Does

- Creates BullMQ queues for email jobs and social jobs.
- Runs workers for email and social publishing tasks.
- Exposes an Express API to enqueue jobs and inspect queue status.
- Mounts Bull Board for queue monitoring.
- Uses Redis through `ioredis`.

## Structure

```text
config/
  mailer.js
  redis.js
src/
  api/server.js
  queues/emailQueue.js
  queues/socialQueue.js
  workers/emailWorker.js
  workers/socialWorker.js
```

## Main Endpoints

```text
POST   /api/email/send
POST   /api/social/post
GET    /api/queues/status
DELETE /api/queues/:queueName/jobs/:jobId
GET    /admin/queues
```

## Quick Start

```bash
npm install
copy .env.example .env
node src/api/server.js
```

Redis must be running and reachable using the values in `.env`.

## Environment

Common variables:

- `PORT`
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

## Repository Boundary

This repo only handles background queue orchestration. API routes, deployment configs, and frontend apps are kept in separate repositories.
