import Fastify, {FastifyInstance, FastifyPluginAsync} from 'fastify';
import websocket from '@fastify/websocket';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import pino from 'pino'
import Ajv from 'ajv';
import {MServer} from "./mserver";
import {CandidateMessageOutgoing, FetchServersParams, RegisterParams} from "./types";
import {ROOT_SCHEMA, V1_GET_SERVERS_SCHEMA, WS_MESSAGE_SCHEMA} from "./schemas";
import packageInfo from '../package.json'

export interface HTTPMServerConfig {
    port: number
    disableDocs?: boolean
    logLevel?: pino.Level
    enablePrettyLogs?: boolean
}

export class HTTPMServer extends MServer {
    public readonly fastify: FastifyInstance
    public config: HTTPMServerConfig
    public ajv: Ajv
    public wsMessageValidate
    public wsConnections = new Map<number, WebSocket>

    constructor(config: HTTPMServerConfig) {
        super()

        this.ajv = new Ajv()

        this.wsMessageValidate = this.ajv.compile(WS_MESSAGE_SCHEMA);

        this.config = config

        this.fastify = Fastify({
            logger: {
                transport: config.enablePrettyLogs
                    ? {
                        target: 'pino-pretty',
                    }
                    : undefined,
                level: config.logLevel,
            }
        });

        this.fastify.register(websocket);

        if (!this.config.disableDocs) {
            this.fastify.register(swagger, {
                swagger: {
                    info: {
                        title: packageInfo.name,
                        description: packageInfo.description,
                        version: packageInfo.version,
                    },
                },
            });
            this.fastify.register(swaggerUI, {
                routePrefix: '/docs',
                uiConfig: {
                    docExpansion: 'full',
                    deepLinking: false
                }
            });
        }

        this.fastify.register(this.httpRoutes)
        this.fastify.register(this.wsRoutes)
    }

    private wsRoutes: FastifyPluginAsync = async (fastify) => {
        fastify.get('/ws', {websocket: true}, (connection, req) => {
            const client = this.onClient()
            connection.on('message', (message) => {
                try {
                    const msg = typeof message === 'string' ? message : message.toString();
                    const data = JSON.parse(msg)
                    if (!this.wsMessageValidate(data)) return

                    const [event, payload] = data as [string, unknown]
                    switch (event) {
                        case 'v1:server.register':
                            this.register(client.id, payload as RegisterParams)
                            break
                        case 'v1:server.unregister':
                            this.unregister(client.id)
                            break
                        case 'v1:signalling.description':
                        case 'v1:signalling.candidate':
                            const dataToSend = payload as CandidateMessageOutgoing
                            const toClient = this.wsConnections.get(dataToSend.to)
                            if (toClient) {
                                dataToSend.from = client.id
                                toClient.send(JSON.stringify([event, dataToSend]))
                            }
                            break
                    }
                } catch (e) {
                    req.log.error(e)
                }
            });

            connection.on('close', () => {
                this.onClientDisconnect(client.id)
            });

            connection.send(JSON.stringify(['v1:connect', {id: client.id}]))
        });
    }

    private httpRoutes: FastifyPluginAsync = async (fastify) => {
        fastify.get('/', {
            schema: ROOT_SCHEMA
        }, async () => {
            return {
                time: Math.floor(Date.now() / 1000)
            }
        });

        fastify.get('/v1/servers', {
            schema: V1_GET_SERVERS_SCHEMA
        }, async (request) => {
            return this.fetchServers(request.query as FetchServersParams);
        });
    }

    async start() {
        await this.fastify.listen({port: this.config.port});
    }
}