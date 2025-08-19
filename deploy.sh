#!/bin/bash
echo "🚀 Deploying SmartQR.ai to Netlify..."
echo

echo "Step 1: Building application..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"
echo

echo "Step 2: Deploying to Netlify..."
netlify deploy --prod --dir=.next
if [ $? -ne 0 ]; then
    echo "❌ Deployment failed!"
    echo "Please run: netlify login"
    echo "Then try again: ./deploy.sh"
    exit 1
fi

echo
echo "🎉 SmartQR.ai deployed successfully!"
echo "Your site is now live!"
echo