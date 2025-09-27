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

function toFieldString(value: string | number | bigint): string {
    if (typeof value === 'bigint') {
        return value.toString();
    }

    if (typeof value === 'number') {
        return BigInt(value).toString();
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return '0';
    }

    if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
        try {
            return BigInt(trimmed).toString();
        } catch {
            // Fall through and return the original string if it is not valid hex
        }
    }

    return trimmed;
}

function buildCircuitInputs(policy: PolicyData, proof: OracleMerkleProof, merkleRoot: string) {
    return {
        orderHash: toFieldString(policy.purchaseDetails.orderHash),
        invoicePrice: toFieldString(policy.purchaseDetails.invoicePrice),
        invoiceDate: toFieldString(policy.purchaseDetails.invoiceDate),
        productHash: toFieldString(policy.purchaseDetails.productHash),
        salt: toFieldString(policy.purchaseDetails.salt),
        selectedTier: toFieldString(policy.purchaseDetails.selectedTier),
        currentPrice: toFieldString(proof.currentPrice),
        leafHash: toFieldString(proof.leafBigInt || proof.leaf),
        merkleProof: proof.siblings.map(toFieldString),
        leafIndex: proof.pathIndices.map(index => Number(index)),
        commitment: toFieldString(policy.secretCommitment),
        merkleRoot: toFieldString(merkleRoot),
        policyStartDate: toFieldString(policy.policyPurchaseDate),
        paidPremium: toFieldString(policy.premium)
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
