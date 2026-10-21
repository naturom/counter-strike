#!/usr/bin/env bash
set -euo pipefail
PROJECT="${1:?Usage: deploy/deploy.sh PROJECT IMAGE_TAG}"
TAG="${2:?Provide a unique image tag}"
REGION=asia-southeast1
IMAGE="$REGION-docker.pkg.dev/$PROJECT/desert-fps/game:$TAG"
# Prerequisites are deliberately explicit: dedicated registry, runtime service
# account, and INVITE_SECRET in Secret Manager. See README. Never echo the secret.
gcloud builds submit --project="$PROJECT" --config=deploy/cloudbuild.yaml --substitutions="_IMAGE=$IMAGE" .
gcloud run deploy desert-fps --project="$PROJECT" --region="$REGION" \
  --image="$IMAGE" --service-account="desert-fps-runtime@$PROJECT.iam.gserviceaccount.com" \
  --set-secrets=INVITE_SECRET=desert-fps-invite-secret:1 \
  --cpu=2 --memory=2Gi --concurrency=100 --timeout=3600 \
  --min=0 --max=1 --min-instances=0 --max-instances=1 --cpu-throttling \
  --session-affinity --allow-unauthenticated --port=8080 \
  --startup-probe=httpGet.path=/health,httpGet.port=8080,initialDelaySeconds=0,periodSeconds=5,timeoutSeconds=3,failureThreshold=20 \
  --quiet
gcloud run services describe desert-fps --project="$PROJECT" --region="$REGION" --format=json
