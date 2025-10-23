@echo off
echo Setting up Vercel environment variables...
echo.

echo Setting DATABASE_URL...
echo postgresql://postgres.uwddeseqwdsryvuoulsm:duseorua12d@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres | vercel env add DATABASE_URL production

echo.
echo Setting NEXTAUTH_URL...
echo https://onsia-crm.vercel.app | vercel env add NEXTAUTH_URL production

echo.
echo Setting AUTH_URL...
echo https://onsia-crm.vercel.app | vercel env add AUTH_URL production

echo.
echo Setting NEXTAUTH_SECRET...
echo onsia-crm-secret-key-change-in-production | vercel env add NEXTAUTH_SECRET production

echo.
echo Setting AUTH_SECRET...
echo onsia-crm-secret-key-change-in-production | vercel env add AUTH_SECRET production

echo.
echo Environment variables setup complete!
pause
