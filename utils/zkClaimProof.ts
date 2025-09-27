import type { PolicyData } from './policyManager';
import type { OracleMerkleProof } from './oracleClient';

interface GeneratedClaimProof {
    proof: {
        a: [string, string];
        b: [[string, string], [string, string]];
        c: [string, string];
    };
    publicSignals: string[];
}

const DEFAULT_ZK_BASE = '/zk';

function getZkBasePath(): string {
    return process.env.NEXT_PUBLIC_ZK_ASSETS_BASE || DEFAULT_ZK_BASE;
}

function toHex32(value: string | bigint): string {
    const asBigInt = typeof value === 'bigint' ? value : BigInt(value);
    const hex = asBigInt.toString(16);
    return `0x${hex.padStart(64, '0')}`;
}

function formatProof(fullProof: any): GeneratedClaimProof {
    const { proof, publicSignals } = fullProof;
    return {
        proof: {
            a: [proof.pi_a[0], proof.pi_a[1]],
            b: [
                [proof.pi_b[0][1], proof.pi_b[0][0]],
                [proof.pi_b[1][1], proof.pi_b[1][0]]
            ],
            c: [proof.pi_c[0], proof.pi_c[1]]
        },
        publicSignals: publicSignals.map((signal: any) => signal.toString())
    };
}

function buildCircuitInputs(policy: PolicyData, proof: OracleMerkleProof, merkleRoot: string) {
    return {
        orderHash: policy.purchaseDetails.orderHash,
        invoicePrice: policy.purchaseDetails.invoicePrice,
        invoiceDate: policy.purchaseDetails.invoiceDate,
        productHash: policy.purchaseDetails.productHash,
        salt: policy.purchaseDetails.salt,
        selectedTier: policy.purchaseDetails.selectedTier,
        currentPrice: proof.currentPrice.toString(),
        leafHash: proof.leafBigInt || proof.leaf,
        merkleProof: proof.siblings,
        leafIndex: proof.pathIndices,
        commitment: policy.secretCommitment,
        merkleRoot: merkleRoot,
        policyStartDate: policy.policyPurchaseDate,
        paidPremium: policy.premium
    };
}

async function loadVerificationKey(): Promise<any> {
    const response = await fetch(`${getZkBasePath()}/priceProtection_verification_key.json`);
    if (!response.ok) {
        throw new Error(`Failed to load verification key (${response.status})`);
    }
    return response.json();
}

export async function generateClaimProof(
    policy: PolicyData,
    proof: OracleMerkleProof,
    merkleRoot: string
): Promise<GeneratedClaimProof> {
    const snarkjs = await import('snarkjs');

    const inputs = buildCircuitInputs(policy, proof, merkleRoot);
    const wasmPath = `${getZkBasePath()}/priceProtection.wasm`;
    const zkeyPath = `${getZkBasePath()}/priceProtection_final.zkey`;

    const fullProof = await snarkjs.groth16.fullProve(inputs, wasmPath, zkeyPath);
    const formatted = formatProof(fullProof);

    try {
        const vKey = await loadVerificationKey();
        const isValid = await snarkjs.groth16.verify(vKey, formatted.publicSignals, fullProof.proof);
        if (!isValid) {
            console.warn('ripextension: Proof verification failed locally; contract verification will run on-chain.');
        }
    } catch (error) {
        console.warn('ripextension: Unable to verify proof locally:', error);
    }

    return formatted;
}

export function formatPublicSignals(publicSignals: string[]): bigint[] {
    return publicSignals.map(signal => BigInt(signal));
}

export function formatMerkleRoot(root: string): string {
    try {
        return toHex32(root);
    } catch {
        return root;
    }
}
