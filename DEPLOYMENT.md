# SmartQR.ai Deployment Guide

## 🚀 Vercel Deployment (Recommended)

### Prerequisites
1. Vercel account connected to GitHub
2. PostgreSQL database (Supabase, PlanetScale, or Neon recommended)
3. Stripe account with API keys

### Step 1: Database Setup

#### Option A: Supabase (Recommended)
1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Go to Settings > Database
4. Copy the connection string (Direct connection, not pooler)
5. Format: `postgresql://postgres:[password]@[host]:5432/postgres`

#### Option B: PlanetScale
1. Go to [planetscale.com](https://planetscale.com)
2. Create new database
3. Create production branch
4. Get connection string

### Step 2: Stripe Setup
1. Go to [stripe.com](https://stripe.com)
2. Get your API keys:
   - Publishable key (starts with `pk_`)
   - Secret key (starts with `sk_`)
3. Create webhook endpoint:
   - URL: `https://your-domain.vercel.app/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
4. Copy webhook secret (starts with `whsec_`)

### Step 3: Deploy to Vercel

#### Method 1: GitHub Integration (Recommended)
1. Push code to GitHub repository
2. Go to [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your GitHub repository
5. Configure environment variables (see below)
6. Deploy!

#### Method 2: Vercel CLI
```bash
npm i -g vercel
vercel login
vercel --prod
```

### Step 4: Environment Variables

In Vercel Dashboard > Settings > Environment Variables, add:

#### Required Variables
```
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=your-32-character-random-string
NEXTAUTH_URL=https://your-domain.vercel.app
NEXT_PUBLIC_BASE_URL=https://your-domain.vercel.app
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

#### Optional Variables
```
OPENAI_API_KEY=sk-...
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

### Step 5: Database Migration
After deployment, run migrations:

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Link your project
vercel link

# Run database migration
vercel env pull .env.local
npx prisma migrate deploy
```

### Step 6: Test Your Deployment
1. Visit your Vercel URL
2. Create a test account
3. Create a QR code
4. Test QR scanning
5. Test Stripe payment flow (use test cards)

## 🔧 Custom Deployment

### Docker Deployment
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

### Traditional VPS Deployment
1. Set up Node.js 18+ on your server
2. Clone repository
3. Install dependencies: `npm ci`
4. Set environment variables
5. Run migrations: `npx prisma migrate deploy`
6. Build: `npm run build`
7. Start with PM2: `pm2 start npm --name "smartqr" -- start`

## 🏗 Post-Deployment Checklist

### DNS & Domain
- [ ] Configure custom domain in Vercel
- [ ] Update `NEXTAUTH_URL` and `NEXT_PUBLIC_BASE_URL`
- [ ] Update Stripe webhook URL

### Security
- [ ] Enable Vercel password protection (if needed)
- [ ] Set up monitoring (Sentry, LogRocket, etc.)
- [ ] Configure CSP headers
- [ ] Test all API endpoints

### Performance
- [ ] Enable Vercel Analytics
- [ ] Test page load speeds
- [ ] Verify database query performance
- [ ] Set up uptime monitoring

### Stripe Configuration
- [ ] Switch to live mode
- [ ] Update webhook endpoint URL
- [ ] Test payment flows
- [ ] Set up billing alerts

## 🐛 Troubleshooting

### Common Issues

#### Database Connection Errors
```bash
# Test database connection
npx prisma db pull
```

If this fails:
- Check DATABASE_URL format
- Verify database server is accessible
- Check firewall settings

#### Build Failures
```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

#### Stripe Webhook Issues
- Verify webhook URL is accessible
- Check webhook secret matches
- Test with Stripe CLI: `stripe listen --forward-to your-domain.com/api/stripe/webhook`

#### Environment Variable Issues
```bash
# Check all env vars are set
vercel env ls
```

### Performance Issues
- Enable Edge Runtime for API routes
- Use Vercel Edge Functions for QR redirects
- Implement Redis caching for analytics

## 📊 Monitoring & Analytics

### Recommended Tools
- **Uptime**: Vercel Analytics, Uptime Robot
- **Errors**: Sentry, Bugsnag
- **Performance**: Vercel Speed Insights
- **User Analytics**: Google Analytics, Mixpanel

### Health Check Endpoint
Create `/api/health` endpoint:
```typescript
export async function GET() {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'healthy' });
  } catch (error) {
    return NextResponse.json({ status: 'unhealthy' }, { status: 500 });
  }
}
```

## 🔄 Updates & Maintenance

### Updating Dependencies
```bash
npm update
npm audit fix
```

### Database Migrations
```bash
# Create migration
npx prisma migrate dev --name description

# Deploy to production
vercel env pull .env.local
npx prisma migrate deploy
```

### Backup Strategy
- Database: Set up automated backups with your provider
- Code: Use GitHub with proper branching strategy
- Environment: Document all environment variables

---

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review Vercel deployment logs
3. Check database logs
4. Create an issue in the repository

Good luck with your deployment! 🚀