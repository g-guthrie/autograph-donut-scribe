import {SERVER_SCHEMA} from "./common";

export const WS_V1_REGISTER_SCHEMA = {
    type: 'array',
    minItems: 2,
    maxItems: 2,
    additionalItems: false,
    items: [
        { const: 'v1:server.register' },
        {
            type: 'object',
            properties: {
                ...Object.fromEntries(
                    Object.entries(SERVER_SCHEMA.properties).filter(([key]) => key !== 'address')
                ),
            },
            required: SERVER_SCHEMA.required.filter(r => r !== 'address'),
            additionalProperties: false
        },
    ],
}

export const WS_V1_UNREGISTER_SCHEMA = {
    type: 'array',
    minItems: 2,
    maxItems: 2,
    additionalItems: false,
    items: [
        { const: 'v1:server.unregister' },
        {
            type: 'object',
            additionalProperties: false
        },
    ],
}

export const WS_V1_DESCRIPTION = {
    type: 'array',
    minItems: 2,
    maxItems: 2,
    additionalItems: false,
    items: [
        { const: 'v1:signalling.description' },
        {
            type: 'object',
            properties: {
                to: {type: 'integer'},
                description: {
                    type: 'object',
                    properties: {
                        type: {
                            type: "string",
                            enum: ["offer", "answer", "pranswer", "rollback"],
                            description: "The type of the session description."
                        },
                        sdp: {
                            type: "string",
                            nullable: true,
                            description: "The SDP message content for the session description."
                        }
                    },
                    required: ["type"],
                    additionalProperties: false
                }
            },
            additionalProperties: false
        },
    ],
}

export const WS_V1_CANDIDATE = {
    type: 'array',
    minItems: 2,
    maxItems: 2,
    additionalItems: false,
    items: [
        { const: 'v1:signalling.candidate' },
        {
            type: 'object',
            properties: {
                to: {type: 'integer'},
                description: {
                    type: 'object',
                    properties: {
                        candidate: {
                            type: "string",
                            description: "The ICE candidate-attribute line in SDP syntax."
                        },
                        sdpMid: {
                            type: "string",
                            nullable: true,
                            description: "The media stream identification tag."
                        },
                        sdpMLineIndex: {
                            type: "number",
                            nullable: true,
                            description: "The index (starting at zero) of the media description."
                        },
                        usernameFragment: {
                            type: "string",
                            nullable: true,
                            description: "The username fragment for the remote peer."
                        }
                    },
                    required: ["candidate"],
                    additionalProperties: false
                }
            },
            additionalProperties: false
        },
    ],
}

export const WS_MESSAGE_SCHEMA = {
    oneOf: [
        WS_V1_REGISTER_SCHEMA,
        WS_V1_UNREGISTER_SCHEMA,
        WS_V1_DESCRIPTION,
        WS_V1_CANDIDATE,
    ],
}