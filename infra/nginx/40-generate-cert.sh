#!/bin/sh
# Generate a self-signed TLS certificate on first boot if none is mounted.
# Runs from nginx:alpine's /docker-entrypoint.d/ before nginx starts.
set -e

CERT_DIR=/etc/nginx/certs
if [ ! -f "$CERT_DIR/server.crt" ]; then
  echo "→ Generating self-signed TLS certificate for localhost..."
  mkdir -p "$CERT_DIR"
  openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
    -keyout "$CERT_DIR/server.key" \
    -out "$CERT_DIR/server.crt" \
    -subj "/C=US/ST=Dev/L=Dev/O=MedPlatform/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
  echo "→ Certificate written to $CERT_DIR (replace with a real cert in production)."
fi
