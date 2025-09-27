import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import type { BaseContract, ContractTransactionResponse, ContractTransactionReceipt, Log } from 'ethers';
import styles from '../../styles/InvoiceWidget.module.css';
import { storageService, OrderInfo, OrderItem, SessionDataResult } from '../../utils/storage';
import { buildCommitment, InvoiceData, PurchaseDetails } from '../../lib/zk/commitment';
import { getInsuranceVaultContractWithSigner, getPaymentTokenContract } from '../../lib/contracts';
import {
    generatePolicyData,
    savePolicyForAddress,
    saveCommitmentForAddress,
    CommitmentData,
    getPoliciesForAddress,
    PolicyData,
    mergePolicyForAddress
} from '../../utils/policyManager';
import { useWallet } from '../../context/WalletContext';
import InvoiceHeader from './invoice/InvoiceHeader';
import ProcessingStatus from './invoice/ProcessingStatus';
import OrderItemsList from './invoice/OrderItemsList';
import NoItemsMessage from './invoice/NoItemsMessage';
import NoDataMessage from './invoice/NoDataMessage';
import { ProcessingState, ZkCommitmentDisplayData, ZkPurchaseState, ZkStep } from './invoice/types';
import { checkEligibility, formatUsdFromMicros } from '../../utils/oracleClient';
import type { OracleMerkleProof } from '../../utils/oracleClient';
import { generateClaimProof, formatMerkleRoot, formatPublicSignals } from '../../utils/zkClaimProof';

type ExtendedOrderItem = OrderItem & {
    orderId?: string;
    shipmentId?: string;
    trackingId?: string;
    productName?: string;
    orderTotal?: string;
    quantity?: string | number;
    priceUsdValue?: number;
    invoiceDetails?: {
        unitPrice?: string | number;
    } | null;
    [key: string]: unknown;
};

interface ExtendedOrderInfo {
    orderId?: string | null;
    shipmentId?: string | null;
    trackingId?: string | null;
    productName?: string | null;
    orderTotal?: string | null;
    orderDate?: string | null;
    orderStatus?: string | null;
    seller?: string | null;
    asin?: string | null;
    quantity?: string | number | null;
    invoiceUrl?: string | null;
    invoiceDetails?: {
        unitPrice?: string | number;
    } | null;
    currentAsin?: string | null;
}

type PaymentTokenContract = BaseContract & {
    allowance(owner: string, spender: string): Promise<bigint>;
    approve(spender: string, value: bigint): Promise<ContractTransactionResponse>;
};

type InsuranceVaultContract = BaseContract & {
    buyPolicy(commitment: string, premium: bigint): Promise<ContractTransactionResponse>;
    claimPayout(
        policyId: bigint,
        commitment: string,
        merkleRoot: string,
        policyPurchaseDate: bigint,
        premiumPaid: bigint,
        proofA: [string, string],
        proofB: [[string, string], [string, string]],
        proofC: [string, string],
        publicSignals: bigint[]
    ): Promise<ContractTransactionResponse>;
    priceMerkleRoot(): Promise<string>;
    policies(policyId: bigint): Promise<{
        buyer: string;
        commitment: string;
        premiumPaid: bigint;
        purchaseDate: bigint;
        alreadyClaimed: boolean;
    }>;
};

const coerceString = (...values: Array<unknown>): string | null => {
    for (const value of values) {
        if (typeof value === 'string' && value.trim().length > 0) {
            return value;
        }
    }
    return null;
};

const coerceQuantity = (...values: Array<unknown>): string | null => {
    for (const value of values) {
        if (value === null || value === undefined) continue;
        if (typeof value === 'number') {
            return value.toString();
        }
        if (typeof value === 'string' && value.trim().length > 0) {
            return value;
        }
    }
    return null;
};

const parsePriceToNumber = (value?: string | null): number | null => {
    if (!value) {
        return null;
    }
    const sanitized = value.replace(/[^0-9.,]/g, '').replace(/,/g, '');
    if (!sanitized) {
        return null;
    }
    const parsed = Number.parseFloat(sanitized);
    return Number.isFinite(parsed) ? parsed : null;
};

const normalizeProductId = (value?: string | null): string | null => {
    if (!value) {
        return null;
    }
    const uppercase = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return uppercase || null;
};

const buildProductPayloads = (info: OrderInfo | null): Array<{ id: string; name: string; basePrice: number }> => {
    if (!info) {
        return [];
    }

    const candidates = info.orderItems && info.orderItems.length > 0
        ? info.orderItems
        : [
            {
                asin: info.asin,
                name: info.productName,
                price: info.orderTotal
            }
        ];

    const payloads: Array<{ id: string; name: string; basePrice: number }> = [];
    const seenIds = new Set<string>();

    for (const candidate of candidates) {
        const rawId = candidate?.asin || candidate?.name || info.asin || info.productName || info.orderId;
        const normalizedId = normalizeProductId(rawId ?? undefined);
        if (!normalizedId || seenIds.has(normalizedId)) {
            continue;
        }

        const priceCandidate = candidate?.price || info.orderTotal || info.invoiceDetails?.unitPrice;
        const numericPrice = parsePriceToNumber(priceCandidate || null);
        if (numericPrice === null || numericPrice <= 0) {
            continue;
        }

        const name = candidate?.name || info.productName || normalizedId;
        const basePrice = Math.round(numericPrice * 1_000_000);

        payloads.push({ id: normalizedId, name, basePrice });
        seenIds.add(normalizedId);
    }

    return payloads;
};

const toNumber = (value: number | string | null | undefined): number | undefined => {
    if (value === null || value === undefined) {
        return undefined;
    }
    const numeric = typeof value === 'string' ? Number(value) : value;
    return Number.isFinite(numeric) ? numeric : undefined;
};

const formatTimestamp = (seconds?: number | null): string => {
    if (!seconds) {
        return 'Unknown';
    }
    const date = new Date(seconds * 1000);
    if (Number.isNaN(date.getTime())) {
        return 'Unknown';
    }
    return date.toLocaleString();
};

const formatUsdcValue = (value?: string | null): string => {
    if (!value) {
        return 'N/A';
    }
    try {
        return `${ethers.formatUnits(value, 6)} USDC`;
    } catch {
        try {
            return `${ethers.formatUnits(BigInt(value), 6)} USDC`;
        } catch {
            return value;
        }
    }
};

const shortenValue = (value?: string | null, leading = 6, trailing = 4): string => {
    if (!value) {
        return 'N/A';
    }
    if (value.length <= leading + trailing + 3) {
        return value;
    }
    return `${value.slice(0, leading)}…${value.slice(-trailing)}`;
};

const mapSessionDataToOrderInfo = (sessionData: SessionDataResult): OrderInfo => {
    const normalizedInfo = (sessionData.orderInfo ?? {}) as Partial<ExtendedOrderInfo>;
    const firstItem = sessionData.orderItems[0] as ExtendedOrderItem | undefined;

    return {
        orderId: coerceString(normalizedInfo.orderId, firstItem?.orderId, sessionData.sessionId),
        shipmentId: coerceString(normalizedInfo.shipmentId, firstItem?.shipmentId),
        trackingId: coerceString(normalizedInfo.trackingId, firstItem?.trackingId),
        productName: coerceString(normalizedInfo.productName, firstItem?.productName, firstItem?.name),
        orderTotal: coerceString(normalizedInfo.orderTotal, firstItem?.orderTotal, firstItem?.price),
        orderDate: coerceString(normalizedInfo.orderDate, firstItem?.orderDate),
        orderStatus: coerceString(normalizedInfo.orderStatus, firstItem?.orderStatus),
        seller: coerceString(normalizedInfo.seller, firstItem?.seller),
        asin: coerceString(normalizedInfo.asin, firstItem?.asin, normalizedInfo.currentAsin),
        quantity: coerceQuantity(normalizedInfo.quantity, firstItem?.quantity),
        orderItems: sessionData.orderItems,
        invoiceUrl: coerceString(normalizedInfo.invoiceUrl, firstItem?.invoiceUrl),
        invoiceDetails: normalizedInfo.invoiceDetails ?? firstItem?.invoiceDetails ?? null,
    };
};

interface ClaimEligibilityState {
    dropPercentage: number;
    dropAmountMicros: string;
    currentPriceMicros: string;
    formattedDrop: string;
    formattedCurrent: string;
    merkleRoot: string;
    proof: OracleMerkleProof;
    payoutAmount: string;
    checkedAt: number;
}

type ClaimStatus = 'idle' | 'active' | 'checking' | 'eligible' | 'ineligible' | 'claiming' | 'claimed' | 'error';

interface ClaimState {
    status: ClaimStatus;
    eligibility?: ClaimEligibilityState;
    error?: string;
    txHash?: string;
}

interface InvoiceWidgetProps {
    onOrderExtracted?: (orderInfo: OrderInfo) => void;
    onProcessingStateChange?: (state: string) => void;
    onItemSelected?: (item: OrderItem) => void;
}

const resolveProcessingStatusText = (
    processingState: ProcessingState,
    mounted: boolean,
    orderInfo: OrderInfo | null
): string => {
    let sessionId: string | null = null;
    let hasExtensionData = false;

    if (mounted && typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        sessionId = urlParams.get('sessionId');
        hasExtensionData = Boolean(sessionId) || Boolean(orderInfo);
    }

    switch (processingState) {
        case 'loading':
            return 'Checking for Amazon extension data...';
        case 'extracted':
            return hasExtensionData
                ? 'Order information loaded from Amazon extension'
                : 'No order data found from extension';
        case 'error':
            return 'Error loading order information from extension';
        case 'no-data':
            return 'No order information available. Please use the RIP (Remorse Insurance Protocol) extension on Amazon to extract order data first.';
        default:
            return 'Waiting for extension data...';
    }
};

const resolveStatusIcon = (processingState: ProcessingState): string => {
    switch (processingState) {
        case 'loading':
            return '⏳';
        case 'extracted':
            return '✅';
        case 'error':
            return '❌';
        case 'no-data':
            return '📄';
        default:
            return '⏳';
    }
};

const InvoiceWidget: React.FC<InvoiceWidgetProps> = ({
    onOrderExtracted,
    onProcessingStateChange,
    onItemSelected
}) => {
    const { address, isConnected, signer } = useWallet();
    const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null);
    const [processingState, setProcessingState] = useState<ProcessingState>('loading');
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [mounted, setMounted] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [isRetrying, setIsRetrying] = useState(false);

    const [zkProcessing, setZkProcessing] = useState(false);
    const [zkStep, setZkStep] = useState<ZkStep>('idle');
    const [zkError, setZkError] = useState<string | null>(null);
    const [zkCommitmentData, setZkCommitmentData] = useState<ZkCommitmentDisplayData | null>(null);
    const [selectedZkItem, setSelectedZkItem] = useState<OrderItem | null>(null);
    const [policies, setPolicies] = useState<PolicyData[]>([]);
    const syncedProductsRef = useRef<Set<string>>(new Set());
    const [claimStates, setClaimStates] = useState<Record<string, ClaimState>>({});

    const updateClaimState = useCallback((policyId: string, partial: Partial<ClaimState>) => {
        setClaimStates(prev => {
            const existing = prev[policyId];
            const nextStatus = partial.status ?? existing?.status ?? 'active';

            return {
                ...prev,
                [policyId]: {
                    ...existing,
                    ...partial,
                    status: nextStatus
                }
            };
        });
    }, []);

    const syncProductCatalog = useCallback(async (info: OrderInfo | null) => {
        if (typeof window === 'undefined') {
            return;
        }

        const payloads = buildProductPayloads(info);
        if (!payloads.length) {
            return;
        }

        await Promise.all(payloads.map(async (payload) => {
            if (syncedProductsRef.current.has(payload.id)) {
                return;
            }

            try {
                const response = await fetch('/api/products', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    syncedProductsRef.current.add(payload.id);
                } else {
                    const message = await response.text();
                    console.error('Failed to sync product catalog:', message);
                }
            } catch (error) {
                console.error('Error syncing product catalog:', error);
            }
        }));
    }, []);

    const applySessionData = useCallback((sessionData: SessionDataResult) => {
        const mappedOrderInfo = mapSessionDataToOrderInfo(sessionData);
        setOrderInfo(mappedOrderInfo);
        setProcessingState('extracted');
        onProcessingStateChange?.('extracted');
        onOrderExtracted?.(mappedOrderInfo);
        console.log('RIP: Order data successfully loaded with', sessionData.orderItems.length, 'items');
        syncProductCatalog(mappedOrderInfo);
    }, [onOrderExtracted, onProcessingStateChange, syncProductCatalog]);

    const loadOrderData = useCallback(async () => {
        try {
            setProcessingState('loading');
            onProcessingStateChange?.('loading');

            console.log('RIP: Loading order data from extension...');
            const data = await storageService.getOrderInfo();
            console.log('RIP: Received order data:', data);
            console.log('RIP: Order items count:', data?.orderItems?.length || 0);
            console.log('RIP: Order items content:', data?.orderItems);

            if (data && data.orderItems && data.orderItems.length > 0) {
                applySessionData(data);
            } else {
                console.log('RIP: No order data found from extension');
                setProcessingState('no-data');
                onProcessingStateChange?.('no-data');
            }
        } catch (error) {
            console.error('RIP: Error loading order data:', error);
            setProcessingState('error');
            onProcessingStateChange?.('error');
        }
    }, [applySessionData, onProcessingStateChange]);

    useEffect(() => {
        setMounted(true);
        loadOrderData();

        const handleExtensionMessage = (event: MessageEvent) => {
            if (event.data.source !== 'cryptoinsure-extension' || event.data.action !== 'sessionDataResponse') {
                return;
            }

            if (event.data.data) {
                const sessionData = storageService.transformSessionData(event.data.data, event.data.sessionId);
                if (sessionData.orderItems.length > 0) {
                    console.log('RIP: Applying order data directly from extension message');
                    applySessionData(sessionData);
                    return;
                }
            }

            if (event.data.autoProvided) {
                console.log('RIP: Auto-reloading due to extension data update');
                setTimeout(() => {
                    loadOrderData();
                }, 100);
            }
        };

        window.addEventListener('message', handleExtensionMessage);

        return () => {
            window.removeEventListener('message', handleExtensionMessage);
        };
    }, [applySessionData, loadOrderData]);

    useEffect(() => {
        if (!mounted) {
            return;
        }

        syncedProductsRef.current.clear();

        if (!address) {
            setPolicies([]);
            setClaimStates({});
            return;
        }

        const storedPolicies = getPoliciesForAddress(address);
        setPolicies(storedPolicies);

        setClaimStates(prev => {
            const next: Record<string, ClaimState> = {};

            storedPolicies.forEach(policy => {
                const previous = prev[policy.policyId];
                const status = policy.status || previous?.status || 'active';
                const eligibility = policy.eligibility
                    ? {
                        dropPercentage: policy.eligibility.dropPercentage,
                        dropAmountMicros: policy.eligibility.dropAmount,
                        currentPriceMicros: policy.eligibility.currentPrice,
                        formattedDrop: formatUsdFromMicros(policy.eligibility.dropAmount),
                        formattedCurrent: formatUsdFromMicros(policy.eligibility.currentPrice),
                        merkleRoot: policy.eligibility.merkleRoot || previous?.eligibility?.merkleRoot || '',
                        proof: policy.eligibility.proof || previous?.eligibility?.proof,
                        payoutAmount: policy.eligibility.payoutAmount || previous?.eligibility?.payoutAmount || '0',
                        checkedAt: policy.eligibility.checkedAt
                    }
                    : previous?.eligibility;

                next[policy.policyId] = {
                    status: status as ClaimStatus,
                    txHash: policy.claimTxHash || previous?.txHash,
                    eligibility,
                    error: previous?.error
                };
            });

            return next;
        });
    }, [address, mounted]);

    const retryLoad = async () => {
        setIsRetrying(true);
        setRetryCount(prev => prev + 1);
        await new Promise(resolve => setTimeout(resolve, 1000));
        await loadOrderData();
        setIsRetrying(false);
    };

    const handleItemInsure = async (item: OrderItem) => {
        try {
            if (!isConnected || !signer || !address) {
                alert('Please connect your wallet first using the wallet connect button in the top navigation.');
                return;
            }

            setZkProcessing(true);
            setZkError(null);
            setSelectedZkItem(item);

            const extendedItem = item as ExtendedOrderItem;
            const invoiceUnitPrice = extendedItem.invoiceDetails?.unitPrice;
            const invoiceUnitPriceString = typeof invoiceUnitPrice === 'number'
                ? invoiceUnitPrice.toString()
                : invoiceUnitPrice ?? null;

            const parsedPrice = typeof extendedItem.priceUsdValue === 'number'
                ? extendedItem.priceUsdValue
                : parsePriceToNumber(extendedItem.price ?? null)
                    ?? parsePriceToNumber(extendedItem.orderTotal ?? null)
                    ?? parsePriceToNumber(invoiceUnitPriceString)
                    ?? parsePriceToNumber(orderInfo?.orderTotal ?? null)
                    ?? 0;

            const usdPrice = parsedPrice;

            const productIdSource = extendedItem.asin
                || (typeof extendedItem.productName === 'string' ? extendedItem.productName : undefined)
                || (typeof orderInfo?.asin === 'string' ? orderInfo.asin : undefined)
                || (typeof orderInfo?.productName === 'string' ? orderInfo.productName : undefined)
                || (item.name ?? undefined)
                || 'unknown';

            const normalizedProductId = normalizeProductId(productIdSource) || 'UNKNOWN';

            const invoiceData: InvoiceData = {
                orderNumber: item.orderId || `ORDER_${Date.now()}`,
                productId: normalizedProductId,
                purchasePriceUsd: usdPrice,
                purchaseDate: item.orderDate ?
                    new Date(item.orderDate).toISOString().split('T')[0] :
                    new Date().toISOString().split('T')[0]
            };

            setZkStep('generating');
            console.log('🔨 Calling buildCommitment with invoiceData:', invoiceData);

            let buildCommitmentResult:
                | { commitment: string; details: PurchaseDetails; tier: number; premium: bigint }
                | undefined;
            try {
                buildCommitmentResult = await buildCommitment(invoiceData);
                console.log('🔨 buildCommitment returned:', buildCommitmentResult);

                if (!buildCommitmentResult || !buildCommitmentResult.commitment || !buildCommitmentResult.details) {
                    console.error('❌ buildCommitment returned invalid result:', buildCommitmentResult);
                    throw new Error('buildCommitment returned invalid or empty result');
                }
            } catch (error) {
                console.error('❌ buildCommitment failed:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                throw new Error(`Failed to generate commitment: ${errorMessage}`);
            }

            if (!buildCommitmentResult) {
                throw new Error('Commitment data missing after generation');
            }

            const { commitment, details, tier, premium } = buildCommitmentResult;

            const zkDataObject: ZkCommitmentDisplayData = {
                commitment,
                tier,
                premium: premium.toString(),
                invoicePrice: details.invoicePrice.toString(),
                details,
                itemData: item
            };

            setZkCommitmentData(zkDataObject);

            console.log('Generated commitment:', commitment);
            console.log('Tier:', tier, 'Premium:', ethers.formatUnits(premium, 6), 'USDC');

            if (!isConnected || !signer || !address) {
                throw new Error('Please connect your wallet first');
            }

            const insuranceVault = await getInsuranceVaultContractWithSigner(signer) as InsuranceVaultContract;
            const paymentToken = await getPaymentTokenContract(process.env.NEXT_PUBLIC_PAYMENT_TOKEN, signer);

            setZkStep('approving');
            const signerAddress = address;
            const vaultAddress = await insuranceVault.getAddress();

            const tokenContract = paymentToken as PaymentTokenContract;
            const vaultContract = insuranceVault as InsuranceVaultContract;

            let currentAllowance: bigint;
            try {
                currentAllowance = await tokenContract.allowance(signerAddress, vaultAddress);
            } catch (allowanceError) {
                console.warn('ripextension: Failed to fetch current allowance, defaulting to 0.', allowanceError);
                currentAllowance = BigInt(0);
            }

            if (currentAllowance < premium) {
                console.log('Approving token spend...');
                const approveTx = await tokenContract.approve(vaultAddress, premium);
                await approveTx.wait();
                console.log('Token approval confirmed');
            }

            setZkStep('purchasing');
            console.log('Purchasing policy with commitment:', commitment);
            console.log('Premium amount:', ethers.formatUnits(premium, 6), 'USDC');

            const tx = await vaultContract.buyPolicy(commitment, premium);

            console.log('Policy purchase transaction sent:', tx.hash);
            const receiptNullable = await tx.wait();
            if (!receiptNullable) {
                throw new Error('Transaction receipt was not received.');
            }

            const receipt = receiptNullable as ContractTransactionReceipt;

            const policyBoughtEvent = receipt.logs.find((log: Log) => {
                try {
                    const parsed = insuranceVault.interface.parseLog(log);
                    return parsed?.name === 'PolicyBought';
                } catch {
                    return false;
                }
            });

            let policyId = 'unknown';
            if (policyBoughtEvent) {
                const parsed = insuranceVault.interface.parseLog(policyBoughtEvent);
                policyId = parsed?.args?.policyId?.toString() || 'unknown';
            }

            console.log('Policy purchased successfully! Policy ID:', policyId);

            const userAddress = address;

            const serializableDetails = {
                orderHash: details.orderHash,
                invoicePrice: details.invoicePrice.toString(),
                invoiceDate: details.invoiceDate,
                productHash: `0x${details.productHash.toString(16)}`,
                salt: `0x${details.salt.toString(16)}`,
                selectedTier: details.selectedTier
            };

            const commitmentData: CommitmentData = {
                commitment,
                tier,
                premium: premium.toString(),
                invoicePrice: details.invoicePrice.toString(),
                details: serializableDetails,
                salt: `0x${details.salt.toString(16)}`,
                productHash: `0x${details.productHash.toString(16)}`,
                orderHash: details.orderHash
            };

            console.log('✅ Final commitment data for policy:', commitmentData);

            const contractAddresses = {
                vault: process.env.NEXT_PUBLIC_VAULT_ADDRESS || '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6',
                token: process.env.NEXT_PUBLIC_PAYMENT_TOKEN || '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853',
                verifier: process.env.NEXT_PUBLIC_VERIFIER_ADDRESS || '0x0165878A594ca255338adfa4d48449f69242Eb8F'
            };

            const invoiceDataForPolicy = {
                ...item,
                productId: normalizedProductId,
                purchaseDate: item.orderDate || new Date().toISOString()
            };

            const policyData = generatePolicyData(
                receipt.hash,
                receipt.blockNumber,
                policyId,
                commitmentData,
                invoiceDataForPolicy,
                contractAddresses
            );

            savePolicyForAddress(userAddress, policyData);
            saveCommitmentForAddress(userAddress, commitmentData);

            setPolicies(getPoliciesForAddress(userAddress));
            setClaimStates(prev => ({
                ...prev,
                [policyId]: {
                    status: 'active'
                }
            }));

            console.log('Policy and commitment data saved to localStorage');

            setZkStep('success');

            const itemKey = `${item.asin || item.name}_${item.quantity}`;
            setSelectedItems(prev => new Set([...prev, itemKey]));
            onItemSelected?.(item);

            setTimeout(() => {
                setZkStep('idle');
                setZkProcessing(false);
                setSelectedZkItem(null);
                setZkCommitmentData(null);
            }, 3000);
        } catch (error: unknown) {
            console.error('ZK Policy purchase failed:', error);
            const message = error instanceof Error ? error.message : 'Unknown error occurred';
            setZkError(message);
            setZkStep('idle');
        } finally {
            setZkProcessing(false);
        }
    };

    const isItemSelected = (item: OrderItem): boolean => {
        const itemKey = `${item.asin || item.name}_${item.quantity}`;
        return selectedItems.has(itemKey);
    };

    const handleClearZkError = () => {
        setZkError(null);
        setZkStep('idle');
        setSelectedZkItem(null);
    };

    const handleCheckClaim = useCallback(async (policy: PolicyData) => {
        if (!address) {
            alert('Please connect your wallet to check claims.');
            return;
        }

        if (!policy.purchaseDetails.productId || policy.purchaseDetails.productId === 'unknown') {
            alert('Unable to determine product ID for this policy.');
            return;
        }

        if (!/^[0-9]+$/.test(policy.policyId)) {
            alert('Policy ID is invalid.');
            return;
        }

        updateClaimState(policy.policyId, { status: 'checking', error: undefined });

        try {
            const originalPrice = BigInt(policy.purchaseDetails.invoicePrice);
            if (originalPrice <= BigInt(0)) {
                throw new Error('Invalid purchase price recorded for policy.');
            }

            const normalizedPolicyProductId = normalizeProductId(policy.purchaseDetails.productId) || policy.purchaseDetails.productId;
            const eligibility = await checkEligibility(normalizedPolicyProductId, originalPrice);

            updateClaimState(policy.policyId, {
                status: eligibility.eligible ? 'eligible' : 'ineligible',
                eligibility: {
                    dropPercentage: eligibility.dropPercentage,
                    dropAmountMicros: eligibility.dropAmount,
                    currentPriceMicros: eligibility.currentPrice,
                    formattedDrop: formatUsdFromMicros(eligibility.dropAmount),
                    formattedCurrent: formatUsdFromMicros(eligibility.currentPrice),
                    merkleRoot: eligibility.merkleRoot,
                    proof: eligibility.proof,
                    payoutAmount: eligibility.payoutAmount,
                    checkedAt: Date.now()
                }
            });

            const nextPurchaseDetails = normalizedPolicyProductId !== policy.purchaseDetails.productId
                ? { ...policy.purchaseDetails, productId: normalizedPolicyProductId }
                : policy.purchaseDetails;

            const updatedPolicy = mergePolicyForAddress(address, policy.policyId, {
                status: eligibility.eligible ? 'eligible' : 'ineligible',
                purchaseDetails: nextPurchaseDetails,
                eligibility: {
                    checkedAt: Date.now(),
                    dropPercentage: eligibility.dropPercentage,
                    dropAmount: eligibility.dropAmount,
                    currentPrice: eligibility.currentPrice,
                    merkleRoot: eligibility.merkleRoot,
                    proof: eligibility.proof,
                    payoutAmount: eligibility.payoutAmount
                }
            });

            if (updatedPolicy) {
                setPolicies(prev => prev.map(existing => existing.policyId === policy.policyId ? updatedPolicy : existing));
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to check claim eligibility.';
            console.error('Eligibility check failed:', error);
            updateClaimState(policy.policyId, { status: 'error', error: message });
        }
    }, [address, updateClaimState]);

    const handleSubmitClaim = useCallback(async (policy: PolicyData) => {
        if (!address || !signer) {
            alert('Please connect your wallet to submit a claim.');
            return;
        }

        const claimState = claimStates[policy.policyId];
        if (!claimState || !claimState.eligibility || !claimState.eligibility.proof) {
            alert('Please check claim eligibility before submitting.');
            return;
        }

        if (!/^[0-9]+$/.test(policy.policyId)) {
            alert('Policy ID is invalid.');
            return;
        }

        updateClaimState(policy.policyId, { status: 'claiming', error: undefined });

        try {
            const formattedRoot = formatMerkleRoot(claimState.eligibility.merkleRoot);
            const proofResult = await generateClaimProof(policy, claimState.eligibility.proof, claimState.eligibility.merkleRoot);

            const vault = await getInsuranceVaultContractWithSigner(signer) as InsuranceVaultContract;

            const [onChainRoot, storedPolicy] = await Promise.all([
                vault.priceMerkleRoot(),
                vault.policies(BigInt(policy.policyId))
            ]);

            if (onChainRoot.toLowerCase() !== formattedRoot.toLowerCase()) {
                throw new Error('Latest on-chain Merkle root does not match oracle root.');
            }

            const walletAddress = await signer.getAddress();
            if (storedPolicy.buyer.toLowerCase() !== walletAddress.toLowerCase()) {
                throw new Error('This policy belongs to another wallet.');
            }

            if (storedPolicy.alreadyClaimed) {
                throw new Error('Policy is already claimed on-chain.');
            }

            const policyIdBig = BigInt(policy.policyId);
            const commitmentHex = ethers.zeroPadValue(policy.secretCommitment, 32);
            const premiumBig = BigInt(policy.premium);
            const publicSignals = formatPublicSignals(proofResult.publicSignals);

            const tx = await vault.claimPayout(
                policyIdBig,
                commitmentHex,
                formattedRoot,
                BigInt(policy.policyPurchaseDate),
                premiumBig,
                proofResult.proof.a,
                proofResult.proof.b,
                proofResult.proof.c,
                publicSignals
            );

            const receiptNullable = await tx.wait();
            if (!receiptNullable) {
                throw new Error('Claim transaction did not return a receipt.');
            }

            const receipt = receiptNullable as ContractTransactionReceipt;

            updateClaimState(policy.policyId, {
                status: 'claimed',
                txHash: receipt.hash
            });

            const updatedPolicy = mergePolicyForAddress(address, policy.policyId, {
                status: 'claimed',
                claimTxHash: receipt.hash,
                claimedAt: Math.floor(Date.now() / 1000),
                eligibility: {
                    ...(policy.eligibility || {}),
                    checkedAt: Date.now(),
                    dropPercentage: claimState.eligibility.dropPercentage,
                    dropAmount: claimState.eligibility.dropAmountMicros,
                    currentPrice: claimState.eligibility.currentPriceMicros,
                    merkleRoot: claimState.eligibility.merkleRoot,
                    proof: claimState.eligibility.proof,
                    payoutAmount: claimState.eligibility.payoutAmount
                }
            });

            if (updatedPolicy) {
                setPolicies(prev => prev.map(existing => existing.policyId === policy.policyId ? updatedPolicy : existing));
            } else {
                setPolicies(getPoliciesForAddress(address));
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Claim submission failed.';
            console.error('Claim submission failed:', error);
            updateClaimState(policy.policyId, { status: 'error', error: message });
        }
    }, [address, signer, claimStates, updateClaimState]);

    const statusText = useMemo(
        () => resolveProcessingStatusText(processingState, mounted, orderInfo),
        [processingState, mounted, orderInfo]
    );

    const statusIcon = useMemo(
        () => resolveStatusIcon(processingState),
        [processingState]
    );

    const zkState: ZkPurchaseState = {
        processing: zkProcessing,
        step: zkStep,
        error: zkError,
        commitmentData: zkCommitmentData,
        selectedItem: selectedZkItem
    };

    const hasOrderItems = Boolean(orderInfo?.orderItems && orderInfo.orderItems.length > 0);

    return (
        <section className={styles.invoiceWidget}>
            <InvoiceHeader onRefresh={retryLoad} isRetrying={isRetrying} />
            <ProcessingStatus
                processingState={processingState}
                statusText={statusText}
                statusIcon={statusIcon}
                retryCount={retryCount}
            />

            {hasOrderItems && orderInfo?.orderItems && (
                <OrderItemsList
                    items={orderInfo.orderItems}
                    isConnected={Boolean(isConnected)}
                    onItemInsure={handleItemInsure}
                    isItemSelected={isItemSelected}
                    zkState={zkState}
                    onClearZkError={handleClearZkError}
                />
            )}

            {address && (
                <div className={styles.policySection}>
                    <h3 className={styles.policyHeader}>Saved Policies</h3>
                    {policies.length === 0 ? (
                        <p className={styles.policyEmpty}>No saved policies found for this wallet yet.</p>
                    ) : (
                        <div className={styles.policyCards}>
                            {policies.map(policy => {
                                const claimState = claimStates[policy.policyId] || { status: policy.status || 'active' };
                                const isEligible = claimState.status === 'eligible';
                                const isClaimed = claimState.status === 'claimed' || policy.status === 'claimed';
                                const isChecking = claimState.status === 'checking';
                                const isClaiming = claimState.status === 'claiming';

                                return (
                                    <div className={styles.policyCard} key={policy.transactionHash}>
                                        <div className={styles.policyCardHeader}>
                                            <div className={styles.policyMeta}>
                                                <span className={styles.policyId}>Policy #{policy.policyId}</span>
                                                <span className={styles.policyDate}>Purchased {formatTimestamp(toNumber(policy.policyPurchaseDate))}</span>
                                                <span className={styles.policyNetwork}>Network: {policy.network || 'Unknown'}</span>
                                            </div>
                                            <div className={styles.policyActionsHeader}>
                                                <span className={styles.policyStatusBadge} data-status={isClaimed ? 'claimed' : claimState.status}>
                                                    {isClaimed ? 'Claimed' : claimState.status === 'eligible' ? 'Eligible' : claimState.status === 'ineligible' ? 'Not Eligible' : claimState.status === 'claiming' ? 'Claiming…' : claimState.status === 'checking' ? 'Checking…' : 'Active'}
                                                </span>
                                                <div className={styles.policyActionButtons}>
                                                    {isEligible && !isClaimed ? (
                                                        <button
                                                            type="button"
                                                            className={styles.policyClaimButton}
                                                            onClick={() => handleSubmitClaim(policy)}
                                                            disabled={isClaiming}
                                                        >
                                                            {isClaiming ? 'Claiming…' : 'Claim Payout'}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            className={styles.policyClaimSecondaryButton}
                                                            onClick={() => handleCheckClaim(policy)}
                                                            disabled={isChecking || isClaimed}
                                                        >
                                                            {isClaimed ? 'Already Claimed' : isChecking ? 'Checking…' : 'Check Claim'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {claimState.error && !claimState.eligibility && (
                                            <p className={styles.policyError}>{claimState.error}</p>
                                        )}

                                        <div className={styles.policyDetailSection}>
                                            <h4 className={styles.policySectionTitle}>Coverage Summary</h4>
                                            <div className={styles.policyDetailGrid}>
                                                <div className={styles.policyDetail}>
                                                    <span className={styles.policyDetailLabel}>Premium</span>
                                                    <span className={styles.policyDetailValue}>{formatUsdcValue(policy.premium)}</span>
                                                </div>
                                                <div className={styles.policyDetail}>
                                                    <span className={styles.policyDetailLabel}>Invoice Price</span>
                                                    <span className={styles.policyDetailValue}>{formatUsdcValue(policy.purchaseDetails.invoicePrice)}</span>
                                                </div>
                                                <div className={styles.policyDetail}>
                                                    <span className={styles.policyDetailLabel}>Tier</span>
                                                    <span className={styles.policyDetailValue}>Tier {policy.tier}</span>
                                                </div>
                                                <div className={styles.policyDetail}>
                                                    <span className={styles.policyDetailLabel}>Invoice Date</span>
                                                    <span className={styles.policyDetailValue}>{formatTimestamp(toNumber(policy.purchaseDetails.invoiceDate))}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {claimState.eligibility && (
                                            <div className={styles.policyDetailSection}>
                                                <h4 className={styles.policySectionTitle}>Claim Eligibility</h4>
                                            <div className={styles.policyDetailGrid}>
                                                <div className={styles.policyDetail}>
                                                    <span className={styles.policyDetailLabel}>Current Price</span>
                                                    <span className={styles.policyDetailValue}>{claimState.eligibility.formattedCurrent}</span>
                                                </div>
                                                <div className={styles.policyDetail}>
                                                    <span className={styles.policyDetailLabel}>Price Drop</span>
                                                    <span className={styles.policyDetailValue}>{claimState.eligibility.formattedDrop}</span>
                                                </div>
                                                <div className={styles.policyDetail}>
                                                    <span className={styles.policyDetailLabel}>Drop %</span>
                                                    <span className={styles.policyDetailValue}>{claimState.eligibility.dropPercentage.toFixed(2)}%</span>
                                                </div>
                                                <div className={styles.policyDetail}>
                                                    <span className={styles.policyDetailLabel}>Potential Payout</span>
                                                    <span className={styles.policyDetailValue}>{formatUsdFromMicros(claimState.eligibility.payoutAmount)}</span>
                                                </div>
                                                <div className={styles.policyDetail}>
                                                    <span className={styles.policyDetailLabel}>Checked</span>
                                                    <span className={styles.policyDetailValue}>{new Date(claimState.eligibility.checkedAt).toLocaleString()}</span>
                                                </div>
                                            </div>
                                                {claimState.error && (
                                                    <p className={styles.policyError}>{claimState.error}</p>
                                                )}
                                                {claimState.txHash && (
                                                    <p className={styles.policySuccess}>Claimed in transaction {claimState.txHash}</p>
                                                )}
                                            </div>
                                        )}

                                        <div className={styles.policyDetailSection}>
                                            <h4 className={styles.policySectionTitle}>Identifiers</h4>
                                            <div className={styles.policyDetailGrid}>
                                                <div className={styles.policyDetail}>
                                                    <span className={styles.policyDetailLabel}>Product ID</span>
                                                    <span className={styles.policyDetailValue}>{policy.purchaseDetails.productId || 'Unknown'}</span>
                                                </div>
                                                <div className={styles.policyDetail}>
                                                    <span className={styles.policyDetailLabel}>Transaction Hash</span>
                                                    <span className={`${styles.policyDetailValue} ${styles.policyDetailMono}`} title={policy.transactionHash}>
                                                        {shortenValue(policy.transactionHash, 10, 8)}
                                                    </span>
                                                </div>
                                                <div className={styles.policyDetail}>
                                                    <span className={styles.policyDetailLabel}>Order Hash</span>
                                                    <span className={`${styles.policyDetailValue} ${styles.policyDetailMono}`} title={policy.purchaseDetails.orderHash}>
                                                        {shortenValue(policy.purchaseDetails.orderHash, 10, 8)}
                                                    </span>
                                                </div>
                                                <div className={styles.policyDetail}>
                                                    <span className={styles.policyDetailLabel}>Product Hash</span>
                                                    <span className={`${styles.policyDetailValue} ${styles.policyDetailMono}`} title={policy.purchaseDetails.productHash}>
                                                        {shortenValue(policy.purchaseDetails.productHash, 10, 8)}
                                                    </span>
                                                </div>
                                                <div className={styles.policyDetail}>
                                                    <span className={styles.policyDetailLabel}>Salt</span>
                                                    <span className={`${styles.policyDetailValue} ${styles.policyDetailMono}`} title={policy.purchaseDetails.salt}>
                                                        {shortenValue(policy.purchaseDetails.salt, 10, 8)}
                                                    </span>
                                                </div>
                                                <div className={styles.policyDetail}>
                                                    <span className={styles.policyDetailLabel}>Secret Commitment</span>
                                                    <span className={`${styles.policyDetailValue} ${styles.policyDetailMono}`} title={policy.secretCommitment}>
                                                        {shortenValue(policy.secretCommitment, 10, 8)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className={styles.policyDetailSection}>
                                            <h4 className={styles.policySectionTitle}>Contract References</h4>
                                            <div className={styles.policyDetailGrid}>
                                                <div className={styles.policyDetail}>
                                                    <span className={styles.policyDetailLabel}>Vault</span>
                                                    <span className={`${styles.policyDetailValue} ${styles.policyDetailMono}`} title={policy.contracts.vault}>
                                                        {shortenValue(policy.contracts.vault, 10, 8)}
                                                    </span>
                                                </div>
                                                <div className={styles.policyDetail}>
                                                    <span className={styles.policyDetailLabel}>Payment Token</span>
                                                    <span className={`${styles.policyDetailValue} ${styles.policyDetailMono}`} title={policy.contracts.token}>
                                                        {shortenValue(policy.contracts.token, 10, 8)}
                                                    </span>
                                                </div>
                                                <div className={styles.policyDetail}>
                                                    <span className={styles.policyDetailLabel}>Verifier</span>
                                                    <span className={`${styles.policyDetailValue} ${styles.policyDetailMono}`} title={policy.contracts.verifier}>
                                                        {shortenValue(policy.contracts.verifier, 10, 8)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {processingState === 'extracted' && orderInfo && (!orderInfo.orderItems || orderInfo.orderItems.length === 0) && (
                <NoItemsMessage />
            )}

            {processingState === 'no-data' && (
                <NoDataMessage />
            )}
        </section>
    );
};

export default InvoiceWidget;
