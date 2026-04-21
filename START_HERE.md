# CS Browser Starter

This workspace is set up around the current browser-capable GoldSrc stack:

- `webxash3d-fwgs`: browser client, WASM engine builds, examples, and Docker server images
- `rehlds`: dedicated server engine work
- `regamedll-cs`: server-side Counter-Strike gameplay code
- `reapi`: plugin API layer for server-side gameplay hooks
- `emsdk`: local Emscripten SDK

## Current state

- `pnpm install` has been run in `webxash3d-fwgs`
- `colima` is installed and the active Docker context
- `docker-buildx` and `docker-compose` are installed
- `steamcmd` is installed, but the easiest asset path is still a local Steam install or manually supplied `valve/` + `cstrike/` directories

## First commands

Start the container runtime:

```bash
./scripts/start-colima.sh
```

Validate the local environment:

```bash
./scripts/check-env.sh
```

Build a local WASM package when you want the browser app to use your edits instead of the published npm package:

```bash
./scripts/build-local-wasm.sh cs16
```

If you already have a legal Half-Life / Counter-Strike 1.6 install, package assets for the browser examples:

```bash
./scripts/prepare-assets.sh "/path/to/Half-Life"
```

Start the local browser example:

```bash
./scripts/start-example.sh
```

Start the WebRTC browser example with a shared local dedicated server:

```bash
./scripts/start-example.sh webrtc
```

Then open `http://localhost:3000` in two tabs. Each tab will auto-connect to the same local server, auto-join opposite teams, and drop into the same `de_dust2` match.

## Asset expectations

The browser examples expect a `valve.zip` containing:

```text
valve.zip
├── valve/
└── cstrike/
```

`./scripts/prepare-assets.sh` writes that file to `assets/valve.zip` and symlinks it into the example `public/` directories.

## Multiplayer path

There are two practical multiplayer paths in this workspace:

1. `./scripts/start-example.sh webrtc` for the local two-tab workflow on `http://localhost:3000`
2. Browser example plus separate WebRTC-capable dedicated server from `webxash3d-fwgs/docker/cs-web-server`
3. Dedicated server experimentation in `rehlds`, `regamedll-cs`, and `reapi` for gameplay changes such as hitboxes

## Hitbox work

For hitbox changes, plan to modify authoritative server-side gameplay code or plugin hooks first, not only the browser client.
The browser examples in this workspace are configured to consume the local `cs16-client` package, so rebuilding that package is the shortest path to testing gameplay-side changes in the browser.

Relevant repos:

- `regamedll-cs`
- `reapi`

## Known blocker

No local CS assets were found automatically on this machine, so the browser client cannot boot until `valve/` and `cstrike/` are supplied from a legal install.
