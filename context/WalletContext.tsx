'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { useAppKitAccount, useAppKitProvider, useDisconnect, useAppKitNetwork } from '@reown/appkit/react'
import { BrowserProvider, JsonRpcSigner } from 'ethers'

// Supported networks including Anvil Local
const SUPPORTED_NETWORKS = [1, 137, 8453, 10, 42161, 11155111, 31337] // Mainnet, Polygon, Base, Optimism, Arbitrum, Sepolia, Anvil Local

// Network name mapping
const getNetworkName = (chainId: number): string => {
    switch (chainId) {
        case 1: return 'Ethereum Mainnet'
        case 11155111: return 'Sepolia Testnet'
        case 137: return 'Polygon'
        case 8453: return 'Base'
        case 10: return 'Optimism'
        case 42161: return 'Arbitrum One'
        case 31337: return 'Anvil Local'
        default: return `Chain ${chainId}`
    }
}

// Type definitions
interface NetworkInfo {
    chainId: number | null
    name: string
    isSupported: boolean
}

interface WalletContextType {
    address: string | undefined
    isConnected: boolean
    isLoading: boolean
    provider: BrowserProvider | null
    signer: JsonRpcSigner | null
    networkInfo: NetworkInfo
    connectWallet: () => Promise<void>
    disconnectWallet: () => Promise<void>
    checkNetwork: () => Promise<void>
}

interface WalletProviderProps {
    children: ReactNode
}

const WalletContext = createContext<WalletContextType>({
    address: undefined,
    isConnected: false,
    isLoading: false,
    provider: null,
    signer: null,
    networkInfo: { chainId: null, name: 'Unknown', isSupported: false },
    connectWallet: async () => { },
    disconnectWallet: async () => { },
    checkNetwork: async () => { }
})

export function WalletProvider({ children }: WalletProviderProps) {
    const { address, isConnected, status } = useAppKitAccount()
    const { walletProvider } = useAppKitProvider('eip155')
    const { disconnect } = useDisconnect()
    const { chainId: networkChainId } = useAppKitNetwork()

    const [provider, setProvider] = useState<BrowserProvider | null>(null)
    const [signer, setSigner] = useState<JsonRpcSigner | null>(null)
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const [networkInfo, setNetworkInfo] = useState<NetworkInfo>({
        chainId: null,
        name: 'Unknown',
        isSupported: false
    })

    // Initialize provider and signer when wallet is connected
    useEffect(() => {
        if (walletProvider && isConnected) {
            try {
                const ethersProvider = new BrowserProvider(walletProvider as any)
                setProvider(ethersProvider)

                ethersProvider.getSigner().then(signer => {
                    setSigner(signer)
                    console.log('RIP: Wallet signer initialized')
                }).catch(error => {
                    console.error('RIP: Failed to get signer:', error)
                    setSigner(null)
                })
            } catch (error) {
                console.error('RIP: Failed to initialize provider:', error)
                setProvider(null)
                setSigner(null)
            }
        } else {
            setProvider(null)
            setSigner(null)
        }
    }, [walletProvider, isConnected])

    // Check current network status
    const checkNetwork = useCallback(async (): Promise<void> => {
        if (walletProvider && isConnected) {
            try {
                const provider = new BrowserProvider(walletProvider as any)
                const network = await provider.getNetwork()
                const chainId = Number(network.chainId)
                const isSupported = SUPPORTED_NETWORKS.includes(chainId)

                console.log('RIP: Network check result:', {
                    chainId,
                    networkName: network.name,
                    isSupported,
                    supportedNetworks: SUPPORTED_NETWORKS
                })

                setNetworkInfo({
                    chainId,
                    name: getNetworkName(chainId),
                    isSupported
                })
            } catch (error) {
                console.error('RIP: Network check failed:', error)
                setNetworkInfo({
                    chainId: null,
                    name: 'Unknown',
                    isSupported: false
                })
            }
        } else {
            setNetworkInfo({
                chainId: null,
                name: 'Not Connected',
                isSupported: false
            })
        }
    }, [walletProvider, isConnected])

    // Connect wallet function (opens AppKit modal)
    const connectWallet = useCallback(async (): Promise<void> => {
        setIsLoading(true)
        try {
            // The connection is handled by AppKit components
            console.log('RIP: Opening wallet connection modal...')
        } catch (error) {
            console.error('RIP: Wallet connection error:', error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    // Disconnect wallet function
    const disconnectWallet = useCallback(async (): Promise<void> => {
        try {
            await disconnect()
            setProvider(null)
            setSigner(null)
            setNetworkInfo({
                chainId: null,
                name: 'Not Connected',
                isSupported: false
            })
            console.log('RIP: Wallet disconnected')
        } catch (error) {
            console.error('RIP: Disconnect error:', error)
        }
    }, [disconnect])

    // Monitor connection status changes
    useEffect(() => {
        if (status === 'connecting' || status === 'reconnecting') {
            setIsLoading(true)
        } else {
            setIsLoading(false)
        }

        if (isConnected && address) {
            console.log('RIP: Wallet connected:', address)
            checkNetwork()
        } else if (!isConnected) {
            console.log('RIP: Wallet disconnected')
            setNetworkInfo({
                chainId: null,
                name: 'Not Connected',
                isSupported: false
            })
        }
    }, [status, isConnected, address, checkNetwork])

    // Monitor network changes
    useEffect(() => {
        if (isConnected && networkChainId) {
            checkNetwork()
        }
    }, [networkChainId, isConnected, checkNetwork])

    // Persist wallet session
    useEffect(() => {
        if (isConnected && address) {
            localStorage.setItem('cryptoinsure_wallet_connected', 'true')
            localStorage.setItem('cryptoinsure_wallet_address', address)
        } else {
            localStorage.removeItem('cryptoinsure_wallet_connected')
            localStorage.removeItem('cryptoinsure_wallet_address')
        }
    }, [isConnected, address])

    // Restore wallet session on page load
    useEffect(() => {
        const wasConnected = localStorage.getItem('cryptoinsure_wallet_connected')
        const savedAddress = localStorage.getItem('cryptoinsure_wallet_address')

        if (wasConnected === 'true' && savedAddress && !isConnected) {
            console.log('RIP: Attempting to restore wallet session...')
            // AppKit should automatically restore the session
        }
    }, [isConnected])

    const contextValue: WalletContextType = {
        address,
        isConnected,
        isLoading,
        provider,
        signer,
        networkInfo,
        connectWallet,
        disconnectWallet,
        checkNetwork
    }

    return (
        <WalletContext.Provider value={contextValue}>
            {children}
        </WalletContext.Provider>
    )
}

export const useWallet = (): WalletContextType => {
    const context = useContext(WalletContext)
    if (!context) {
        throw new Error('useWallet must be used within a WalletProvider')
    }
    return context
}