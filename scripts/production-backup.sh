#!/bin/bash

# Production Backup Script for BookStud.io
# This script creates timestamped database backups with compression and retention management

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/app/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
BACKUP_PREFIX="bookstudio-backup"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/${BACKUP_PREFIX}_${TIMESTAMP}.sql.gz"

# Database connection parameters
DB_HOST="${PGHOST:-db}"
DB_PORT="${PGPORT:-5432}"
DB_NAME="${PGDATABASE:-bookstudio}"
DB_USER="${PGUSER:-postgres}"
DB_PASSWORD="${PGPASSWORD:-postgres}"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Error handling
handle_error() {
    log "ERROR: Backup failed on line $1"
    exit 1
}

trap 'handle_error $LINENO' ERR

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

log "Starting database backup..."
log "Backup file: ${BACKUP_FILE}"

# Perform the backup with compression
export PGPASSWORD="${DB_PASSWORD}"
pg_dump \
    --host="${DB_HOST}" \
    --port="${DB_PORT}" \
    --username="${DB_USER}" \
    --dbname="${DB_NAME}" \
    --no-password \
    --verbose \
    --clean \
    --create \
    --if-exists \
    --format=custom \
    --compress=9 \
    --file="${BACKUP_FILE%.gz}"

# Compress the backup
gzip "${BACKUP_FILE%.gz}"

# Verify backup file exists and has content
if [[ ! -s "${BACKUP_FILE}" ]]; then
    log "ERROR: Backup file is empty or doesn't exist"
    exit 1
fi

BACKUP_SIZE=$(stat -c%s "${BACKUP_FILE}" 2>/dev/null || stat -f%z "${BACKUP_FILE}" 2>/dev/null || echo "unknown")
log "Backup completed successfully. Size: ${BACKUP_SIZE} bytes"

# Clean up old backups
log "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "${BACKUP_PREFIX}_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete || true

# List remaining backups
log "Current backups:"
ls -lh "${BACKUP_DIR}/${BACKUP_PREFIX}_"*.sql.gz 2>/dev/null || log "No backups found"

log "Backup process completed successfully"