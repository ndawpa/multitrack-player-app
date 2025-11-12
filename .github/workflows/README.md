# GitHub Actions Workflows

This directory contains CI/CD workflows for the Multitrack Player App.

## Available Workflows

### 1. `build.yml` - Code Quality Analysis
- Runs SonarQube analysis on code changes
- Triggers on pushes and pull requests

### 2. `docker.yml` - Build and Push to GitHub Container Registry (Default)
- Builds Docker image and pushes to GitHub Container Registry (ghcr.io)
- **No additional secrets required** - uses `GITHUB_TOKEN` automatically
- Triggers on:
  - Pushes to `main`/`master` branch
  - Version tags (e.g., `v1.0.0`)
  - Manual workflow dispatch

### 3. `docker-dockerhub.yml` - Build and Push to Docker Hub
- Alternative workflow for Docker Hub
- Requires Docker Hub credentials in secrets
- Same triggers as `docker.yml`

## Setup Instructions

### Option 1: GitHub Container Registry (Recommended - No Setup Required)

The `docker.yml` workflow is ready to use out of the box. It uses GitHub Container Registry which:
- ✅ No additional setup required
- ✅ Uses built-in `GITHUB_TOKEN`
- ✅ Free for public repositories
- ✅ Integrated with GitHub

**To use:**
1. The workflow is already configured
2. Push to `main`/`master` branch or create a version tag
3. Image will be available at: `ghcr.io/YOUR_USERNAME/multitrack-player-app:latest`

**To make the package public:**
1. Go to your repository on GitHub
2. Click on "Packages" (right sidebar)
3. Click on the package
4. Go to "Package settings"
5. Change visibility to "Public"

### Option 2: Docker Hub

**Setup steps:**

1. **Create Docker Hub account** (if you don't have one)
   - Go to https://hub.docker.com
   - Sign up for a free account

2. **Create Access Token**
   - Go to Docker Hub → Account Settings → Security
   - Click "New Access Token"
   - Give it a name (e.g., "github-actions")
   - Copy the token (you won't see it again!)

3. **Add GitHub Secrets**
   - Go to your GitHub repository
   - Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Add two secrets:
     - `DOCKER_USERNAME`: Your Docker Hub username
     - `DOCKER_PASSWORD`: The access token you created

4. **Enable the workflow**
   - The `docker-dockerhub.yml` workflow will automatically use these secrets
   - Or rename `docker-dockerhub.yml` to `docker.yml` to replace the default

**Image will be available at:**
`docker.io/YOUR_USERNAME/multitrack-player-app:latest`

## Workflow Features

### Automatic Tagging
Images are automatically tagged based on:
- **Branch name**: `main`, `master`, etc.
- **Version tags**: `v1.0.0` → `1.0.0`, `1.0`, `1`
- **Commit SHA**: `main-abc1234`
- **Latest**: Always tags `latest` on default branch

### Multi-platform Support
Builds for both:
- `linux/amd64` (Intel/AMD processors)
- `linux/arm64` (Apple Silicon, ARM servers)

### Build Caching
Uses GitHub Actions cache to speed up builds:
- Docker layer caching
- Faster subsequent builds

### Security
- Uses official Docker actions
- Supports artifact attestation (SBOM)
- No hardcoded credentials

## Manual Workflow Dispatch

You can manually trigger the workflow:

1. Go to Actions tab in GitHub
2. Select the workflow
3. Click "Run workflow"
4. Optionally specify a custom tag
5. Click "Run workflow"

## Pulling the Image

### From GitHub Container Registry:
```bash
# Login (first time only)
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Pull the image
docker pull ghcr.io/YOUR_USERNAME/multitrack-player-app:latest

# Run the container
docker run -d -p 3000:80 ghcr.io/YOUR_USERNAME/multitrack-player-app:latest
```

### From Docker Hub:
```bash
# Pull the image
docker pull YOUR_USERNAME/multitrack-player-app:latest

# Run the container
docker run -d -p 3000:80 YOUR_USERNAME/multitrack-player-app:latest
```

## Version Tagging

To create a versioned release:

```bash
# Create and push a version tag
git tag v1.0.0
git push origin v1.0.0
```

This will automatically:
- Build the Docker image
- Tag it as `1.0.0`, `1.0`, and `1`
- Push to the registry

## Troubleshooting

### Workflow fails with "permission denied"
- For GitHub Container Registry: Ensure the workflow has `packages: write` permission (already set)
- For Docker Hub: Check that `DOCKER_USERNAME` and `DOCKER_PASSWORD` secrets are correct

### Image not found after push
- **GitHub Container Registry**: Make sure the package visibility is set to public (if needed)
- **Docker Hub**: Verify the image name matches your Docker Hub username

### Build takes too long
- First build is slower (no cache)
- Subsequent builds use cache and are faster
- Multi-platform builds take longer (consider building for single platform if needed)

### Authentication errors
- **GitHub Container Registry**: Uses `GITHUB_TOKEN` automatically - no action needed
- **Docker Hub**: Verify your access token hasn't expired and secrets are correctly set

## Customization

### Change Image Name
Edit the workflow file and update:
```yaml
IMAGE_NAME: your-custom-name
```

### Build for Single Platform
Remove or modify the `platforms` line:
```yaml
platforms: linux/amd64  # Single platform only
```

### Add Additional Tags
Modify the `tags` section in the metadata action to add custom tags.

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Buildx](https://docs.docker.com/buildx/)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Docker Hub](https://docs.docker.com/docker-hub/)

