# Community leaderboard

The Minister game can publish an end score to `GET/POST /api/leaderboard`. Publishing is optional and requires an explicit button click.

## Public data

- Public display name, or a deterministic seed-generated name when blank
- Scenario, seed, model version, ending tick and political outcome
- Score and compact care/result summary
- Server submission timestamp

No account, email, cookie identifier or IP address is stored. The service uses a client address only in memory for a ten-submissions-per-minute limit. Restarting the service clears this limit.

Community scores are unverified. With no account and no signed server-side replay, a determined caller can forge client results. The interface labels them accordingly. A future verified board would require the server to replay the recorded decision path under the declared model version.

Boards compare only the same model version, scenario and seed. Ranking prioritizes fewer model-classified system deaths, fewer deaths before treatment, more treatment starts, shorter current waits, political completion and finally the scalar score. This prevents an easier seed or a high score with worse mortality from taking precedence. The interface shows both deaths and points beside each name.

## Names and moderation

Names are normalized and limited to 2–24 letters, numbers, spaces and a small punctuation set. HTML is never accepted as a name and the browser inserts names with `textContent`. Blank names become a stable `Minister <adjective> <animal> <seed suffix>` name.

This is input safety, not semantic moderation. Moderation is deliberately offline: there is no public admin endpoint.

List entries inside the leaderboard container:

`npm run leaderboard:moderate -- list [name-or-id]`

Remove an entry by its 24-character ID:

`npm run leaderboard:moderate -- remove <id>`

Removal creates a timestamped backup beside the JSON file before changing it. In Docker, run the command with the leaderboard volume mounted, for example through `docker compose run --rm leaderboard ...`. Retain and periodically prune backups according to the deployment's retention policy.

## Persistence and deployment

The Node service writes atomically to `/data/leaderboard.json`, bounded to 5,000 entries. Docker Compose mounts a named persistent volume. Nginx exposes only `/api/leaderboard`; the leaderboard container has no host port.

Run locally with `npm run leaderboard`. The static Python preview does not proxy the API, so it displays a graceful unavailable message. The complete container stack runs at port 8080 with `docker compose up --build`.

## Operations

- Health: `GET /healthz` inside the leaderboard container
- Back up the `leaderboard-data` volume before replacing/removing the stack
- Do not expose port 3015 publicly without a trusted proxy; `X-Real-IP` is trusted for rate limiting
- Retain only the current model board in the default UI; old model entries stay version-filtered
- Scores are de-duplicated by result content, excluding display name