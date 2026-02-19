# Deployment (Vercel)

## Steps
1) Push the repo to GitHub.
2) Create a new Vercel project and import the repo.
3) Add the environment variables listed below.
4) Deploy. Prisma client is generated automatically via `postinstall`.

## Required environment variables
Server:
- `DATABASE_URL`
- `DIRECT_DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Client:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Virtual mode (Twilio NTS):
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_TURN_TTL` (optional)
- `NEXT_PUBLIC_FORCE_TURN` (optional, set `true` for relay-only testing)

Optional (ads, production only):
- `NEXT_PUBLIC_ADSENSE_CLIENT`
- `NEXT_PUBLIC_ADSENSE_SLOT`

## Notes
- Do not commit `.env` or `.env.local` files.
- AdSense script is only loaded in production when `NEXT_PUBLIC_ADSENSE_CLIENT` is set.
- Ads never render on `/game/*` routes.
