import React from 'react';
import styles from '../../../styles/InvoiceWidget.module.css';

interface InvoiceHeaderProps {
    onRefresh: () => void | Promise<void>;
    isRetrying: boolean;
}

const InvoiceHeader: React.FC<InvoiceHeaderProps> = ({ onRefresh, isRetrying }) => (
    <div className={styles.invoiceHeader}>
        <h2 className={styles.invoiceTitle}>Invoice & Order Processing</h2>
        <div className={styles.headerActions}>
            <button
                onClick={onRefresh}
                disabled={isRetrying}
                title="Refresh from Extension"
                style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: isRetrying ? 'not-allowed' : 'pointer',
                    fontSize: '1.2rem',
                    opacity: isRetrying ? 0.6 : 1,
                    padding: '0.25rem'
                }}
            >
                {isRetrying ? '⏳' : '🔄'}
            </button>
        </div>
    </div>
);

export default InvoiceHeader;
