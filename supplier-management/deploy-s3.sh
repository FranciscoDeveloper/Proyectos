#!/usr/bin/env bash
# ============================================================
# deploy-s3.sh — Build and deploy Angular SPA to AWS S3
#
# Usage:
#   chmod +x deploy-s3.sh
#   ./deploy-s3.sh                          # creates new bucket
#   ./deploy-s3.sh my-existing-bucket       # re-deploy to existing bucket
#
# Prerequisites:
#   aws configure   (run once to set Access Key + Secret + Region)
# ============================================================
set -e

BUCKET_NAME="${1:-datahub-app-$(date +%s)}"
DIST_DIR="dist/supplier-management/browser"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"

echo ""
echo "============================================"
echo "  Deploying to S3: s3://$BUCKET_NAME"
echo "  Region: $REGION"
echo "============================================"
echo ""

# ── 1. Build ────────────────────────────────────────────────
echo "[1/6] Building Angular app..."
npm run build

# ── 2. Create bucket (skip if already exists) ───────────────
echo "[2/6] Creating bucket..."
if aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
  echo "  Bucket already exists — skipping creation."
else
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$BUCKET_NAME" --region "$REGION"
  else
    aws s3api create-bucket \
      --bucket "$BUCKET_NAME" \
      --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION"
  fi
  echo "  Bucket created: $BUCKET_NAME"
fi

# ── 3. Disable Block Public Access ──────────────────────────
echo "[3/6] Enabling public access..."
aws s3api delete-public-access-block --bucket "$BUCKET_NAME" 2>/dev/null || true

# Public-read bucket policy
aws s3api put-bucket-policy --bucket "$BUCKET_NAME" --policy "{
  \"Version\": \"2012-10-17\",
  \"Statement\": [{
    \"Sid\": \"PublicReadGetObject\",
    \"Effect\": \"Allow\",
    \"Principal\": \"*\",
    \"Action\": \"s3:GetObject\",
    \"Resource\": \"arn:aws:s3:::$BUCKET_NAME/*\"
  }]
}"

# ── 4. Enable static website hosting ────────────────────────
# CRITICAL: ErrorDocument must be index.html for SPA routing.
# Without this, /dashboard returns an S3 404 page instead of
# index.html, and Angular never bootstraps — blank page!
echo "[4/6] Configuring static website hosting..."
aws s3api put-bucket-website --bucket "$BUCKET_NAME" --website-configuration '{
  "IndexDocument": { "Suffix": "index.html" },
  "ErrorDocument": { "Key": "index.html" }
}'

# ── 5. Upload files ──────────────────────────────────────────
echo "[5/6] Uploading files..."

# index.html — no cache (always fetch latest)
aws s3 cp "$DIST_DIR/index.html" "s3://$BUCKET_NAME/index.html" \
  --cache-control "no-cache,no-store,must-revalidate" \
  --content-type "text/html"

# JS chunks — immutable (content-hashed, safe to cache forever)
aws s3 sync "$DIST_DIR" "s3://$BUCKET_NAME" \
  --exclude "index.html" \
  --exclude "_redirects" \
  --cache-control "public,max-age=31536000,immutable" \
  --delete

# ── 6. Print URL ─────────────────────────────────────────────
echo ""
echo "[6/6] Done!"
echo ""
echo "  URL: http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"
echo ""
echo "  If you use us-east-1, also try:"
echo "  http://$BUCKET_NAME.s3-website.amazonaws.com"
echo ""
