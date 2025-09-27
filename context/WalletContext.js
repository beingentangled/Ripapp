'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useAppKitAccount, useAppKitProvider, useDisconnect } from '@reown/appkit/react'
import { BrowserProvider } from 'ethers'

const WalletContext = createContext({})

export function WalletProvider({ children }) {
  const { address, isConnected, status } = useAppKitAccount()
  const { walletProvider } = useAppKitProvider('eip155')
  const { disconnect } = useDisconnect()

  const [provider, setProvider] = useState(null)
  const [signer, setSigner] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (walletProvider && isConnected) {
      const ethersProvider = new BrowserProvider(walletProvider)
      setProvider(ethersProvider)

      // Get signer
      ethersProvider.getSigner().then(setSigner).catch(console.error)
    } else {
      setProvider(null)
      setSigner(null)
    }
  }, [walletProvider, isConnected])

  const connectWallet = async () => {
    try {
      setIsLoading(true)
      // AppKit modal will handle the connection
      // The useAppKitAccount hook will update automatically
    } catch (error) {
      console.error('Error connecting wallet:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const disconnectWallet = async () => {
    try {
      setIsLoading(true)
      await disconnect()

      // Clear stored wallet state
      localStorage.removeItem('cryptoinsure_wallet_state')

      // Notify extension of disconnect
      try {
        if (window.postMessage) {
          window.postMessage({
            source: 'cryptoinsure-website',
            action: 'disconnectWallet'
          }, '*')
        }
      } catch (error) {
        console.log('Could not notify extension of disconnect:', error)
      }

      console.log('ripextension: Wallet disconnected')
    } catch (error) {
      console.error('Error disconnecting wallet:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const storeWalletState = async (walletAddress) => {
    try {
      // Resolve network/chainId ahead of time and ensure it's serializable
      let resolvedChainId = null
      if (provider) {
        try {
          const network = await provider.getNetwork()
          // Ethers v6 returns chainId as bigint; convert to number for JSON storage
          resolvedChainId = network?.chainId != null ? Number(network.chainId) : null
        } catch (e) {
          console.warn('Could not resolve network/chainId:', e)
        }
      }

      // Store wallet state that extension can access
      const walletState = {
        address: walletAddress,
        isConnected: true,
        network: 'ethereum',
        chainId: resolvedChainId,
        sessionId: sessionStorage.getItem('cryptoinsure_session_id') || Date.now().toString(),
        connectedAt: Date.now(),
        lastActivity: Date.now()
      }

      // Try to communicate with extension if available
      if (window.postMessage) {
        window.postMessage({
          source: 'cryptoinsure-website',
          action: 'setWalletState',
          data: walletState
        }, '*')
      }

      // Also store in localStorage as backup
      localStorage.setItem('cryptoinsure_wallet_state', JSON.stringify(walletState))
    } catch (error) {
      console.error('Error storing wallet state:', error)
    }
  }

  // Store wallet state when connected
  useEffect(() => {
    if (address && isConnected) {
      storeWalletState(address)
    }
  }, [address, isConnected, provider])

  const value = {
    // AppKit states
    address,
    isConnected,
    status,

    // Ethers integration
    provider,
    signer,

    // Actions
    connectWallet,
    disconnectWallet,
    storeWalletState,

    // Loading state
    isLoading
  }

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return context
}
