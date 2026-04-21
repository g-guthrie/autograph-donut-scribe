export interface FetchServersParams {
    offset?: number
    limit?: number
    game?: string
}

export interface ICEServer {
    urls: string | string[]
    username?: string
    credential?: string
}

export interface RegisterParams {
    name: string
    game: string
    maxPlayers: number
    map: string
    iceServers?: ICEServer[]
}