# Troubleshooting Harbor Workflow Failures

## Common Issues and Solutions

### 1. ❌ Missing Secrets Error

**Error Message:**
```
Error: HARBOR_USERNAME secret is not set
```

**Solution:**
1. Go to your GitHub repository
2. Navigate to: **Settings → Secrets and variables → Actions**
3. Click **"New repository secret"**
4. Add:
   - Name: `HARBOR_USERNAME`
   - Value: Your Harbor username
5. Repeat for `HARBOR_PASSWORD`

### 2. ❌ Authentication Failed

**Error Message:**
```
Error response from daemon: Get "https://harbor.guiadodevops.com/v2/": unauthorized
```

**Possible Causes:**
- Incorrect username or password
- Account doesn't have push permissions to the `core` project
- Password/token expired

**Solutions:**
1. **Verify credentials:**
   ```bash
   docker login harbor.guiadodevops.com -u YOUR_USERNAME -p YOUR_PASSWORD
   ```
   If this fails locally, the credentials are incorrect.

2. **Check Harbor permissions:**
   - Log in to Harbor UI: https://harbor.guiadodevops.com/
   - Go to Projects → `core` project
   - Verify your user has "Developer" or "Maintainer" role
   - If not, ask your Harbor administrator to grant permissions

3. **Use Harbor Access Token (Recommended):**
   - In Harbor UI: Go to your profile → User Profile → Access Tokens
   - Create a new token with push permissions
   - Use the token as `HARBOR_PASSWORD` instead of your password

### 3. ❌ Certificate/SSL Issues

**Error Message:**
```
x509: certificate signed by unknown authority
```

**Solution:**
If Harbor uses a self-signed certificate, you may need to configure Docker to trust it. However, for GitHub Actions, this is usually handled automatically. If issues persist:

1. Contact your Harbor administrator to verify the certificate
2. Check if Harbor requires HTTPS (most do)

### 4. ❌ Build Failures

**Error Message:**
```
Error: failed to solve: ...
```

**Possible Causes:**
- Dockerfile issues
- Missing dependencies
- Network issues during build

**Solutions:**
1. **Test build locally:**
   ```bash
   docker build -t test-image .
   ```
   If this fails locally, fix the Dockerfile first.

2. **Check Dockerfile exists:**
   Ensure `Dockerfile` is in the repository root.

3. **Check .dockerignore:**
   Verify important files aren't being excluded.

### 5. ❌ Push Permission Denied

**Error Message:**
```
denied: requested access to the resource is denied
```

**Solution:**
- Your Harbor user doesn't have push permissions to the `core` project
- Contact Harbor administrator to grant "Developer" or "Maintainer" role

### 6. ❌ Registry Not Found

**Error Message:**
```
Error response from daemon: Get "https://harbor.guiadodevops.com/v2/": dial tcp: lookup harbor.guiadodevops.com
```

**Solution:**
- Verify the Harbor URL is correct
- Check if Harbor is accessible from GitHub Actions runners
- Some Harbor instances might be behind a firewall/VPN

## Debugging Steps

### Step 1: Check Workflow Logs
1. Go to GitHub → Actions tab
2. Click on the failed workflow run
3. Expand each step to see detailed error messages
4. Look for the specific step that failed

### Step 2: Test Locally
```bash
# Test Docker build
docker build -t test-image .

# Test Harbor login
docker login harbor.guiadodevops.com -u YOUR_USERNAME -p YOUR_PASSWORD

# Test push (if login works)
docker tag test-image harbor.guiadodevops.com/core/multitrack-player-app:test
docker push harbor.guiadodevops.com/core/multitrack-player-app:test
```

### Step 3: Verify Secrets
1. Go to: Repository → Settings → Secrets and variables → Actions
2. Verify both `HARBOR_USERNAME` and `HARBOR_PASSWORD` exist
3. Check that values are correct (no extra spaces, correct case)

### Step 4: Check Harbor UI
1. Log in to: https://harbor.guiadodevops.com/
2. Navigate to: Projects → `core`
3. Check if repository `multitrack-player-app` exists or will be created
4. Verify your user has appropriate permissions

## Getting Help

If you've tried all the above and still have issues:

1. **Check the specific error message** in the workflow logs
2. **Share the error** with your team/Harbor administrator
3. **Include:**
   - The exact error message
   - Which step failed
   - Harbor version (if known)
   - Whether local Docker commands work

## Workflow Status Check

After fixing issues, you can:

1. **Re-run the workflow:**
   - Go to Actions → Select the workflow run
   - Click "Re-run all jobs"

2. **Or trigger manually:**
   - Go to Actions → Select `docker-harbor.yml`
   - Click "Run workflow"
   - Select branch and optional tag
   - Click "Run workflow"

## Success Indicators

When the workflow succeeds, you should see:
- ✅ All steps completed successfully
- ✅ Image pushed to Harbor
- ✅ Summary showing image details and pull command

You can verify in Harbor UI:
- Go to: https://harbor.guiadodevops.com/harbor/projects/core/repositories/multitrack-player-app
- You should see your image with the appropriate tags


