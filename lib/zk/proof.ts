import { groth16 } from 'snarkjs';

export interface ProofData {
    proof: {
        pi_a: [string, string];
        pi_b: [[string, string], [string, string]];
        pi_c: [string, string];
    };
    publicSignals: string[];
}

export async function generateZKProof(
    orderHash: string,
    invoicePrice: bigint,
    invoiceDate: number,
    productHash: bigint,
    salt: bigint,
    selectedTier: number,
    currentPrice: bigint,
    leafHash: bigint,
    merkleProof: bigint[],
    leafIndex: number[],
    commitment: string,
    merkleRoot: string,
    policyStartDate: number,
    paidPremium: bigint
): Promise<ProofData> {
    // Prepare circuit inputs
    const input = {
        // Private inputs
        orderHash: orderHash,
        invoicePrice: invoicePrice.toString(),
        invoiceDate: invoiceDate.toString(),
        productHash: productHash.toString(),
        salt: salt.toString(),
        selectedTier: selectedTier.toString(),
        currentPrice: currentPrice.toString(),
        leafHash: leafHash.toString(),
        merkleProof: merkleProof.map(p => p.toString()),
        leafIndex: leafIndex.map(i => i.toString()),

        // Public inputs
        commitment: commitment,
        merkleRoot: merkleRoot,
        policyStartDate: policyStartDate.toString(),
        paidPremium: paidPremium.toString(),
    };

    try {
        // Load circuit artifacts
        const wasmResponse = await fetch('/circuits/priceProtection.wasm');
        const wasmBuffer = await wasmResponse.arrayBuffer();

        const zkeyResponse = await fetch('/circuits/priceProtection_final.zkey');
        const zkeyBuffer = await zkeyResponse.arrayBuffer();

        // Generate proof using circuit artifacts
        const { proof, publicSignals } = await groth16.fullProve(
            input,
            new Uint8Array(wasmBuffer),
            new Uint8Array(zkeyBuffer)
        );

        const pi_a = Array.isArray(proof.pi_a) ? proof.pi_a.slice(0, 2) : [];
        const pi_b = Array.isArray(proof.pi_b) ? proof.pi_b.slice(0, 2) : [];
        const pi_c = Array.isArray(proof.pi_c) ? proof.pi_c.slice(0, 2) : [];

        const normalized: ProofData = {
            proof: {
                pi_a: [pi_a[0] ?? '0', pi_a[1] ?? '0'],
                pi_b: [
                    [pi_b[0]?.[0] ?? '0', pi_b[0]?.[1] ?? '0'],
                    [pi_b[1]?.[0] ?? '0', pi_b[1]?.[1] ?? '0']
                ],
                pi_c: [pi_c[0] ?? '0', pi_c[1] ?? '0']
            },
            publicSignals: publicSignals.map(signal => signal.toString())
        };

        return normalized;
    } catch (error) {
        console.error('ZK proof generation failed:', error);
        throw new Error(`Failed to generate ZK proof: ${error}`);
    }
}

export function formatProofForSolidity(proof: ProofData) {
    return {
        a: [proof.proof.pi_a[0], proof.proof.pi_a[1]],
        b: [[proof.proof.pi_b[0][1], proof.proof.pi_b[0][0]], [proof.proof.pi_b[1][1], proof.proof.pi_b[1][0]]],
        c: [proof.proof.pi_c[0], proof.proof.pi_c[1]],
        publicInputs: proof.publicSignals.map(signal => signal.toString()),
    };
}

export function serializeProofForContract(proof: ProofData) {
    return formatProofForSolidity(proof);
}
