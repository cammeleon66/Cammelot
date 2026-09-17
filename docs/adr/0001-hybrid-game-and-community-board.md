---
status: accepted
---

# Keep the game static and host community scores as a sidecar

Minister of Cammelot remains a static, self-contained game so GitHub Pages can serve it cheaply and reliably. Optional community scores use a separate Node service, because a shared persistent board cannot be implemented securely in a static browser without exposing write credentials. The production game calls an Azure App Service HTTPS endpoint protected by an exact-origin CORS allowlist. Local/container deployments use same-origin `/api/leaderboard`.

The backend stores no accounts, email addresses or IP addresses. It supports unverified community submissions only; a verified board would require server-side replay of the recorded decisions. Production persists bounded JSON under App Service `/home` and runs one B1 instance. Replacing it with a database is deferred until traffic or multi-instance deployment requires it.