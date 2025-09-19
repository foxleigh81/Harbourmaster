# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Harbourmaster is a Node.js application that provides a friendly Unraid-like web UI for Docker container management without a paid license. It features a secure daemon (harbourmasterd) that talks to the local Docker socket and a React UI for container management.

### Core Features
- First-class, safe container management via a clean web UI
- No direct exposure of docker.sock to browsers or the network
- Friendly creation wizard for images, ports, volumes, env, healthchecks, restart policy
- Visual status, logs, metrics, exec and update checks by digest
- Optional app store with curated, form-driven installs of popular containers
- Human-editable app manifests

### Non-Goals
- Full NAS feature set (no array management, parity, ZFS pool UX in v1)
- Kubernetes (targets single-node or small homelab nodes with plain Docker)
- Multi-tenant RBAC and SSO in v1 (single-admin model initially)

## Development Commands

```bash
# Install dependencies (from root)
pnpm install

# Daemon development
cd apps/daemon
pnpm dev       # Development server with hot reload
pnpm build     # Production build
pnpm test      # Run tests

# UI development
cd apps/ui
pnpm dev       # Development server (Vite)
pnpm build     # Production build
pnpm preview   # Preview production build

# Docker operations (for testing)
docker ps -a                    # List all containers
docker logs <container-id>      # View container logs
docker stats                    # Monitor container resources
```

## Architecture

### System Architecture
- **Daemon**: Node.js service (harbourmasterd) connecting to `/var/run/docker.sock`
- **API**: RESTful HTTP/HTTPS API (configurable)
- **Frontend**: React UI (speaks only to daemon API, never to Docker directly)
- **Store Service**: Optional - static Git-backed manifests initially

### Process Model
- `harbourmasterd` - Node.js daemon (can run standalone, with PM2, or as systemd service)
- Optional reverse proxy (Caddy/Traefik/nginx) for TLS termination
- Optional store service for app manifests

### Security Model
- Daemon is the only process allowed to access Docker socket
- Daemon runs with minimal privileges (requires docker group membership)
- HTTPS with strong defaults (HTTP allowed for local development)
- Session cookies with SameSite=strict and CSRF protection
- Audit log of management actions in JSON Lines format
- Encrypted credential storage using libsodium

### Data Models
- `container-template` - Saved parameters for container creation
- `deployment` - Tracks container plus resolved image digest
- `registry-credential` - Encrypted credentials for registries
- `volume` - Named volumes and bind mounts
- `network` - User-defined networks and members
- `event` - Stream of Docker events
- `health` - Cached last health state and reason

## Directory Structure

```
harbourmaster/
  apps/
    daemon/                 # Node.js backend
      src/
        routes/          # API route handlers
        services/        # Business logic
        lib/
          docker/        # Docker API wrapper using dockerode
          security/      # Auth, encryption, validation
      bin/
        cli.ts          # CLI entry point
      package.json
    ui/                  # React frontend
      src/
        components/      # React components
        pages/          # Page components
        hooks/          # Custom React hooks
        api/            # API client
      package.json
  packages/              # Shared packages
    shared/              # Types, validators, utils
  docs/
    adrs/                # Architecture Decision Records
  package.json           # Workspace root
  pnpm-workspace.yaml    # pnpm workspace config
```

## Key Conventions

### Code Style
- **File naming**: Use kebab-case for all files and folders
- **Container naming**: Default to app slug with numeric suffix when needed
- **Volume naming**: Use `app-slug_data` pattern
- **TypeScript**: Prefer TypeScript for both daemon and UI
- **No comments**: Do not add comments unless specifically requested
- **Error handling**: Always validate inputs and provide friendly error messages

### API Conventions
- RESTful endpoints following standard patterns
- Use HTTP status codes appropriately
- Return JSON responses with consistent structure
- Stream logs and events using SSE or WebSockets
- Never expose Docker socket directly

### UI Conventions
- Use existing component patterns before creating new ones
- Maintain consistent visual hierarchy
- Show loading states for all async operations
- Display friendly error messages with recovery actions
- Use traffic light colors for health status

### Docker Integration
- Always use dockerode library, never shell out to docker CLI
- Pin exact digests during deployment
- Validate port bindings before container start
- Implement proper cleanup on container removal

## API Endpoints

### Phase 1 MVP Endpoints
```
# Health & Auth
GET    /api/health
POST   /api/login
POST   /api/logout

# Containers
GET    /api/containers?all=true
POST   /api/containers
GET    /api/containers/:id
POST   /api/containers/:id/start
POST   /api/containers/:id/stop
POST   /api/containers/:id/restart
DELETE /api/containers/:id
GET    /api/containers/:id/logs?since=...&follow=true
WS     /api/containers/:id/exec
GET    /api/containers/:id/stats

# Images
GET    /api/images
POST   /api/images/pull
DELETE /api/images/:name

# System
GET    /api/events  (Server-Sent Events)
GET    /api/templates
POST   /api/templates

# Store (Phase 2)
GET    /api/store/index
GET    /api/store/manifests/:slug
```

## Testing Strategy

```bash
# Unit tests
pnpm test

# Integration tests (requires Docker)
pnpm test:integration

# E2E tests (requires full stack running)
pnpm test:e2e
```

## Development Workflow

1. **Local Development**
   - Ensure Docker daemon is running
   - Run daemon in dev mode: `cd apps/daemon && pnpm dev`
   - Run UI dev server: `cd apps/ui && pnpm dev`
   - Access UI at http://localhost:5173

2. **Testing Changes**
   - Test container operations against local Docker
   - Verify UI updates reflect Docker state
   - Check error handling for edge cases

3. **Before Committing**
   - Run linters: `pnpm lint`
   - Run tests: `pnpm test`
   - Verify no secrets in code

## Important Implementation Notes

### Docker Socket Access
- NEVER expose docker.sock to the browser
- All Docker operations go through the daemon API
- Use dockerode library for all Docker interactions

### Update Strategy
- Always pin exact image digests when deploying
- Compare current digest with upstream tag digest for updates
- Provide safe rollback on failed updates

### Error Handling
- Validate all user inputs
- Check host paths exist before bind mounting
- Detect port collisions before starting containers
- Show friendly errors with actionable messages

### Security Considerations
- Never log credentials or secrets
- Mask sensitive data in UI
- Warn loudly for privileged containers
- Require explicit confirmation for dangerous operations

## Phase Implementation

### Current Phase: Phase 1 MVP
- Manual container management only (no store)
- Core CRUD operations for containers
- Logs, exec, stats streaming
- Update detection by digest
- Template creation from running containers

### Next: Phase 2 App Store
- YAML manifest schema v1
- Static index.json with app catalog
- Form-driven app installation
- Version tracking and updates

### Future: Phase 3 Decentralized Store
- P2P distribution options (IPFS, BitTorrent, Nostr)
- Signed manifests with publisher keys
- Trust verification on client

## Configuration

Harbourmaster can be configured via environment variables or config file:

```bash
# Environment variables
PORT=3000
HOST=0.0.0.0
DOCKER_SOCKET=/var/run/docker.sock
DATA_DIR=~/.harbourmaster/data
LOG_LEVEL=info
ENABLE_TLS=false
```

Or via `~/.harbourmaster/config.json`:

```json
{
  "port": 3000,
  "host": "0.0.0.0",
  "dockerSocket": "/var/run/docker.sock",
  "dataDir": "~/.harbourmaster/data",
  "logLevel": "info",
  "tls": {
    "enabled": false
  }
}
```

## Debugging Tips

```bash
# Check Docker socket permissions
ls -la /var/run/docker.sock

# Test Docker connection
curl --unix-socket /var/run/docker.sock http://localhost/version

# View daemon logs (if using systemd)
journalctl -u harbourmasterd -f

# Check container events
docker events --format '{{json .}}'

# Test daemon API
curl http://localhost:3000/api/health
```