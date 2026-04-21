import {SERVER_SCHEMA} from "./common";

export const ROOT_SCHEMA = {
    description: 'Returns UNIX timestamp of the server. Can be used as a health check',
    response: {
        200: {
            type: 'object',
            properties: {
                time: {type: 'integer'}
            },
            required: ['time'],
            additionalProperties: false
        }
    }
}

export const V1_GET_SERVERS_SCHEMA = {
    description: 'Fetch paginated list of available servers',
    querystring: {
        type: 'object',
        properties: {
            offset: {type: 'integer', minimum: 0, default: 0},
            limit: {type: 'integer', minimum: 1, maximum: 10, default: 10},
            game: {type: 'string', default: 'valve'}
        },
        additionalProperties: false
    },
    response: {
        200: {
            type: 'object',
            properties: {
                servers: {
                    type: 'array',
                    items: SERVER_SCHEMA
                },
                offset: {type: 'integer'},
                limit: {type: 'integer'},
                total: {type: 'integer'}
            }
        }
    }
}