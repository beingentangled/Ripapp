import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import styles from '../../../styles/InvoiceWidget.module.css';
import { OrderItem } from '../../../utils/storage';
import { ZkPurchaseState } from './types';

interface OrderItemCardProps {
    item: OrderItem;
    isConnected: boolean;
    onInsure: (item: OrderItem) => void | Promise<void>;
    isSelected: boolean;
    zkState: ZkPurchaseState;
    onClearZkError: () => void;
}

const OrderItemCard: React.FC<OrderItemCardProps> = ({
    item,
    isConnected,
    onInsure,
    isSelected,
    zkState,
    onClearZkError
}) => {
    const [imageError, setImageError] = useState(false);

    useEffect(() => {
        setImageError(false);
    }, [item.imageUrl]);
    const isProcessingItem = zkState.processing && zkState.selectedItem === item;
    const isItemWithError = zkState.error && zkState.selectedItem === item;
    const showCommitmentData = isProcessingItem && zkState.commitmentData;

    const renderButtonLabel = () => {
        if (!isConnected) {
            return '🔗 Connect Wallet First';
        }

        if (isProcessingItem) {
            switch (zkState.step) {
                case 'generating':
                    return '🔄 Generating Commitment...';
                case 'approving':
                    return '✓ Approving Tokens...';
                case 'purchasing':
                    return '💰 Purchasing Policy...';
                case 'success':
                    return '✅ Policy Purchased!';
                default:
                    return 'Processing...';
            }
        }

        if (isSelected) {
            return 'Policy Purchased';
        }

        return '🔐 Get ZK Privacy Insurance';
    };

    return (
        <div className={styles.itemCard}>
            <div className={styles.itemHeader}>
                {item.imageUrl && !imageError ? (
                    <Image
                        src={item.imageUrl}
                        alt={item.name}
                        width={96}
                        height={96}
                        className={styles.itemImage}
                        onError={() => setImageError(true)}
                    />
                ) : (
                    <div className={styles.itemImagePlaceholder}>
                        No Image
                    </div>
                )}
                <div className={styles.itemDetails}>
                    <h4 className={styles.itemName}>{item.name}</h4>
                    <div className={styles.itemMeta}>
                        {item.asin && (
                            <p className={styles.itemProperty}>
                                <strong>ASIN:</strong> {item.asin}
                            </p>
                        )}
                        {item.orderId && (
                            <p className={styles.itemProperty}>
                                <strong>Order ID:</strong> {item.orderId}
                            </p>
                        )}
                        {item.orderDate && (
                            <p className={styles.itemProperty}>
                                <strong>Order Date:</strong> {item.orderDate}
                            </p>
                        )}
                        {item.orderStatus && (
                            <p className={styles.itemProperty}>
                                <strong>Status:</strong> {item.orderStatus}
                            </p>
                        )}
                        {item.seller && (
                            <p className={styles.itemProperty}>
                                <strong>Seller:</strong> {item.seller}
                            </p>
                        )}
                        {item.quantity && (
                            <p className={styles.itemProperty}>
                                <strong>Quantity:</strong> {item.quantity}
                            </p>
                        )}
                    </div>
                    {item.price && (
                        <p className={styles.itemPrice}>{item.price}</p>
                    )}
                    {item.invoiceUrl && (
                        <div className={styles.invoiceLink}>
                            <a
                                href={item.invoiceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.invoiceButton}
                            >
                                📄 View Invoice
                            </a>
                        </div>
                    )}
                </div>
            </div>
            <div className={styles.itemActions}>
                <button
                    className={styles.insureButton}
                    onClick={() => onInsure(item)}
                    disabled={!isConnected || isSelected || isProcessingItem}
                    title={!isConnected ? 'Please connect your wallet first' : ''}
                >
                    {renderButtonLabel()}
                </button>

                {showCommitmentData && zkState.commitmentData && (
                    <div className={styles.zkProgress}>
                        <div className={styles.commitmentInfo}>
                            <p><strong>Tier:</strong> {zkState.commitmentData.tier}</p>
                            <p><strong>Premium:</strong> ${(Number(zkState.commitmentData.premium) / 1000000).toFixed(2)} USDC</p>
                            <p><strong>Privacy Hash:</strong> {zkState.commitmentData.commitment.slice(0, 10)}...</p>
                        </div>
                    </div>
                )}

                {isItemWithError && zkState.error && (
                    <div className={styles.zkError}>
                        <p><strong>Error:</strong> {zkState.error}</p>
                        <button onClick={onClearZkError} className={styles.retryButton}>
                            Try Again
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OrderItemCard;
