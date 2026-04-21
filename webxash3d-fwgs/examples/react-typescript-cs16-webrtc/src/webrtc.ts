import {Net, Packet, Xash3D as BaseXash3D, Xash3DOptions} from "xash3d-fwgs";

export {BaseXash3D as Xash3D}

const textDecoder = new TextDecoder()

type NetworkPhase = 'menu' | 'internet_browser' | 'connecting' | 'in_game'
type Endpoint = {
    host: string
    port: number
}
type BackendEndpoints = {
    master: Endpoint
    connect: Endpoint & {
        protocol: string
    }
    signalURL: string
    queryURL: string
}
type Xash3DWebRTCOptions = Xash3DOptions & {
    endpoints: BackendEndpoints
}
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

declare global {
    interface Window {
        __cs15TraceUpdate?: (patch: Record<string, unknown>) => void
    }
}

const ipToTuple = (host: string): [number, number, number, number] => {
    const parts = host.split('.').map((part) => Number.parseInt(part, 10))
    if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
        return [127, 0, 0, 1]
    }
    return [parts[0], parts[1], parts[2], parts[3]]
}

const tupleToHost = (ip: [number, number, number, number]) => ip.join('.')

const isConnectionless = (packet: Uint8Array) => (
    packet.length >= 5 &&
    packet[0] === 0xff &&
    packet[1] === 0xff &&
    packet[2] === 0xff &&
    packet[3] === 0xff
)

const connectionlessBody = (packet: Uint8Array) => textDecoder.decode(packet.subarray(4))

const isMasterQuery = (packet: Uint8Array) => (
    isConnectionless(packet) &&
    packet[4] === '1'.charCodeAt(0) &&
    packet[5] === 0xff
)

const isServerQuery = (packet: Uint8Array) => {
    if (!isConnectionless(packet)) {
        return false
    }

    const body = connectionlessBody(packet)
    return (
        body.startsWith('TSource Engine Query') ||
        packet[4] === 'V'.charCodeAt(0) ||
        packet[4] === 'U'.charCodeAt(0) ||
        body.startsWith('ping') ||
        body.startsWith('info ')
    )
}

const clonePacket = (packet: Packet): Packet => ({
    data: new Int8Array(packet.data),
    ip: [...packet.ip] as [number, number, number, number],
    port: packet.port,
})

const countMasterServers = (packet: Uint8Array) => {
    if (packet.length < 17 || !isConnectionless(packet) || packet[4] !== 'f'.charCodeAt(0)) {
        return 0
    }

    let count = 0
    for (let offset = 11; offset + 5 < packet.length; offset += 6) {
        const port = packet[offset + 4] | (packet[offset + 5] << 8)
        if (port === 0) {
            break
        }
        count += 1
    }
    return count
}

const toBase64 = (data: Int8Array) => {
    let raw = ''
    for (let index = 0; index < data.length; index += 1) {
        raw += String.fromCharCode(data[index] & 0xff)
    }
    return btoa(raw)
}

const fromBase64 = (value: string) => {
    const raw = atob(value)
    const bytes = new Uint8Array(raw.length)
    for (let index = 0; index < raw.length; index += 1) {
        bytes[index] = raw.charCodeAt(index)
    }
    return bytes
}

export class Xash3DWebRTC extends BaseXash3D {
    private readonly endpoints: BackendEndpoints
    private channel?: RTCDataChannel
    private resolve?: () => void
    private ws?: WebSocket
    private peer?: RTCPeerConnection
    private remoteDescription?: RTCSessionDescriptionInit
    private candidates: RTCIceCandidateInit[] = []
    private wasRemote = false
    private stream?: MediaStream
    private connected = false
    private connectingPromise?: Promise<void>
    private serverListCount = 0
    private readonly connectedListeners = new Set<() => void>()
    private readonly stateListeners = new Set<(patch: Record<string, unknown>) => void>()
    private readonly pendingGamePackets: Packet[] = []
    private sawFirstGamePacket = false

    constructor(opts: Xash3DWebRTCOptions) {
        const {endpoints, ...baseOpts} = opts
        super(baseOpts);
        this.endpoints = endpoints
        this.net = new Net(this)
    }

    async init() {
        await super.init()
    }

    isConnected() {
        return this.connected
    }

    onConnected(listener: () => void) {
        if (this.connected) {
            listener()
            return () => undefined
        }

        this.connectedListeners.add(listener)
        return () => {
            this.connectedListeners.delete(listener)
        }
    }

    onState(listener: (patch: Record<string, unknown>) => void) {
        this.stateListeners.add(listener)
        return () => {
            this.stateListeners.delete(listener)
        }
    }

    private emitState(patch: Record<string, unknown>) {
        this.stateListeners.forEach((listener) => listener(patch))
    }

    private emitTrace(stage: HostStage, lastError?: string | null) {
        window.__cs15TraceUpdate?.({
            stage,
            ...(lastError === undefined ? {} : {lastError}),
        })
    }

    private notifyConnected() {
        this.connected = true
        this.connectingPromise = undefined
        this.emitState({
            transportConnected: true,
            connectedServer: this.connectAddress(),
        })
        this.connectedListeners.forEach((listener) => listener())
        this.connectedListeners.clear()
        this.flushPendingGamePackets()
    }

    private connectAddress() {
        return `${this.endpoints.connect.host}:${this.endpoints.connect.port}`
    }

    private isConnectTarget(packet: Packet) {
        return packet.port === this.endpoints.connect.port && tupleToHost(packet.ip) === this.endpoints.connect.host
    }

    private flushPendingGamePackets() {
        if (!this.channel) {
            return
        }

        if (this.pendingGamePackets.length > 0) {
            console.debug('[webrtc] flushing pending packets', this.pendingGamePackets.length)
        }

        while (this.pendingGamePackets.length) {
            const packet = this.pendingGamePackets.shift()
            if (!packet) {
                continue
            }
            this.channel.send(packet.data)
        }
    }

    private startConnection() {
        this.peer = new RTCPeerConnection()
        console.debug('[webrtc] peer created')
        this.peer.onicecandidate = (event) => {
            if (!event.candidate) {
                return
            }
            console.debug('[webrtc] local candidate')
            this.wsSend('candidate', event.candidate.toJSON())
        }
        this.peer.onconnectionstatechange = () => {
            console.debug('[webrtc] connection state', this.peer?.connectionState)
            if (this.peer?.connectionState === 'failed') {
                this.connectWs()
            }
        }
        this.stream?.getTracks()?.forEach((track) => {
            this.peer!.addTrack(track, this.stream!)
        })

        let openedChannels = 0
        this.peer.ondatachannel = (event) => {
            if (event.channel.label === 'write') {
                event.channel.onmessage = (message) => {
                    const markFirstPacket = () => {
                        if (this.sawFirstGamePacket) {
                            return
                        }
                        this.sawFirstGamePacket = true
                        console.debug('[webrtc] first game packet')
                        this.emitTrace('first_game_packet')
                    }
                    const packet: Packet = {
                        ip: ipToTuple(this.endpoints.connect.host),
                        port: this.endpoints.connect.port,
                        data: new Int8Array()
                    }
                    if (message.data instanceof Blob) {
                        message.data.arrayBuffer().then((data) => {
                            packet.data = new Int8Array(data);
                            markFirstPacket();
                            (this.net as Net).incoming.enqueue(packet)
                        })
                    } else if (message.data instanceof ArrayBuffer) {
                        packet.data = new Int8Array(message.data);
                        markFirstPacket();
                        (this.net as Net).incoming.enqueue(packet)
                    } else if (ArrayBuffer.isView(message.data)) {
                        packet.data = new Int8Array(
                            message.data.buffer,
                            message.data.byteOffset,
                            message.data.byteLength
                        );
                        markFirstPacket();
                        (this.net as Net).incoming.enqueue(packet)
                    } else {
                        markFirstPacket();
                        (this.net as Net).incoming.enqueue(packet)
                    }
                }
            }

            event.channel.onopen = () => {
                openedChannels += 1
                console.debug('[webrtc] datachannel open', event.channel.label, openedChannels)
                if (event.channel.label === 'read') {
                    this.channel = event.channel
                }
                if (openedChannels === 2 && this.resolve) {
                    const complete = this.resolve
                    this.resolve = undefined
                    this.emitTrace('datachannel_open')
                    this.notifyConnected()
                    complete()
                } else if (openedChannels === 2) {
                    this.emitTrace('datachannel_open')
                    this.notifyConnected()
                }
            }
        }

        this.handleDescription()
    }

    private async getUserMedia() {
        try {
            return await navigator.mediaDevices.getUserMedia({audio: true})
        } catch {
            return undefined
        }
    }

    private wsSend(event: string, data: unknown) {
        if (this.ws?.readyState !== WebSocket.OPEN) {
            return
        }
        this.ws.send(JSON.stringify({event, data}))
    }

    private async handleDescription() {
        if (!this.remoteDescription || !this.peer) {
            return
        }

        await this.peer.setRemoteDescription(this.remoteDescription)
        this.remoteDescription = undefined

        const answer = await this.peer.createAnswer()
        await this.peer.setLocalDescription(answer)
        this.wsSend('answer', answer)
        this.wasRemote = true
        this.handleCandidates()
    }

    private handleCandidates() {
        if (!this.candidates.length || !this.peer) {
            return
        }

        const queued = this.candidates
        this.candidates = []

        queued.forEach((candidate) => {
            this.peer!.addIceCandidate(candidate).catch(() => {
                this.candidates.push(candidate)
            })
        })
    }

    private connectWs() {
        if (this.ws) {
            this.ws.close()
        }
        if (this.peer) {
            this.peer.close()
            this.peer = undefined
        }
        this.channel = undefined
        this.connected = false
        this.wasRemote = false
        this.remoteDescription = undefined
        this.candidates = []
        this.sawFirstGamePacket = false

        const handler = async (event: MessageEvent) => {
            const parsed = JSON.parse(event.data)
            console.debug('[webrtc] ws message', parsed.event)
            switch (parsed.event) {
                case 'offer':
                    if (this.connected) {
                        console.debug('[webrtc] ignoring renegotiation offer after connect')
                        break
                    }
                    this.remoteDescription = parsed.data
                    await this.handleDescription()
                    break
                case 'candidate':
                    this.candidates.push(parsed.data)
                    if (this.wasRemote) {
                        this.handleCandidates()
                    }
                    break
            }
        }

        this.ws = new WebSocket(this.endpoints.signalURL)
        this.ws.onerror = () => {
            console.debug('[webrtc] websocket error')
            if (!this.connected) {
                this.connectWs()
            }
        }
        this.ws.addEventListener('message', handler)
        this.ws.onopen = () => {
            console.debug('[webrtc] websocket open')
            this.startConnection()
        }
    }

    async connect() {
        if (this.connected) {
            return
        }
        if (this.connectingPromise) {
            return this.connectingPromise
        }
        this.stream = await this.getUserMedia()
        this.connectingPromise = new Promise((resolve) => {
            this.resolve = resolve
            this.connectWs()
        })
        return this.connectingPromise
    }

    async getRuntimeState(timeoutMs = 1000): Promise<RuntimeState | null> {
        try {
            const log = await this.waitLog('cs15-runtime ', 'cs15_runtime_state\n', timeoutMs)
            const payload = log.slice(log.indexOf('cs15-runtime ') + 'cs15-runtime '.length).trim()
            return JSON.parse(payload) as RuntimeState
        } catch {
            return null
        }
    }

    private proxyConnectionless(packet: Packet) {
        const destination = tupleToHost(packet.ip)
        const masterQuery = isMasterQuery(packet.data)
        console.debug('[stock-net] connectionless query', destination, packet.port)

        void fetch(this.endpoints.queryURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                host: destination,
                port: packet.port,
                packet: toBase64(new Int8Array(packet.data)),
                timeout_ms: 1500,
            }),
        }).then(async (response) => {
            if (!response.ok) {
                throw new Error(`query bridge failed: ${response.status}`)
            }
            return response.json() as Promise<{ packet: string; host: string; port: number }>
        }).then((result) => {
            const bytes = fromBase64(result.packet)
            if (masterQuery) {
                this.serverListCount = countMasterServers(bytes)
            }
            this.emitState({
                phase: 'internet_browser' satisfies NetworkPhase,
                serverListCount: this.serverListCount,
            })
            ;(this.net as Net).incoming.enqueue({
                ip: ipToTuple(result.host),
                port: result.port,
                data: new Int8Array(bytes),
            })
        }).catch((error) => {
            console.error('[stock-net] query bridge error', error)
            this.emitState({
                lastError: error instanceof Error ? error.message : String(error),
            })
        })
    }

    sendto(packet: Packet) {
        const copy = clonePacket(packet)
        if (isMasterQuery(copy.data)) {
            this.proxyConnectionless(copy)
            return
        }

        if (this.isConnectTarget(copy) && isServerQuery(copy.data)) {
            this.proxyConnectionless(copy)
            return
        }

        if (this.isConnectTarget(copy)) {
            console.debug('[webrtc] game send', copy.data.length)
            this.emitState({
                phase: 'connecting' satisfies NetworkPhase,
                connectedServer: this.connectAddress(),
            })
        }

        if (!this.channel) {
            this.pendingGamePackets.push(copy)
            if (this.isConnectTarget(copy) && !this.connected) {
                void this.connect().catch(() => undefined)
            }
            return
        }

        this.channel.send(copy.data)
    }
}
