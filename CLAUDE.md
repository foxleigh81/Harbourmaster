# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Harbourmaster OS is a Debian-based, self-hosted operating system that provides a friendly Unraid-like UI for Docker container management without a paid license. The system ships with Docker Engine, a Node.js manager daemon that talks to the local Docker socket, and a React UI.

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
# API Server (Node.js)
cd apps/api
npm install
npm run dev       # Development server with hot reload
npm run build     # Production build
npm run lint      # Run ESLint
npm run test      # Run tests

# UI (React)
cd apps/ui
npm install
npm run dev       # Development server (Vite)
npm run build     # Production build
npm run lint      # Run ESLint
npm run preview   # Preview production build

# Docker operations (for testing)
docker ps -a                    # List all containers
docker logs <container-id>      # View container logs
docker stats                    # Monitor container resources
```

## Architecture

### System Architecture
- **Base OS**: Debian minimal base
- **Container Runtime**: Docker Engine (rootless or standard)
- **Manager Service**: Node.js daemon connecting to `/var/run/docker.sock`
- **Reverse Proxy**: Caddy or Traefik for TLS and auth
- **Frontend**: React UI (speaks only to Manager API, never to Docker directly)
- **Store Service**: Optional - static Git-backed manifests initially

### Process Model
- `docker.service` - systemd unit for Docker
- `docker-manager.service` - Node daemon
- `caddy.service` or `traefik.service` - TLS termination
- `docker-manager-store.service` - Optional private store

### Security Model
- Manager is the only process allowed to access Docker socket
- Manager runs as non-root service account
- HTTPS with strong defaults (HTTP disabled unless explicitly toggled)
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
    api/                 # Node.js backend
      src/
        routes/          # API route handlers
        services/        # Business logic
        lib/
          docker/        # Docker API wrapper using dockerode
          security/      # Auth, encryption, validation
      package.json
    ui/                  # React frontend
      src/
        components/      # React components
        pages/          # Page components
        hooks/          # Custom React hooks
        api/            # API client
      package.json
  packaging/
    deb/                # Debian package files
    iso/                # ISO build scripts
    images/             # VM images (qcow2, ova)
  docs/
    adr/                # Architecture Decision Records
  Caddyfile             # Reverse proxy config
  .env.example          # Environment variables template
```

## Key Conventions

### Code Style
- **File naming**: Use kebab-case for all files and folders
- **Container naming**: Default to app slug with numeric suffix when needed
- **Volume naming**: Use `app-slug_data` pattern
- **TypeScript**: Prefer TypeScript for both API and UI
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
npm run test

# Integration tests (requires Docker)
npm run test:integration

# E2E tests (requires full stack running)
npm run test:e2e
```

## Development Workflow

1. **Local Development**
   - Start Docker daemon
   - Run API server in dev mode
   - Run UI dev server
   - Access UI at http://localhost:5173

2. **Testing Changes**
   - Test container operations against local Docker
   - Verify UI updates reflect Docker state
   - Check error handling for edge cases

3. **Before Committing**
   - Run linters: `npm run lint`
   - Run tests: `npm run test`
   - Verify no secrets in code

## Important Implementation Notes

### Docker Socket Access
- NEVER expose docker.sock to the browser
- All Docker operations go through the Manager API
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

## Debugging Tips

```bash
# Check Docker socket permissions
ls -la /var/run/docker.sock

# Test Docker connection
curl --unix-socket /var/run/docker.sock http://localhost/version

# View manager service logs
journalctl -u docker-manager -f

# Check container events
docker events --format '{{json .}}'
```