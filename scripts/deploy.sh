
#!/usr/bin/env bash

set -Eeuo pipefail

# Arguments
AWS_PROFILE="${1:?Usage: deploy.sh <profile> <region>}"
AWS_REGION="${2:?Usage: deploy.sh <profile> <region>}"

# Project configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FUNCTION_NAME="$(node -p "JSON.parse(require('fs').readFileSync('$PROJECT_ROOT/package.json')).name")"

RUNTIME="nodejs24.x"

# Match resource naming from provision.sh
ACCOUNT_ID=$(aws sts get-caller-identity \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --query Account \
  --output text)

NAME_HASH=$(printf '%s' "$FUNCTION_NAME" | shasum -a 256 | cut -c1-8)

ROLE_NAME="lambda-web-${NAME_HASH}"
BUCKET_NAME="lambda-web-${ACCOUNT_ID}-${AWS_REGION}-${NAME_HASH}"
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

AWS=(aws --profile "$AWS_PROFILE" --region "$AWS_REGION")

TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

STAGING_DIR="$TEMP_DIR/deploy"
ZIP_PATH="$TEMP_DIR/deployment.zip"

echo "======================================"
echo " Deploying Lambda Web Function"
echo "======================================"
echo "Function: $FUNCTION_NAME"
echo "Profile:  $AWS_PROFILE"
echo "Region:   $AWS_REGION"
echo

# Verify function exists
if ! "${AWS[@]}" lambda-web get-web-function \
  --function-name "$FUNCTION_NAME" >/dev/null 2>&1; then
  echo "ERROR: Lambda Web Function does not exist."
  echo "Run npm run provision first."
  exit 1
fi

# Verify S3 bucket exists
if ! "${AWS[@]}" s3api head-bucket \
  --bucket "$BUCKET_NAME" >/dev/null 2>&1; then
  echo "ERROR: Deployment bucket does not exist."
  echo "Run npm run provision first."
  exit 1
fi

# 1. Build Next.js
echo "1. Building Next.js..."

cd "$PROJECT_ROOT"
npm run build

# Verify standalone output
STANDALONE_DIR="$PROJECT_ROOT/.next/standalone"

if [[ ! -f "$STANDALONE_DIR/server.js" ]]; then
  echo "ERROR: .next/standalone/server.js not found."
  echo "Ensure next.config.ts has output: 'standalone'."
  exit 1
fi

# 2. Prepare deployment directory
echo
echo "2. Preparing deployment package..."

mkdir -p "$STAGING_DIR"

# Copy standalone output
cp -a "$STANDALONE_DIR/." "$STAGING_DIR/"

# Copy Next.js static assets
mkdir -p "$STAGING_DIR/.next"
cp -a "$PROJECT_ROOT/.next/static" "$STAGING_DIR/.next/"

# Copy public assets if present
if [[ -d "$PROJECT_ROOT/public" ]]; then
  cp -a "$PROJECT_ROOT/public" "$STAGING_DIR/"
fi

# Avoid shipping local environment files
find "$STAGING_DIR" -maxdepth 1 -type f -name '.env*' -delete

# 3. Create Lambda entry point
echo
echo "3. Creating Lambda entry point..."

cat > "$STAGING_DIR/index.js" <<'JS'
const [host, port] = (
  process.env.AWS_LAMBDA_HTTP_ENDPOINT || "127.0.0.1:3000"
).split(":");

process.env.HOSTNAME = host;
process.env.PORT = port;

require("./server.js");
JS

# 4. Zip deployment
echo
echo "4. Creating ZIP archive..."

cd "$STAGING_DIR"
zip -qr "$ZIP_PATH" .

echo "Package size: $(du -h "$ZIP_PATH" | cut -f1)"

# 5. Upload to S3
echo
echo "5. Uploading deployment to S3..."

TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
S3_KEY="deployments/${FUNCTION_NAME}/${TIMESTAMP}.zip"

VERSION_ID=$("${AWS[@]}" s3api put-object \
  --bucket "$BUCKET_NAME" \
  --key "$S3_KEY" \
  --body "$ZIP_PATH" \
  --query VersionId \
  --output text)

if [[ -z "$VERSION_ID" || "$VERSION_ID" == "None" ]]; then
  echo "ERROR: Could not retrieve S3 object version."
  exit 1
fi

echo "S3 key:     $S3_KEY"
echo "Version ID: $VERSION_ID"

# 6. Create new Lambda revision
echo
echo "6. Creating Lambda revision..."

cat > "$TEMP_DIR/build-config.json" <<JSON
{
  "codeConfig": {
    "s3Object": {
      "bucket": "${BUCKET_NAME}",
      "key": "${S3_KEY}",
      "versionId": "${VERSION_ID}"
    }
  },
  "runtimeConfig": {
    "runtime": "${RUNTIME}"
  }
}
JSON

cat > "$TEMP_DIR/service-config.json" <<JSON
{
  "executionRoleArn": "${ROLE_ARN}",
  "timeoutSeconds": 30
}
JSON

REVISION_ID=$("${AWS[@]}" lambda-web create-web-function-revision \
  --function-name "$FUNCTION_NAME" \
  --build-config "file://$TEMP_DIR/build-config.json" \
  --service-config "file://$TEMP_DIR/service-config.json" \
  --query revisionId \
  --output text)

echo "Created revision: $REVISION_ID"

# 7. Wait for revision activation
echo
echo "7. Waiting for revision to become Active..."

if ! "${AWS[@]}" lambda-web wait web-function-revision-active \
  --function-name "$FUNCTION_NAME" \
  --revision-id "$REVISION_ID"; then

  echo "ERROR: Revision failed to become Active."

  "${AWS[@]}" lambda-web get-web-function-revision \
    --function-name "$FUNCTION_NAME" \
    --revision-id "$REVISION_ID"

  exit 1
fi

# 8. Retrieve endpoint
echo
echo "8. Retrieving endpoint..."

ENDPOINT=$("${AWS[@]}" lambda-web get-web-function-endpoint \
  --function-name "$FUNCTION_NAME" \
  --endpoint-name dev \
  --query domainName \
  --output text)

echo
echo "======================================"
echo " Deployment successful!"
echo "======================================"
echo
echo "Function: $FUNCTION_NAME"
echo "Revision: $REVISION_ID"
echo "Endpoint: https://$ENDPOINT"
echo
