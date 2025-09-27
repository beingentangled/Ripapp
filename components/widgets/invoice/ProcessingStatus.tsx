import React from 'react';
import styles from '../../../styles/InvoiceWidget.module.css';
import { ProcessingState } from './types';

interface ProcessingStatusProps {
    processingState: ProcessingState;
    statusText: string;
    statusIcon: string;
    retryCount: number;
}

const ProcessingStatus: React.FC<ProcessingStatusProps> = ({
    processingState,
    statusText,
    statusIcon,
    retryCount
}) => (
    <div className={styles.processingStatus}>
        <p className={styles.statusText}>
            <span className={styles.statusIcon}>
                {processingState === 'loading' ? (
                    <span className={styles.loadingSpinner}></span>
                ) : (
                    statusIcon
                )}
            </span>
            {statusText}
        </p>
        {retryCount > 0 && (
            <small style={{ color: '#666', fontSize: '0.8rem', marginTop: '0.5rem', display: 'block' }}>
                Retried {retryCount} time{retryCount > 1 ? 's' : ''}
            </small>
        )}
        {processingState === 'error' && (
            <div style={{
                background: '#fff3cd',
                border: '1px solid #ffeaa7',
                borderRadius: '4px',
                padding: '0.75rem',
                marginTop: '0.5rem'
            }}>
                <strong style={{ color: '#856404' }}>Extension Bridge Error</strong>
                <p style={{ margin: '0.25rem 0 0 0', color: '#856404', fontSize: '0.85rem' }}>
                    The browser extension is not responding. Make sure:
                </p>
                <ul style={{ margin: '0.5rem 0 0 1rem', color: '#856404', fontSize: '0.85rem' }}>
                    <li>The RIP (Remorse Insurance Protocol) extension is installed and enabled</li>
                    <li>You&apos;ve visited an Amazon order page recently</li>
                    <li>Try refreshing this page</li>
                </ul>
            </div>
        )}
    </div>
);

export default ProcessingStatus;
