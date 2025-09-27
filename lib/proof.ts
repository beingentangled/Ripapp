import { groth16 } from 'snarkjs'

const DEFAULT_WASM_PATH = '/circuits/priceProtection.wasm'
const DEFAULT_ZKEY_PATH = '/circuits/circuit_final.zkey'
const DEFAULT_VKEY_PATH = '/circuits/verification_key.json'

interface CircuitArtifacts {
    wasm: Uint8Array;
    zkey: Uint8Array;
    verificationKey: any;
}

interface ProofOptions {
    wasmPath?: string;
    zkeyPath?: string;
    vkeyPath?: string;
}

interface ProofResult {
    proof: any;
    publicSignals: any[];
}

interface SerializedProof {
    a: any[];
    b: any[];
    c: any[];
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

async function fetchJson(url: string): Promise<any> {
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
    }
    return response.json()
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
        fetchJson(vkeyPath)
    ])

    cachedArtifacts = { wasm, zkey, verificationKey }
    return cachedArtifacts
}

export async function generateProof(input: any, options?: ProofOptions): Promise<ProofResult> {
    const { wasm, zkey } = await loadCircuitArtifacts(options)
    const { proof, publicSignals } = await groth16.fullProve(input, wasm, zkey)
    return { proof, publicSignals }
}

export async function verifyProof(proof: any, publicSignals: any[], options?: ProofOptions): Promise<boolean> {
    const { verificationKey } = await loadCircuitArtifacts(options)
    return groth16.verify(verificationKey, publicSignals, proof)
}

export function serializeProofForContract(proof: any): SerializedProof | null {
    if (!proof) return null
    return {
        a: proof.pi_a?.slice(0, 2) ?? [],
        b: proof.pi_b?.map((inner: any) => inner.slice().reverse())?.slice(0, 2) ?? [],
        c: proof.pi_c?.slice(0, 2) ?? []
    }
}