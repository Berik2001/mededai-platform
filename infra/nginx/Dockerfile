FROM nginx:1.27-alpine

# openssl for on-boot self-signed cert generation.
RUN apk add --no-cache openssl

COPY nginx.conf /etc/nginx/conf.d/default.conf
# nginx:alpine runs executables in /docker-entrypoint.d/ before starting nginx.
COPY 40-generate-cert.sh /docker-entrypoint.d/40-generate-cert.sh
RUN chmod +x /docker-entrypoint.d/40-generate-cert.sh

EXPOSE 80 443
