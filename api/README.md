# `api/` — Future Server-Side Proxy

## Purpose

This folder is reserved for **server-side API proxy code** (e.g., Node.js
Express routes or edge functions) that will be added when the platform
transitions to a fully cloud-hosted architecture.

Planned use cases:
- Supabase auth edge functions
- Row-level security enforcement
- Server-side calculation endpoints (to protect proprietary engine logic)
- OpenMeteo data caching proxy

## Current Status

**Empty** — the app currently runs entirely client-side. No files here are
loaded by `index.html` or `app.js`.

Do **not** delete this folder.
