import {HTTPMServer} from "./http";

const server = new HTTPMServer({
    port: 3001,
})

server.start()