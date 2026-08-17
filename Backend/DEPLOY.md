# Deploying Sentinel to AWS Lambda

This app is fully AWS-ready: `main.py` already wraps the FastAPI app with
Mangum (`handler = Mangum(app)`), `template.yaml` defines the Lambda
function + public Function URL as infrastructure-as-code, and
`build_lambda_package.ps1` builds the deployable package. **Nothing here
requires code changes** — deployment is blocked only on having AWS
account/console access, not on missing integration work.

---

## Prerequisites
- An AWS account (console access) — see the main README for the
  UPI/card verification note if you're setting one up for the first time.
- Your CockroachDB connection details (`COCKROACH_HOST`, `COCKROACH_USER`,
  `COCKROACH_PASSWORD`, `COCKROACH_DB`, `COCKROACH_PORT`) — same values
  as your local `.env`.
- Your `GROQ_API_KEY`.

---

## Option A — Deploy with AWS SAM (recommended, one command)

1. Install the AWS SAM CLI: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html
2. Configure AWS credentials locally: `aws configure` (needs an IAM
   access key/secret from the AWS console — Console → IAM → Users →
   Security credentials → Create access key).
3. Build the deployment package:
   ```powershell
   .\build_lambda_package.ps1
   ```
4. Deploy:
   ```powershell
   sam deploy --guided
   ```
   When prompted, provide:
   - Stack name: `sentinel-api`
   - AWS Region: `ap-south-1` (Mumbai, closest to the CockroachDB cluster)
   - Parameter `CockroachHost`, `CockroachUser`, `CockroachPassword`,
     `CockroachDb`, `CockroachPort`, `GroqApiKey` — enter your real values
     when asked (SAM will store the secrets ones with `NoEcho`, not
     printed back to the terminal).
5. After deploy finishes, SAM prints the **Function URL** — this is your
   public demo endpoint for the hackathon submission form.

---

## Option B — Manual deploy via AWS Console (no SAM CLI needed)

1. Build the package:
   ```powershell
   .\build_lambda_package.ps1
   Compress-Archive -Path .\lambda_package\* -DestinationPath .\sentinel_lambda.zip
   ```
2. AWS Console → **Lambda** → **Create function**:
   - Author from scratch
   - Function name: `sentinel-api`
   - Runtime: **Python 3.12**
   - Architecture: x86_64
3. Under **Code**, click **Upload from → .zip file**, select
   `sentinel_lambda.zip`.
   - If the zip is over 50MB, upload it to an S3 bucket first, then choose
     **Upload from → Amazon S3 location** instead and paste the S3 object
     URL.
4. **Runtime settings → Edit** → set **Handler** to `main.handler`.
5. **Configuration → Environment variables → Edit** → add:
   ```
   COCKROACH_HOST=<your cluster host>
   COCKROACH_USER=sentinel
   COCKROACH_PASSWORD=<your password>
   COCKROACH_DB=defaultdb
   COCKROACH_PORT=26257
   GROQ_API_KEY=<your groq key>
   ALLOWED_ORIGINS=*
   ```
6. **Configuration → General configuration → Edit** → set:
   - Memory: **1024 MB**
   - Timeout: **60 sec**
   (agents run in parallel and call both Groq and CockroachDB, so the
   default 128MB/3s settings aren't enough)
7. **Configuration → Function URL → Create function URL**:
   - Auth type: **NONE** (for the demo; add real auth before any
     production use)
   - Configure CORS: allow all origins/methods/headers for the demo
8. Copy the **Function URL** shown — this is your public demo endpoint.

---

## Verify it's working

```powershell
curl https://<your-function-url>/
```
Should return:
```json
{"status": "Sentinel API is running", "docs": "/docs"}
```

Then test the full pipeline:
```powershell
curl -X POST https://<your-function-url>/orchestrator/run `
  -H "Content-Type: application/json" `
  -d '{ ...same sample shipment JSON used for local testing... }'
```

Check CockroachDB afterward the same way as local testing:
```sql
SELECT origin, suggestion, created_at FROM shipment_runs ORDER BY created_at DESC LIMIT 1;
```
If a new row appears, the deployed Lambda is writing to the same
CockroachDB cluster correctly.

---

## Cost note
Both the Lambda function and its Function URL stay within AWS's free tier
(1M requests + 400,000 GB-seconds/month free) for hackathon-scale traffic.
Nothing in `template.yaml` provisions anything beyond the single Lambda
function + its Function URL — no API Gateway, no NAT Gateway, no other
billable resources.
