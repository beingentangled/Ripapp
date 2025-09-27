import { createAppKit } from '@reown/appkit/react'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'
import { mainnet, arbitrum, polygon, base, optimism, sepolia, AppKitNetwork } from '@reown/appkit/networks'

// 1. projectId from https://cloud.reown.com
const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || 'demo-project-id'

// Custom Anvil Local network configuration
const anvilLocal: AppKitNetwork = {
    id: 31337,
    name: 'Anvil Local',
    nativeCurrency: {
        decimals: 18,
        name: 'Ethereum',
        symbol: 'ETH'
    },
    rpcUrls: {
        default: {
            http: ['http://127.0.0.1:8545']
        },
        public: {
            http: ['http://127.0.0.1:8545']
        }
    },
    blockExplorers: {
        default: {
            name: 'Local Explorer',
            url: 'http://127.0.0.1:8545'
        }
    },
    testnet: true
}

// 2. Setting the networks - Include mainnet networks and Anvil Local
const supportedNetworks: [AppKitNetwork, ...AppKitNetwork[]] = [
    mainnet,
    arbitrum,
    polygon,
    base,
    optimism,
    sepolia,
    anvilLocal
]

// 3. Create a metadata object - optional
const metadata = {
    name: 'Rippap',
    description: 'Decentralized Insurance Platform for Amazon Orders',
    url: typeof window !== 'undefined' ? window.location.origin : 'https://cryptoinsure.vercel.app',
    icons: [`${typeof window !== 'undefined' ? window.location.origin : 'https://cryptoinsure.vercel.app'}/favicon.ico`]
}

// 4. Create Ethers adapter
const ethersAdapter = new EthersAdapter()

// 5. Create a AppKit instance
export const appKit = createAppKit({
    adapters: [ethersAdapter],
    networks: supportedNetworks,
    metadata,
    projectId,
    features: {
        analytics: true, // Optional - defaults to your Cloud configuration
        email: false, // default to true
        socials: false, // default to true
        emailShowWallets: false // default to true
    },
    themeMode: 'dark',
    themeVariables: {
        '--w3m-color-mix': '#FF9900',
        '--w3m-color-mix-strength': 20,
        '--w3m-accent': '#FF9900',
        '--w3m-border-radius-master': '8px',
    }
})

export default appKit
