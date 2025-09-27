import { buildPoseidon } from 'circomlibjs'

// Type definitions
export interface PoseidonInstance {
    (values: (string | number | bigint)[]): any
    F: {
        toObject(value: any): bigint
        toString(value: any): string
    }
}

let poseidonInstancePromise: Promise<PoseidonInstance> | null = null

export async function getPoseidon(): Promise<PoseidonInstance> {
    if (!poseidonInstancePromise) {
        poseidonInstancePromise = buildPoseidon() as Promise<PoseidonInstance>
    }
    return poseidonInstancePromise
}

export async function hashPoseidon(values: (string | number | bigint)[]): Promise<bigint> {
    const poseidon = await getPoseidon()
    const result = poseidon(values)
    return poseidon.F.toObject(result)
}

export async function poseidonHashHex(values: (string | number | bigint)[]): Promise<string> {
    const poseidon = await getPoseidon()
    const result = poseidon(values)
    const asBigInt = poseidon.F.toObject(result)
    return '0x' + BigInt(asBigInt).toString(16)
}