import { ethers } from 'ethers';
import { getPoseidon } from './poseidon';

export interface InvoiceData {
    orderNumber: string;
    purchasePriceUsd: number;
    purchaseDate: string;
    productId: string;
}

export interface PurchaseDetails {
    orderHash: string;
    invoicePrice: bigint;
    invoiceDate: number;
    productHash: bigint;
    salt: bigint;
    selectedTier: number;
}

export interface TierBoundary {
    min: bigint;
    max: bigint;
    tier: number;
    premium: bigint;
}

// Premium tiers (must match circuit and contract)
export const TIER_BOUNDARIES: TierBoundary[] = [
    { min: BigInt(1000000), max: BigInt(99999999), tier: 1, premium: BigInt(1000000) }, // $1-99.99 → $1
    { min: BigInt(100000000), max: BigInt(499000000), tier: 2, premium: BigInt(3000000) }, // $100-499 → $3
    { min: BigInt(500000000), max: BigInt(999000000), tier: 3, premium: BigInt(7000000) }, // $500-999 → $7
    { min: BigInt(1000000000), max: BigInt(1999000000), tier: 4, premium: BigInt(13000000) }, // $1000-1999 → $13
    { min: BigInt(2000000000), max: BigInt(10000000000), tier: 5, premium: BigInt(20000000) }, // $2000-10000 → $20
];

const TOKEN_MULTIPLIER = BigInt(1_000_000); // USDC 6 decimals

export async function buildCommitment(invoiceData: InvoiceData) {
    console.log('🔧 Building commitment for:', invoiceData);

    try {
        const poseidon = await getPoseidon();
        const F = poseidon.F;

        const { orderNumber, purchasePriceUsd, purchaseDate, productId } = invoiceData;

        // Convert to blockchain format
        const orderHash = ethers.keccak256(ethers.toUtf8Bytes(orderNumber));
        const invoicePrice = BigInt(Math.round(purchasePriceUsd * Number(TOKEN_MULTIPLIER)));
        const invoiceDate = Math.floor(new Date(purchaseDate).getTime() / 1000);

        // Hash product ID
        const productIdBytes = ethers.toUtf8Bytes(productId);
        const productIdHash = ethers.keccak256(productIdBytes);
        const productHashBigInt = BigInt(productIdHash);
        const productHashField = poseidon([productHashBigInt]);
        const productHash = poseidon.F.toObject(productHashField);

        // Generate random salt
        const saltArray = new Uint8Array(32);
        crypto.getRandomValues(saltArray);
        const saltHex = Array.from(saltArray).map(b => b.toString(16).padStart(2, '0')).join('');
        const salt = BigInt('0x' + saltHex);
        console.log('🔧 Generated salt:', '0x' + saltHex);

        // Calculate tier
        const { tier } = calculateTierAndPremium(invoicePrice);
        console.log('🔧 Calculated tier:', tier, 'for price:', ethers.formatUnits(invoicePrice, 6), 'USDC');

        const purchaseDetails: PurchaseDetails = {
            orderHash,
            invoicePrice,
            invoiceDate,
            productHash,
            salt,
            selectedTier: tier,
        };

        // Generate commitment
        const commitment = poseidon([
            BigInt(purchaseDetails.orderHash),
            purchaseDetails.invoicePrice,
            BigInt(purchaseDetails.invoiceDate),
            purchaseDetails.productHash,
            purchaseDetails.salt,
            BigInt(purchaseDetails.selectedTier),
        ]);

        const commitmentHex = '0x' + F.toObject(commitment).toString(16).padStart(64, '0');
        console.log('🔧 Generated commitment:', commitmentHex);

        console.log('🔧 Commitment generation completed successfully');
        return {
            commitment: commitmentHex,
            details: purchaseDetails,
            tier,
            premium: calculateTierAndPremium(invoicePrice).premium,
        };
    } catch (error) {
        console.error('❌ Error in buildCommitment:', error);
        throw error;
    }
}

export function calculateTierAndPremium(invoicePrice: bigint): { tier: number; premium: bigint } {
    for (const boundary of TIER_BOUNDARIES) {
        if (invoicePrice >= boundary.min && invoicePrice <= boundary.max) {
            return {
                tier: boundary.tier,
                premium: boundary.premium,
            };
        }
    }
    throw new Error(`Invoice price ${invoicePrice} outside valid tier ranges`);
}
