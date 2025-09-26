import React, { useState, useEffect } from 'react';
import { useAppKit, useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react';
import styles from '../styles/Header.module.css';

interface HeaderWidgetProps {
    title: string;
}

const HeaderWidget: React.FC<HeaderWidgetProps> = ({ title }) => {
    const { open } = useAppKit();
    const { address, isConnected, status } = useAppKitAccount();
    const { chainId } = useAppKitNetwork();
    const [mounted, setMounted] = useState(false);


    useEffect(() => {
        setMounted(true);
    }, []);

    const getNetworkName = (chainId?: string | number): string => {
        const numChainId = typeof chainId === 'string' ? parseInt(chainId) : chainId;
        switch (numChainId) {
            case 1: return 'Ethereum Mainnet';
            case 137: return 'Polygon';
            case 8453: return 'Base';
            case 10: return 'Optimism';
            case 42161: return 'Arbitrum One';
            case 11155111: return 'Sepolia';
            default: return numChainId ? `Chain ${numChainId}` : 'Unknown Network';
        }
    };

    const formatAddress = (addr?: string): string => {
        if (!addr) return '';
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    return (
        <header className={styles.header}>
            <div className={styles.headerContent}>
                <div className={styles.logo}>
                    <h1>{title}</h1>
                    <p>Decentralized Insurance Platform</p>
                </div>

                <div className={styles.walletSection}>
                    {!mounted ? (
                        // Show loading state during SSR and initial client render
                        <div className={styles.disconnectedWallet}>
                            <button
                                className={styles.connectButton}
                                disabled={true}
                            >
                                Loading...
                            </button>
                        </div>
                    ) : isConnected && address ? (
                        <div className={styles.connectedWallet}>
                            <div className={styles.networkInfo}>
                                <span className={styles.networkBadge}>
                                    🌐 {getNetworkName(chainId)}
                                </span>
                            </div>
                            <div className={styles.walletInfo}>
                                <span className={styles.walletAddress}>
                                    {formatAddress(address)}
                                </span>
                                <div className={styles.connectedIndicator}>
                                    <span className={styles.statusDot}>●</span>
                                    Connected
                                </div>
                            </div>
                            <button
                                className={styles.walletButton}
                                onClick={() => open()}
                                disabled={status === 'connecting' || status === 'reconnecting'}
                            >
                                {status === 'connecting' || status === 'reconnecting' ? '...' : 'Wallet'}
                            </button>
                        </div>
                    ) : (
                        <div className={styles.disconnectedWallet}>
                            <button
                                className={styles.connectButton}
                                onClick={() => open()}
                                disabled={status === 'connecting' || status === 'reconnecting'}
                            >
                                {status === 'connecting' || status === 'reconnecting' ? 'Connecting...' : 'Connect Wallet'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default HeaderWidget;
