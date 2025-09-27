import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ethers } from 'ethers';
import styles from '../../styles/InvoiceWidget.module.css';
import { storageService, OrderInfo, OrderItem, SessionDataResult } from '../../utils/storage';
import { buildCommitment, InvoiceData, PurchaseDetails } from '../../lib/zk/commitment';
import { getInsuranceVaultContractWithSigner, getPaymentTokenContract } from '../../lib/contracts';
import {
    generatePolicyData,
    savePolicyForAddress,
    saveCommitmentForAddress,
    CommitmentData
} from '../../utils/policyManager';
import { useWallet } from '../../context/WalletContext';
import InvoiceHeader from './invoice/InvoiceHeader';
import ProcessingStatus from './invoice/ProcessingStatus';
import OrderItemsList from './invoice/OrderItemsList';
import NoItemsMessage from './invoice/NoItemsMessage';
import NoDataMessage from './invoice/NoDataMessage';
import { ProcessingState, ZkCommitmentDisplayData, ZkPurchaseState, ZkStep } from './invoice/types';

type ExtendedOrderItem = OrderItem & Record<string, any>;

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

const mapSessionDataToOrderInfo = (sessionData: SessionDataResult): OrderInfo => {
    const normalizedInfo = (sessionData.orderInfo ?? {}) as Record<string, any>;
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

    const applySessionData = useCallback((sessionData: SessionDataResult) => {
        const mappedOrderInfo = mapSessionDataToOrderInfo(sessionData);
        setOrderInfo(mappedOrderInfo);
        setProcessingState('extracted');
        onProcessingStateChange?.('extracted');
        onOrderExtracted?.(mappedOrderInfo);
        console.log('RIP: Order data successfully loaded with', sessionData.orderItems.length, 'items');
    }, [onOrderExtracted, onProcessingStateChange]);

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

            const invoiceData: InvoiceData = {
                orderNumber: item.orderId || `ORDER_${Date.now()}`,
                productId: item.asin || `PRODUCT_${Date.now()}`,
                purchasePriceUsd: parseFloat(item.price?.replace(/[₹$,]/g, '') || '0'),
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

            const insuranceVault = await getInsuranceVaultContractWithSigner(signer);
            const paymentToken = await getPaymentTokenContract(process.env.NEXT_PUBLIC_PAYMENT_TOKEN, signer);

            setZkStep('approving');
            const signerAddress = address;
            const vaultAddress = await insuranceVault.getAddress();

            const tokenContract = paymentToken as any;
            const vaultContract = insuranceVault as any;

            const currentAllowance = await tokenContract.allowance(signerAddress, vaultAddress);

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
            const receipt = await tx.wait();

            const policyBoughtEvent = receipt.logs.find((log: any) => {
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
                productHash: '0x' + (details.productHash as bigint).toString(16),
                salt: '0x' + (details.salt as bigint).toString(16),
                selectedTier: details.selectedTier
            };

            const commitmentData: CommitmentData = {
                commitment,
                tier,
                premium: premium.toString(),
                invoicePrice: details.invoicePrice.toString(),
                details: serializableDetails,
                salt: '0x' + (details.salt as bigint).toString(16),
                productHash: '0x' + (details.productHash as bigint).toString(16),
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
                productId: item.asin || item.name || 'unknown',
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
        } catch (error: any) {
            console.error('ZK Policy purchase failed:', error);
            setZkError(error.message || 'Unknown error occurred');
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
