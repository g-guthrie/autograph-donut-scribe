export type Address = number

export interface RTCSessionDescription {
    type: 'offer' | 'answer' | 'pranswer' | 'rollback'
    sdp: string
}

export interface DescriptionMessageIncoming {
    to: Address
    description: RTCSessionDescription
}

export interface DescriptionMessageOutgoing extends DescriptionMessageIncoming{
    from: Address
}

export interface RTCIceCandidateInit {
    candidate: string
    sdpMid?: string | null
    sdpMLineIndex?: number | null
    usernameFragment?: string | null
}

export interface CandidateMessageIncoming {
    to: Address
    candidate: RTCIceCandidateInit
}

export interface CandidateMessageOutgoing extends CandidateMessageIncoming{
    from: Address
}