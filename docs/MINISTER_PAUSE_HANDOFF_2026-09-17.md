# Minister of Cammelot — archived pause handoff

Archived: 2026-09-17

The original handoff captured a temporary state before the production leaderboard and subsequent browser/mobile fixes were completed. Its unchecked deployment and Docker items are obsolete, and its commit references are no longer current.

Current status and the small remaining task set are maintained in [MINISTER_RELEASE_STATUS.md](MINISTER_RELEASE_STATUS.md).

The public game is https://cammelot.org/minister.html. The leaderboard runs on Azure App Service with persistent `/home` storage, managed-identity registry pull and exact-origin CORS. Public Pages calls that service directly.
