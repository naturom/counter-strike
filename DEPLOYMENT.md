# Verified deployment — 22 October 2026 (Singapore)

## Release

- **Play:** https://desert-fps-479916246177.asia-southeast1.run.app
- Alternative service URL: https://desert-fps-nrihwi5oja-as.a.run.app
- **Project:** `nood-429501` (project number `479916246177`)
- **Region / service:** `asia-southeast1` / `desert-fps`
- **Ready revision:** `desert-fps-00003-nvv`, serving 100% of traffic.
- **Cloud Build:** `dca73ca3-7020-4158-81d0-1fdd9d03e323`, status `SUCCESS`.
- [Build record and logs](https://console.cloud.google.com/cloud-build/builds/dca73ca3-7020-4158-81d0-1fdd9d03e323?project=479916246177)
- Image: `asia-southeast1-docker.pkg.dev/nood-429501/desert-fps/game:20261022-01`
- Deployed immutable digest: `sha256:2e5f175a38ccefb39cfaa2aa70f0aee186e30b272b3b692a69cc21b55982bcb6`

The game source is in this workspace. See [README](README.md) for local commands, architecture, controls, limitations, logs and deletion commands. The image was built and pushed by Google Cloud Build, and deployed by digest. This release updates the existing game service and reuses its registry, runtime account and signing secret. No new database or running service was added.

## New in this release

- Renamed the lobby, in-game header and browser title to **Counter Strike**.
- Equipment slots: **1 knife**, **2 primary gun**, **3 pistol**, **4 grenade**. Left click uses the selected item. G no longer throws grenades.
- Knife attacks have a 1.8-metre range, 40 damage and a half-second cooldown, with a viewmodel, swing animation and sound. They respect cover, friendly-fire rules and spawn protection.
- Selecting a grenade does not throw it. Each fresh mouse click throws one; holding the button cannot throw both. The HUD shows the selected slot and remaining supply.
- Dunes/Relay, weapon pickups, crouching, textures, sounds and health feedback from the previous release remain available.

## Actual settings inspected after deployment

| Setting | Observed configuration |
| --- | --- |
| Billing | Request-based; `run.googleapis.com/cpu-throttling: true` |
| Minimum instances | 0 at service and revision levels (zero defaults; API omits zero-valued minimum fields) |
| Maximum instances | 1 at service level (`run.googleapis.com/maxScale`) and revision level (`autoscaling.knative.dev/maxScale`) |
| CPU / memory limits | 2 vCPU / 2 GiB |
| Concurrency | 100 |
| Request timeout | 3600 seconds |
| Startup CPU boost | Enabled by Cloud Run's default; can incur additional startup CPU charges |
| Public access | `allUsers` has `roles/run.invoker`; ingress is `all` |
| Transport | One HTTP/1 port, 8080, serving HTTPS and WSS through Cloud Run |
| Session affinity | Enabled; best effort only |
| Startup health probe | HTTP `/health`, port 8080, period 5 s, timeout 3 s, failure threshold 20 |
| Runtime identity | `desert-fps-runtime@nood-429501.iam.gserviceaccount.com` |
| Signing secret | `INVITE_SECRET` references `desert-fps-invite-secret`, version 1, in Secret Manager |

No database, Redis, VM service, GPU, external keep-warm requests or always-on worker was provisioned. Active WebSocket connections are billable requests. Cloud Run, Cloud Build, Artifact Registry, network and logging charges remain possible; this is **not a zero-cost deployment**. Dedicated secret storage/access and retained build source archives can also incur charges.

## Verified results

- Typecheck: passed.
- Production Next.js and combined Node server build: passed locally and in Cloud Build's Linux container.
- Unit/integration/restart suite: **27 passed, 0 failed**. Includes input validation, collision, weapon rules, hits/deaths, respawns, score, round end/rematch, eight-player limits, balance, real WebSocket reconnection and signed invitation reuse after a real server-process restart.
- Local eight-client integration run: **20 snapshots/second**, 30 control messages/second per client, three-second sampled load interval.
- Public API smoke test: **PASS on Dunes**, 34 seconds. Homepage, `/health`, signed creation/join and map selection, weapon pickup, crouch, grenade blast damage, navigation, real hitscan kill, score, respawn, reconnection, eight clients and rejection of a ninth. The five-second eight-client sample measured **20 snapshots/second**.
- Public two-browser test: **PASS**, no page errors. Textured WebGL rendering, both map selections, joining the same room, pointer lock, keyboard input, pickups, crouching, firing with authoritative ammunition reduction, reload, all four equipment slots, knife selection/slash, grenade selection followed by mouse throwing (including held-click protection), and real damage/health feedback, active Web Audio effects, scoreboard, leaving and responsive lobby layout.
- Final `/health`: `{"ok":true,"service":"desert-fps","rooms":0,"version":"2.0.0"}`.
- Query for service runtime logs with severity ERROR or higher returned no entries for the verification period.

Local evidence files are in the ignored `artifacts/` directory: lobby/game/scoreboard/mobile screenshots and exported Cloud Run service, revision and IAM settings. The tests are rerunnable using the commands in README.

## Limits of verification and operation

These results do not establish a sustained capacity benchmark, high-latency fairness, a full ten-minute human match, an actual Cloud Run scale-to-zero cycle, or a one-hour WebSocket timeout. The ten-minute boundary is covered using simulated server time. The real process-restart test establishes that the same signing key can recreate a new zero-score match; no old score is persisted.

State is in memory. Maximum instances 1 and session affinity cannot guarantee zero overlap or deterministic routing during revisions/restarts; invitation links may temporarily reach different new matches. Players have box hitboxes and cannot physically block each other. There is no lag compensation or headshot multiplier. Gameplay requires a desktop keyboard and mouse; mobile touch play is not implemented.

## Logs and teardown

```sh
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="desert-fps"' --project=nood-429501 --limit=50 --format=json
gcloud run services delete desert-fps --project=nood-429501 --region=asia-southeast1
```

Deleting the service does not delete images, secrets, retained logs or build archives. README contains optional cleanup commands for only this game's dedicated resources.
