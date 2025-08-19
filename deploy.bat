@echo off
echo 🚀 Deploying SmartQR.ai to Netlify...
echo.

echo Step 1: Building application...
call npm run build
if errorlevel 1 (
    echo ❌ Build failed!
    pause
    exit /b 1
)

echo ✅ Build successful!
echo.

echo Step 2: Deploying to Netlify...
call netlify deploy --prod --dir=.next
if errorlevel 1 (
    echo ❌ Deployment failed!
    echo Please run: netlify login
    echo Then try again: deploy.bat
    pause
    exit /b 1
)

echo.
echo 🎉 SmartQR.ai deployed successfully!
echo Your site is now live!
echo.
pause