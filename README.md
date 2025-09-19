# Harbourmaster OS

## Summary

Goal: build a Debian-based, self-hosted OS that provides a friendly Unraid-like UI for Docker container management without a paid licence. The system ships with Docker Engine, a Node.js manager daemon that talks to the local Docker socket, and a React UI. Optional app store enables curated, form-driven installs of popular containers. Future work explores a peer-to-peer store to avoid central hosting costs.

## Objectives

- First-class, safe container management via a clean web UI.
- No direct exposure of docker.sock to browsers or the network.
- Friendly creation wizard for images, ports, volumes, env, healthchecks, restart policy.
- Visual status, logs, metrics, exec and update checks by digest.
- Human-editable app manifests and a store that can be centralised initially and decentralised later.
- Install paths that feel like an OS but are just Debian plus packages and sane defaults.

## Non-goals

- Full NAS feature set. No array management, parity, ZFS pool UX in v1.
- Kubernetes. This targets single-node or small homelab nodes with plain Docker.
- Multi-tenant RBAC and SSO in v1. Keep a single-admin model initially.

## High-level architecture

- Debian minimal base
- Docker Engine (rootless or standard)
- Node.js Manager Service
    - Connects to `/var/run/docker.sock`
    - Exposes HTTPS API to the UI only on localhost by default
- Reverse proxy for TLS and auth
    - Caddy or Traefik
- React UI
    - Speaks to Manager API. Never talks to Docker directly.
- Optional Store service
    - Starts as static Git-backed manifests and an index.json
    - Later P2P distribution with signed manifests

### Process model

- `docker.service` systemd unit
- `docker-manager.service` Node daemon
- `caddy.service` or `traefik.service` for TLS
- Optional `docker-manager-store.service` if hosting a private store

## Security model

- The manager is the only process allowed to access the Docker socket.
- The manager runs as a non-root service account. Prefer rootless Docker if feasible.
- HTTPS with strong defaults. HTTP disabled unless explicitly toggled.
- Session cookies with SameSite=strict and CSRF tokens or double-submit cookie.
- Optional 2FA for admin user in v1.1.
- Audit log of management actions stored locally in JSON Lines for simplicity.
- Future: Docker Authorisation plugin or OPA-style policy if multi-user is added.

## Networking

- Default bridge network for simple cases.
- Optional host network for advanced containers.
- Custom user-defined bridge networks exposed in the UI.
- Port collision detection against live container port maps before starting containers.

## Data model overview

- `container-template`Saved parameters for container creation, generated either from a running container or from a store manifest.
- `deployment`Tracks a container plus the resolved image digest at the time of deployment.
- `registry-credential`Encrypted credentials for registries. Supports Docker Hub, GHCR, GitLab Registry and self-hosted.
- `volume`Named volumes and bind mounts with host paths.
- `network`User-defined networks and their members.
- `event`Stream of Docker events mirrored into the manager for the UI.
- `health`Cached last health state and reason.

## Installation options

### Option A. Debian installer plus packages

- Provide an apt repository with these packages:
    - `docker-manager` Node daemon
    - `docker-manager-ui` static assets
    - `docker-manager-firstboot` wizard
    - Dependencies: Docker Engine, Caddy or Traefik
- Users install Debian, add repo, then `apt install docker-manager`.
- Lowest maintenance and easiest upgrades.

### Option B. Branded live ISO

- Use `live-build` to create an ISO that boots into the installer with the packages preselected.
- Gives the feel of a dedicated OS while still being Debian underneath.

### Option C. Cloud images

- Pre-baked `qcow2` and `ova` images for Proxmox, ESXi and VirtualBox.
- Ideal for homelab users spinning up VMs quickly.

## First boot flow

1. Detect GPU, CPU flags and available disks.
2. Ask for hostname, timezone and admin password.
3. Offer to set up Tailscale or WireGuard for remote admin.
4. Choose app data root, default `/srv/appdata`.
5. Generate TLS via local CA or ACME if DNS is routable.
6. Create admin user and log in to UI.

## Phase plan

### Phase 1 MVP

**Scope**

- Manual container management only. No store.
- UI for create, list, start, stop, restart, remove, logs, exec.
- Update detection by comparing current image digest with remote tag digest.
- Icons can be set per container manually.

**API surface**

- `GET /api/containers?all=true`
- `POST /api/containers` create
- `POST /api/containers/:id/start`
- `POST /api/containers/:id/stop`
- `POST /api/containers/:id/restart`
- `DELETE /api/containers/:id`
- `GET /api/containers/:id/logs?since=...&follow=true`
- WebSocket `ws://.../api/containers/:id/exec` for interactive shells
- `GET /api/images`
- `POST /api/images/pull`
- `GET /api/events` server-sent events to reflect Docker events
- `GET /api/stats` per-container CPU, RAM, Net I O
- `POST /api/templates` to save a running container as a template

**dockerode usage examples**

```jsx
import Docker from 'dockerode';
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// list containersconst containers = await docker.listContainers({ all: true });

// create and startconst c = await docker.createContainer({
  Image: 'nginx:alpine',
  name: 'my-nginx',
  HostConfig: { PortBindings: { '80/tcp': [{ HostPort: '8080' }] } },
  ExposedPorts: { '80/tcp': {} },
  Env: ['TZ=Europe/London']
});
await c.start();

// logsconst stream = await c.logs({ follow: true, stdout: true, stderr: true, tail: 200 });

// execconst exec = await c.exec({ Cmd: ['/bin/sh'], AttachStdin: true, AttachStdout: true, AttachStderr: true, Tty: true });
const ws = await exec.start({ hijack: true, Tty: true });// bridge to browser WebSocket// pull with progressawait new Promise((resolve, reject) => {
  docker.pull('nginx:alpine', (err, s) => {
    if (err) return reject(err);
    docker.modem.followProgress(s, resolve, e => {
// emit progress to UI
    });
  });
});

```

**Systemd units**

`/etc/systemd/system/docker-manager.service`

```
[Unit]
Description=Docker Manager
After=docker.service
Requires=docker.service

[Service]
User=manager
Group=manager
Environment=NODE_ENV=production
ExecStart=/usr/local/bin/docker-manager
Restart=on-failure

[Install]
WantedBy=multi-user.target

```

**Reverse proxy**

Caddyfile snippet

```
:443 {
  tls internal
  route {
    reverse_proxy 127.0.0.1:5173
  }
}

```

### Phase 2 App store

**Manifest schema v1**

- One YAML per app, human-editable and reviewable.
- Compose-like but simplified and opinionated so the UI can render forms.

```yaml
schema: v1
name: Immich
slug: immich
image: ghcr.io/immich-app/immich-server
defaultTag: v1.123.0
icon: https://example.com/immich.png
categories: [photos, ai]
homepage: https://immich.app
docs: https://immich.app/docs
license: agpl-3.0

params:
  - key: DB_HOST
    label: Database host
    type: string
    default: immich-db
  - key: DB_PASSWORD
    label: Database password
    type: secret
  - key: TZ
    label: Timezone
    type: string
    default: Europe/London

ports:
  - container: 2283
    hostDefault: 2283
    protocol: tcp

volumes:
  - container: /config
    hostDefault: /srv/appdata/immich

healthcheck:
  test: ['CMD', 'curl', '-fsS', 'http://localhost:2283/health']
  interval: 30s
  timeout: 3s
  retries: 5

notes:
  - Requires PostgreSQL 14 or newer

```

**Index service**

- Build an `index.json` with app slugs, latest tags, and digests.
- Sign the index with a store key. Clients verify before trusting.
- Store hosted as static content on GitHub Pages or any CDN.
- Submissions via PR keep curation and cost near zero.

**Version tracking**

- Use distribution APIs to list tags and fetch digests.
- Cache in CI and update the index on a schedule.
- Manager compares deployed `image@sha256:...` against the index to show update badges.

### Phase 3 Decentralised store

Targets later. Options to evaluate:

- IPFS for manifests and icons with a signed root index.
- BitTorrent with a DHT, manifests bundled per category.
- Nostr relay gossip layer for announcing new app versions.
- Whichever approach, keep signature verification. Trust is tied to publisher keys.

## UX notes

- Create wizard with presets for volumes and ports. Validate host paths exist.
- Traffic light health status. Show reason strings, not just colours.
- Events timeline that corresponds to Docker events stream.
- One-click save as template from a running container.
- Diff view when updating an app that shows changed env, ports and volumes.
- Friendly errors when port bindings collide or a path is missing.

## Updates by digest

- Always pin the exact digest during deployment.
- When tag digest changes upstream, show Update Available.
- Provide a safe update flow:
    - Pull new image
    - Stop container
    - Start new container with identical config but new digest
    - If start fails, roll back to previous digest automatically

## Backups and restore

- Export a tarball with:
    - Manager config and templates
    - List of containers with config and pinned digests
    - A mapping of named volumes and bind mounts
- Import process recreates containers and reuses existing volumes where present.

## Metrics

- Use Docker stats for CPU, memory, net I O.
- Optional node exporter integration for system metrics.
- Keep it simple in v1. Graphs are nice-to-have, not required for MVP.

## Registry auth

- Store credentials encrypted at rest using libsodium.
- Support Docker Hub, GHCR, GitLab and custom registries.
- Never log credentials. Mask secrets in the UI.

## Directory layout

Use kebab-case for files and folders.

```
docker-manager/
  apps/
    api/
      src/
        routes/
        services/
        lib/docker/
        lib/security/
      package.json
    ui/
      src/
      package.json
  packaging/
    deb/
    iso/
    images/
  docs/
    adr/
      0001-architecture.md
  Caddyfile
  .env.example

```

## Future features

- Multiple nodes with a simple agent that proxies to local Docker daemons.
- RBAC for read-only users.
- Template marketplace distinct from the app store.
- Built-in Watchtower-lite scheduler with per-app windows.
- Snapshots of named volumes using btrfs or ZFS where available.

## Risks and mitigations

- Docker socket exposure. Mitigation: manager is the only process that can access it, UI never does.
- Tag drift and breaking changes. Mitigation: always pin digest, show diffs, allow rollback.
- Privileged containers. Mitigation: warn loudly, require explicit confirmation.
- Store trust. Mitigation: signed index and signed manifests. Verify signatures on client.

## Roadmap checklist

- [ ]  Package repo and installer scripts
- [ ]  Manager API core endpoints
- [ ]  Event and stats streaming
- [ ]  Create wizard with validation and presets
- [ ]  TLS and auth
- [ ]  Templates and export-import
- [ ]  Update detection by digest
- [ ]  Store schema v1 and static index
- [ ]  Install from store flow
- [ ]  Documentation and ADRs

## Appendix A. Example systemd units

`/etc/systemd/system/docker-manager.service`

```
[Unit]
Description=Docker Manager
After=docker.service
Requires=docker.service

[Service]
User=manager
Group=manager
Environment=NODE_ENV=production
ExecStart=/usr/local/bin/docker-manager
Restart=on-failure

[Install]
WantedBy=multi-user.target

```

## Appendix B. Example Caddyfile

```
:443 {
  tls internal
  encode zstd gzip
  reverse_proxy 127.0.0.1:5173
}

```

## Appendix C. API sketch

```
GET    /api/health
POST   /api/login
POST   /api/logout

GET    /api/containers?all=true
POST   /api/containers
GET    /api/containers/:id
POST   /api/containers/:id/start
POST   /api/containers/:id/stop
POST   /api/containers/:id/restart
DELETE /api/containers/:id
GET    /api/containers/:id/logs
WS     /api/containers/:id/exec
GET    /api/containers/:id/stats

GET    /api/images
POST   /api/images/pull
DELETE /api/images/:name

GET    /api/events  (SSE)
GET    /api/templates
POST   /api/templates
GET    /api/store/index
GET    /api/store/manifests/:slug

```

## Appendix D. Example manifest schema JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "App Manifest v1",
  "type": "object",
  "required": ["schema", "name", "slug", "image"],
  "properties": {
    "schema": {"const": "v1"},
    "name": {"type": "string"},
    "slug": {"type": "string", "pattern": "^[a-z0-9-]+$"},
    "image": {"type": "string"},
    "defaultTag": {"type": "string"},
    "icon": {"type": "string"},
    "categories": {"type": "array", "items": {"type": "string"}},
    "homepage": {"type": "string"},
    "docs": {"type": "string"},
    "license": {"type": "string"},
    "params": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["key", "label", "type"],
        "properties": {
          "key": {"type": "string"},
          "label": {"type": "string"},
          "type": {"enum": ["string", "secret", "number", "boolean"]},
          "default": {}
        }
      }
    },
    "ports": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["container"],
        "properties": {
          "container": {"type": "integer"},
          "hostDefault": {"type": "integer"},
          "protocol": {"enum": ["tcp", "udp"]}
        }
      }
    },
    "volumes": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["container"],
        "properties": {
          "container": {"type": "string"},
          "hostDefault": {"type": "string"}
        }
      }
    },
    "healthcheck": {
      "type": "object",
      "properties": {
        "test": {"type": "array", "items": {"type": "string"}},
        "interval": {"type": "string"},
        "timeout": {"type": "string"},
        "retries": {"type": "integer"}
      }
    },
    "notes": {"type": "array", "items": {"type": "string"}}
  }
}

```

## Appendix E. Naming conventions

- Filenames and slugs use kebab-case.
- Container names default to the app slug with a numeric suffix when needed.
- Named volumes use `app-slug_data` pattern by default.