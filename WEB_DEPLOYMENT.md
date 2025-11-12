# Web Deployment Guide

This guide explains how to deploy your Multitrack Player App to production on the web.

## Prerequisites

- Node.js and npm installed
- All dependencies installed (`npm install`)
- Firebase project configured (for authentication and database)

## Building for Production

### Step 1: Build the Static Web Bundle

Run the following command to create a production-ready static web build:

```bash
npm run build:web
```

This will:
- Create an optimized production build
- Generate static HTML, CSS, and JavaScript files
- Output everything to the `dist/` directory

### Step 2: Test the Build Locally (Optional)

Before deploying, you can test the production build locally:

```bash
# Install a simple HTTP server (if not already installed)
npm install -g serve

# Serve the dist directory
serve dist
```

Then open `http://localhost:3000` in your browser to test.

## Deployment Options

### Option 1: Firebase Hosting (Recommended)

Since you're already using Firebase, this is the easiest option:

1. **Install Firebase CLI** (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

3. **Initialize Firebase Hosting** (if not already done):
   ```bash
   firebase init hosting
   ```
   - Select your Firebase project
   - Set public directory to: `dist`
   - Configure as single-page app: `Yes`
   - Set up automatic builds: `No` (or `Yes` if you want CI/CD)

4. **Deploy**:
   ```bash
   npm run build:web
   firebase deploy --only hosting
   ```

5. **Your app will be live at**: `https://YOUR-PROJECT-ID.web.app`

### Option 2: Netlify

1. **Install Netlify CLI**:
   ```bash
   npm install -g netlify-cli
   ```

2. **Build and deploy**:
   ```bash
   npm run build:web
   netlify deploy --prod --dir=dist
   ```

   Or connect your GitHub repository to Netlify for automatic deployments.

3. **Create `netlify.toml`** in project root (optional):
   ```toml
   [build]
     command = "npm run build:web"
     publish = "dist"

   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200
   ```

### Option 3: Vercel

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Deploy**:
   ```bash
   npm run build:web
   vercel --prod
   ```

   Or connect your GitHub repository to Vercel for automatic deployments.

3. **Create `vercel.json`** in project root (optional):
   ```json
   {
     "buildCommand": "npm run build:web",
     "outputDirectory": "dist",
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```

### Option 4: GitHub Pages

1. **Build the app**:
   ```bash
   npm run build:web
   ```

2. **Install gh-pages**:
   ```bash
   npm install --save-dev gh-pages
   ```

3. **Add to package.json scripts**:
   ```json
   "deploy:gh-pages": "npm run build:web && gh-pages -d dist"
   ```

4. **Deploy**:
   ```bash
   npm run deploy:gh-pages
   ```

5. **Enable GitHub Pages** in your repository settings:
   - Go to Settings > Pages
   - Select source: `gh-pages` branch
   - Your app will be at: `https://USERNAME.github.io/REPO-NAME`

### Option 5: Traditional Web Server (Apache/Nginx)

1. **Build the app**:
   ```bash
   npm run build:web
   ```

2. **Upload the `dist` directory** to your web server

3. **Configure your web server** to serve `index.html` for all routes (SPA routing)

   **For Nginx**, add to your config:
   ```nginx
   location / {
     try_files $uri $uri/ /index.html;
   }
   ```

   **For Apache**, create `.htaccess` in `dist`:
   ```apache
   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteBase /
     RewriteRule ^index\.html$ - [L]
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule . /index.html [L]
   </IfModule>
   ```

## Environment Variables

If you need different Firebase configurations for production, you can:

1. Use environment variables (if supported by your hosting platform)
2. Update `src/config/firebase.ts` to use production Firebase config
3. Use build-time environment variables

## Continuous Deployment (CI/CD)

### GitHub Actions Example

Create `.github/workflows/deploy-web.yml`:

```yaml
name: Deploy Web

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build:web
      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          projectId: your-project-id
          channelId: live
```

## Troubleshooting

### Build Errors

- Make sure all dependencies are installed: `npm install`
- Clear cache: `npx expo export:web --clear`
- Check for TypeScript errors: `npx tsc --noEmit`

### Routing Issues

- Ensure your hosting platform is configured for SPA routing (all routes serve `index.html`)
- Check that `app.json` has `"output": "static"` in web config

### Firebase Issues

- Verify Firebase configuration is correct for production
- Check Firebase Security Rules for your database and storage
- Ensure Firebase Hosting is properly configured if using it

## Notes

- The `dist` directory is gitignored by default (check your `.gitignore`)
- Always test your production build locally before deploying
- Consider setting up a staging environment for testing
- Monitor your Firebase usage to avoid unexpected costs

