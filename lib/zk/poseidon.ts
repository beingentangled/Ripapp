import { buildPoseidon } from 'circomlibjs';

let poseidonPromise: ReturnType<typeof buildPoseidon> | null = null;

export async function getPoseidon() {
    if (!poseidonPromise) {
        poseidonPromise = buildPoseidon();
    }
    return poseidonPromise;
}