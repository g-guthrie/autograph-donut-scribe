import {Connection} from "./connection";
import {FetchServersParams, RegisterParams} from "./types";
import {Server} from "./server";

export class MServer {
    public readonly connections = new Map<number, Connection>
    public readonly servers = new Map<string, Server[]>

    onClient() {
        const connection = new Connection()
        this.connections.set(connection.id, connection)

        return connection
    }

    onClientDisconnect(id: number) {
        this.unregister(id)
        this.connections.delete(id)
    }

    fetchServers(params: FetchServersParams = {}) {
        const {
            game = 'valve',
            offset = 0,
            limit = 10
        } = params
        const allServers = this.servers.get(game) ?? []
        const servers = allServers.slice(offset, offset + limit)

        return {
            servers,
            offset,
            limit,
            total: allServers.length,
        }
    }

    unregister(connectionID: number) {
        const connection = this.connections.get(connectionID)
        if (!connection?.server) return;

        const game = connection.server.params.game
        const servers = this.servers.get(game)
        if (!servers) return;

        const newServers = servers.filter(s => s.connectionID !== connectionID)
        if (newServers.length) {
            this.servers.set(game, newServers)
        } else {
            this.servers.delete(game)
        }

        delete connection.server
    }

    register(id: number, params: RegisterParams) {
        const connection = this.connections.get(id)
        if (!connection) return

        this.unregister(id)

        connection.server = new Server(id, params)
        const servers = this.servers.get(params.game) ?? []
        servers.push(connection.server)
        this.servers.set(params.game, servers)
    }
}