#!/bin/bash

# Production Restore Script for BookStud.io
# This script restores a database backup with safety checks and verification

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/app/backups}"
BACKUP_FILE="${1:-}"

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
    log "ERROR: Restore failed on line $1"
    exit 1
}

trap 'handle_error $LINENO' ERR

# Usage function
usage() {
    echo "Usage: $0 <backup_file>"
    echo "Example: $0 bookstudio-backup_20250605_230000.sql.gz"
    echo ""
    echo "Available backups:"
    ls -lh "${BACKUP_DIR}/"*.sql.gz 2>/dev/null || echo "No backups found in ${BACKUP_DIR}"
    exit 1
}

# Validate input
if [[ -z "${BACKUP_FILE}" ]]; then
    log "ERROR: No backup file specified"
    usage
fi

# Check if backup file exists
FULL_BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"
if [[ ! -f "${FULL_BACKUP_PATH}" ]]; then
    log "ERROR: Backup file not found: ${FULL_BACKUP_PATH}"
    usage
fi

# Verify backup file is not empty
if [[ ! -s "${FULL_BACKUP_PATH}" ]]; then
    log "ERROR: Backup file is empty: ${FULL_BACKUP_PATH}"
    exit 1
fi

log "Starting database restore from: ${FULL_BACKUP_PATH}"

# Create a pre-restore backup
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
PRE_RESTORE_BACKUP="${BACKUP_DIR}/pre-restore-backup_${TIMESTAMP}.sql.gz"

log "Creating pre-restore backup: ${PRE_RESTORE_BACKUP}"
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
    --file="${PRE_RESTORE_BACKUP%.gz}"

gzip "${PRE_RESTORE_BACKUP%.gz}"
log "Pre-restore backup created successfully"

# Decompress the backup file if needed
RESTORE_FILE="${FULL_BACKUP_PATH}"
if [[ "${FULL_BACKUP_PATH}" == *.gz ]]; then
    RESTORE_FILE="${FULL_BACKUP_PATH%.gz}"
    log "Decompressing backup file..."
    gunzip -c "${FULL_BACKUP_PATH}" > "${RESTORE_FILE}"
fi

# Perform the restore
log "Restoring database from: ${RESTORE_FILE}"
pg_restore \
    --host="${DB_HOST}" \
    --port="${DB_PORT}" \
    --username="${DB_USER}" \
    --dbname="${DB_NAME}" \
    --no-password \
    --verbose \
    --clean \
    --if-exists \
    --create \
    --exit-on-error \
    "${RESTORE_FILE}"

# Clean up temporary decompressed file
if [[ "${FULL_BACKUP_PATH}" == *.gz ]]; then
    rm -f "${RESTORE_FILE}"
fi

# Verify restore
log "Verifying restore..."
TABLES_COUNT=$(psql \
    --host="${DB_HOST}" \
    --port="${DB_PORT}" \
    --username="${DB_USER}" \
    --dbname="${DB_NAME}" \
    --no-password \
    --tuples-only \
    --command="SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")

if [[ "${TABLES_COUNT}" -gt 0 ]]; then
    log "Restore completed successfully. Found ${TABLES_COUNT} tables in the database."
else
    log "WARNING: No tables found after restore. Please verify the backup file."
fi

log "Restore process completed"
log "Pre-restore backup saved as: ${PRE_RESTORE_BACKUP}"