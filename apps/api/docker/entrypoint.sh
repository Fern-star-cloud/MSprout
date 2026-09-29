#!/bin/sh
set -eu

if [ "${APP_ENV:-}" != "production" ] || [ "${APP_DEBUG:-true}" != "false" ]; then
    echo "Production requires APP_ENV=production and APP_DEBUG=false." >&2
    exit 1
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
    migrate)
        exec php artisan migrate --database=pgsql_migration --force --no-interaction
        ;;
    *)
        echo "Unknown service mode." >&2
        exit 64
        ;;
esac
