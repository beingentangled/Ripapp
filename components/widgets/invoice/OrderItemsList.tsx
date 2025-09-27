import React from 'react';
import styles from '../../../styles/InvoiceWidget.module.css';
import { OrderItem } from '../../../utils/storage';
import { ZkPurchaseState } from './types';
import OrderItemCard from './OrderItemCard';

interface OrderItemsListProps {
    items: OrderItem[];
    isConnected: boolean;
    onItemInsure: (item: OrderItem) => void | Promise<void>;
    isItemSelected: (item: OrderItem) => boolean;
    zkState: ZkPurchaseState;
    onClearZkError: () => void;
}

const OrderItemsList: React.FC<OrderItemsListProps> = ({
    items,
    isConnected,
    onItemInsure,
    isItemSelected,
    zkState,
    onClearZkError
}) => (
    <div className={styles.itemsContainer}>
        <h3 className={styles.itemsHeader}>
            Order Items ({items.length}) - From Amazon Extension
        </h3>
        <div className={styles.itemCards}>
            {items.map((item, index) => (
                <OrderItemCard
                    key={`${item.asin || item.name || 'item'}-${index}`}
                    item={item}
                    isConnected={isConnected}
                    onInsure={onItemInsure}
                    isSelected={isItemSelected(item)}
                    zkState={zkState}
                    onClearZkError={onClearZkError}
                />
            ))}
        </div>
    </div>
);

export default OrderItemsList;
