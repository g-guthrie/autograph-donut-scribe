export const ICE_SERVER_SCHEMA = {
    type: 'object',
    properties: {
        urls: {
            oneOf: [
                {type: 'string'},
                {
                    type: 'array',
                    items: {type: 'string'},
                    minItems: 1
                }
            ]
        },
        username: {type: 'string'},
        credential: {type: 'string'},
    },
    required: ['urls'],
    additionalProperties: false
}

export const SERVER_SCHEMA = {
    type: 'object',
    properties: {
        name: {type: 'string'},
        address: {type: 'integer'},
        maxPlayers: {type: 'integer'},
        map: {type: 'string'},
        iceServers: {
            type: 'array',
            items: ICE_SERVER_SCHEMA
        }
    },
    required: ['name', 'address', 'maxPlayers', 'map'],
    additionalProperties: false
}