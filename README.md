# Counter Strike — Dust II & Relay

An original desktop browser multiplayer FPS, implemented with Next.js, TypeScript, Three.js, Rapier and an authoritative Colyseus server. Choose between **Dust II** (default), a hand-authored reconstruction with Long, Mid, raised Short, CT passage, and upper/lower tunnels, and **Relay**, the original outpost. The Dust II proportions and elevations are approximate; its geometry and scenery are authored here, and no Valve game assets are included. Use **Scout the map** in the lobby to inspect eight viewpoints. PBR sandstone and sand textures are CC0 from Poly Haven; see [asset sources](ASSETS.md).

## Play

Choose a map and game mode, enter a guest callsign, create a room, and copy the invitation link to a friend. Invitations are carried in the URL fragment, so they are not sent in normal HTTP request URLs. Teams balance automatically, with four players per team and eight per room. A full room displays an explicit notice.

Click **Enter the arena** to capture your mouse. Escape releases it.

| Control | Action |
| --- | --- |
| W A S D / mouse | Move / look |
| Left click | Use selected item: slash, fire, or throw; hold for rifle/SMG |
| Space / Shift | Jump / sprint (cannot fire while sprinting) |
| R | Reload |
| 1 | Knife |
| 2 / 3 | Equipped primary gun / pistol |
| E | Pick up a nearby gun or dropped C4; hold near enemy C4 to defuse |
| 4, then left click | Select and throw a frag grenade |
| 5, then hold left click | Select your team’s C4; red plants at A, blue at B |
| C / Ctrl | Hold to crouch |
| Tab | Hold scoreboard |
| Escape | Menu, invite, leave |

Deathmatch rounds last ten minutes or end at 30 kills. Players have 100 HP, respawn in three seconds, and cannot damage teammates. Respawns receive 1.5 seconds of protection, cancelled by firing or throwing a grenade. Rifle: 25 damage, 600 RPM, 30 rounds, 1.8-second reload. Pistol: 20 damage, maximum 300 RPM, 12 rounds, 1.2-second reload. Ammunition reserves are unlimited; magazines and reload times are enforced. Half the connected players must vote to start a rematch.

**Bomb Defusal (Dust II):** Each team has one C4 and one enemy target: **red attacks A and defends B; blue attacks B and defends A**. One player on each team carries its charge. Select it with **5** and hold left click at your assigned site for **3.2 seconds**. Each planted bomb has its own **40-second fuse**. The first detonation wins; an exact simultaneous detonation is a draw. Hold **E** within reach and line of sight of enemy C4 for **10 seconds** to defuse it. Defusing stops that charge while the round and your own charge continue. Only teammates can recover their dropped C4. Movement, jumping, releasing the button, switching away while planting, dying or disconnecting cancels progress. HUD and radar distinguish your C4 from the enemy’s, with independent countdowns and progress.

Bomb rounds have **unlimited time** and one life once both teams are present. A planted charge starts its own **40-second fuse**. A team wins by eliminating the opponent once no enemy planted charge remains. Both charges defused or simultaneous elimination without planted charges results in a draw. Killing a carrier after planting never stops the fuse. Late joiners wait for the next round. Vote for a rematch to reset both teams, charges and equipment. Solo practice waits for an opponent before one-life elimination rules apply. There is no buy economy or defuse-kit inventory.

The knife deals 40 damage within 1.8 metres, with one slash per click and a half-second cooldown. Solid cover, friendly-fire rules and spawn protection apply. It uses no ammunition. Selecting a grenade does not throw it; left-click throws one, and an empty grenade slot shows zero remaining.

Weapon racks offer a 40-round SMG (17 damage, 900 RPM, 1.5-second reload) and an 8-round DMR (70 damage, 2.4-second reload). A pickup replaces your primary while retaining your pistol; each rack replenishes after 20 seconds. Respawning restores rifle, pistol and two grenades. Grenades bounce, explode after 2.2 seconds, and apply distance-based damage within eight metres, respecting solid cover. They can hurt their thrower but not teammates.

Crouching lowers your camera and hitbox and slows movement; standing is blocked under low cover. Incoming hits produce a directional red indicator, screen vignette, sound and brief camera jolt. Numeric health and a health bar show HP remaining; low health adds a pulse and heartbeat. Reduced-motion preferences suppress camera shake and weapon bob.

Directional audio combines synthesized gun reports with recorded knife swishes, dry player-impact Foley, metallic wall contacts and boots on stone, gravel, wood and metal, plus recorded airsoft magazine and action handling for reloads. Reload clips are edited to match each weapon’s reload time without changing the pitch or speed of the mechanical transients. Recordings are bundled as mono WAV files, fetched from the game server and decoded once; there is no synthetic fallback for footsteps, reloads or knife sounds. Sources, licenses and changes are listed in [audio credits](apps/web/public/audio/CREDITS.txt), also linked from the lobby. Nearby teammates and enemies can hear each other: footsteps fade out at 25 m walking, 32 m sprinting and 7 m crouching; crouching is substantially quieter. Footstep cadence follows travelled distance, with no steps while airborne or stationary. Cover muffles footsteps, gunfire, reloads and knife sounds; distance softens high frequencies and adds propagation delay. Reload sounds stop when the server cancels the reload (including switching weapons or dying). Four recorded footstep takes per surface reduce repetition, and overlapping combat voices are capped. Pickups, grenade throws, explosions and damage also have sound. Audio starts after clicking Enter/Explore and can be muted in the menu. Grenades have a sharp pressure crack, dust burst and roughly four seconds of smoke; C4 has a larger flash, debris, ten-second dust/smoke cloud and an 8.5-second rolling bass/reflection tail. Sound delay and high-frequency absorption follow distance, and cover muffles the blast. The C4 result screen waits 3.2 seconds so the blast remains visible. Effects are capped, cleaned up on rematch/exit, and flashes/shake respect reduced-motion preferences. Lighting, sky, shadows, textured surfaces, shutters, roof details, palms and background buildings improve the environment while keeping the rendering lightweight. These are stylized procedural models, not photorealistic scanned environments.

## Run locally

Requires Node.js **22.13+** and npm. From the repository root:

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`. The one Node process serves both Next.js HTTP and Colyseus WebSocket traffic on the same port. No database, Redis or login is needed. An ephemeral signing key is generated for local development. To keep local invitations valid across restarts, provide an environment variable `INVITE_SECRET` with at least 32 cryptographically random bytes; do not commit it.

```sh
npm run typecheck
npm test
npm run build
INVITE_SECRET='<your-local-secret>' npm start
```

The production server refuses to start without a signing key. `PORT` defaults to 3000 locally and 8080 in the container. Production secrets are injected from Google Secret Manager.

## Layout

- `apps/web`: Next.js lobby, HUD, scoreboard, connection lifecycle and imperative Three.js renderer.
- `apps/server`: Colyseus room lifecycle, HTTP entry point, authoritative simulation and invite validation.
- `packages/shared`: map definitions, protocol, weapon settings, deterministic movement and hitscan geometry.
- `deploy`: multistage Dockerfile, Cloud Build configuration and explicit Cloud Run deployment script.
- `tests`: unit, real WebSocket integration/load and process-restart tests.
- `scripts`: end-to-end verification through public APIs and headless Chrome browser checks.

## Authority and synchronization

The server runs at **30 Hz**, broadcasting authoritative snapshots at **20 Hz**. Clients send bounded control inputs with monotonic sequence numbers, never positions, health, damage, ammunition or timestamps. The server consumes at most one input per tick, bounds queue size and checks fire cooldowns, reloads, owned weapons, pickup distance/visibility, crouch clearance, grenade physics/blasts, collision, target occlusion, spawn protection, deaths and scores. A shared fixed-step kinematic box solver handles movement. Client prediction replays unacknowledged inputs against each authoritative snapshot, with camera correction smoothing. Remote avatars interpolate a 100 ms snapshot buffer.

Rapier runs on the client for physical impact debris, raycasts and collision against the same static arena geometry. It does not decide damage or authoritative player movement. Three.js renders original procedural models with CC0 surface textures. Static meshes are batched by material to reduce draw calls. Gameplay cover has shared server/client box geometry; foliage and decorative trim are visual. Players do not physically block each other. Hitboxes are uniform boxes, without headshots or lag compensation.

HTTP bodies and WebSocket payloads are bounded. Matchmaking is available only through the signed-invite endpoint, with per-IP HTTP and per-session input limits and same-origin browser checks. Rooms are capped at 12 per process. Guests inactive for two minutes are disconnected; closing the browser releases the seat after the reconnection window. No external keep-warm requests or transport ping traffic are scheduled. A live match naturally sends snapshots and inputs while its WebSockets remain connected.

## Invitations, reconnection and restarts

Invitations are HMAC-SHA256 tokens with a random 128-bit room identity and a seven-day expiry. The constant signing secret is stored in **Secret Manager**, so valid invitations survive scale-to-zero and instance restart. Tokens identify invitations and the selected map, not persisted scores. Existing invitations from the first release retain Relay.

Unexpected disconnects reserve a player's seat for 20 seconds. The client retries with backoff and its Colyseus reconnection token. If the old match is no longer reachable, the client rejoins using the invitation and displays a fresh-match notice when applicable. Browser refresh can recover a stored reconnection token from session storage. If a room has been disposed or the process restarted, its invitation creates a **new match with zero scores**. Expired or malformed invitations are rejected.

State is exclusively in memory. Session affinity is enabled as a best-effort aid. Cloud Run's maximum-instance setting does **not** prevent all instance/revision overlap, and affinity does not guarantee routing to the same instance. During overlap, identical invitation links can reach separate in-memory matches; a lost match cannot be recovered. This is an explicit limitation of the requested no-database/no-Redis architecture. WebSocket requests can end at the one-hour service timeout; reconnection handles that as a transport drop.

## Verification

```sh
npm run typecheck
npm test
npm run build
# Against a running production or dev server:
npm run test:live
MAP_ID=relay npm run test:live
npm run test:browser
# Against deployment:
BASE_URL='https://<service-url>' npm run test:live
BASE_URL='https://<service-url>' npm run test:browser
```

The browser script uses installed Google Chrome on macOS. Override `CHROME_PATH` for another compatible executable. It opens isolated, temporary browser profiles, verifies WebGL, two-player joining, pointer lock, keyboard input, ammo after firing, reload, weapon switch, pickups, crouching, grenade throws, damage feedback and health changes, active Web Audio, both map selections, scoreboard and leaving. Screenshots go to ignored `artifacts/`.

Unit tests cover eight-player limits, balanced teams, spawn clearance, collision, jumping/roof collision, input validation, flood/replay rejection, fire rates, ammunition/reloads, hits, friendly fire, deaths, respawns, scoring, timeouts, rematches and token security. Integration tests use actual WebSockets with eight clients at 30 input messages per second each, plus reconnection and room disposal/recreation. A separate test kills and relaunches a real server process to verify the same signed invitation creates a fresh match. The public API smoke test navigates two clients through the actual map, obtains a real kill, verifies score and respawn, reconnects, fills eight seats and rejects a ninth. It also checks weapon pickups, crouch state and grenade blast damage on either map. It has no privileged test endpoints.

These are short correctness/load runs, not a sustained capacity benchmark. Browser performance on low-end hardware, high-latency intercontinental play, a full ten-minute human match, an actual Cloud Run scale-to-zero cycle and one-hour timeout are not established by these tests. Round timeout is covered by simulated time. Desktop keyboard/mouse is required; the lobby is responsive but touch gameplay is not implemented.

## Deploy to Google Cloud

Project: **nood-429501**. Region: **asia-southeast1**. Service: **desert-fps**.

Dedicated resources:

- Artifact Registry Docker repository `desert-fps` in `asia-southeast1`.
- Runtime account `desert-fps-runtime@nood-429501.iam.gserviceaccount.com`.
- Secret `desert-fps-invite-secret`, version 1, with access granted only to that runtime account (plus inherited project administrators).

The default authenticated Cloud Build account builds the image. The Docker build runs typecheck, all unit/integration tests and the production build, then prunes development dependencies. The runtime runs as an unprivileged Linux user. Do not bake signing secrets into images.

```sh
bash deploy/deploy.sh nood-429501 <unique-image-tag>
```

Requested configuration, verified after deployment in `DEPLOYMENT.md`:

- Request-based billing, CPU throttling enabled outside requests.
- Minimum instances 0; maximum 1 at both service and revision levels.
- 2 vCPU, 2 GiB memory, concurrency 100, request timeout 3600 seconds.
- Public HTTPS/WSS endpoint, `/health` startup probe and best-effort session affinity.

**Not zero cost:** active WebSockets are billable requests. Cloud Run CPU/memory/request usage, Cloud Build, Artifact Registry storage, network egress and logging may incur charges. Idle open matches can continue billing until the connection ends. The game disconnects inactive guests after two minutes; no keep-warm service is provisioned.

View actual settings and logs:

```sh
gcloud run services describe desert-fps --project=nood-429501 --region=asia-southeast1 --format=yaml
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="desert-fps"' --project=nood-429501 --limit=50 --format=json
```

Delete the service to stop it accepting traffic:

```sh
gcloud run services delete desert-fps --project=nood-429501 --region=asia-southeast1
```

Optional cleanup of **only the game's dedicated resources** (deleting the secret permanently invalidates all invitations):

```sh
gcloud artifacts repositories delete desert-fps --project=nood-429501 --location=asia-southeast1
gcloud secrets delete desert-fps-invite-secret --project=nood-429501
gcloud iam service-accounts delete desert-fps-runtime@nood-429501.iam.gserviceaccount.com --project=nood-429501
```

Cloud Build source archives and retained logs can remain after deleting the service; inspect the project's build history before removing only this game's artifacts. No unrelated resources should be removed.

References: [Cloud Run WebSockets](https://docs.cloud.google.com/run/docs/triggering/websockets), [session affinity](https://docs.cloud.google.com/run/docs/configuring/session-affinity), [Colyseus reconnection](https://docs.colyseus.io/room/reconnection).
