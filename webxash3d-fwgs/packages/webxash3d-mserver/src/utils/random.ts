import {randomInt} from 'crypto'

export function generateRandomID(min = 1000, max = 9000) {
    return randomInt(min, max + 1);
}
