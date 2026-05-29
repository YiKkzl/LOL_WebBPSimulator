#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/lolbp/app}"
APP_USER="${APP_USER:-lolbp}"
CONFIG_DIR="${CONFIG_DIR:-/etc/lolbp}"
BRANCH="${1:-${DEPLOY_BRANCH:-develop}}"
DOMAIN="${DOMAIN:-lolbp.yikk.top}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this script as root, for example: sudo bash scripts/deploy-production.sh ${BRANCH}" >&2
  exit 1
fi

if [ ! -f "${CONFIG_DIR}/mysql.env" ]; then
  echo "Missing ${CONFIG_DIR}/mysql.env" >&2
  exit 1
fi

# shellcheck disable=SC1091
source "${CONFIG_DIR}/mysql.env"

DATABASE_URL="mysql://${MYSQL_USER}:${MYSQL_PASSWORD}@127.0.0.1:3306/${MYSQL_DATABASE}"

echo "[1/6] Fetching ${BRANCH}"
git config --global --add safe.directory "${APP_DIR}" >/dev/null 2>&1 || true
cd "${APP_DIR}"
git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
git reset --hard "origin/${BRANCH}"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

echo "[2/6] Writing app environment"
cat > "${CONFIG_DIR}/lolbp.env" <<ENV
NODE_ENV=production
PORT=3000
NEXT_TELEMETRY_DISABLED=1
DATABASE_URL=${DATABASE_URL}
ENV
chmod 600 "${CONFIG_DIR}/lolbp.env"

echo "[3/6] Installing dependencies"
sudo -u "${APP_USER}" env DATABASE_URL="${DATABASE_URL}" npm ci

echo "[4/6] Applying Prisma schema"
sudo -u "${APP_USER}" env DATABASE_URL="${DATABASE_URL}" npx prisma generate
sudo -u "${APP_USER}" env DATABASE_URL="${DATABASE_URL}" npx prisma db push

echo "[5/6] Building application"
sudo -u "${APP_USER}" env DATABASE_URL="${DATABASE_URL}" NEXT_TELEMETRY_DISABLED=1 npm run build

echo "[6/6] Restarting service"
systemctl restart lolbp
sleep 3
systemctl --no-pager --full status lolbp | sed -n '1,12p'

if command -v curl >/dev/null 2>&1; then
  curl -fsSI "https://${DOMAIN}/" | sed -n '1,8p'
fi

echo "Deployment complete: ${BRANCH}"
