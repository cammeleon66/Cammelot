---
status: accepted
---

# Keep the game static and host community scores as a sidecar

Minister of Cammelot remains a static, self-contained game so GitHub Pages can serve it cheaply and reliably. Optional community scores use a separate Node sidecar behind same-origin `/api/leaderboard`, because a shared persistent board cannot be implemented securely in a static browser without exposing write credentials. GitHub Pages deployments therefore preserve all gameplay and show a graceful unavailable state until a persistent container host proxies that route; they must not be described as including a live community board.

The sidecar stores no accounts, email addresses or IP addresses. It supports unverified community submissions only; a verified board would require server-side replay of the recorded decisions. Replacing the bounded JSON volume with a database is deferred until traffic or multi-instance deployment requires it.