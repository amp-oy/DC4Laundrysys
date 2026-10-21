# Freshfold Laundry Order Tracking

Freshfold is a React dashboard backed by a Laravel 12 JSON API. The Laravel database stores users and roles, service types, orders, order items, payments, and status history.

## Requirements

- PHP 8.2 or newer with `pdo_sqlite` enabled (or `pdo_mysql` for MySQL/MariaDB)
- Composer
- Node.js and npm

## First-time setup

### Laravel API and database

```powershell
cd backend
composer install
Copy-Item .env.example .env
php artisan key:generate
if (-not (Test-Path database\database.sqlite)) { New-Item -ItemType File database\database.sqlite }
php artisan migrate --seed
```

The example configuration uses SQLite so the project runs without a separate database server. The default shop timezone is Asia/Manila. To use MySQL/MariaDB instead, set `DB_CONNECTION=mysql`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, and `DB_PASSWORD` in `backend/.env`, then create that database and run the migrations. Set `DB_TIMEZONE` to match the database session timezone when changing the shop timezone.

Start the API in one terminal:

```powershell
php artisan serve --host=127.0.0.1 --port=8001
```

### React frontend

The React/Vite app is in `frontend`. In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

The frontend defaults to `http://127.0.0.1:8001/api` to avoid conflicts with other local apps using port 8000. Override it with `VITE_API_URL` if the API is hosted elsewhere. Add the frontend origin to `CORS_ALLOWED_ORIGINS` in `backend/.env` if you use a different Vite host or port.

## Demo accounts

The database seeder creates a local shop administrator and sample customers. The development staff account is:

- Email: `staff@freshfold.test`
- Password: `password`

Sample customer accounts use the same demo password. Before seeding a production database, set `DEMO_STAFF_EMAIL` and a unique `DEMO_STAFF_PASSWORD` in `backend/.env`; production seeding refuses to run without a staff password and does not create demo customer accounts. Demo credentials are only shown in the development sign-in screen.

Customers can also register in the sign-in screen. They can create and track their own orders, and cancel an unpaid order that has not left the Received stage. Staff can see all orders and customers, advance orders one step at a time, and record payments.

## API and data

- `POST /api/register`, `POST /api/login`, `POST /api/logout`, `GET /api/me`
- `GET /api/dashboard`, `GET /api/services`, `GET /api/customers`
- `GET|POST /api/orders`, `GET|DELETE /api/orders/{order}`
- `PATCH /api/orders/{order}/status`, `POST /api/orders/{order}/payment`
- Staff-only service create/update/delete endpoints

Protected endpoints use Laravel Sanctum bearer tokens. The server validates order data and prices; order totals are calculated from the selected service price and quantity. Order status history is recorded in the database.

## Checks

```powershell
cd frontend
npm run lint
npm run build
cd ..\backend
php artisan test
```

## Project layout

- `frontend/` - React application, Vite configuration, and frontend dependencies
- `backend/` - Laravel API, database migrations, and seed data
