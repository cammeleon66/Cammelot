# Community leaderboard

The Minister game publishes a completed end score to `GET/POST /api/leaderboard` under the public name chosen before play. No account or email is required. If publication fails, the local result remains available and the result screen offers a retry.

## Public data

- Public display name, or a deterministic seed-generated name when blank
- Scenario, seed, model version, ending tick and political outcome
- Score and compact care/result summary
- Server submission timestamp

No account, email, cookie identifier or IP address is stored. The service uses a client address only in memory for a ten-submissions-per-minute limit. Restarting the service clears this limit.

Community scores are unverified. With no account and no signed server-side replay, a determined caller can forge client results. The interface labels them accordingly. A future verified board would require the server to replay the recorded decision path under the declared model version.

Boards compare only the same model version, scenario and seed. Ranking prioritizes fewer model-classified system deaths, fewer deaths before treatment, more treatment starts, shorter current waits, political completion and finally the scalar score. This prevents an easier seed or a high score with worse mortality from taking precedence. The interface shows both deaths and points beside each name.

The opening screen shows five persisted runs for the selected scenario/model across town seeds and labels that cross-town context. When a newly versioned board is empty, it shows clearly labeled simulation examples; these are UI examples, not stored players. The end screen remains a same-seed board.

## Names and moderation

Names are normalized and limited to 2–24 letters, numbers, spaces and a small punctuation set. HTML is never accepted as a name and the browser inserts names with `textContent`. Blank names become a stable seed-generated name selected from several styles, including minister titles, local call signs and Cammelot bynames.

This is input safety, not semantic moderation. Moderation is deliberately offline: there is no public admin endpoint.

List entries inside the leaderboard container:

`npm run leaderboard:moderate -- list [name-or-id]`

Remove an entry by its 24-character ID:

`npm run leaderboard:moderate -- remove <id>`

Removal creates a timestamped backup beside the JSON file before changing it. In Docker, run the command with the leaderboard volume mounted, for example through `docker compose run --rm leaderboard ...`. Retain and periodically prune backups according to the deployment's retention policy.

## Persistence and deployment

The Node service writes atomically to its configured JSON file, bounded to 5,000 entries. Docker Compose mounts `/data` for local/container deployments.

Production uses Azure App Service Linux at `app-cammelot-leaderboard-a8f605fa.azurewebsites.net`. The app reads/writes `/home/data/leaderboard.json`; App Service storage keeps `/home` across image updates and restarts. The container image is pulled from Azure Container Registry through the Web App's managed identity. HTTPS is mandatory.

The GitHub Pages game calls the Azure HTTPS endpoint directly. The service allows browser requests only from `https://cammelot.org` and `https://www.cammelot.org`; disallowed origins receive 403. It does not allow credentialed CORS. Local/container clients keep the same-origin `/api/leaderboard` route.

Run locally with `npm run leaderboard`. The static Python preview does not proxy the API, so it displays a graceful unavailable message. The complete container stack runs at port 8080 with `docker compose up --build`.

## Operations

- Health: `GET https://app-cammelot-leaderboard-a8f605fa.azurewebsites.net/healthz`
- Back up `/home/data/leaderboard.json` through Entra-authenticated App Service/Kudu access before moderation or migration
- App Service terminates HTTPS and forwards to port 3015; do not expose the container port separately
- Retain only the current model board in the default UI; old model entries stay version-filtered
- Scores are de-duplicated by result content, excluding display name

The first production persistence check submitted a labeled score, restarted App Service, verified that it survived, then backed up and removed it. The final release-check board was empty. Failed Azure Container Apps/Azure Files experiments must not be treated as production storage.