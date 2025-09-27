export interface OraclePrice {
    id: string;
    name: string;
    currentPrice: number;
    basePrice: number;
    change: number;
}

export interface OraclePricesResponse {
    prices: OraclePrice[];
    merkleRoot: string;
    timestamp: number;
}

export interface OracleMerkleProof {
    leaf: string;
    currentPrice: number;
    proof: Array<{ position: 'left' | 'right'; data: string }>;
    siblings: string[];
    pathIndices: number[];
    root: string;
    productName: string;
    leafBigInt: string;
    productHash: string;
    productId: string;
}

export interface EligibilityResult {
    eligible: boolean;
    dropPercentage: number;
    dropAmount: string;
    currentPrice: string;
    merkleRoot: string;
    proof: OracleMerkleProof;
    payoutAmount: string;
}

const DEFAULT_DROP_THRESHOLD = 10; // percent

const ORACLE_BASE_URL = (typeof window !== 'undefined'
    ? window.localStorage.getItem('ripextension_oracle_url')
    : null) || process.env.NEXT_PUBLIC_ORACLE_URL || 'http://localhost:3001';

function buildEndpoint(endpoint: string): string {
    return `${ORACLE_BASE_URL.replace(/\/$/, '')}${endpoint}`;
}

function normalizeOracleProductId(value: string): string {
    return value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .trim();
}

async function fetchJson<T>(endpoint: string): Promise<T> {
    const response = await fetch(buildEndpoint(endpoint));
    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Request failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
}

export async function getOraclePrices(): Promise<OraclePricesResponse> {
    return fetchJson<OraclePricesResponse>('/api/prices');
}

export async function getMerkleProof(productId: string): Promise<OracleMerkleProof> {
    const encodedId = encodeURIComponent(productId);
    return fetchJson<OracleMerkleProof>(`/api/merkle-proof/${encodedId}`);
}

export async function checkEligibility(
    productId: string,
    originalPrice: bigint,
    dropThresholdPercent: number = Number(process.env.NEXT_PUBLIC_CLAIM_DROP_THRESHOLD || DEFAULT_DROP_THRESHOLD)
): Promise<EligibilityResult> {
    const { prices, merkleRoot } = await getOraclePrices();

    const normalizedInputId = normalizeOracleProductId(productId);
    const trimmedInputId = productId.trim().toLowerCase();

    const matchedProduct = prices.find(price => {
        const normalizedPriceId = normalizeOracleProductId(price.id);
        if (normalizedInputId) {
            return normalizedPriceId === normalizedInputId;
        }
        return price.id.trim().toLowerCase() === trimmedInputId;
    });

    if (!matchedProduct) {
        throw new Error(`Product ${productId} not found in oracle catalog.`);
    }

    const proof = await getMerkleProof(matchedProduct.id);

    if (proof.root !== merkleRoot) {
        console.warn('ripextension: Oracle proof root does not match reported merkle root.', { proofRoot: proof.root, merkleRoot });
    }

    const currentPrice = BigInt(matchedProduct.currentPrice);
    const dropAmount = originalPrice > currentPrice ? originalPrice - currentPrice : BigInt(0);
    const originalPriceNumber = Number(originalPrice.toString());
    const dropAmountNumber = Number(dropAmount.toString());
    const dropPercentage = originalPriceNumber > 0
        ? (dropAmountNumber / originalPriceNumber) * 100
        : 0;

    const eligible = dropAmount > BigInt(0) && dropPercentage >= dropThresholdPercent;

    return {
        eligible,
        dropPercentage: Math.round(dropPercentage * 100) / 100,
        dropAmount: dropAmount.toString(),
        currentPrice: currentPrice.toString(),
        merkleRoot,
        proof,
        payoutAmount: dropAmount.toString()
    };
}

export function formatUsdFromMicros(value: string | number | bigint): string {
    try {
        const bigValue = BigInt(value);
        const dollars = Number(bigValue) / 1_000_000;
        return `$${dollars.toFixed(2)}`;
    } catch {
        return String(value);
    }
}
