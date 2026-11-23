#!/usr/bin/env bash

set -Eeuo pipefail

# Arguments
AWS_PROFILE="${1:?Usage: provision.sh <profile> <region>}"
AWS_REGION="${2:?Usage: provision.sh <profile> <region>}"

# Project configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FUNCTION_NAME="$(node -p "require('$PROJECT_ROOT/package.json').name")"

RUNTIME="nodejs24.x"
ENDPOINT_NAME="dev"

# How long to wait for the endpoint to become Active, and how often to poll
WAIT_TIMEOUT_SECONDS=600
POLL_INTERVAL_SECONDS=5

# Validate function name
if [[ ! "$FUNCTION_NAME" =~ ^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$ ]]; then
  echo "Invalid Lambda function name: $FUNCTION_NAME"
  echo "Expected 1-64 letters, numbers, hyphens, or underscores."
  exit 1
fi

export AWS_PROFILE AWS_REGION
export AWS_PAGER=""

aws_cmd() {
  aws --profile "$AWS_PROFILE" --region "$AWS_REGION" "$@"
}

# Print the endpoint's state (or NotFound if it can't be read yet)
endpoint_state() {
  aws_cmd lambda-web get-web-function-endpoint \
    --function-name "$FUNCTION_NAME" \
    --endpoint-name "$ENDPOINT_NAME" \
    --query state --output text 2>/dev/null || echo "NotFound"
}

# Block until the endpoint is Active, then print its URL.
wait_for_endpoint() {
  local deadline=$((SECONDS + WAIT_TIMEOUT_SECONDS))
  local state reason domain

  echo "Waiting for endpoint '$ENDPOINT_NAME' to become active (timeout ${WAIT_TIMEOUT_SECONDS}s)..."

  while :; do
    state="$(endpoint_state)"

    case "$state" in
      Active)
        break
        ;;
      Failed)
        reason="$(aws_cmd lambda-web get-web-function-endpoint \
          --function-name "$FUNCTION_NAME" \
          --endpoint-name "$ENDPOINT_NAME" \
          --query stateReason --output text 2>/dev/null || true)"
        echo
        echo "Endpoint entered Failed state: $reason" >&2
        return 1
        ;;
      Deleting)
        echo
        echo "Endpoint is being deleted; cannot continue." >&2
        return 1
        ;;
    esac

    if (( SECONDS >= deadline )); then
      echo
      echo "Timed out waiting for endpoint (last state: $state)." >&2
      return 1
    fi

    printf '  state: %s\r' "$state"
    sleep "$POLL_INTERVAL_SECONDS"
  done

  domain="$(aws_cmd lambda-web get-web-function-endpoint \
    --function-name "$FUNCTION_NAME" \
    --endpoint-name "$ENDPOINT_NAME" \
    --query domainName --output text)"

  ENDPOINT_URL="https://${domain}"
}

echo "======================================"
echo " Provisioning Lambda Web Function"
echo "======================================"
echo "Function: $FUNCTION_NAME"
echo "Profile:  $AWS_PROFILE"
echo "Region:   $AWS_REGION"
echo

# Check AWS credentials
ACCOUNT_ID="$(aws_cmd sts get-caller-identity --query Account --output text)"

echo "AWS Account: $ACCOUNT_ID"

# If the function already exists, just report its endpoint URL
if aws_cmd lambda-web get-web-function \
  --function-name "$FUNCTION_NAME" >/dev/null 2>&1; then
  echo "Function '$FUNCTION_NAME' already exists."
  echo
  wait_for_endpoint
  echo
  echo "Endpoint URL: $ENDPOINT_URL"
  exit 0
fi

# Deterministic resource names
NAME_HASH="$(printf '%s' "$FUNCTION_NAME" | shasum -a 256 | cut -c1-8)"

ROLE_NAME="lambda-web-${NAME_HASH}"
BUCKET_NAME="lambda-web-${ACCOUNT_ID}-${AWS_REGION}-${NAME_HASH}"

TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT

echo
echo "1. Creating IAM execution role..."

cat > "$TEMP_DIR/trust-policy.json" <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
JSON

if ! aws_cmd iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  aws_cmd iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "file://$TEMP_DIR/trust-policy.json" \
    >/dev/null
fi

# CloudWatch logging permissions
cat > "$TEMP_DIR/logging-policy.json" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": [
        "arn:aws:logs:${AWS_REGION}:${ACCOUNT_ID}:log-group:/aws/lambda/web/${FUNCTION_NAME}:*",
        "arn:aws:logs:${AWS_REGION}:${ACCOUNT_ID}:log-group:/aws/lambda/web/${FUNCTION_NAME}.local:*"
      ]
    }
  ]
}
JSON

aws_cmd iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name LambdaWebLogging \
  --policy-document "file://$TEMP_DIR/logging-policy.json"

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

# Wait for IAM role propagation
echo "Waiting for IAM role to propagate..."
aws_cmd iam wait role-exists --role-name "$ROLE_NAME"
sleep 10

echo "Execution role: $ROLE_ARN"

echo
echo "2. Creating deployment artifact bucket..."

if ! aws_cmd s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
  if [[ "$AWS_REGION" == "us-east-1" ]]; then
    aws_cmd s3api create-bucket \
      --bucket "$BUCKET_NAME" \
      >/dev/null
  else
    aws_cmd s3api create-bucket \
      --bucket "$BUCKET_NAME" \
      --create-bucket-configuration "LocationConstraint=$AWS_REGION" \
      >/dev/null
  fi
fi

# Enable versioning (required by Lambda Web Functions)
aws_cmd s3api put-bucket-versioning \
  --bucket "$BUCKET_NAME" \
  --versioning-configuration Status=Enabled

echo "Bucket: $BUCKET_NAME"

echo
echo "3. Configuring S3 permissions..."

cat > "$TEMP_DIR/bucket-policy.json" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowLambdaWebFunctionRead",
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": [
        "s3:GetObject",
        "s3:GetObjectVersion"
      ],
      "Resource": "arn:aws:s3:::${BUCKET_NAME}/*",
      "Condition": {
        "ArnLike": {
          "aws:SourceArn": "arn:aws:lambda:${AWS_REGION}:${ACCOUNT_ID}:web-function/${FUNCTION_NAME}/revision/*"
        }
      }
    }
  ]
}
JSON

aws_cmd s3api put-bucket-policy \
  --bucket "$BUCKET_NAME" \
  --policy "file://$TEMP_DIR/bucket-policy.json"

echo
echo "4. Creating placeholder HTTP server..."

cat > "$TEMP_DIR/index.js" <<'JS'
const http = require("node:http");

const [host, port] = (
  process.env.AWS_LAMBDA_HTTP_ENDPOINT || "127.0.0.1:3000"
).split(":");

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    "content-type": "application/json",
  });

  res.end(JSON.stringify({
    message: "Placeholder revision. Deploy the application to replace it.",
    path: req.url,
  }));
});

server.listen(Number(port), host);
JS

(cd "$TEMP_DIR" && zip -q placeholder.zip index.js)

echo
echo "5. Uploading placeholder artifact..."

aws_cmd s3 cp \
  "$TEMP_DIR/placeholder.zip" \
  "s3://${BUCKET_NAME}/placeholder.zip" \
  --only-show-errors

echo
echo "6. Creating Lambda Web Function..."

cat > "$TEMP_DIR/revision-config.json" <<JSON
{
  "buildConfig": {
    "codeConfig": {
      "s3Object": {
        "bucket": "${BUCKET_NAME}",
        "key": "placeholder.zip"
      }
    },
    "runtimeConfig": {
      "runtime": "${RUNTIME}"
    }
  },
  "serviceConfig": {
    "executionRoleArn": "${ROLE_ARN}",
    "timeoutSeconds": 30
  }
}
JSON

cat > "$TEMP_DIR/endpoint-config.json" <<JSON
{
  "endpointName": "${ENDPOINT_NAME}",
  "endpointType": "HomeRegion",
  "authType": "ApplicationManaged",
  "autoDeploymentMode": "LatestRevision"
}
JSON

aws_cmd lambda-web create-web-function \
  --function-name "$FUNCTION_NAME" \
  --revision-config "file://$TEMP_DIR/revision-config.json" \
  --endpoint-config "file://$TEMP_DIR/endpoint-config.json" \
  >/dev/null

echo
echo "7. Waiting for endpoint..."

wait_for_endpoint

echo
echo "======================================"
echo " Provisioning complete"
echo "======================================"
echo
echo "Function: $FUNCTION_NAME"
echo "Role:     $ROLE_NAME"
echo "Bucket:   $BUCKET_NAME"
echo "Endpoint: $ENDPOINT_NAME"
echo
echo "Endpoint URL: $ENDPOINT_URL"
echo
echo "Your application has NOT been deployed yet; the URL currently serves the placeholder."