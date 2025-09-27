// Policy management utilities for storing and retrieving ZK insurance policies

export interface PolicyData {
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
    status?: 'active' | 'eligible' | 'ineligible' | 'claimed';
    eligibility?: {
        checkedAt: number;
        dropPercentage: number;
        dropAmount: string;
        currentPrice: string;
        merkleRoot?: string;
        proof?: any;
        payoutAmount?: string;
    };
    claimTxHash?: string;
    claimedAt?: number;
}

export interface CommitmentData {
    commitment: string;
    tier: number;
    premium: string;
    invoicePrice: string;
    details: any;
    salt: string;
    productHash: string;
    orderHash: string;
}

// Get all policies for a specific wallet address
export function getPoliciesForAddress(walletAddress: string): PolicyData[] {
    if (typeof window === 'undefined') return [];

    try {
        const key = `zkpp_policies_${walletAddress.toLowerCase()}`;
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Error loading policies from localStorage:', error);
        return [];
    }
}

// Save a new policy for a wallet address
export function savePolicyForAddress(
    walletAddress: string,
    policyData: PolicyData
): void {
    if (typeof window === 'undefined') return;

    try {
        const key = `zkpp_policies_${walletAddress.toLowerCase()}`;
        const existingPolicies = getPoliciesForAddress(walletAddress);

        // Check if policy already exists (by transaction hash)
        const exists = existingPolicies.some(p => p.transactionHash === policyData.transactionHash);
        if (exists) {
            console.log('Policy already exists, skipping save');
            return;
        }

        const updatedPolicies = [...existingPolicies, policyData];
        localStorage.setItem(key, JSON.stringify(updatedPolicies, null, 2));

        console.log('✅ Policy saved to localStorage:', policyData.policyId);
    } catch (error) {
        console.error('Error saving policy to localStorage:', error);
    }
}

// Generate policy data from successful transaction
export function generatePolicyData(
    transactionHash: string,
    blockNumber: number,
    policyId: string,
    commitmentData: CommitmentData,
    invoiceData: any,
    contractAddresses: {
        vault: string;
        token: string;
        verifier: string;
    }
): PolicyData {
    const now = new Date();
    const invoiceDate = invoiceData.purchaseDate
        ? new Date(invoiceData.purchaseDate).getTime() / 1000
        : Math.floor(now.getTime() / 1000);

    return {
        policyId,
        transactionHash,
        blockNumber,
        policyPurchaseDate: Math.floor(now.getTime() / 1000),
        purchaseDetails: {
            orderHash: commitmentData.orderHash,
            invoicePrice: commitmentData.invoicePrice,
            invoiceDate,
            productHash: commitmentData.productHash,
            salt: commitmentData.salt,
            selectedTier: commitmentData.tier,
            productId: invoiceData.productId || 'unknown'
        },
        secretCommitment: commitmentData.commitment,
        premium: commitmentData.premium,
        tier: commitmentData.tier,
        contracts: contractAddresses,
        createdAt: now.toISOString(),
        network: process.env.NEXT_PUBLIC_CHAIN_ID === '31337' ? 'anvil-local' : 'unknown',
        status: 'active'
    };
}

export function updatePolicyForAddress(
    walletAddress: string,
    policyId: string,
    updater: (policy: PolicyData) => PolicyData
): PolicyData | null {
    if (typeof window === 'undefined') return null;

    try {
        const key = `zkpp_policies_${walletAddress.toLowerCase()}`;
        const existingPolicies = getPoliciesForAddress(walletAddress);
        const index = existingPolicies.findIndex(policy => policy.policyId === policyId);

        if (index === -1) {
            return null;
        }

        const updatedPolicy = updater({ ...existingPolicies[index] });
        existingPolicies[index] = updatedPolicy;
        localStorage.setItem(key, JSON.stringify(existingPolicies, null, 2));
        return updatedPolicy;
    } catch (error) {
        console.error('Error updating policy in localStorage:', error);
        return null;
    }
}

export function mergePolicyForAddress(
    walletAddress: string,
    policyId: string,
    updates: Partial<PolicyData>
): PolicyData | null {
    return updatePolicyForAddress(walletAddress, policyId, (policy) => ({
        ...policy,
        ...updates,
        eligibility: updates.eligibility ? { ...policy.eligibility, ...updates.eligibility } : policy.eligibility
    }));
}

// Get commitment data for a specific wallet address
export function getCommitmentsForAddress(walletAddress: string): CommitmentData[] {
    if (typeof window === 'undefined') return [];

    try {
        const key = `zkpp_commitments_${walletAddress.toLowerCase()}`;
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Error loading commitments from localStorage:', error);
        return [];
    }
}

// Save commitment data for a wallet address
export function saveCommitmentForAddress(
    walletAddress: string,
    commitmentData: CommitmentData
): void {
    if (typeof window === 'undefined') return;

    try {
        const key = `zkpp_commitments_${walletAddress.toLowerCase()}`;
        const existingCommitments = getCommitmentsForAddress(walletAddress);

        // Check if commitment already exists
        const exists = existingCommitments.some(c => c.commitment === commitmentData.commitment);
        if (exists) {
            console.log('Commitment already exists, skipping save');
            return;
        }

        const updatedCommitments = [...existingCommitments, commitmentData];
        localStorage.setItem(key, JSON.stringify(updatedCommitments, null, 2));

        console.log('✅ Commitment saved to localStorage:', commitmentData.commitment.slice(0, 10) + '...');
    } catch (error) {
        console.error('Error saving commitment to localStorage:', error);
    }
}

// Export policy data as JSON (for debugging/backup)
export function exportPolicyAsJson(policy: PolicyData): string {
    return JSON.stringify(policy, null, 2);
}

// Clear all policies for a wallet (useful for testing)
export function clearPoliciesForAddress(walletAddress: string): void {
    if (typeof window === 'undefined') return;

    const policyKey = `zkpp_policies_${walletAddress.toLowerCase()}`;
    const commitmentKey = `zkpp_commitments_${walletAddress.toLowerCase()}`;

    localStorage.removeItem(policyKey);
    localStorage.removeItem(commitmentKey);

    console.log('🗑️ Cleared all policies and commitments for address:', walletAddress);
}
