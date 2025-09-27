import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppKitAccount } from '@reown/appkit/react';
import styles from '../styles/Invoice.module.css';

interface OrderItem {
  asin?: string;
  name: string;
  price: string;
  quantity: number;
  orderId?: string;
  orderDate?: string;
}

interface OrderInfo {
  orderId: string;
  orderItems: OrderItem[];
  sessionId?: string;
}

interface InvoiceData {
  id: string;
  orderNumber: string;
  merchantName: string;
  totalAmount: number;
  currency: string;
  orderDate: string;
  items: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  status: 'pending' | 'confirmed' | 'insured' | 'claimed';
}

interface InvoiceWidgetProps {
  className?: string;
  onOrderExtracted?: (orderInfo: OrderInfo) => void;
  onProcessingStateChange?: (state: string) => void;
  onItemSelected?: (item: OrderItem) => void;
}

type ProcessingState = 'loading' | 'extracted' | 'error' | 'no-data';
type ZkStep = 'idle' | 'generating' | 'approving' | 'purchasing' | 'success';

const InvoiceWidget: React.FC<InvoiceWidgetProps> = ({
  className,
  onOrderExtracted,
  onProcessingStateChange,
  onItemSelected
}) => {
  const { address, isConnected } = useAppKitAccount();
  const [processingState, setProcessingState] = useState<ProcessingState>('loading');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isRetrying, setIsRetrying] = useState(false);
  const [zkProcessing, setZkProcessing] = useState(false);
  const [zkStep, setZkStep] = useState<ZkStep>('idle');
  const [zkError, setZkError] = useState<string | null>(null);
  const [selectedZkItem, setSelectedZkItem] = useState<OrderItem | null>(null);

  // Mock invoices for demo - converted from the previous implementation
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [extensionConnected, setExtensionConnected] = useState(false);

  const loadMockData = useCallback(() => {
    const mockInvoices: InvoiceData[] = [
      {
        id: '1',
        orderNumber: 'AMZ-123456789',
        merchantName: 'Amazon',
        totalAmount: 299.99,
        currency: 'USD',
        orderDate: '2024-01-15',
        items: [
          { name: 'Wireless Headphones', price: 199.99, quantity: 1 },
          { name: 'Phone Case', price: 29.99, quantity: 2 },
          { name: 'Shipping', price: 9.99, quantity: 1 }
        ],
        status: 'pending'
      },
      {
        id: '2',
        orderNumber: 'AMZ-987654321',
        merchantName: 'Amazon',
        totalAmount: 149.50,
        currency: 'USD',
        orderDate: '2024-01-10',
        items: [
          { name: 'Book: Web3 Development', price: 39.99, quantity: 1 },
          { name: 'Notebook Set', price: 24.99, quantity: 2 },
          { name: 'Express Shipping', price: 14.99, quantity: 1 }
        ],
        status: 'confirmed'
      }
    ];

    setInvoices(mockInvoices);

    // Convert to OrderInfo format for compatibility
    const orderItems: OrderItem[] = mockInvoices.flatMap(invoice =>
      invoice.items.map(item => ({
        asin: `ASIN_${item.name.replace(/\s+/g, '_')}`,
        name: item.name,
        price: `$${item.price.toFixed(2)}`,
        quantity: item.quantity,
        orderId: invoice.orderNumber,
        orderDate: invoice.orderDate
      }))
    );

    const mockOrderInfo: OrderInfo = {
      orderId: 'DEMO_ORDER',
      orderItems,
      sessionId: 'demo_session'
    };

    setProcessingState('extracted');
    onProcessingStateChange?.('extracted');
    onOrderExtracted?.(mockOrderInfo);
  }, [onProcessingStateChange, onOrderExtracted]);

  const loadOrderData = useCallback(async () => {
    try {
      setProcessingState('loading');
      onProcessingStateChange?.('loading');

      console.log('RIP: Loading order data from extension...');

      // Check for extension communication
      let hasExtensionData = false;
      if (typeof window !== 'undefined') {
        // Listen for extension messages
        const messageListener = (event: MessageEvent) => {
          if (event.data.source === 'cryptoinsure-extension' &&
              event.data.action === 'sessionDataResponse') {
            console.log('RIP: Received extension data:', event.data);
            hasExtensionData = true;

            if (event.data.orderItems && event.data.orderItems.length > 0) {
              const mappedOrderInfo: OrderInfo = {
                orderId: event.data.sessionId || 'EXT_ORDER',
                orderItems: event.data.orderItems,
                sessionId: event.data.sessionId
              };

              setExtensionConnected(true);
              setProcessingState('extracted');
              onProcessingStateChange?.('extracted');
              onOrderExtracted?.(mappedOrderInfo);
              console.log('RIP: Extension data successfully loaded');
            }
          }
        };

        window.addEventListener('message', messageListener);

        // Request data from extension
        window.postMessage({
          source: 'cryptoinsure-webapp',
          action: 'requestSessionData'
        }, '*');

        // Timeout after 3 seconds if no extension response
        setTimeout(() => {
          window.removeEventListener('message', messageListener);
          if (!hasExtensionData) {
            console.log('RIP: No extension data found, using demo data');
            setExtensionConnected(false);
            loadMockData();
          }
        }, 3000);
      } else {
        // Server-side or no window, use mock data
        loadMockData();
      }
    } catch (error) {
      console.error('RIP: Error loading order data:', error);
      setProcessingState('error');
      onProcessingStateChange?.('error');
      // Fallback to mock data on error
      loadMockData();
    }
  }, [onProcessingStateChange, onOrderExtracted, loadMockData]);

  useEffect(() => {
    loadOrderData();

    // Listen for auto-updates from extension
    const handleExtensionMessage = (event: MessageEvent) => {
      if (event.data.source === 'cryptoinsure-extension' &&
          event.data.action === 'sessionDataResponse' &&
          event.data.autoProvided) {
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
  }, [loadOrderData]);

  const retryLoad = async () => {
    setIsRetrying(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    await loadOrderData();
    setIsRetrying(false);
  };

  const handleItemInsure = async (item: OrderItem) => {
    try {
      if (!isConnected || !address) {
        alert('Please connect your wallet first using the Connect Wallet button in the header.');
        return;
      }

      setZkProcessing(true);
      setZkError(null);
      setSelectedZkItem(item);
      setZkStep('generating');

      // Simulate ZK commitment generation
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('🔨 Generating ZK commitment for item:', item.name);

      setZkStep('approving');
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log('✅ Token approval simulated');

      setZkStep('purchasing');
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('💰 Policy purchase simulated');

      setZkStep('success');

      const itemKey = `${item.asin || item.name}_${item.quantity}`;
      setSelectedItems(prev => new Set([...prev, itemKey]));
      onItemSelected?.(item);

      // Reset after success
      setTimeout(() => {
        setZkStep('idle');
        setZkProcessing(false);
        setSelectedZkItem(null);
      }, 3000);

    } catch (error) {
      console.error('Policy purchase failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setZkError(errorMessage);
      setZkStep('idle');
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

  const resolveProcessingStatusText = useMemo(() => {
    switch (processingState) {
      case 'loading':
        return 'Checking for Amazon extension data...';
      case 'extracted':
        return extensionConnected
          ? 'Order information loaded from Amazon extension'
          : 'Demo mode - showing sample data';
      case 'error':
        return 'Error loading order information from extension';
      case 'no-data':
        return 'No order information available. Please use the RIP extension on Amazon.';
      default:
        return 'Waiting for extension data...';
    }
  }, [processingState, extensionConnected]);

  const resolveStatusIcon = useMemo(() => {
    switch (processingState) {
      case 'loading': return '⏳';
      case 'extracted': return '✅';
      case 'error': return '❌';
      case 'no-data': return '📄';
      default: return '⏳';
    }
  }, [processingState]);

  const getStatusColor = (status: InvoiceData['status']) => {
    switch (status) {
      case 'pending': return '#ff9900';
      case 'confirmed': return '#00c851';
      case 'insured': return '#007bff';
      case 'claimed': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const getZkStepText = (step: ZkStep) => {
    switch (step) {
      case 'generating': return 'Generating ZK commitment...';
      case 'approving': return 'Approving token spend...';
      case 'purchasing': return 'Purchasing insurance policy...';
      case 'success': return 'Policy purchased successfully!';
      default: return '';
    }
  };

  if (processingState === 'loading') {
    return (
      <div className={`${styles.container} ${className || ''}`}>
        <div className={styles.header}>
          <h2>📄 Invoice Manager</h2>
          <div className={styles.connectionStatus}>
            <span className={styles.statusIndicator}>
              {resolveStatusIcon} {resolveProcessingStatusText}
            </span>
          </div>
        </div>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading invoice data...</p>
        </div>
      </div>
    );
  }

  if (processingState === 'error') {
    return (
      <div className={`${styles.container} ${className || ''}`}>
        <div className={styles.error}>
          <h3>⚠️ Error Loading Invoices</h3>
          <p>{resolveProcessingStatusText}</p>
          <button onClick={retryLoad} className={styles.retryButton} disabled={isRetrying}>
            {isRetrying ? 'Retrying...' : 'Try Again'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className || ''}`}>
      <div className={styles.header}>
        <h2>📄 Invoice Manager</h2>
        <div className={styles.headerActions}>
          <div className={styles.connectionStatus}>
            <span className={styles.statusIndicator}>
              {extensionConnected ? '🟢 Extension Connected' : '🟡 Demo Mode'}
            </span>
          </div>
          <button onClick={retryLoad} className={styles.refreshButton} disabled={isRetrying}>
            {isRetrying ? '⏳ Refreshing...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {/* ZK Processing Status */}
      {zkProcessing && (
        <div className={styles.zkProcessing}>
          <div className={styles.zkStatus}>
            <div className={styles.spinner}></div>
            <span>{getZkStepText(zkStep)}</span>
          </div>
          {selectedZkItem && (
            <p>Processing: {selectedZkItem.name}</p>
          )}
        </div>
      )}

      {/* ZK Error Display */}
      {zkError && (
        <div className={styles.zkError}>
          <h4>❌ Insurance Purchase Failed</h4>
          <p>{zkError}</p>
          <button onClick={handleClearZkError} className={styles.clearErrorButton}>
            Dismiss
          </button>
        </div>
      )}

      <div className={styles.invoiceList}>
        {invoices.length === 0 ? (
          <div className={styles.emptyState}>
            <h3>📦 No Invoices Found</h3>
            <p>Install and connect the chrome extension to load your Amazon order data.</p>
          </div>
        ) : (
          invoices.map((invoice) => (
            <div key={invoice.id} className={styles.invoiceCard}>
              <div className={styles.invoiceHeader}>
                <div className={styles.invoiceInfo}>
                  <h3>{invoice.orderNumber}</h3>
                  <p className={styles.merchant}>{invoice.merchantName}</p>
                  <span className={styles.date}>{new Date(invoice.orderDate).toLocaleDateString()}</span>
                </div>
                <div className={styles.invoiceAmount}>
                  <span className={styles.amount}>
                    {formatCurrency(invoice.totalAmount, invoice.currency)}
                  </span>
                  <span
                    className={styles.status}
                    style={{ backgroundColor: getStatusColor(invoice.status) }}
                  >
                    {invoice.status.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className={styles.itemsList}>
                <h4>Items:</h4>
                {invoice.items.map((item, index) => {
                  const orderItem: OrderItem = {
                    asin: `ASIN_${item.name.replace(/\s+/g, '_')}`,
                    name: item.name,
                    price: `$${item.price.toFixed(2)}`,
                    quantity: item.quantity,
                    orderId: invoice.orderNumber,
                    orderDate: invoice.orderDate
                  };

                  const isSelected = isItemSelected(orderItem);

                  return (
                    <div key={index} className={styles.item}>
                      <div className={styles.itemInfo}>
                        <span className={styles.itemName}>{item.name}</span>
                        <span className={styles.itemPrice}>
                          {formatCurrency(item.price, invoice.currency)} x {item.quantity}
                        </span>
                      </div>
                      <button
                        className={`${styles.itemInsureButton} ${isSelected ? styles.insured : ''}`}
                        onClick={() => handleItemInsure(orderItem)}
                        disabled={isSelected || zkProcessing || !isConnected}
                      >
                        {isSelected ? '✅ Insured' :
                         zkProcessing && selectedZkItem?.name === item.name ? '⏳ Processing...' :
                         !isConnected ? '🔒 Connect Wallet' : '🛡️ Insure'}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className={styles.actions}>
                <button className={styles.detailsButton}>
                  View Details
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default InvoiceWidget;
