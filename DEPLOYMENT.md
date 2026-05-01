# Content Moderator — Deployment Guide

## Project structure

```
content-moderator/
├── frontend/                   React app (→ AWS Amplify)
│   ├── src/
│   │   ├── App.js
│   │   ├── index.js
│   │   ├── components/
│   │   │   ├── LoginPage.js
│   │   │   ├── ModeratorApp.js
│   │   │   └── VerdictPanel.js
│   │   ├── services/
│   │   │   ├── cognitoService.js
│   │   │   └── apiService.js
│   │   └── styles/
│   │       ├── index.css
│   │       ├── LoginPage.css
│   │       ├── ModeratorApp.css
│   │       └── VerdictPanel.css
│   ├── package.json
│   └── .env.example
├── backend/                    FastAPI app (→ AWS ECS Fargate via ALB)
│   ├── main.py
│   ├── agent.py
│   ├── auth.py
│   ├── config.py
│   ├── dynamodb_client.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
└── database/
    └── dynamodb_setup.py       DynamoDB table creation + seed script
```

---

## Step 1 — AWS Prerequisites

Before deploying any code, set up the following AWS resources:

### 1a. AWS Cognito User Pool

1. Go to **AWS Console → Cognito → User Pools → Create user pool**
2. Configure:
   - Sign-in: **Email**
   - Password policy: as required
   - MFA: optional
   - App client: create one, **no client secret** (public SPA client)
   - Note down: `User Pool ID` and `App Client ID`
3. Add users manually via the Cognito console or AWS CLI:
   ```bash
   aws cognito-idp admin-create-user \
     --user-pool-id us-east-1_XXXXXXXXX \
     --username user@company.com \
     --temporary-password "Temp1234!" \
     --message-action SUPPRESS
   ```

### 1b. DynamoDB Tables + Seed Data

```bash
cd database
pip install boto3
cp .env.example .env   # not needed — script reads from AWS credentials

# Create tables and insert violation categories
python dynamodb_setup.py

# Options:
python dynamodb_setup.py --create-only   # tables only, no data
python dynamodb_setup.py --seed-only     # data only, tables must exist
```

The script creates these four tables:
- `general-community`
- `kids-platform`
- `marketplace`
- `news-comments`

### 1c. AWS Bedrock — Enable Claude Sonnet 4.6

1. Go to **AWS Console → Bedrock → Model access**
2. Request access to **Anthropic Claude 3 Sonnet** (`anthropic.claude-sonnet-4-6`)
3. Access is usually granted within minutes

### 1d. IAM Role for ECS Task

Create an ECS Task Execution Role with these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:Scan",
        "dynamodb:GetItem",
        "dynamodb:Query"
      ],
      "Resource": [
        "arn:aws:dynamodb:REGION:ACCOUNT:table/general-community",
        "arn:aws:dynamodb:REGION:ACCOUNT:table/kids-platform",
        "arn:aws:dynamodb:REGION:ACCOUNT:table/marketplace",
        "arn:aws:dynamodb:REGION:ACCOUNT:table/news-comments"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "arn:aws:bedrock:REGION::foundation-model/anthropic.claude-sonnet-4-6"
    }
  ]
}
```

---

## Step 2 — Deploy Backend to ECS Fargate

### 2a. Build and push Docker image to ECR

```windows powershell
# Set your values
$env:REGION="us-east-1"
$env:ACCOUNT_ID="487612116503"
$env:ECR_REPO="content-moderator-backend"

# When using Windows PowerShell, environment variables do not work with the commands below.
# Use the actual value instead, for example $env:REGION use "us-east-1" in the command.
# Replace environment variables with the actuall values

# Create ECR repository (first time only)
aws ecr create-repository --repository-name $env:ECR_REPO --region $env:REGION

# Authenticate Docker to ECR
aws ecr get-login-password --region $env:REGION | docker login --username AWS --password-stdin $env:ACCOUNT_ID.dkr.ecr.$env:REGION.amazonaws.com

# Build, tag, push
cd backend
docker build -t $env:ECR_REPO .

docker tag $env:ECR_REPO:latest $env:ACCOUNT_ID.dkr.ecr.$env:REGION.amazonaws.com/$env:ECR_REPO:latest

docker push $env:ACCOUNT_ID.dkr.ecr.$env:REGION.amazonaws.com/$env:ECR_REPO:latest
```

### 2b. Create ECS Cluster + Fargate Service

1. **AWS Console → ECS → Clusters → Create Cluster**
   - Cluster name: `content-moderator`
   - Infrastructure: **Fargate**

2. **Create Task Definition**
   - Launch type: Fargate
   - OS: Linux/X86_64
   - CPU: 1 vCPU, Memory: 2 GB (adjust based on load)
   - Task role: the IAM role from Step 1d
   - Container:
     - Image URI: `487612116503.dkr.ecr.us-east-1.amazonaws.com/content-moderator-backend:latest`
     - Port: `8000`
     - Environment variables (or use AWS Secrets Manager):
       ```
       AWS_REGION              = us-east-1
       COGNITO_USER_POOL_ID    = us-east-1_N9muKRSSh
       COGNITO_REGION          = us-east-1
       BEDROCK_MODEL_ID        = anthropic.claude-sonnet-4-6
       ALLOWED_ORIGINS         = https://staging.d1nb41zzskft31.amplifyapp.com
       ```

3. **Create Service**
   - Service name: `content-moderator-svc`
   - Desired tasks: 2 (for HA)
   - Load balancer: Application Load Balancer (create below)

### 2c. Application Load Balancer (ALB)

1. **EC2 → Load Balancers → Create Load Balancer → Application**
   - Scheme: Internet-facing
   - Listeners: HTTP:80 (add HTTPS:443 + ACM certificate for production)
   - Target group:
     - Target type: IP
     - Protocol: HTTP, Port: 8000
     - Health check path: `/health`
   - Register your ECS service tasks as targets

2. Note the **ALB DNS name** — you will need it for the frontend `.env`

---

## Step 3 — Deploy Frontend to AWS Amplify (Manual / CLI)

### Prerequisites

```bash
# Install Node.js 18+, then:
npm install -g @aws-amplify/cli
aws configure   # ensure your CLI has appropriate IAM permissions
```

### 3a. Install dependencies and build

```bash
cd frontend

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your real values:
#   REACT_APP_COGNITO_USER_POOL_ID
#   REACT_APP_COGNITO_CLIENT_ID
#   REACT_APP_COGNITO_REGION
#   REACT_APP_ALB_BASE_URL  ← your ALB DNS from Step 2c

npm install
npm run build
# Produces an optimised build in ./build/
```

### 3b. Deploy to Amplify Hosting (manual ZIP deploy)

**Option A — AWS Console (simplest)**

1. Go to **AWS Console → Amplify → New app → Deploy without Git**
2. App name: `big-brother`
3. Choose **Manual deploy**
4. Drag and drop (or upload) the `frontend/build/` folder as a ZIP:
   ```bash
   cd frontend
   cd build && zip -r ../build.zip . && cd ..
   ```
5. Click **Save and deploy**
6. Amplify provides a `.amplifyapp.com` URL within ~2 minutes

**Option B — Amplify CLI**

```bash
# One-time: initialise Amplify in the frontend directory
cd frontend
amplify init
# → Follow prompts: environment name "prod", use existing AWS profile

# Add Amplify Hosting
amplify add hosting
# → Select: Hosting with Amplify Console
# → Select: Manual deployment

# Build and publish in one command
npm run build
amplify publish
# Amplify zips ./build, uploads to S3, deploys to the CDN
# Outputs the live URL on completion
```

### 3c. Set environment variables in Amplify Console

After the first deploy, update environment variables via the console so
they are baked into future builds (Amplify re-injects them at build time):

1. Amplify Console → your app → **Environment variables**
2. Add:
   - `REACT_APP_COGNITO_USER_POOL_ID`
   - `REACT_APP_COGNITO_CLIENT_ID`
   - `REACT_APP_COGNITO_REGION`
   - `REACT_APP_ALB_BASE_URL`
3. **Redeploy** the app for the new variables to take effect

### 3d. Update Cognito App Client Callback URLs

Add your Amplify URL to the Cognito App Client's allowed callback and
sign-out URLs if you later add OAuth/hosted UI flows.

### 3e. Update CORS on the Backend

Set the `ALLOWED_ORIGINS` environment variable on your ECS task to include
the Amplify app URL:

```
ALLOWED_ORIGINS=https://main.xxxxxxxxxx.amplifyapp.com
```

Redeploy the ECS service to pick up the change (force a new deployment):

```bash
aws ecs update-service \
  --cluster content-moderator \
  --service content-moderator-svc \
  --force-new-deployment
```

---

## Step 4 — Verify end-to-end

1. Open the Amplify URL in your browser
2. Log in with a user that exists in your Cognito User Pool
3. Select a content type, paste some test content, click **Analyze**
4. The request flows: Amplify → ALB → ECS → Bedrock + DynamoDB → response

### Test the backend directly

```bash
# Health check
curl http://<ALB-DNS>/health

# Moderation endpoint (get a token from Cognito first)
TOKEN=$(aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters USERNAME=user@company.com,PASSWORD=YourPassword1! \
  --client-id <client-id> \
  --query AuthenticationResult.IdToken \
  --output text)

curl -X POST http://<ALB-DNS>/api/v1/moderate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Buy cheap meds now!!!", "content_type": "marketplace"}'
```

---

## Security checklist before going to production

- [ ] Add HTTPS listener to the ALB with an ACM certificate
- [ ] Restrict ALB security group to HTTPS only (port 443)
- [ ] Store secrets (Cognito IDs, etc.) in AWS Secrets Manager, not plain env vars
- [ ] Enable ALB access logs to S3
- [ ] Enable ECS task CloudWatch logging
- [ ] Set up Cognito MFA for moderator accounts
- [ ] Configure Amplify custom domain with Route 53
- [ ] Enable DynamoDB point-in-time recovery
- [ ] Review IAM roles — apply least-privilege principle
