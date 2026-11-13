#!/usr/bin/env bash
# ##############################################################################
# CPMS: one-time setup and first deploy to Google Cloud Run
# ##############################################################################
# WHAT THIS DOES (every step is safe to re-run; existing resources and secrets are kept)
#   1 enable APIs   2 Artifact Registry repo   3 Cloud SQL (PostgreSQL 16) + database
#   4 runtime service account   5 secrets in Secret Manager (database URL, session secret,
#   seed passwords)   6 per-secret access for the runtime account   7 build the image
#   8 migration job (migrate + seed), run it   9 Cloud Run service   10 print the URL
#
# HOW TO RUN (a team member, in Cloud Shell or a terminal logged in with gcloud)
#   DRY_RUN=1 PROJECT_ID=your-project-id bash deploy/deploy.sh   # prints commands, changes nothing
#   PROJECT_ID=your-project-id bash deploy/deploy.sh             # real run
#
# SAFETY
#   * Secrets are generated here and stored only in Secret Manager. They are never printed;
#     the database password is redacted from the command log.
#   * The runtime account gets access to each secret one by one, never project-wide.
#   * --allow-unauthenticated makes the service URL public. That is what Lab 5 requires (R-03).
#   * The service scales to zero (min 0, max 3). Cloud SQL still bills per hour: see
#     docs/labs/lab-05/deployment.md for cost control and teardown (deploy/teardown.sh).
# ##############################################################################
set -euo pipefail

DRY_RUN="${DRY_RUN:-0}"
REGION="${REGION:-asia-southeast1}"

if [ "$#" -gt 0 ]; then
  echo "Unknown argument: $1" >&2
  echo "Usage: [DRY_RUN=1] [PROJECT_ID=...] [REGION=...] $0" >&2
  exit 1
fi

# Print every command; redact generated database passwords; skip execution on a dry run.
run_cmd() {
  local arg
  if [ "$DRY_RUN" = "1" ]; then printf '[DRY_RUN] '; else printf '+ '; fi
  for arg in "$@"; do
    case "$arg" in
      --password=*) printf '%s ' '--password=<REDACTED>' ;;
      *) printf '%q ' "$arg" ;;
    esac
  done
  printf '\n'
  if [ "$DRY_RUN" != "1" ]; then "$@"; fi
}

if [ "$DRY_RUN" = "1" ]; then
  PROJECT_ID="${PROJECT_ID:-example-gcp-project}"
else
  PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
  if [ -z "$PROJECT_ID" ]; then
    echo "Error: PROJECT_ID is not set and no active gcloud project was found." >&2
    echo "Run: gcloud config set project YOUR_PROJECT_ID" >&2
    exit 1
  fi
fi

# Names (also used by deploy/release.sh, .github/workflows/deploy.yml and deployment.md).
REPO_NAME="cpms"
SQL_INSTANCE="cpms-pg"
DB_NAME="cpms"
DB_USER="cpms"
SERVICE_NAME="cpms"
MIGRATE_JOB_NAME="cpms-migrate"
SA_NAME="cpms-runner"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
SQL_CONN_NAME="${PROJECT_ID}:${REGION}:${SQL_INSTANCE}"
IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}:latest"
SECRET_DB_URL="cpms-database-url"
SECRET_SESSION="cpms-session-secret"
SECRET_STUDENT_PASS="cpms-seed-student-password"
SECRET_SUPERVISOR_PASS="cpms-seed-supervisor-password"

echo "=================================================================="
echo "CPMS Cloud Run deployment"
echo "Project : ${PROJECT_ID}"
echo "Region  : ${REGION}"
echo "Dry run : ${DRY_RUN}"
echo "=================================================================="

# Create a secret only if it does not exist, so a re-run never replaces a working value.
# usage: create_secret_if_missing NAME VALUE   (VALUE is piped in and never echoed)
create_secret_if_missing() {
  local name="$1" value="$2"
  if [ "$DRY_RUN" = "1" ]; then
    run_cmd gcloud secrets describe "$name" --project "$PROJECT_ID"
    run_cmd gcloud secrets create "$name" --replication-policy="automatic" --project "$PROJECT_ID"
    run_cmd gcloud secrets versions add "$name" --data-file=- --project "$PROJECT_ID"
  elif ! gcloud secrets describe "$name" --project "$PROJECT_ID" >/dev/null 2>&1; then
    run_cmd gcloud secrets create "$name" --replication-policy="automatic" --project "$PROJECT_ID"
    printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- --project "$PROJECT_ID"
  fi
}

# 1. Enable the APIs this project needs.
run_cmd gcloud services enable \
  run.googleapis.com sqladmin.googleapis.com artifactregistry.googleapis.com \
  cloudbuild.googleapis.com secretmanager.googleapis.com iam.googleapis.com \
  --project "$PROJECT_ID"

# 2. Artifact Registry repository for the container image.
if [ "$DRY_RUN" = "1" ]; then
  run_cmd gcloud artifacts repositories describe "$REPO_NAME" --location "$REGION" --project "$PROJECT_ID"
  run_cmd gcloud artifacts repositories create "$REPO_NAME" --repository-format=docker --location "$REGION" --description="CPMS container repository" --project "$PROJECT_ID"
elif ! gcloud artifacts repositories describe "$REPO_NAME" --location "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1; then
  run_cmd gcloud artifacts repositories create "$REPO_NAME" \
    --repository-format=docker --location "$REGION" \
    --description="CPMS container repository" --project "$PROJECT_ID"
fi

# 3. Cloud SQL for PostgreSQL: smallest tier, no storage auto-increase (cost control), then the database.
if [ "$DRY_RUN" = "1" ]; then
  run_cmd gcloud sql instances describe "$SQL_INSTANCE" --project "$PROJECT_ID"
  run_cmd gcloud sql instances create "$SQL_INSTANCE" --database-version=POSTGRES_16 --edition=enterprise --tier=db-f1-micro --region="$REGION" --storage-size=10GB --storage-type=SSD --no-storage-auto-increase --backup-start-time=03:00 --project "$PROJECT_ID"
elif ! gcloud sql instances describe "$SQL_INSTANCE" --project "$PROJECT_ID" >/dev/null 2>&1; then
  run_cmd gcloud sql instances create "$SQL_INSTANCE" \
    --database-version=POSTGRES_16 --edition=enterprise --tier=db-f1-micro \
    --region="$REGION" --storage-size=10GB --storage-type=SSD --no-storage-auto-increase \
    --backup-start-time=03:00 --project "$PROJECT_ID"
fi
if [ "$DRY_RUN" = "1" ]; then
  run_cmd gcloud sql databases describe "$DB_NAME" --instance="$SQL_INSTANCE" --project "$PROJECT_ID"
  run_cmd gcloud sql databases create "$DB_NAME" --instance="$SQL_INSTANCE" --project "$PROJECT_ID"
elif ! gcloud sql databases describe "$DB_NAME" --instance="$SQL_INSTANCE" --project "$PROJECT_ID" >/dev/null 2>&1; then
  run_cmd gcloud sql databases create "$DB_NAME" --instance="$SQL_INSTANCE" --project "$PROJECT_ID"
fi

# 4. Runtime service account: it may connect to Cloud SQL and nothing else at project level.
if [ "$DRY_RUN" = "1" ]; then
  run_cmd gcloud iam service-accounts describe "$SA_EMAIL" --project "$PROJECT_ID"
  run_cmd gcloud iam service-accounts create "$SA_NAME" --display-name="CPMS Cloud Run runtime" --project "$PROJECT_ID"
elif ! gcloud iam service-accounts describe "$SA_EMAIL" --project "$PROJECT_ID" >/dev/null 2>&1; then
  run_cmd gcloud iam service-accounts create "$SA_NAME" --display-name="CPMS Cloud Run runtime" --project "$PROJECT_ID"
fi
run_cmd gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" --role="roles/cloudsql.client" --condition=None --quiet

# 5a. Database user and DATABASE_URL secret (the password lives only inside the secret).
if [ "$DRY_RUN" = "1" ]; then
  run_cmd gcloud secrets describe "$SECRET_DB_URL" --project "$PROJECT_ID"
  run_cmd gcloud sql users list --instance="$SQL_INSTANCE" --project "$PROJECT_ID" --format="value(name)"
  run_cmd gcloud sql users create "$DB_USER" --instance="$SQL_INSTANCE" --password="<GENERATED_HEX_PASSWORD>" --project "$PROJECT_ID"
  run_cmd gcloud secrets create "$SECRET_DB_URL" --replication-policy="automatic" --project "$PROJECT_ID"
  run_cmd gcloud secrets versions add "$SECRET_DB_URL" --data-file=- --project "$PROJECT_ID"
elif ! gcloud secrets describe "$SECRET_DB_URL" --project "$PROJECT_ID" >/dev/null 2>&1; then
  DB_PASS="$(openssl rand -hex 24)"
  if gcloud sql users list --instance="$SQL_INSTANCE" --project "$PROJECT_ID" --format="value(name)" | grep -qx "$DB_USER"; then
    run_cmd gcloud sql users set-password "$DB_USER" --instance="$SQL_INSTANCE" --password="$DB_PASS" --project "$PROJECT_ID"
  else
    run_cmd gcloud sql users create "$DB_USER" --instance="$SQL_INSTANCE" --password="$DB_PASS" --project "$PROJECT_ID"
  fi
  DB_URL_VALUE="postgresql://${DB_USER}:${DB_PASS}@localhost/${DB_NAME}?host=/cloudsql/${SQL_CONN_NAME}&schema=public&connection_limit=3"
  run_cmd gcloud secrets create "$SECRET_DB_URL" --replication-policy="automatic" --project "$PROJECT_ID"
  printf '%s' "$DB_URL_VALUE" | gcloud secrets versions add "$SECRET_DB_URL" --data-file=- --project "$PROJECT_ID"
fi

# 5b. Session secret and the seed passwords for the demo accounts (generated, never printed).
if [ "$DRY_RUN" = "1" ]; then
  create_secret_if_missing "$SECRET_SESSION" ""
  create_secret_if_missing "$SECRET_STUDENT_PASS" ""
  create_secret_if_missing "$SECRET_SUPERVISOR_PASS" ""
else
  create_secret_if_missing "$SECRET_SESSION" "$(openssl rand -hex 32)"
  create_secret_if_missing "$SECRET_STUDENT_PASS" "$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)Aa1"
  create_secret_if_missing "$SECRET_SUPERVISOR_PASS" "$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)Ss1"
fi

# 6. Give the runtime account access to each secret, one by one.
for secret in "$SECRET_DB_URL" "$SECRET_SESSION" "$SECRET_STUDENT_PASS" "$SECRET_SUPERVISOR_PASS"; do
  run_cmd gcloud secrets add-iam-policy-binding "$secret" \
    --member="serviceAccount:${SA_EMAIL}" --role="roles/secretmanager.secretAccessor" \
    --project "$PROJECT_ID" --quiet
done

# The public URL is predictable: https://SERVICE-PROJECT_NUMBER.REGION.run.app. The app needs it
# as ALLOWED_ORIGIN (same-origin check for state-changing requests) from its first start.
if [ "$DRY_RUN" = "1" ]; then
  PROJECT_NUMBER="000000000000"
else
  PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
fi
ALLOWED_ORIGIN="https://${SERVICE_NAME}-${PROJECT_NUMBER}.${REGION}.run.app"

# 7. Build the image with Cloud Build and push it to Artifact Registry.
run_cmd gcloud builds submit --tag "$IMAGE_URI" --project "$PROJECT_ID"

# 8. Migration job: apply migrations, then the idempotent seed. If it fails, stop before the service.
run_cmd gcloud run jobs deploy "$MIGRATE_JOB_NAME" \
  --image "$IMAGE_URI" --region "$REGION" \
  --service-account "$SA_EMAIL" --set-cloudsql-instances "$SQL_CONN_NAME" \
  --set-secrets "DATABASE_URL=${SECRET_DB_URL}:latest,SEED_STUDENT_PASSWORD=${SECRET_STUDENT_PASS}:latest,SEED_SUPERVISOR_PASSWORD=${SECRET_SUPERVISOR_PASS}:latest" \
  --set-env-vars "NODE_ENV=production,TZ=Asia/Bangkok" \
  --command "sh" --args "-c,npx prisma migrate deploy && npx tsx src/seed/run.ts" \
  --max-retries 1 --task-timeout 300s --project "$PROJECT_ID"
if ! run_cmd gcloud run jobs execute "$MIGRATE_JOB_NAME" --region "$REGION" --wait --project "$PROJECT_ID"; then
  printf '%s\n' "ERROR: Cloud Run migration job '${MIGRATE_JOB_NAME}' failed. Aborting service deployment." >&2
  printf '%s\n' "View job logs with:" >&2
  printf '%s\n' "  gcloud logging read \"resource.type=cloud_run_job AND resource.labels.job_name=${MIGRATE_JOB_NAME}\" --project \"${PROJECT_ID}\" --limit 50 --format=\"value(textPayload)\"" >&2
  exit 1
fi

# 9. The Cloud Run service. Scales to zero. TRUST_PROXY=1 because one Google proxy sits in front.
run_cmd gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE_URI" --region "$REGION" --platform managed --allow-unauthenticated \
  --service-account "$SA_EMAIL" --add-cloudsql-instances "$SQL_CONN_NAME" \
  --set-secrets "DATABASE_URL=${SECRET_DB_URL}:latest,SESSION_SECRET=${SECRET_SESSION}:latest" \
  --set-env-vars "NODE_ENV=production,TZ=Asia/Bangkok,TRUST_PROXY=1,SESSION_TTL_HOURS=8,ALLOWED_ORIGIN=${ALLOWED_ORIGIN}" \
  --min-instances 0 --max-instances 3 --memory 512Mi --cpu 1 --port 3000 \
  --project "$PROJECT_ID"

# 10. Confirm the real URL matches the one the app was told to allow; fix it if it does not.
if [ "$DRY_RUN" = "1" ]; then
  SERVICE_URL="$ALLOWED_ORIGIN"
else
  SERVICE_URL="$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)')"
  if [ "$SERVICE_URL" != "$ALLOWED_ORIGIN" ]; then
    run_cmd gcloud run services update "$SERVICE_NAME" --region "$REGION" --project "$PROJECT_ID" --update-env-vars "ALLOWED_ORIGIN=${SERVICE_URL}"
  fi
fi

printf '\n%s\n' "=================================================================="
printf '%s\n' "Deployment completed."
printf '%s\n' "Service URL    : ${SERVICE_URL}"
printf '%s\n' "Health check   : ${SERVICE_URL}/api/health"
printf '%s\n' "Readiness check: ${SERVICE_URL}/api/ready"
printf '%s\n' "Seed accounts  : supervisor1@example.test, student.a1@example.test (and others, see deployment.md)"
printf '%s\n' "Passwords      : Secret Manager, ${SECRET_STUDENT_PASS} and ${SECRET_SUPERVISOR_PASS} (not printed)."
printf '%s\n' "=================================================================="
