# Verified deployment — 22 October 2026 (Singapore)

## Release

- **Play:** https://desert-fps-479916246177.asia-southeast1.run.app
- Alternative service URL: https://desert-fps-nrihwi5oja-as.a.run.app
- **Project:** `nood-429501` (project number `479916246177`)
- **Region / service:** `asia-southeast1` / `desert-fps`
- **Ready revision:** `desert-fps-00002-zs8`, serving 100% of traffic.
- **Cloud Build:** `61df7f12-86ba-4ad3-a072-3fbd8fb5b9a1`, status `SUCCESS`.
- [Build record and logs](https://console.cloud.google.com/cloud-build/builds/61df7f12-86ba-4ad3-a072-3fbd8fb5b9a1?project=479916246177)
- Image: `asia-southeast1-docker.pkg.dev/nood-429501/desert-fps/game:20261021-03`
- Deployed immutable digest: `sha256:dd6580b48145cba23b095c3eb9534e256cc405e42879922d33b74bb8a9701551`

The game source is in this workspace. See [README](README.md) for local commands, architecture, controls, limitations, logs and deletion commands. The image was built and pushed by Google Cloud Build, and deployed by digest. This release updates the existing game service and reuses its registry, runtime account and signing secret. No new database or running service was added.

## New in this release

- Dunes is the default map, with Dust II inspired routes; Relay remains selectable. Map choice is signed into the invitation. Invitations from release 1 retain Relay.
- CC0 sandstone/sand surface textures, procedural sky, directional lighting, environmental details and batched scenery. See [asset sources](ASSETS.md).
- Reload, footstep, weapon, grenade, pickup and damage sounds with positional attenuation.
- Two weapon slots, SMG/DMR pickups, two bouncing frag grenades per life, crouch movement/hitboxes, damage direction and remaining-health feedback.

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
- Unit/integration/restart suite: **23 passed, 0 failed**. Includes input validation, collision, weapon rules, hits/deaths, respawns, score, round end/rematch, eight-player limits, balance, real WebSocket reconnection and signed invitation reuse after a real server-process restart.
- Local eight-client integration run: **20 snapshots/second**, 30 control messages/second per client, three-second sampled load interval.
- Public API smoke tests: **PASS on both Dunes and Relay**, 34 seconds per map. Homepage, `/health`, signed creation/join and map selection, weapon pickup, crouch, grenade blast damage, navigation, real hitscan kill, score, respawn, reconnection, eight clients and rejection of a ninth. Both five-second eight-client samples measured **20 snapshots/second**.
- Public two-browser test: **PASS**, no page errors. Textured WebGL rendering, both map selections, joining the same room, pointer lock, keyboard input, pickups, crouching, firing with authoritative ammunition reduction, reload, weapon switch, grenade throw and real damage/health feedback, active Web Audio effects, scoreboard, leaving and responsive lobby layout.
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
