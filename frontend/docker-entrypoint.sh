#!/bin/sh
# docker-entrypoint.sh
# Replaces the INTERNAL_ALB_DNS placeholder in nginx.conf with the
# actual value from the INTERNAL_ALB_DNS environment variable at
# container startup — so you don't need to rebuild the image when
# the ALB DNS changes.

set -e

if [ -z "$INTERNAL_ALB_DNS" ]; then
  echo "ERROR: INTERNAL_ALB_DNS environment variable is not set."
  exit 1
fi

echo "Configuring Nginx proxy to: $INTERNAL_ALB_DNS"
sed -i "s|INTERNAL_ALB_DNS|${INTERNAL_ALB_DNS}|g" /etc/nginx/conf.d/default.conf

exec nginx -g "daemon off;"
