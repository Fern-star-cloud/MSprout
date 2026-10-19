#!/bin/sh
set -eu

if [ "${APP_ENV:-}" != "production" ] || [ "${APP_DEBUG:-true}" != "false" ]; then
    echo "Production requires APP_ENV=production and APP_DEBUG=false." >&2
    exit 1
fi

php docker/process-boundary.php "${1:-api}"
if [ "${1:-api}" = "maintenance" ]; then
    # This secret is mounted only in the dedicated, non-HTTP maintenance service.
    export DB_PASSWORD="$(cat /run/secrets/msprout-maintenance-password)"
    export MSPROUT_MAINTENANCE_PROCESS=true
    # Private per-service file cache retains scheduler overlap locks without a web-writable DB cache.
    export CACHE_STORE=file SESSION_DRIVER=array QUEUE_CONNECTION=null
fi

php artisan config:cache --no-interaction
php artisan route:cache --no-interaction
php artisan view:cache --no-interaction

case "${1:-api}" in
    api)
        exec apache2-foreground
        ;;
    worker)
        exec php artisan queue:work --sleep=3 --tries=3 --timeout=120 --max-time=3600
        ;;
    scheduler)
        exec php artisan schedule:work
        ;;
    maintenance)
        # No shared queue: runtime-controlled job payloads must never acquire this identity.
        if [ "$#" -eq 2 ]; then
            exec php artisan operations:maintenance "$2"
        fi
        exec php artisan schedule:work
        ;;
    migrate)
        exec php artisan migrate --database=pgsql_migration --force --no-interaction
        ;;
    *)
        echo "Unknown service mode." >&2
        exit 64
        ;;
esac
