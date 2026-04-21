import {RegisterParams} from "./types";

export class Server {
    public readonly params
    public readonly connectionID

    constructor(connectionID: number, params: RegisterParams) {
        this.connectionID = connectionID
        this.params = params
    }

    toJSON() {
        return {
            name: this.params.name,
            address: this.connectionID,
            maxPlayers: this.params.maxPlayers,
            map: this.params.map,
            iceServers: this.params.iceServers,
        }
    }
}
