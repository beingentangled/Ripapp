import React from 'react';
import styles from '../../../styles/InvoiceWidget.module.css';

const NoDataMessage: React.FC = () => (
    <div className={styles.noItemsMessage}>
        <h4 style={{ color: '#232F3E', marginBottom: '1rem' }}>Get Started with RIP</h4>
        <p style={{ marginBottom: '1rem' }}>
            To use this insurance platform, you need to first extract order data from Amazon:
        </p>
        <ol style={{ textAlign: 'left', maxWidth: '400px', margin: '0 auto', lineHeight: '1.6' }}>
            <li>Install the RIP (Remorse Insurance Protocol) browser extension</li>
            <li>Go to your Amazon order history page</li>
            <li>Click the "Insure by Crypto" button on any order</li>
            <li>Your order data will be loaded here automatically</li>
        </ol>
    </div>
);

export default NoDataMessage;
