import React from 'react';
import styles from '../../../styles/InvoiceWidget.module.css';

const NoItemsMessage: React.FC = () => (
    <div className={styles.noItemsMessage}>
        <p>
            <strong>Order loaded from extension!</strong><br />
            No individual items were extracted from this order.
            The order summary is available above. You can still get insurance quotes for the entire order.
        </p>
    </div>
);

export default NoItemsMessage;
