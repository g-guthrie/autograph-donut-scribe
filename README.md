# Olympus Phase 1

This repo is intentionally limited to the actual Phase 1 milestone from the spec:

- binary gameplay protocol
- seeded voxel world generation
- chunked greedy-meshed rendering
- movement, collision, crouch, jump, step-up, and fall damage
- third-person camera with ADS transition and shoulder swap
- basic networking with prediction, reconciliation, interpolation, ACKs, and reconnect

It explicitly does **not** include Phase 2 combat systems.

## Local development

Use Node 22 and install dependencies:

```bash
export PATH=/opt/homebrew/opt/node@22/bin:$PATH
corepack pnpm install
```

Run the fast local loop:

```bash
OLYMPUS_CLIENT_PORT=5180 OLYMPUS_WORKER_PORT=8788 pnpm dev
```

Run the worker-served preview:

```bash
OLYMPUS_WORKER_PORT=57002 pnpm preview:cf
```

## Checks

```bash
pnpm test
pnpm build
```
