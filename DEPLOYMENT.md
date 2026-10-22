# Verified deployment — 23 October 2026 (Singapore)

## Current release: map surface and escape-route repairs

- **Play:** https://desert-fps-479916246177.asia-southeast1.run.app
- Source commit: `1923c42` (includes the earlier lobby cleanup).
- **Ready revision:** `desert-fps-00006-mhn`, serving 100% of traffic.
- **Cloud Build:** `21a9d15c-30ff-4202-823e-1c335aa190e2`, status `SUCCESS` ([build record](https://console.cloud.google.com/cloud-build/builds/21a9d15c-30ff-4202-823e-1c335aa190e2?project=479916246177)).
- Image: `asia-southeast1-docker.pkg.dev/nood-429501/desert-fps/game:20261023-map-repairs-01`.
- Immutable digest: `sha256:447d6a9df1deca13120c96d0064f57d6b5c7fb19fc6e35e03b2ef4115605f6c4`.

This release fills terrain gaps, repairs return routes from Pit and other side pockets, removes covered/coplanar floor faces, and fixes movement jitter at ramp/landing edges. Cloud Build passed typecheck, all **52 tests**, and the production build. The tests include movement in both directions through ten former trap areas, sampled surface return paths, and rendered/collision floor agreement. Public browser verification confirmed the cleaned lobby, repaired A platform preview, room creation, radar, and room exit to a clean URL. The public health endpoint returned `{"ok":true,"service":"desert-fps","rooms":0,"version":"2.0.0"}` before the room check. Resource limits, scale settings, runtime identity and secret references match the prior release.

## Previous release: Dust II reconstruction

- **Play:** https://desert-fps-479916246177.asia-southeast1.run.app
- **Ready revision:** `desert-fps-00005-w5s`, serving 100% of traffic.
- **Cloud Build:** `79b29f1e-725d-443a-9236-58099629234a`, status `SUCCESS` ([build record](https://console.cloud.google.com/cloud-build/builds/79b29f1e-725d-443a-9236-58099629234a?project=479916246177)).
- Image: `asia-southeast1-docker.pkg.dev/nood-429501/desert-fps/game:20261022-dust2-01`.
- Immutable digest: `sha256:e3909ec03bc2c43670b5bc7a13ad32b7534cbbe044bc879b63da4ac5817b6244`.

This release adds the hand-authored Dust II routes and scenery, raised Short/CT passage, map preview, and teammate radar. Cloud Build reran typecheck, the 37-test suite, and the production build. The public `/health` endpoint returned `{"ok":true,"service":"desert-fps","rooms":0,"version":"2.0.0"}`. Browser verification confirmed the live map preview, room creation with Dust II, and that leaving a room clears the invitation URL and unlocks both map choices. The service continues to use its existing resource limits, runtime account and signing secret.

The sections below document the preceding release and operating settings.

## Release

- **Play:** https://desert-fps-479916246177.asia-southeast1.run.app
- Alternative service URL: https://desert-fps-nrihwi5oja-as.a.run.app
- **Project:** `nood-429501` (project number `479916246177`)
- **Region / service:** `asia-southeast1` / `desert-fps`
- **Ready revision:** `desert-fps-00004-hlz`, serving 100% of traffic.
- **Cloud Build:** `8c3858d9-b163-45d7-bd5d-5b857146016e`, status `SUCCESS`.
- [Build record and logs](https://console.cloud.google.com/cloud-build/builds/8c3858d9-b163-45d7-bd5d-5b857146016e?project=479916246177)
- Image: `asia-southeast1-docker.pkg.dev/nood-429501/desert-fps/game:20261022-02`
- Deployed immutable digest: `sha256:27b4bfd0e35e794cffd3b97b23b504ef5d9cba4be6a8b37915d52c5c2e809569`

The game source is in this workspace. See [README](README.md) for local commands, architecture, controls, limitations, logs and deletion commands. The image was built and pushed by Google Cloud Build, and deployed by digest. This release updates the existing game service and reuses its registry, runtime account and signing secret. No new database or running service was added.

## New in this release

- Leaving a room clears the invitation from the URL and lobby state, and removes the stored reconnection token.
- Both map buttons are immediately available again. Selecting another map creates a fresh room with a different invitation.
- Previous room notices, kill feed, votes and copy-link status are cleared when returning to the lobby.

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
- Cloud Build reran all 27 tests, including real WebSocket multiplayer and server restart coverage.
- Targeted public Chrome verification: **PASS**, no page errors. Created-room and invited-room exits clear the URL and reconnection storage, both map buttons unlock, changing from Dunes to Relay creates a different invitation and the correct map, and refreshing after leaving retains a clean lobby.
- Service settings compared before and after the image update: resource limits, concurrency, timeout, runtime identity, secret references, startup probe, CPU throttling, minimum/maximum instances and session affinity are unchanged.
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
