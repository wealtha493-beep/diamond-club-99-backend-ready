# Diamond Club 99 of Ekiti — Backend Setup

This project now includes a real Node/Express backend connected to Supabase.

## What is connected
- Secure admin login with an HttpOnly session cookie
- Secure member login with an HttpOnly session cookie
- Admin CRUD for members, announcements, news, affirmations, projects, gallery, leadership and meetings
- President and club settings management
- Member-only content endpoints
- Private Supabase Storage bucket for the Members Gallery
- Gallery uploads from the Admin Panel
- Server-side protection for `/admin/*.html` and `/members/*.html`
- Activity logging
- Password hashing with bcrypt
- Login rate limiting and security headers

## Supabase setup
1. Create/open your Supabase project.
2. Open **SQL Editor**.
3. Run `supabase/schema.sql`.
4. Copy `.env.example` to `.env` for local testing.
5. Fill in `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and a strong `JWT_SECRET`.
6. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` before first server start.

**Important:** `SUPABASE_SERVICE_ROLE_KEY` must stay on the server. Never put it in frontend JavaScript or a public GitHub repository.

## Run locally
```bash
npm install
npm start
```
Then open:
- Homepage: `http://localhost:3000/diamond-club.html`
- Member login: `http://localhost:3000/members/login.html`
- Admin login: `http://localhost:3000/admin/login.html`
- Health check: `http://localhost:3000/api/health`

## Render deployment
Use a Render Web Service:
- Environment: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Root Directory: leave blank if this folder is the repository root

Add these environment variables in Render:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `NODE_ENV=production`

Do not commit `.env`.

## First member
There is intentionally no permanent demo member password in the production code. Log in as the administrator, open **Members**, add a member and set that member's login password.

## Gallery
The Members Gallery is private. Admin uploads are stored in the private `club-gallery` Supabase Storage bucket. Members receive temporary signed image URLs after they authenticate.
