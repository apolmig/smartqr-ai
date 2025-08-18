# SmartQR.ai Netlify Deployment Guide

## 🚀 Deploy to Netlify

### Prerequisites
1. Netlify account connected to GitHub
2. PostgreSQL database (Supabase, PlanetScale, or Neon recommended)
3. Stripe account with API keys

### Step 1: Database Setup

#### Option A: Supabase (Recommended)
1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Go to Settings > Database
4. Copy the connection string (Direct connection, not pooler)
5. Format: `postgresql://postgres:[password]@[host]:5432/postgres`

#### Option B: Neon (Also good for Netlify)
1. Go to [neon.tech](https://neon.tech)
2. Create new project
3. Copy the connection string from dashboard
4. Format: `postgresql://user:password@host/database?sslmode=require`

### Step 2: Stripe Setup
1. Go to [stripe.com](https://stripe.com)
2. Get your API keys:
   - Publishable key (starts with `pk_`)
   - Secret key (starts with `sk_`)
3. Create webhook endpoint:
   - URL: `https://your-site.netlify.app/.netlify/functions/stripe-webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
4. Copy webhook secret (starts with `whsec_`)

### Step 3: Prepare Repository

1. **Push code to GitHub:**
```bash
git add .
git commit -m "Configure for Netlify deployment"
git push origin main
```

2. **Verify all Netlify configuration files are in place:**
   - ✅ `netlify.toml`
   - ✅ `netlify/functions/` directory with serverless functions
   - ✅ Updated `next.config.js`
   - ✅ Updated `package.json` with build scripts

### Step 4: Deploy to Netlify

#### Method 1: Netlify Dashboard (Recommended)
1. Go to [netlify.com](https://netlify.com)
2. Click "Add new site" > "Import an existing project"
3. Connect to GitHub and select your repository
4. Configure build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `.next`
   - **Functions directory:** `netlify/functions`
5. Click "Deploy site"

#### Method 2: Netlify CLI
```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

### Step 5: Environment Variables

In Netlify Dashboard > Site settings > Environment variables, add:

#### Required Variables
```
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=your-32-character-random-string
NEXTAUTH_URL=https://your-site.netlify.app
NEXT_PUBLIC_BASE_URL=https://your-site.netlify.app
STRIPE_SECRET_KEY=sk_live_... (or sk_test_ for testing)
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_... (or pk_test_ for testing)
```

#### Optional Variables
```
OPENAI_API_KEY=sk-...
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
NODE_ENV=production
```

### Step 6: Database Migration

After deployment, run migrations using Netlify CLI:

```bash
# Install Netlify CLI if not already installed
npm i -g netlify-cli

# Link your site
netlify link

# Pull environment variables
netlify env:import .env.production

# Run database migration
npx prisma migrate deploy
```

### Step 7: Configure Custom Domain (Optional)

1. In Netlify Dashboard > Domain settings
2. Add custom domain
3. Update DNS records as instructed
4. Update environment variables:
   - `NEXTAUTH_URL=https://yourdomain.com`
   - `NEXT_PUBLIC_BASE_URL=https://yourdomain.com`
5. Update Stripe webhook URL

### Step 8: Test Your Deployment

1. Visit your Netlify URL
2. Create a test account
3. Generate a QR code
4. Test QR scanning with redirect: `https://your-site.netlify.app/r/[shortId]`
5. Test payment flow (use Stripe test cards)

## 🔧 Netlify-Specific Features

### Functions
- **QR Redirect:** `/.netlify/functions/qr-redirect`
- **Stripe Webhook:** `/.netlify/functions/stripe-webhook`
- **Stripe Checkout:** `/.netlify/functions/stripe-checkout`
- **QR Management:** `/.netlify/functions/qr-generate`

### Performance
- Automatic CDN for static assets
- Edge functions for global performance
- Built-in image optimization

### Security
- Automatic HTTPS
- DDoS protection
- Environment variable encryption

## 🐛 Troubleshooting

### Common Issues

#### Build Failures
```bash
# Check build logs in Netlify dashboard
# Clear cache and redeploy
netlify build --clear-cache
```

#### Database Connection Issues
- Ensure DATABASE_URL is correctly formatted
- Verify database allows connections from Netlify IPs
- Check if using connection pooling is needed

#### Function Timeout Issues
- Netlify functions have 10s timeout by default
- Optimize database queries
- Consider using edge functions for performance

#### Environment Variables Not Working
```bash
# Verify variables are set correctly
netlify env:list

# Pull and test locally
netlify env:import .env.local
npm run dev
```

### Function Logs
View function logs in Netlify Dashboard > Functions tab, or use:
```bash
netlify functions:list
netlify functions:invoke function-name
```

## 📊 Monitoring & Analytics

### Netlify Analytics
Enable in Site settings > Analytics for:
- Page views and unique visitors
- Top pages and referrers
- Bandwidth usage

### Function Monitoring
- View invocation counts and errors
- Monitor execution time
- Set up alerts for failures

### Performance
- Use Netlify's built-in performance monitoring
- Enable Speed Insights
- Monitor Core Web Vitals

## 🔄 Updates & CI/CD

### Automatic Deployments
- Netlify automatically deploys on git push to main branch
- Set up deploy previews for pull requests
- Configure build hooks for external triggers

### Build Optimization
```bash
# Optimize build time
npm run build -- --profile
```

### Branch Deploys
- Production: main branch → production URL
- Staging: develop branch → deploy preview
- Feature branches → deploy previews

## 📋 Production Checklist

- [ ] Database connected and migrated
- [ ] All environment variables configured
- [ ] Stripe webhooks configured with correct URL
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificate active
- [ ] QR redirect function working
- [ ] Payment flow tested
- [ ] Analytics configured
- [ ] Error monitoring set up
- [ ] Backup strategy in place

## 🚀 Going Live

1. **Switch Stripe to live mode:**
   - Update API keys to live versions
   - Test payment flow with real cards
   - Monitor webhook deliveries

2. **Final testing:**
   - Create real QR codes
   - Test all user flows
   - Verify analytics tracking

3. **Marketing setup:**
   - Configure Google Analytics
   - Set up social media meta tags
   - Submit sitemap to search engines

## 📞 Support

### Netlify Support
- [Netlify Documentation](https://docs.netlify.com)
- [Netlify Community](https://community.netlify.com)
- Support ticket system for paid plans

### Common Resources
- [Next.js on Netlify](https://docs.netlify.com/frameworks/next-js/)
- [Netlify Functions](https://docs.netlify.com/functions/overview/)
- [Environment Variables](https://docs.netlify.com/environment-variables/overview/)

---

Your SmartQR.ai application is now ready for production on Netlify! 🎉