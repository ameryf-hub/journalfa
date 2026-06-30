# Private Journal

A full-stack personal journal app with a React frontend, an Express API, and PostgreSQL storage for Railway.

## Features

- Create, edit, search, and delete journal entries.
- Single-user sign in with a session cookie so only you can open the journal.
- Store data in Railway Postgres through a simple API.
- Deploys as one Node app that serves the built frontend and backend together.

## Local development

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL`, `APP_USERNAME`, `APP_PASSWORD`, and `SESSION_SECRET`.
3. Start the app with `npm run dev`.

The frontend runs on Vite and proxies API requests to the backend on port `3000`.

## Railway setup

1. Add a Railway PostgreSQL service.
2. Set `DATABASE_URL` from the Railway Postgres connection string.
3. Set `APP_USERNAME`, `APP_PASSWORD`, and `SESSION_SECRET` in Railway Variables.
4. Set `ALLOWED_ORIGINS` to your Railway domain and any local dev origins you use.
5. Deploy the repository.

The app uses the `build` script to create the frontend bundle and `npm start` for the production server.

## Railway checklist

Use this when you deploy from your Railway account:

1. Create a new Railway project from this GitHub repository.
2. Attach a Railway PostgreSQL database to the project.
3. Copy the database connection string into `DATABASE_URL`.
4. Set `APP_USERNAME`, `APP_PASSWORD`, and `SESSION_SECRET` in Railway Variables.
5. Add your Railway app URL to `ALLOWED_ORIGINS`.
6. Deploy and open the public Railway domain.
7. Sign in with the username and password you configured.

## Authentication

- The app is protected by one username/password pair you control through environment variables.
- Sessions are stored in a secure HTTP-only cookie and expire after 14 days of inactivity.