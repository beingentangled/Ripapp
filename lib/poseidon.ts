import { buildPoseidon, type Poseidon } from 'circomlibjs'

let poseidonInstancePromise: Promise<Poseidon> | null = null

export async function getPoseidon(): Promise<Poseidon> {
    if (!poseidonInstancePromise) {
        poseidonInstancePromise = buildPoseidon()
    }
    return poseidonInstancePromise
}

export async function hashPoseidon(values: Array<string | number | bigint>): Promise<bigint> {
    const poseidon = await getPoseidon()
    const result = poseidon(values)
    return poseidon.F.toObject(result) as bigint
}

export async function poseidonHashHex(values: Array<string | number | bigint>): Promise<string> {
    const poseidon = await getPoseidon()
    const result = poseidon(values)
    const asBigInt = poseidon.F.toObject(result) as bigint
    return `0x${asBigInt.toString(16)}`
}
