# WebXash3D – Zombie Plague (CS 1.6)

This setup provides a fully containerized, browser-playable CS 1.6 Zombie Plague server.

---

# Requirements

- Docker
- Docker Compose
- Legal Steam copy of Counter-Strike 1.6
- Zombie Plague archive from AlliedMods forum

---

# Setup Instructions

## 1. Download Zombie Plague

Download any version from:

    https://forums.alliedmods.net/showthread.php?t=279404

Extract the archive.

Copy the `addons` folder from the archive and place it in the same directory as this README.

Project structure should now look like:

    .
    ├── docker-compose.yml
    ├── Dockerfile
    ├── README.md
    ├── addons/

---

## 2. Prepare Original Game Files

You must use original CS 1.6 files from Steam.

From your Steam installation, copy:

    valve/
    cstrike/

If they do not exist, create them.

---

## 3. Prepare cstrike/downloaded

Inside the `cstrike` folder, create (if not exists):

    cstrike/downloaded/

Extract the Zombie Plague resource files and place them inside:

    cstrike/downloaded/

---

## 5. Create Final Archive

Create ONE zip archive containing only:

    valve/
    cstrike/

The root of the archive MUST contain only these two folders.

Correct structure:

    valve.zip
    ├── valve/
    └── cstrike/

Incorrect structure:

    valve.zip
    └── some-folder/
        ├── valve/
        └── cstrike/

Place `valve.zip` in the project root (same level as `addons/`).

---

# Run the Server

After you have:

    addons/
    valve.zip
    docker-compose.yml

Run:

    docker compose up --build

Once the build finishes, open:

    http://localhost:27016

The game will load directly in your browser.

---

# First Launch – Team Selection Issue

Currently, the team selection menu does not render in the Web build.

To join the game:

1. Open the console using the backtick key:

   `

2. Execute:

   jointeam 1

3. Then:

   joinclass 1

You should now spawn successfully and the game should work.

---

# Important Notes

- You must legally own Counter-Strike 1.6.
- Only original Steam assets are supported.
- Most startup issues are caused by incorrect archive structure.
- Some GoldSrc UI elements may not render in Web mode.
- Performance depends on browser WebAssembly capabilities.

---

# Expected Final Directory Structure

    project-root/
    │
    ├── docker-compose.yml
    ├── Dockerfile
    ├── README.md
    ├── valve.zip
    └── addons/

---

# Result

You now have:

- CS 1.6 Zombie Plague
- Running in browser
- Fully containerized

This setup is suitable for local testing, experimentation, and web deployment scenarios.
