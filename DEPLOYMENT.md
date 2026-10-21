# Verified deployment — 20 October 2026

## Release

- **Play:** https://desert-fps-479916246177.asia-southeast1.run.app
- Alternative service URL: https://desert-fps-nrihwi5oja-as.a.run.app
- **Project:** `nood-429501` (project number `479916246177`)
- **Region / service:** `asia-southeast1` / `desert-fps`
- **Ready revision:** `desert-fps-00001-gjv`, serving 100% of traffic.
- **Cloud Build:** `ca6962d4-0bc4-4c20-9904-1d2f28151ef9`, status `SUCCESS`.
- [Build record and logs](https://console.cloud.google.com/cloud-build/builds/ca6962d4-0bc4-4c20-9904-1d2f28151ef9?project=479916246177)
- Image: `asia-southeast1-docker.pkg.dev/nood-429501/desert-fps/game:20261020-01`
- Deployed immutable digest: `sha256:1406b89b45e9790df9fa95698eea135792b90d45863e15d1110d56d5fb3b8cf5`

The game source is in this workspace. See [README](README.md) for local commands, architecture, controls, limitations, logs and deletion commands. The image was built and pushed by Google Cloud Build, and deployed by digest. The service and all game-specific supporting resources were newly created; no existing service was replaced.

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
- Unit/integration/restart suite: **14 passed, 0 failed**. Includes input validation, collision, weapon rules, hits/deaths, respawns, score, round end/rematch, eight-player limits, balance, real WebSocket reconnection and signed invitation reuse after a real server-process restart.
- Local eight-client integration run: **20 snapshots/second**, 30 control messages/second per client, three-second sampled load interval.
- Public API smoke test: **PASS**, 22 seconds total. Homepage, `/health`, signed creation/join, navigation through the arena, real hitscan kill, score, respawn, reconnection, eight clients and rejection of a ninth. Five-second eight-client sample measured **20 snapshots/second**.
- Public two-browser test: **PASS**, no page errors. WebGL rendering, joining the same room, pointer lock, keyboard input, firing with authoritative ammunition reduction, reload, weapon switch, scoreboard, leaving and responsive lobby layout.
- Production dependency audit: **0 known vulnerabilities** at verification time.
- Final `/health`: `{"ok":true,"service":"desert-fps","rooms":0,"version":"1.0.0"}`.
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
