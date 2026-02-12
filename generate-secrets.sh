#!/bin/bash

# FOIA Archive - Generate Secure Secrets for Production Deployment
echo "🔐 Generating secure secrets for FOIA Archive deployment..."
echo ""

# Generate SECRET_KEY (64 characters)
SECRET_KEY=$(openssl rand -base64 48)
echo "✅ SECRET_KEY (for JWT signing):"
echo "   Copy this to Railway environment variables:"
echo "   SECRET_KEY=$SECRET_KEY"
echo ""

# Generate ADMIN_PASSWORD suggestion
echo "⚠️  ADMIN_PASSWORD (for admin login):"
echo "   Create a strong password (min 12 characters, mix of letters/numbers/symbols)"
echo "   Example generator: https://1password.com/password-generator/"
echo "   Or use: $(openssl rand -base64 16)"
echo ""

# Database URLs (Railway provides these)
echo "📊 DATABASE_URL:"
echo "   Railway provides this - copy from PostgreSQL service"
echo "   Format: postgresql+asyncpg://user:pass@host:port/db"
echo ""

echo "📮 REDIS_URL:"
echo "   Railway provides this - copy from Redis service"
echo "   Format: redis://host:port/0"
echo ""

# CORS origins
echo "🌐 CORS_ORIGINS:"
echo "   CRITICAL: Must match your frontend domain!"
echo '   CORS_ORIGINS=["https://foiaarchive.com","https://www.foiaarchive.com"]'
echo ""

# Email configuration
echo "📧 EMAIL CONFIGURATION:"
echo "   For iCloud custom domain (recordsrequest@foiaarchive.com):"
echo "   1. Go to: https://appleid.apple.com"
echo "   2. Sign-In & Security → App-Specific Passwords"
echo "   3. Generate password for 'FOIA Archive'"
echo "   4. Use that password for both SMTP_PASSWORD and IMAP_PASSWORD"
echo ""
echo "   SMTP_HOST=smtp.mail.me.com"
echo "   SMTP_PORT=587"
echo "   SMTP_USER=recordsrequest@foiaarchive.com"
echo "   SMTP_PASSWORD=<your-app-specific-password>"
echo "   FROM_EMAIL=recordsrequest@foiaarchive.com"
echo "   IMAP_HOST=imap.mail.me.com"
echo "   IMAP_PORT=993"
echo "   IMAP_USER=recordsrequest@foiaarchive.com"
echo "   IMAP_PASSWORD=<same-as-smtp>"
echo ""

# S3/R2 Configuration
echo "💾 S3/R2 STORAGE (for FOIA PDFs):"
echo "   Cloudflare R2 (recommended): https://dash.cloudflare.com/r2"
echo "   Or AWS S3: https://s3.console.aws.amazon.com"
echo ""
echo "   S3_ENDPOINT=<your-r2-endpoint or leave empty for AWS>"
echo "   S3_ACCESS_KEY=<access-key>"
echo "   S3_SECRET_KEY=<secret-key>"
echo "   S3_BUCKET_NAME=<bucket-name>"
echo "   S3_REGION=us-east-1"
echo ""

# Optional services
echo "🤖 OPTIONAL: Anthropic Claude API (for AI classification):"
echo "   Get key: https://console.anthropic.com/settings/keys"
echo "   ANTHROPIC_API_KEY=sk-ant-..."
echo "   Note: Falls back to regex classification if not set"
echo ""

echo "📺 OPTIONAL: YouTube Data API (for analytics sync):"
echo "   Setup: https://console.cloud.google.com/apis/credentials"
echo "   YOUTUBE_CLIENT_ID=<oauth-client-id>"
echo "   YOUTUBE_CLIENT_SECRET=<oauth-secret>"
echo "   YOUTUBE_REFRESH_TOKEN=<refresh-token>"
echo "   Note: Can enable later, not required for launch"
echo ""

echo "✅ Secrets generated! Copy these to Railway environment variables."
echo ""
echo "📖 Next steps:"
echo "   1. Copy SECRET_KEY above to Railway"
echo "   2. Set ADMIN_PASSWORD to a strong password"
echo "   3. Configure email credentials"
echo "   4. Set up S3/R2 storage"
echo "   5. Update CORS_ORIGINS"
echo "   6. Follow DEPLOY_NOW.md for full deployment"
echo ""
