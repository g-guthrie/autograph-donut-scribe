import {generateRandomID} from "./utils";
import {Server} from './server'

export class Connection {
    public readonly id

    public server?: Server

    constructor() {
        this.id = generateRandomID()
    }
}