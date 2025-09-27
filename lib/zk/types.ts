// Type definitions for ZK purchase policy functionality

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

export interface PolicyRecord {
    policyId: string;
    transactionHash: string;
    blockNumber: number;
    policyPurchaseDate: number;
    purchaseDetails: {
        orderHash: string;
        invoicePrice: string;
        invoiceDate: number;
        productHash: string;
        salt: string;
        selectedTier: number;
        productId: string;
    };
    secretCommitment: string;
    premium: string;
    tier: number;
    contracts: {
        vault: string;
        token: string;
        verifier: string;
    };
    createdAt: string;
    network: string;
}

export interface DeploymentAddresses {
    vault: string;
    token: string;
    verifier: string;
}