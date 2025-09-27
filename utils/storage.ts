// Storage utility for ripextension - interfaces with extension shared storage

export interface OrderItem {
    name: string;
    asin?: string;
    quantity?: string;
    price?: string;
    imageUrl?: string;
    orderId?: string;
    orderDate?: string;
    orderStatus?: string;
    seller?: string;
    invoiceUrl?: string;
}

export interface OrderInfo {
    orderId: string | null;
    shipmentId?: string | null;
    trackingId?: string | null;
    productName?: string | null;
    orderTotal?: string | null;
    orderDate?: string | null;
    orderStatus?: string | null;
    seller?: string | null;
    asin?: string | null;
    quantity?: string | null;
    orderItems: OrderItem[];
    invoiceUrl?: string | null;
    invoiceDetails?: any;
}

export type SessionDataResult = {
    orderItems: OrderItem[];
    sessionId: string;
    orderInfo: Record<string, any> | null;
};

export interface InsurancePolicy {
    id: string;
    orderId: string;
    orderInfo: OrderInfo;
    premiumAmount: string;
    coverageAmount: string;
    createdAt: number;
    status: 'active' | 'expired' | 'claimed';
}

export interface WalletState {
    address: string | null;
    isConnected: boolean;
    network: string | null;
    chainId: number | null;
    sessionId: string | null;
    lastActivity: number | null;
    connectedAt: number | null;
}

// Storage interface for communicating with extension
declare global {
    interface Window {
        ripextensionStorage?: {
            getWalletState(): Promise<WalletState>;
            setWalletState(state: WalletState): Promise<void>;
            getSessionData(): Promise<any>;
            setSessionData(data: any): Promise<void>;
            getInsurancePolicies(): Promise<InsurancePolicy[]>;
            addInsurancePolicy(policy: Partial<InsurancePolicy>): Promise<void>;
            requestFromExtension(action: string, data?: any): Promise<any>;
            sendToExtension(action: string, data?: any): Promise<void>;
        };
    }
}

// No mock data - only real data from extension

class StorageService {
    private static instance: StorageService;
    private isExtensionAvailable = false;
    private sessionDataCache: { [key: string]: any } = {};

    private constructor() {
        this.checkExtensionAvailability();
        this.setupMessageListener();
    }

    private setupMessageListener() {
        if (typeof window !== 'undefined') {
            window.addEventListener('message', (event) => {
                if (event.data.source === 'cryptoinsure-extension' && event.data.action === 'sessionDataResponse') {
                    const { sessionId, data, autoProvided } = event.data;
                    console.log('RIP: Raw message received:', JSON.stringify(event.data, null, 2));
                    if (data) {
                        console.log('RIP: Received session data from extension:', JSON.stringify(data, null, 2), autoProvided ? '(auto-provided)' : '');
                        // Use provided sessionId or generate one for auto-provided data
                        const cacheKey = sessionId || 'auto-session';
                        this.sessionDataCache[cacheKey] = data;

                        // If auto-provided, also cache with current session
                        if (autoProvided) {
                            const currentSession = this.getSessionId();
                            this.sessionDataCache[currentSession] = data;
                        }
                    } else {
                        console.log('RIP: Received empty data in session response');
                    }
                }
            });
        }
    } public static getInstance(): StorageService {
        if (!StorageService.instance) {
            StorageService.instance = new StorageService();
        }
        return StorageService.instance;
    }

    private getSessionId(): string {
        // Generate or retrieve session ID from URL or storage
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            const sessionParam = urlParams.get('session') || urlParams.get('sessionId');
            if (sessionParam) {
                return sessionParam;
            }

            // Check if we have a session in local storage
            const storedSession = localStorage.getItem('cryptoinsure-session');
            if (storedSession) {
                return storedSession;
            }

            // Generate new session
            const newSession = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('cryptoinsure-session', newSession);
            return newSession;
        }
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private parseSessionData(cachedData: any, sessionId: string): SessionDataResult {
        console.log('RIP: Parsing session data:', JSON.stringify(cachedData, null, 2));
        console.log('RIP: Data structure analysis:', {
            hasItems: !!cachedData.items,
            hasCurrentOrderInfo: !!cachedData.currentOrderInfo,
            currentOrderInfoKeys: cachedData.currentOrderInfo ? Object.keys(cachedData.currentOrderInfo) : [],
            cachedDataKeys: Object.keys(cachedData),
            dataType: typeof cachedData,
            isArray: Array.isArray(cachedData),
            isEmpty: Object.keys(cachedData).length === 0
        });

        if (cachedData.items && Array.isArray(cachedData.items) && cachedData.items.length > 0) {
            console.log('RIP: Found items in cached data:', cachedData.items);
            const normalizedOrderInfo = cachedData.currentOrderInfo
                ? { ...cachedData.currentOrderInfo, orderItems: cachedData.items }
                : null;
            return {
                orderItems: cachedData.items,
                sessionId,
                orderInfo: normalizedOrderInfo
            };
        } else if (cachedData.currentOrderInfo) {
            const orderInfo = cachedData.currentOrderInfo;
            console.log('RIP: Processing currentOrderInfo:', orderInfo);

            if (cachedData.orderItems && Array.isArray(cachedData.orderItems)) {
                console.log('RIP: Found orderItems array:', cachedData.orderItems);
                const validItems = cachedData.orderItems.filter((item: any) =>
                    item &&
                    (item.name && item.name.trim() !== '') &&
                    item.asin !== null &&
                    item.asin !== undefined
                );
                if (validItems.length > 0) {
                    console.log('ripextension: Found valid orderItems:', validItems);
                    const normalizedOrderInfo = orderInfo
                        ? { ...orderInfo, orderItems: validItems }
                        : { orderItems: validItems };
                    return {
                        orderItems: validItems,
                        sessionId,
                        orderInfo: normalizedOrderInfo
                    };
                } else {
                    console.log('ripextension: OrderItems exist but are invalid:', cachedData.orderItems);
                }
            }

            console.log('ripextension: Creating order item from main order info');
            const orderItems = [{
                name: orderInfo.productName || orderInfo.name || 'Unknown Product',
                asin: orderInfo.asin || cachedData.currentAsin,
                quantity: orderInfo.quantity || '1',
                price: orderInfo.orderTotal || orderInfo.price || 'N/A',
                imageUrl: orderInfo.imageUrl || '',
                orderId: orderInfo.orderId,
                orderDate: orderInfo.orderDate,
                orderStatus: orderInfo.orderStatus,
                seller: orderInfo.seller,
                invoiceUrl: orderInfo.invoiceUrl
            }];
            console.log('ripextension: Created order items:', orderItems);
            const normalizedOrderInfo = orderInfo
                ? { ...orderInfo, orderItems }
                : { orderItems };
            const result: SessionDataResult = {
                orderItems,
                sessionId,
                orderInfo: normalizedOrderInfo
            };
            console.log('ripextension: Returning result with orderItems count:', result.orderItems.length);
            return result;
        } else {
            console.log('ripextension: Could not find suitable data structure in cached data');
            console.log('ripextension: No extension data available - returning empty orderItems array');
            return { orderItems: [], sessionId, orderInfo: null };
        }
    }

    private async checkExtensionAvailability(): Promise<void> {
        // Wait for extension bridge to be loaded and extension to be available
        let attempts = 0;
        const maxAttempts = 10; // Increased attempts to wait for injection

        while (attempts < maxAttempts && typeof window !== 'undefined') {
            try {
                // Check for both ripextensionStorage and the bridge
                if (window.ripextensionStorage || (window as any).ripextensionVercelBridge) {
                    this.isExtensionAvailable = true;
                    console.log('ripextension: Extension available', {
                        storage: !!window.ripextensionStorage,
                        bridge: !!(window as any).ripextensionVercelBridge
                    });
                    return;
                }
            } catch (error) {
                console.log('ripextension: Extension check error:', error);
            }

            attempts++;
            await new Promise(resolve => setTimeout(resolve, 300)); // Increased wait time
        }

        console.log('ripextension: Extension not available after', maxAttempts, 'attempts');
        this.isExtensionAvailable = false;
    }

    async getOrderInfo(): Promise<SessionDataResult> {
        try {
            const sessionId = this.getSessionId();
            console.log('ripextension: Getting order info for session:', sessionId);

            // Priority 1: Check if we have auto-provided data (most reliable)
            if (this.sessionDataCache['auto-session']) {
                const cachedData = this.sessionDataCache['auto-session'];
                console.log('ripextension: Using auto-provided session data');
                const result = this.parseSessionData(cachedData, sessionId);
                console.log('ripextension: Parsed result:', result);
                if (result.orderItems.length > 0) {
                    return result;
                }
            }

            // Priority 2: Check if we have cached data from extension messages for this session
            if (this.sessionDataCache[sessionId]) {
                const cachedData = this.sessionDataCache[sessionId];
                console.log('ripextension: Using cached session data for session:', sessionId);
                const result = this.parseSessionData(cachedData, sessionId);
                if (result.orderItems.length > 0) {
                    return result;
                }
            }

            // Priority 3: Try direct extension access (but don't override cached data if it fails)
            if (typeof window !== 'undefined' && (window as any).ripextensionStorage) {
                const storage = (window as any).ripextensionStorage;
                console.log('ripextension: Storage available, getting session data');

                const data = await storage.getSessionData();
                console.log('ripextension: Got session data via direct storage:', data);

                if (data && Object.keys(data).length > 0) {
                    const result = this.parseSessionData(data, sessionId);
                    if (result.orderItems.length > 0) {
                        return result;
                    }
                }
            }

            // Priority 4: Try to request data via message (as last resort)
            if (typeof window !== 'undefined' && sessionId) {
                console.log('ripextension: Requesting session data via message');
                window.postMessage({
                    source: 'cryptoinsure-app',
                    action: 'getSessionData',
                    sessionId: sessionId
                }, '*');

                // Wait a bit to see if we get a response
                await new Promise(resolve => setTimeout(resolve, 500));

                if (this.sessionDataCache[sessionId]) {
                    const cachedData = this.sessionDataCache[sessionId];
                    console.log('ripextension: Using cached data from message response');
                    const result = this.parseSessionData(cachedData, sessionId);
                    if (result.orderItems.length > 0) {
                        return result;
                    }
                }
            }

            // If all methods failed or returned empty data, but we have ANY cached data, try to use it
            for (const cacheKey of ['auto-session', sessionId]) {
                if (this.sessionDataCache[cacheKey]) {
                    console.log('ripextension: Falling back to cached data for key:', cacheKey);
                    const result = this.parseSessionData(this.sessionDataCache[cacheKey], sessionId);
                    if (result.orderItems.length > 0) {
                        return result;
                    }
                }
            }

            console.log('ripextension: Extension storage not available or no data found');
            return { orderItems: [], sessionId, orderInfo: null };
        } catch (error) {
            console.error('ripextension: Error getting order info:', error);
            return { orderItems: [], sessionId: this.getSessionId(), orderInfo: null };
        }
    }

    public async getWalletState(): Promise<WalletState> {
        try {
            if (this.isExtensionAvailable && window.ripextensionStorage) {
                return await window.ripextensionStorage.getWalletState();
            } else {
                return {
                    address: null,
                    isConnected: false,
                    network: null,
                    chainId: null,
                    sessionId: null,
                    lastActivity: null,
                    connectedAt: null
                };
            }
        } catch (error) {
            console.error('Error getting wallet state:', error);
            return {
                address: null,
                isConnected: false,
                network: null,
                chainId: null,
                sessionId: null,
                lastActivity: null,
                connectedAt: null
            };
        }
    }

    public async getInsurancePolicies(): Promise<InsurancePolicy[]> {
        try {
            if (this.isExtensionAvailable && window.ripextensionStorage) {
                return await window.ripextensionStorage.getInsurancePolicies();
            } else {
                return [];
            }
        } catch (error) {
            console.error('Error getting insurance policies:', error);
            return [];
        }
    }

    public async addInsurancePolicy(policy: Partial<InsurancePolicy>): Promise<void> {
        try {
            if (this.isExtensionAvailable && window.ripextensionStorage) {
                await window.ripextensionStorage.addInsurancePolicy(policy);
            } else {
                console.warn('Extension not available - policy not saved to extension storage');
            }
        } catch (error) {
            console.error('Error adding insurance policy:', error);
        }
    }

    public async setSessionData(data: any): Promise<void> {
        try {
            if (this.isExtensionAvailable && window.ripextensionStorage) {
                await window.ripextensionStorage.setSessionData(data);
            }
        } catch (error) {
            console.error('Error setting session data:', error);
        }
    }

    public transformSessionData(rawData: any, sessionId?: string): SessionDataResult {
        const targetSession = sessionId || this.getSessionId();
        return this.parseSessionData(rawData || {}, targetSession);
    }
}

export const storageService = StorageService.getInstance();
export default storageService;
