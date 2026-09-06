# Velo Gmail push bridge

Small deployment service for Gmail `users.watch` / Google Pub/Sub notifications.
It is intentionally separate from the Tauri app so it can run on Coolify.

## What it does

- accepts Gmail watch registrations from Velo;
- renews watches before their seven-day expiry;
- receives authenticated Pub/Sub push messages;
- exposes a server-sent events stream for connected Velo clients;
- persists registrations in a mounted JSON data file.

The service does not receive or store mailbox contents. Gmail notifications only contain an account email and history ID; Velo still performs the incremental Gmail API sync.

## Setup

1. Create a Google Cloud Pub/Sub topic, for example `projects/PROJECT_ID/topics/velo-gmail`.
2. Grant Gmail's publishing service account permission to publish to that topic:
   `serviceAccount:gmail-api-push@system.gserviceaccount.com` with `roles/pubsub.publisher`.
3. Create a Pub/Sub push subscription targeting `https://YOUR_HOST/pubsub`.
4. Deploy this directory with Docker Compose and set `PUSH_SHARED_SECRET`.
5. Configure the Velo desktop client to use the service URL and shared secret.

The current desktop app does not yet call this bridge; this service is the deployable backend seam for that integration.
