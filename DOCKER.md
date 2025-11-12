# Docker Deployment Guide

This guide explains how to build and run the Multitrack Player App using Docker.

## 🚀 CI/CD Pipeline

This project includes GitHub Actions workflows that automatically build and push Docker images to container registries. See [.github/workflows/README.md](.github/workflows/README.md) for detailed setup instructions.

**Supported Registries:**
- ✅ **Harbor** (Recommended for Production) - `docker-harbor.yml`
- ✅ **GitHub Container Registry** - `docker.yml` (no setup required)
- ✅ **Docker Hub** - `docker-dockerhub.yml`

**Quick Start:**
- Push to `main`/`master` branch → Image automatically built and pushed
- Create a version tag (e.g., `v1.0.0`) → Versioned image created
- Harbor setup: Add `HARBOR_USERNAME` and `HARBOR_PASSWORD` secrets (see workflow README)

## Prerequisites

- Docker installed (version 20.10 or later)
- Docker Compose installed (version 2.0 or later)
- At least 2GB of free disk space

## Quick Start

### Using Docker Compose (Recommended)

1. **Build and start the container:**
   ```bash
   docker-compose up -d
   ```

2. **Access the app:**
   Open your browser and navigate to `http://localhost:3000`

3. **View logs:**
   ```bash
   docker-compose logs -f
   ```

4. **Stop the container:**
   ```bash
   docker-compose down
   ```

### Using Docker directly

1. **Build the image:**
   ```bash
   docker build -t multitrack-player-app .
   ```

2. **Run the container:**
   ```bash
   docker run -d -p 3000:80 --name multitrack-player-web multitrack-player-app
   ```

3. **Access the app:**
   Open your browser and navigate to `http://localhost:3000`

4. **Stop the container:**
   ```bash
   docker stop multitrack-player-web
   docker rm multitrack-player-web
   ```

## Building for Production

The Docker setup uses a multi-stage build process:

1. **Builder stage:** Installs dependencies and builds the web app
2. **Production stage:** Uses nginx to serve the static files

### Build Options

**Build with Docker Compose:**
```bash
docker-compose build
```

**Build with Docker:**
```bash
docker build -t multitrack-player-app .
```

**Build without cache (clean build):**
```bash
docker build --no-cache -t multitrack-player-app .
```

## Configuration

### Port Configuration

By default, the app runs on port 3000. To change the port, edit `docker-compose.yml`:

```yaml
ports:
  - "YOUR_PORT:80"
```

### Environment Variables

You can add environment variables in `docker-compose.yml`:

```yaml
environment:
  - NODE_ENV=production
  - YOUR_VAR=value
```

Note: Firebase configuration should be handled through the built app's configuration, not Docker environment variables.

## Health Check

The container includes a health check endpoint at `/health`. You can verify the container is healthy:

```bash
curl http://localhost:3000/health
```

Or check the container status:

```bash
docker ps
```

## Troubleshooting

### Container won't start

1. **Check logs:**
   ```bash
   docker-compose logs
   ```

2. **Verify port is available:**
   ```bash
   lsof -i :3000  # macOS/Linux
   netstat -ano | findstr :3000  # Windows
   ```

3. **Rebuild the image:**
   ```bash
   docker-compose build --no-cache
   docker-compose up -d
   ```

### Build fails

1. **Check disk space:**
   ```bash
   df -h
   ```

2. **Clear Docker cache:**
   ```bash
   docker system prune -a
   ```

3. **Verify Node.js version compatibility:**
   The Dockerfile uses Node.js 20. Ensure your local Node.js version is compatible.

### App not loading

1. **Check if the build completed successfully:**
   Look for the `dist` directory in the builder stage logs

2. **Verify nginx is running:**
   ```bash
   docker exec multitrack-player-web nginx -t
   ```

3. **Check nginx logs:**
   ```bash
   docker exec multitrack-player-web cat /var/log/nginx/error.log
   ```

## Production Deployment

### Using Docker Hub

1. **Tag the image:**
   ```bash
   docker tag multitrack-player-app your-username/multitrack-player-app:latest
   ```

2. **Push to Docker Hub:**
   ```bash
   docker push your-username/multitrack-player-app:latest
   ```

3. **Pull and run on production server:**
   ```bash
   docker pull your-username/multitrack-player-app:latest
   docker run -d -p 3000:80 your-username/multitrack-player-app:latest
   ```

### Using a Private Registry

1. **Tag for your registry:**
   ```bash
   docker tag multitrack-player-app registry.example.com/multitrack-player-app:latest
   ```

2. **Push to registry:**
   ```bash
   docker push registry.example.com/multitrack-player-app:latest
   ```

### Using Docker Compose in Production

1. **Copy docker-compose.yml to production server**

2. **Start the service:**
   ```bash
   docker-compose up -d
   ```

3. **Set up reverse proxy (optional):**
   Use nginx or another reverse proxy in front of the Docker container for SSL/TLS termination.

## Security Considerations

1. **Don't commit sensitive files:**
   - `serviceAccountKey.json` is already in `.dockerignore`
   - Never commit API keys or secrets

2. **Use environment variables for secrets:**
   For production, use Docker secrets or environment variable files

3. **Keep images updated:**
   Regularly update the base images (Node.js, nginx) for security patches

4. **Use HTTPS in production:**
   Set up SSL/TLS certificates using a reverse proxy or load balancer

## Performance Optimization

1. **Use multi-stage builds:** Already implemented in the Dockerfile

2. **Enable gzip compression:** Already configured in nginx.conf

3. **Cache static assets:** Already configured with long cache headers

4. **Use a CDN:** Consider using a CDN for static assets in production

## Maintenance

### Update the app

1. **Pull latest code:**
   ```bash
   git pull
   ```

2. **Rebuild and restart:**
   ```bash
   docker-compose up -d --build
   ```

### View container stats

```bash
docker stats multitrack-player-web
```

### Access container shell

```bash
docker exec -it multitrack-player-web sh
```

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Nginx Documentation](https://nginx.org/en/docs/)

