FROM php:8.3-apache-bookworm
RUN apt-get update \
    && apt-get install -y --no-install-recommends libfreetype6-dev libjpeg62-turbo-dev libpng-dev libpq-dev libzip-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" gd pcntl pdo_pgsql zip \
    && a2enmod rewrite headers \
    && rm -rf /var/lib/apt/lists/*

ENV APP_ENV=production \
    APP_DEBUG=false \
    APACHE_DOCUMENT_ROOT=/var/www/html/public \
    PORT=8080

WORKDIR /var/www/html
COPY --from=composer:2.8 /usr/bin/composer /usr/local/bin/composer
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-progress --prefer-dist --classmap-authoritative --no-scripts
COPY . .
COPY docker/entrypoint.sh /usr/local/bin/msprout-entrypoint
RUN composer dump-autoload --no-dev --no-interaction --classmap-authoritative \
    && sed -ri 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf /etc/apache2/apache2.conf \
    && sed -ri 's!Listen 80!Listen ${PORT}!g; s!<VirtualHost \*:80>!<VirtualHost *:${PORT}>!g' /etc/apache2/ports.conf /etc/apache2/sites-available/*.conf \
    && chmod 0755 /usr/local/bin/msprout-entrypoint \
    && chown -R www-data:www-data storage bootstrap/cache /var/lock/apache2 /var/log/apache2 /var/run/apache2

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD php -r "exit(@file_get_contents('http://127.0.0.1:'.(getenv('PORT') ?: '8080').'/health/live') === false ? 1 : 0);"

EXPOSE 8080
USER www-data
CMD ["msprout-entrypoint", "api"]
