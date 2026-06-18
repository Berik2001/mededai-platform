#!/bin/sh
# Apply any pending database migrations, then start the API.
set -e

echo "→ Applying database migrations (prisma migrate deploy)..."
node_modules/.bin/prisma migrate deploy

echo "→ Starting API on port ${API_PORT:-4000}..."
exec node dist/main.js
