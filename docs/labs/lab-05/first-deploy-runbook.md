# Lab 5: first deployment to Cloud Run (Issue #25)

Operator: Jinnakan. Reviewer: Drarun. Traceability: R-03, C-04. Nothing below is marked done until it
has been observed; the evidence section stays blank until then.

## 1. Before you start

| Need | Check |
|---|---|
| Google Cloud CLI | `gcloud --version`. Install on macOS: `brew install --cask google-cloud-sdk`, or use Cloud Shell and skip this row. |
| Signed in | `gcloud auth login` (opens a browser; you do this yourself) |
| Project | `gcloud config set project PROJECT_ID` (the project from Issue #21) |
| Billing | The project is linked to the Free Trial billing account and the budget alert exists (Issue #21). |
| Code | The commit you deploy is the tip of `lab5-staging` after this PR is merged: `git checkout lab5-staging && git pull`. The script deploys `HEAD` of the clone from a clean export, so uncommitted edits are never uploaded. |
| Docker | Not needed. Cloud Build makes the image. |

## 2. Run

```bash
DRY_RUN=1 PROJECT_ID=PROJECT_ID bash deploy/deploy.sh   # read every command; nothing changes
PROJECT_ID=PROJECT_ID bash deploy/deploy.sh             # real run, about 15 minutes
```

The Cloud SQL instance takes the longest (about 10 minutes). The script is safe to re-run; if it
stops, fix the cause and run it again. It prints the service URL, the revision and the commit at the
end. Check that `curl SERVICE_URL/api/version` returns the same commit.

Cost: Cloud SQL `db-f1-micro` bills per hour while it exists. Tear down after grading with
`deploy/teardown.sh` (see `deployment.md`, section 10).

## 3. Verify (AC-1 to AC-3)

Read the two seed passwords into your shell without printing them, run the acceptance script, and
save the output:

```bash
export ACCEPT_STUDENT_PASSWORD="$(gcloud secrets versions access latest --secret=cpms-seed-student-password --project PROJECT_ID)"
export ACCEPT_SUPERVISOR_PASSWORD="$(gcloud secrets versions access latest --secret=cpms-seed-supervisor-password --project PROJECT_ID)"
EXPECTED_COMMIT="$(git rev-parse HEAD)" python3 deploy/acceptance.py SERVICE_URL | tee docs/labs/lab-05/evidence/cloud-run-acceptance.txt
unset ACCEPT_STUDENT_PASSWORD ACCEPT_SUPERVISOR_PASSWORD
```

The output holds status codes and error codes only: no passwords, cookies or tokens. Then do the same
workflow once by hand in a browser for the screenshots (section 5).

## 4. If something fails

| Symptom | Likely cause and fix |
|---|---|
| `PERMISSION_DENIED` or "does not have storage.objects.get" during `builds submit` | New projects run Cloud Build as the Compute Engine default service account. Grant it `roles/cloudbuild.builds.builder`, wait one minute, re-run. |
| API not enabled / billing error | Billing is not linked to the project, or the Free Trial is not active. Fix in the console, re-run. |
| Migration job fails | Read the log command the script prints. The service is not deployed until the job succeeds. |
| Browser shows the page but sign-in fails with 403 | `ALLOWED_ORIGIN` differs from the real URL. The script corrects it at step 10; confirm with `gcloud run services describe cpms --region asia-southeast1 --format='value(status.url)'`. |
| Cold start is slow (a few seconds) | Normal: the service scales to zero. |

## 5. Evidence to record (fill in only from real observations)

| Item | Value |
|---|---|
| Deployment URL | _not yet observed_ |
| Revision | _not yet observed_ |
| Commit deployed (`/api/version`) | _not yet observed_ |
| Environment configuration (names only: `NODE_ENV`, `TZ`, `TRUST_PROXY`, `SESSION_TTL_HOURS`, `ALLOWED_ORIGIN`; secrets `DATABASE_URL`, `SESSION_SECRET` from Secret Manager) | _confirm with_ `gcloud run services describe cpms --region asia-southeast1` _and paste with values of secrets absent_ |
| Account setup method | Seeded by the migration job from Secret Manager passwords; no manual account creation |
| Acceptance output | `evidence/cloud-run-acceptance.txt` _(not yet created)_ |
| Screenshots (redacted) | sign-in, team page, submitted milestone with feedback, a rejected duplicate, a 404 for another team _(not yet taken)_ |

Scenario table (expected results are fixed by the acceptance script; add the observed result):

| Scenario | Expected | Observed |
|---|---|---|
| Health and readiness | 200 `ok`, 200 `ready` | |
| Supervisor creates milestone, member submits, reload shows it | 201, 201, status `SUBMITTED` | |
| Feedback recorded, member sees it | 201, status `REVIEWED` | |
| Second submission | 409 | |
| Too-short feedback; second feedback | 400; 409 | |
| No session | 401 | |
| Student creates a milestone | 403 | |
| Student reads another team | 404, same as nonexistent ID | |
| Supervisor 2 on Team A | 404 | |
| Error bodies | safe envelope, no stack or SQL | |

When the table is filled in, post the summary on Issue #25 without passwords or tokens.
