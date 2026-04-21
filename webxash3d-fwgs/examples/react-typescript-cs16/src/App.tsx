import React, {FC, useEffect, useRef, useState} from 'react';
import {Xash3D} from "xash3d-fwgs";
import filesystemURL from 'xash3d-fwgs/filesystem_stdio.wasm'
import xashURL from 'xash3d-fwgs/xash.wasm'
import menuURL from 'cs16-client/cl_dll/menu_emscripten_wasm32.wasm'
import clientURL from 'cs16-client/cl_dll/client_emscripten_wasm32.wasm'
import serverURL from 'cs16-client/dlls/cs_emscripten_wasm32.wasm'
import gles3URL from 'xash3d-fwgs/libref_gles3compat.wasm'
import './App.css';

type ModeId = 'defusal' | 'rescue' | 'bots'

const MODES: Array<{
    id: ModeId
    label: string
    description: string
}> = [
    {
        id: 'defusal',
        label: 'Bomb Defusal',
        description: 'Classic Counter-Strike on de_dust2.',
    },
    {
        id: 'rescue',
        label: 'Hostage Rescue',
        description: 'Hostage mode on cs_office.',
    },
    {
        id: 'bots',
        label: 'Bot Match',
        description: 'de_dust2 with AI players so you can shoot-test.',
    },
]

const App: FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const engineRef = useRef<Xash3D | null>(null)
    const bootPromiseRef = useRef<Promise<Xash3D> | null>(null)
    const timeoutsRef = useRef<number[]>([])
    const [status, setStatus] = useState('Choose a mode.')
    const [error, setError] = useState<string | null>(null)
    const [selectedMode, setSelectedMode] = useState<ModeId | null>(null)
    const [menuOpen, setMenuOpen] = useState(true)

    const clearScheduledCommands = () => {
        timeoutsRef.current.forEach(window.clearTimeout)
        timeoutsRef.current = []
    }

    const bootEngine = async () => {
        if (engineRef.current && !engineRef.current.exited) {
            return engineRef.current
        }
        if (bootPromiseRef.current) {
            return bootPromiseRef.current
        }

        bootPromiseRef.current = (async () => {
            try {
                if (!canvasRef.current) {
                    throw new Error('canvas not ready')
                }

                const x = new Xash3D({
                    canvas: canvasRef.current,
                    arguments: ['-windowed', '-game', 'cstrike'],
                    libraries: {
                        filesystem: filesystemURL,
                        xash: xashURL,
                        menu: menuURL,
                        server: serverURL,
                        client: clientURL,
                        render: {
                            gles3compat: gles3URL,
                        }
                    },
                    dynamicLibraries: [
                        'dlls/cs_emscripten_wasm32.wasm',
                        'dlls/cs_emscripten_wasm32.so',
                        'dlls/mp_emscripten_wasm32.wasm',
                        'dlls/mp_emscripten_wasm32.so',
                        '/rodir/filesystem_stdio.wasm',
                    ],
                    filesMap: {
                        'dlls/cs_emscripten_wasm32.wasm': serverURL,
                        'dlls/cs_emscripten_wasm32.so': serverURL,
                        'dlls/mp_emscripten_wasm32.wasm': serverURL,
                        'dlls/mp_emscripten_wasm32.so': serverURL,
                        '/rodir/filesystem_stdio.wasm': filesystemURL,
                    },
                });

                engineRef.current = x
                setStatus('Loading asset manifest...')
                setError(null)

                const [manifest] = await Promise.all([
                    (async () => {
                        const res = await fetch('game/manifest.json')
                        return await res.json() as Promise<{ files: string[] }>
                    })(),
                    x.init(),
                ])

                if (x.exited) {
                    throw new Error('engine exited during initialization')
                }

                const files = manifest.files
                let written = 0
                setStatus(`Mounting ${files.length} assets...`)

                const concurrency = 8
                let nextIndex = 0

                const worker = async () => {
                    while (nextIndex < files.length) {
                        const current = nextIndex
                        nextIndex += 1

                        const filename = files[current]
                        const path = '/rodir/' + filename;
                        const dir = path.split('/').slice(0, -1).join('/');

                        const res = await fetch(`game/${encodeURI(filename)}`)
                        const bytes = new Uint8Array(await res.arrayBuffer())

                        if (x.exited) return

                        x.em.FS.mkdirTree(dir);
                        x.em.FS.writeFile(path, bytes);

                        written += 1
                        if (written % 50 === 0 || written === files.length) {
                            setStatus(`Mounting assets... ${written}/${files.length}`)
                        }
                    }
                }

                await Promise.all(Array.from({length: concurrency}, worker))

                x.em.FS.chdir('/rodir')
                x.main()
                setStatus('Engine ready')
                return x
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err)
                setError(message)
                setStatus('Failed to start')
                throw err
            }
        })()

        try {
            return await bootPromiseRef.current
        } finally {
            bootPromiseRef.current = null
        }
    }

    const scheduleCommands = (commands: Array<[number, string]>) => {
        clearScheduledCommands()
        for (const [delay, command] of commands) {
            const id = window.setTimeout(() => {
                if (!engineRef.current || engineRef.current.exited) return
                engineRef.current.Cmd_ExecuteString(command)
            }, delay)
            timeoutsRef.current.push(id)
        }
    }

    const launchMode = async (mode: ModeId) => {
        setSelectedMode(mode)
        setMenuOpen(false)
        setError(null)

        const x = await bootEngine()
        if (x.exited) return

        const map = mode === 'rescue' ? 'cs_office' : 'de_dust2'
        const team = mode === 'rescue' ? '2' : '2'

        const commands: Array<[number, string]> = [
            [0, '_vgui_menus 0'],
            [50, 'crosshair 1'],
            [100, 'hud_draw 1'],
            [150, 'cl_hideweapon 0'],
            [200, 'r_drawviewmodel 1'],
            [250, 'mp_autoteambalance 0'],
            [300, 'mp_limitteams 0'],
            [350, 'mp_freezetime 0'],
            [400, 'mp_buytime 9999'],
            [450, 'mp_roundtime 9'],
            [500, 'bot_kick'],
            [700, `map ${map}`],
            [1800, `menuselect ${team}`],
            [2300, `jointeam ${team}`],
            [2800, `menuselect ${team}`],
            [3400, 'menuselect 1'],
            [3200, 'joinclass 1'],
            [4200, 'sv_restartround 1'],
            [5200, 'slot2'],
        ]

        if (mode === 'defusal') {
            commands.push(
                [5600, 'sv_cheats 1'],
                [6000, 'give weapon_knife'],
                [6200, 'give weapon_usp'],
                [6400, 'give ammo_45acp'],
            )
        }

        if (mode === 'rescue') {
            commands.push(
                [5600, 'sv_cheats 1'],
                [6000, 'give weapon_knife'],
                [6200, 'give weapon_mp5navy'],
                [6400, 'give ammo_9mm'],
            )
        }

        if (mode === 'bots') {
            commands.push(
                [5600, 'bot_add_t'],
                [6000, 'bot_add_t'],
                [6400, 'bot_add_t'],
                [6800, 'bot_add_ct'],
                [7200, 'bot_add_ct'],
                [7600, 'sv_cheats 1'],
                [8000, 'give weapon_knife'],
                [8200, 'give weapon_usp'],
                [8400, 'give ammo_45acp'],
            )
        }

        scheduleCommands(commands)
        const modeLabel = MODES.find(item => item.id === mode)?.label ?? mode
        setStatus(`Running: ${modeLabel}`)
    }

    useEffect(() => {
        return () => {
            clearScheduledCommands()
            engineRef.current?.quit()
            engineRef.current = null
        }
    }, [])

    const currentMode = MODES.find(item => item.id === selectedMode)

    return (
        <>
            <div className={`launcher ${menuOpen ? 'open' : 'closed'}`}>
                <div className="launcherHeader">
                    <strong>CS Browser Modes</strong>
                    <button className="launcherToggle" onClick={() => setMenuOpen(open => !open)}>
                        {menuOpen ? 'Hide' : 'Modes'}
                    </button>
                </div>
                <p className="launcherText">
                    {currentMode ? currentMode.description : 'Pick a mode. de_dust2 is bomb defusal, cs_office is hostage rescue.'}
                </p>
                <div className="launcherButtons">
                    {MODES.map(mode => (
                        <button
                            key={mode.id}
                            className={selectedMode === mode.id ? 'active' : ''}
                            onClick={() => {
                                void launchMode(mode.id)
                            }}
                        >
                            {mode.label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="status">
                <strong>{status}</strong>
                {error ? <span>{error}</span> : null}
            </div>
            <canvas id="canvas" ref={canvasRef}/>
        </>
    );
}

export default App;
