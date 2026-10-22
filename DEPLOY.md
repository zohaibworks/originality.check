# Deploying the Backend to Google Cloud Run

Frontend is live at: https://originality-check-pi.vercel.app  
Firebase project: `originalitycheck-a69c4`

---

## Prerequisites

1. Install [Google Cloud CLI](https://cloud.google.com/sdk/docs/install)
2. Run `gcloud auth login` and `gcloud auth configure-docker`
3. Make sure you have the project selected:
   ```
   gcloud config set project originalitycheck-a69c4
   ```

---

## Step 1 — Enable required APIs (one time)

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  containerregistry.googleapis.com
```

---

## Step 2 — Store your AIORNOT_API_KEY in Secret Manager

Never pass secrets as plain `--set-env-vars`. Use Secret Manager:

```bash
echo -n "aion_prod_4ed9ad38e86841cf88606a413c1843077a10fde4c5ef458ab5350f5fb8679362" | \
  gcloud secrets create AIORNOT_API_KEY --data-file=-
```

If the secret already exists, add a new version:
```bash
echo -n "YOUR_KEY" | gcloud secrets versions add AIORNOT_API_KEY --data-file=-
```

---

## Step 3 — Deploy to Cloud Run

This single command builds your Docker image and deploys it:

```bash
gcloud run deploy originality-check-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --port 3000 \
  --set-env-vars NODE_ENV=production \
  --set-secrets AIORNOT_API_KEY=AIORNOT_API_KEY:latest
```

`--source .` uses Cloud Build to build the Dockerfile automatically — no local Docker needed.

When it finishes, it prints your service URL:
```
Service URL: https://originality-check-api-XXXXXXXX-uc.a.run.app
```

---

## Step 4 — Add the backend URL to Vercel

1. Go to your Vercel project → **Settings → Environment Variables**
2. Add:
   - **Name:** `VITE_API_URL`
   - **Value:** `https://originality-check-api-XXXXXXXX-uc.a.run.app`
   - **Environments:** Production, Preview, Development
3. Redeploy the Vercel frontend (Deployments → Redeploy)

---

## Step 5 — Verify it works

```bash
# Health check
curl https://originality-check-api-XXXXXXXX-uc.a.run.app/api/health

# Expected: {"status":"ok","timestamp":"..."}
```

---

## Firebase Admin Auth — no credentials file needed

Since Cloud Run runs inside GCP and your Firebase project is `originalitycheck-a69c4`,
Firebase Admin automatically uses the **Compute Engine default service account** for
token verification. No `GOOGLE_APPLICATION_CREDENTIALS` file is needed.

To confirm the service account has the right permissions:
```bash
# Grant Firebase Admin SDK access to the default Cloud Run service account
gcloud projects add-iam-policy-binding originalitycheck-a69c4 \
  --member="serviceAccount:$(gcloud iam service-accounts list \
    --filter='displayName:Compute Engine default' \
    --format='value(email)')" \
  --role="roles/firebase.admin"
```

---

## Redeploying after changes

```bash
gcloud run deploy originality-check-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --port 3000 \
  --set-env-vars NODE_ENV=production \
  --set-secrets AIORNOT_API_KEY=AIORNOT_API_KEY:latest
```

---

## Cost

Cloud Run free tier (per month):
- 2,000,000 requests
- 360,000 GB-seconds compute  
- 180,000 vCPU-seconds

At typical usage this stays **$0/month**. Cold starts (~1–2s) happen after 15 min
of inactivity since `--min-instances=0`. Set `--min-instances=1` to eliminate
cold starts (costs ~$2–3/month).
