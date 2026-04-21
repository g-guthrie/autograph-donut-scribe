import React, {FC, useEffect, useRef, useState} from 'react'
import filesystemURL from 'xash3d-fwgs/filesystem_stdio.wasm'
import xashURL from 'xash3d-fwgs/xash.wasm'
import menuURL from 'cs16-client/cl_dll/menu_emscripten_wasm32.wasm'
import clientURL from 'cs16-client/cl_dll/client_emscripten_wasm32.wasm'
import serverURL from 'cs16-client/dlls/cs_emscripten_wasm32.wasm'
import extrasURL from 'cs16-client/extras.pk3'
import gles3URL from 'xash3d-fwgs/libref_gles3compat.wasm'
import {loadAsync} from 'jszip'
import {Xash3DWebRTC} from "./webrtc"
import './App.css'

type TestPhase = 'booting' | 'menu' | 'internet_browser' | 'connecting' | 'in_game'
type HostStage =
    | 'menu_ok'
    | 'sandbox_host_request'
    | 'remote_spawn_started'
    | 'remote_server_up'
    | 'config_ready'
    | 'websocket_ready'
    | 'datachannel_open'
    | 'first_game_packet'
    | 'runtime_playable'

type HostTrace = {
    txid: string | null
    stage: HostStage | null
    lastCompletedStage: HostStage | null
    stageTimes: Partial<Record<HostStage, number>>
    lastError: string | null
}

type RuntimeState = {
    playable: boolean
    hudVisible: boolean
    spectator: boolean
    intermission: boolean
    scoreboardVisible: boolean
    hasSuit: boolean
    health: number
    team: number
    serverName: string
}

type BackendStatus = {
    connectHost: string
    connectPort: number
    protocol: string
    map: string | null
    players: number | null
    maxPlayers: number | null
    hostname: string | null
    password: boolean | null
    serverUp: boolean
    configReady: boolean
    websocketReady: boolean
    sessionReady: boolean
    txid: string | null
    stage: HostStage | null
    lastCompletedStage: HostStage | null
    stageTimes: Partial<Record<HostStage, number>>
    lastError: string | null
}

type TestState = {
    phase: TestPhase
    transportConnected: boolean
    serverListCount: number
    connectedServer: string | null
    currentMap: string | null
    lastError: string | null
    runtime: RuntimeState | null
    trace: HostTrace | null
    backend: BackendStatus | null
}

declare global {
    interface Window {
        __cs15HostTrace?: HostTrace
        __cs15PrepareHostTx?: () => string
        __cs15TraceUpdate?: (patch: Record<string, unknown>) => void
        __cs15MapUpdate?: (mapName: string) => void
        __cs15TestMenuDriver?: {
            openMultiplayer: () => void
            openSandbox: () => void
            openInternetGame: () => void
            refreshInternetGames: () => void
            selectInternetGameRow: (index?: number) => void
            joinInternetGame: () => void
            setInternetGameTab: (index: number) => void
            addServer: (address: string, protocol?: string) => void
            toggleFavorite: () => void
            saveBrowserLists: () => void
            selectCreateGameMap: (selection: string | number) => void
            confirmCreateGame: () => void
            getCVar: (name: string, timeoutMs?: number) => Promise<string>
            getCurrentMap: (timeoutMs?: number) => Promise<string>
        }
        __cs15TestState?: TestState
    }
}

const HOST_STAGE_ORDER: Record<HostStage, number> = {
    menu_ok: 0,
    sandbox_host_request: 1,
    remote_spawn_started: 2,
    remote_server_up: 3,
    config_ready: 4,
    websocket_ready: 5,
    datachannel_open: 6,
    first_game_packet: 7,
    runtime_playable: 8,
}
const MASTER_ENDPOINT = {host: '127.0.0.1', port: 27010}
const DEFAULT_CONNECT_ENDPOINT = {host: '127.0.0.1', port: 8080, protocol: '49'}
const MASTER_LIST = `master ${MASTER_ENDPOINT.host}:${MASTER_ENDPOINT.port}\n`
const DEFAULT_PLAYER_NAME = 'Player'
const STATUS_URL = 'http://127.0.0.1:27016/status'
const QUERY_URL = 'http://127.0.0.1:27020/query'
const SIGNAL_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://127.0.0.1:27017/websocket`
const REQUIRED_SCOPE_ARCS = [
    'scope_arc.tga',
    'scope_arc_ne.tga',
    'scope_arc_nw.tga',
    'scope_arc_sw.tga',
] as const
const SERVER_LIST_FILES = [
    'favorite_servers.lst',
    'history_servers.lst',
] as const

const escapeCommandValue = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

const INITIAL_TEST_STATE: TestState = {
    phase: 'booting',
    transportConnected: false,
    serverListCount: 0,
    connectedServer: null,
    currentMap: null,
    lastError: null,
    runtime: null,
    trace: null,
    backend: null,
}

const createHostTxId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const parseBackendStatus = (payload: Record<string, unknown>): BackendStatus => ({
    connectHost: String(payload.connect_host ?? DEFAULT_CONNECT_ENDPOINT.host),
    connectPort: Number(payload.connect_port ?? DEFAULT_CONNECT_ENDPOINT.port),
    protocol: String(payload.protocol ?? DEFAULT_CONNECT_ENDPOINT.protocol),
    map: payload.map ? String(payload.map) : null,
    players: typeof payload.players === 'number' ? payload.players : null,
    maxPlayers: typeof payload.max_players === 'number' ? payload.max_players : null,
    hostname: payload.hostname ? String(payload.hostname) : null,
    password: typeof payload.password === 'boolean' ? payload.password : null,
    serverUp: Boolean(payload.server_up),
    configReady: Boolean(payload.config_ready),
    websocketReady: Boolean(payload.websocket_ready),
    sessionReady: Boolean(payload.session_ready),
    txid: payload.txid ? String(payload.txid) : null,
    stage: (payload.stage as HostStage | null) ?? null,
    lastCompletedStage: (payload.last_completed_stage as HostStage | null) ?? null,
    stageTimes: (payload.stage_times as Partial<Record<HostStage, number>> | null) ?? {},
    lastError: payload.last_error ? String(payload.last_error) : null,
})

const fetchCanonicalStatus = async () => {
    const response = await fetch(STATUS_URL)
    if (!response.ok) {
        throw new Error(`status fetch failed (${response.status})`)
    }
    return parseBackendStatus(await response.json() as Record<string, unknown>)
}

const stageRank = (stage: HostStage | null | undefined) => stage ? HOST_STAGE_ORDER[stage] : -1

const App: FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const bootPromiseRef = useRef<Promise<void> | null>(null)
    const runtimePollRef = useRef<number | null>(null)
    const runtimePollInFlightRef = useRef(false)
    const testStateRef = useRef<TestState>(INITIAL_TEST_STATE)
    const [status, setStatus] = useState('Loading Counter-Strike...')
    const [error, setError] = useState<string | null>(null)
    const [ready, setReady] = useState(false)

    const updateTestState = (patch: Partial<TestState>) => {
        const next: TestState = {
            ...testStateRef.current,
            ...patch,
        }

        if (next.transportConnected && next.backend?.sessionReady) {
            next.phase = 'in_game'
            next.connectedServer = `${next.backend.connectHost}:${next.backend.connectPort}`
        }

        testStateRef.current = next
        window.__cs15TestState = {...next}
    }

    useEffect(() => {
        window.__cs15TestState = {...INITIAL_TEST_STATE}
        delete window.__cs15HostTrace
        runtimePollInFlightRef.current = false

        const applyTracePatch = (patch: Partial<HostTrace> & {stage?: HostStage}) => {
            const current: HostTrace = window.__cs15HostTrace ?? {
                txid: null,
                stage: null,
                lastCompletedStage: null,
                stageTimes: {},
                lastError: null,
            }

            const next: HostTrace = {
                ...current,
                ...patch,
                stageTimes: {
                    ...current.stageTimes,
                    ...(patch.stageTimes ?? {}),
                },
            }

            if (patch.stage && stageRank(patch.stage) >= stageRank(current.stage)) {
                next.stage = patch.stage
                next.lastCompletedStage = patch.lastCompletedStage ?? patch.stage
                next.stageTimes = {
                    ...next.stageTimes,
                    [patch.stage]: Date.now(),
                }
            } else if (patch.lastCompletedStage && stageRank(patch.lastCompletedStage) > stageRank(current.lastCompletedStage)) {
                next.lastCompletedStage = patch.lastCompletedStage
            }

            window.__cs15HostTrace = next
            updateTestState({trace: next})
            console.debug('[cs15-trace]', JSON.stringify(next))
        }

        window.__cs15TraceUpdate = applyTracePatch
        window.__cs15MapUpdate = (mapName: string) => {
            updateTestState({currentMap: mapName || null})
        }
        window.__cs15PrepareHostTx = () => {
            const txid = createHostTxId()
            applyTracePatch({
                txid,
                lastError: null,
                stage: 'menu_ok',
                stageTimes: {},
            })
            return txid
        }

        return () => {
            if (runtimePollRef.current !== null) {
                window.clearInterval(runtimePollRef.current)
                runtimePollRef.current = null
            }
            delete window.__cs15PrepareHostTx
            delete window.__cs15TraceUpdate
            delete window.__cs15MapUpdate
            delete window.__cs15HostTrace
            delete window.__cs15TestMenuDriver
            delete window.__cs15TestState
        }
    }, [])

    useEffect(() => {
        if (bootPromiseRef.current) {
            return
        }

        bootPromiseRef.current = (async () => {
            if (!canvasRef.current) {
                throw new Error('canvas not ready')
            }

            const playerName = localStorage.getItem('username') || DEFAULT_PLAYER_NAME
            const initialBackend = await fetchCanonicalStatus().catch(() => null)
            if (initialBackend) {
                updateTestState({
                    backend: initialBackend,
                    currentMap: initialBackend.map,
                    lastError: initialBackend.lastError,
                })
            }

            const connectEndpoint = initialBackend ?? {
                connectHost: DEFAULT_CONNECT_ENDPOINT.host,
                connectPort: DEFAULT_CONNECT_ENDPOINT.port,
                protocol: DEFAULT_CONNECT_ENDPOINT.protocol,
            }

            const x = new Xash3DWebRTC({
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
                    'dlls/mp_emscripten_wasm32.wasm',
                    '/rodir/filesystem_stdio.wasm',
                ],
                filesMap: {
                    'dlls/cs_emscripten_wasm32.wasm': serverURL,
                    'dlls/mp_emscripten_wasm32.wasm': serverURL,
                    '/rodir/filesystem_stdio.wasm': filesystemURL,
                },
                endpoints: {
                    master: MASTER_ENDPOINT,
                    connect: {
                        host: connectEndpoint.connectHost,
                        port: connectEndpoint.connectPort,
                        protocol: connectEndpoint.protocol,
                    },
                    signalURL: SIGNAL_URL,
                    queryURL: QUERY_URL,
                },
                module: {
                    print: (line: string) => {
                        if (line.includes('cs15-runtime')) {
                            console.debug(line)
                        }
                        if (line.includes('Adding directory: cstrike/')) {
                            setStatus('Loading Counter-Strike menu...')
                        }
                        if (line.includes('Xash Warning') || line.includes('Error:')) {
                            updateTestState({lastError: line})
                        }
                    },
                    printErr: (line: string) => {
                        if (line.trim()) {
                            updateTestState({lastError: line})
                        }
                    }
                }
            })

            x.onState((patch) => {
                updateTestState(patch as Partial<TestState>)
            })

            x.onConnected(() => {
                updateTestState({transportConnected: true})
            })

            setError(null)
            updateTestState({phase: 'booting', lastError: null})

            const [zip, extras] = await Promise.all([
                (async () => {
                    const res = await fetch('valve.zip')
                    if (!res.ok) {
                        throw new Error(`failed to load valve.zip (${res.status})`)
                    }
                    return loadAsync(await res.arrayBuffer())
                })(),
                (async () => {
                    const res = await fetch(extrasURL)
                    if (!res.ok) {
                        throw new Error(`failed to load extras.pk3 (${res.status})`)
                    }
                    return res.arrayBuffer()
                })(),
                x.init(),
            ])

            if (x.exited) {
                throw new Error('engine exited during initialization')
            }

            const files = Object.entries(zip.files).filter(([, file]) => !file.dir)
            let mounted = 0
            setStatus(`Mounting assets... 0/${files.length}`)

            await Promise.all(files.map(async ([filename, file]) => {
                const path = `/rodir/${filename}`
                const dir = path.split('/').slice(0, -1).join('/')

                x.em.FS.mkdirTree(dir)
                x.em.FS.writeFile(path, await file.async('uint8array'))

                mounted += 1
                if (mounted % 100 === 0 || mounted === files.length) {
                    setStatus(`Mounting assets... ${mounted}/${files.length}`)
                }
            }))

            x.em.FS.writeFile('/rodir/cstrike/extras.pk3', new Uint8Array(extras))
            x.em.FS.writeFile('/rodir/extras.pk3', new Uint8Array(extras))
            x.em.FS.writeFile('/extras.pk3', new Uint8Array(extras))
            x.em.FS.writeFile('/xashcomm.lst', new TextEncoder().encode(MASTER_LIST))
            x.em.FS.writeFile('/rodir/xashcomm.lst', new TextEncoder().encode(MASTER_LIST))
            x.em.FS.writeFile('/rwdir/xashcomm.lst', new TextEncoder().encode(MASTER_LIST))
            for (const filename of SERVER_LIST_FILES) {
                const saved = localStorage.getItem(`cs15:${filename}`)
                if (!saved) {
                    continue
                }
                const data = new TextEncoder().encode(saved)
                x.em.FS.writeFile(`/${filename}`, data)
                x.em.FS.writeFile(`/rwdir/${filename}`, data)
                x.em.FS.writeFile(`/rodir/${filename}`, data)
            }
            await Promise.all(REQUIRED_SCOPE_ARCS.map(async (filename) => {
                const res = await fetch(`cs15-sprites/${filename}`)
                if (!res.ok) {
                    throw new Error(`failed to load ${filename} (${res.status})`)
                }
                x.em.FS.mkdirTree('/rodir/cstrike/sprites')
                x.em.FS.writeFile(`/rodir/cstrike/sprites/${filename}`, new Uint8Array(await res.arrayBuffer()))
            }))
            x.em.FS.chdir('/rodir')

            x.main()
            x.Cmd_ExecuteString(`name "${escapeCommandValue(playerName)}"`)

            const persistBrowserLists = () => {
                for (const filename of SERVER_LIST_FILES) {
                    for (const path of [`/${filename}`, `/rwdir/${filename}`, `/rodir/${filename}`]) {
                        try {
                            const raw = x.em.FS.readFile(path, {encoding: 'utf8'}) as string
                            localStorage.setItem(`cs15:${filename}`, raw)
                            break
                        } catch {
                            // keep trying alternate paths
                        }
                    }
                }
            }

            runtimePollRef.current = window.setInterval(() => {
                if (runtimePollInFlightRef.current) {
                    return
                }
                runtimePollInFlightRef.current = true
                void Promise.all([
                    x.getRuntimeState(3000),
                    x.getCVar('cscl_currentmap', 3000).catch(() => ''),
                    fetchCanonicalStatus().catch(() => null),
                ]).then(([runtime, currentMapCVar, backend]) => {
                    if (backend?.txid) {
                        window.__cs15TraceUpdate?.({
                            txid: backend.txid,
                            stage: backend.stage ?? undefined,
                            lastCompletedStage: backend.lastCompletedStage,
                            stageTimes: backend.stageTimes,
                            lastError: backend.lastError,
                        })
                    }

                    if (runtime?.playable) {
                        window.__cs15TraceUpdate?.({
                            stage: 'runtime_playable',
                        })
                    }

                    const trace = window.__cs15HostTrace ?? null
                    const inferredServerListCount =
                        backend?.sessionReady && testStateRef.current.phase === 'internet_browser'
                            ? Math.max(testStateRef.current.serverListCount, 1)
                            : testStateRef.current.serverListCount
                    updateTestState({
                        backend: backend ?? testStateRef.current.backend,
                        trace,
                        currentMap: backend?.map ?? (currentMapCVar || testStateRef.current.currentMap),
                        runtime: runtime ?? testStateRef.current.runtime,
                        serverListCount: inferredServerListCount,
                        lastError: backend?.lastError ?? testStateRef.current.lastError,
                    })
                }).finally(() => {
                    runtimePollInFlightRef.current = false
                })
            }, 1500)

            window.__cs15TestMenuDriver = {
                openMultiplayer: () => {
                    console.debug('[test-menu-driver] menu_multiplayer')
                    updateTestState({phase: 'menu'})
                    x.Cmd_ExecuteString('menu_multiplayer\n')
                },
                openSandbox: () => {
                    console.debug('[test-menu-driver] menu_sandbox')
                    x.Cmd_ExecuteString('menu_sandbox\n')
                },
                openInternetGame: () => {
                    console.debug('[test-menu-driver] menu_internetgames')
                    updateTestState({phase: 'internet_browser'})
                    x.Cmd_ExecuteString('menu_internetgames\n')
                },
                refreshInternetGames: () => {
                    console.debug('[test-menu-driver] refresh internet game')
                    updateTestState({phase: 'internet_browser'})
                    x.Cmd_ExecuteString('menu_test_refresh\n')
                },
                selectInternetGameRow: (index = 0) => {
                    console.debug('[test-menu-driver] select internet game row', index)
                    x.Cmd_ExecuteString(`menu_test_selectserver ${index}\n`)
                },
                joinInternetGame: () => {
                    console.debug('[test-menu-driver] join internet game')
                    updateTestState({phase: 'connecting'})
                    x.Cmd_ExecuteString('menu_test_join\n')
                },
                setInternetGameTab: (index: number) => {
                    console.debug('[test-menu-driver] set internet game tab', index)
                    x.Cmd_ExecuteString(`menu_test_browsertab ${index}\n`)
                },
                addServer: (address: string, protocol = '49') => {
                    console.debug('[test-menu-driver] add server', address, protocol)
                    x.Cmd_ExecuteString(`menu_test_addserver "${escapeCommandValue(address)}" "${escapeCommandValue(protocol)}"\n`)
                },
                toggleFavorite: () => {
                    console.debug('[test-menu-driver] toggle favorite')
                    x.Cmd_ExecuteString('menu_test_togglefavorite\n')
                },
                saveBrowserLists: () => {
                    console.debug('[test-menu-driver] save browser lists')
                    x.Cmd_ExecuteString('menu_test_savelists\n')
                    window.setTimeout(persistBrowserLists, 100)
                },
                selectCreateGameMap: (selection: string | number) => {
                    const value = String(selection)
                    console.debug('[test-menu-driver] select create game map', value)
                    x.Cmd_ExecuteString(`menu_test_selectmap "${escapeCommandValue(value)}"\n`)
                },
                confirmCreateGame: () => {
                    console.debug('[test-menu-driver] confirm create game')
                    updateTestState({phase: 'connecting'})
                    x.Cmd_ExecuteString('menu_test_ok\n')
                },
                getCVar: (name: string, timeoutMs = 3000) => x.getCVar(name, timeoutMs),
                getCurrentMap: (timeoutMs = 3000) => x.getCVar('cscl_currentmap', timeoutMs),
            }

            updateTestState({phase: 'menu', lastError: null})
            setStatus('Counter-Strike ready.')
            setReady(true)
        })().catch((err) => {
            const message = err instanceof Error ? err.message : String(err)
            setError(message)
            setStatus('Failed to start')
            updateTestState({lastError: message})
        })
    }, [])

    return (
        <>
            <canvas id="canvas" ref={canvasRef}/>
            {!ready || error ? (
                <div className="statusOverlay">
                    <div className="statusPanel">
                        <p className="statusTitle">Counter-Strike 1.6</p>
                        <p className="statusBody">{status}</p>
                        {error ? <p className="statusError">{error}</p> : null}
                    </div>
                </div>
            ) : null}
        </>
    )
}

export default App
