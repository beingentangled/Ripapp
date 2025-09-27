import { groth16, type CircuitSignals, type Groth16Proof, type PublicSignals } from 'snarkjs'

const DEFAULT_WASM_PATH = '/circuits/priceProtection.wasm'
const DEFAULT_ZKEY_PATH = '/circuits/circuit_final.zkey'
const DEFAULT_VKEY_PATH = '/circuits/verification_key.json'

interface CircuitArtifacts {
    wasm: Uint8Array;
    zkey: Uint8Array;
    verificationKey: Record<string, unknown>;
}

interface ProofOptions {
    wasmPath?: string;
    zkeyPath?: string;
    vkeyPath?: string;
}

type ProofInput = CircuitSignals;

interface ProofResult {
    proof: Groth16Proof;
    publicSignals: PublicSignals;
}

interface SerializedProof {
    a: string[];
    b: string[][];
    c: string[];
}

let cachedArtifacts: CircuitArtifacts | null = null

async function fetchBinary(url: string): Promise<Uint8Array> {
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
    }
    const buffer = await response.arrayBuffer()
    return new Uint8Array(buffer)
}

async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
    }
    return response.json() as Promise<T>
}

export async function loadCircuitArtifacts(options: ProofOptions = {}): Promise<CircuitArtifacts> {
    if (cachedArtifacts) {
        return cachedArtifacts
    }

    const wasmPath = options.wasmPath || DEFAULT_WASM_PATH
    const zkeyPath = options.zkeyPath || DEFAULT_ZKEY_PATH
    const vkeyPath = options.vkeyPath || DEFAULT_VKEY_PATH

    const [wasm, zkey, verificationKey] = await Promise.all([
        fetchBinary(wasmPath),
        fetchBinary(zkeyPath),
        fetchJson<Record<string, unknown>>(vkeyPath)
    ])

    cachedArtifacts = { wasm, zkey, verificationKey }
    return cachedArtifacts
}

export async function generateProof(input: ProofInput, options?: ProofOptions): Promise<ProofResult> {
    const { wasm, zkey } = await loadCircuitArtifacts(options)
    const { proof, publicSignals } = await groth16.fullProve(input, wasm, zkey)
    return { proof, publicSignals }
}

export async function verifyProof(proof: Groth16Proof, publicSignals: PublicSignals, options?: ProofOptions): Promise<boolean> {
    const { verificationKey } = await loadCircuitArtifacts(options)
    return groth16.verify(verificationKey, publicSignals, proof)
}

export function serializeProofForContract(proof: Groth16Proof | null | undefined): SerializedProof | null {
    if (!proof) return null
    const a = proof.pi_a.slice(0, 2)
    const b = proof.pi_b.slice(0, 2).map(inner => [...inner].reverse())
    const c = proof.pi_c.slice(0, 2)

    return { a, b, c }
}
