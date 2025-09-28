# RIP - Remorse Insurance Protocol (Frontend Application)

A decentralized insurance protocol frontend application built with Next.js that provides zero-knowledge proof-based price protection for e-commerce purchases. Users can insure their Amazon purchases against price drops while maintaining privacy through ZK-SNARKs.

## 🚀 Features

### Core Functionality
- **Price Protection Insurance**: Insure Amazon purchases against price drops
- **Zero-Knowledge Proofs**: Privacy-preserving claim verification using ZK-SNARKs
- **Browser Extension Integration**: Seamless integration with RIP browser extension
- **Multi-Wallet Support**: Connect with various Web3 wallets via Reown AppKit
- **Decentralized Claims**: On-chain claim processing with automated payouts

### User Experience
- **Interactive Animations**: Lottie-based animations for better UX
- **Real-time Updates**: Live order tracking and policy management
- **Responsive Design**: Mobile-friendly interface
- **Sweet Alert Modals**: Beautiful modal interactions for all user actions

### Technical Features
- **Merkle Tree Verification**: Efficient price data verification
- **Smart Contract Integration**: Direct interaction with insurance vault contracts
- **IPFS Storage**: Decentralized policy data storage
- **Oracle Integration**: Real-time price feed integration

## 🛠️ Technology Stack

### Frontend Framework
- **Next.js 15.5.2**: React-based full-stack framework
- **React 19.0.0**: Latest React with concurrent features
- **TypeScript 5.9.2**: Type-safe development

### Web3 & Blockchain
- **Ethers.js 6.15.0**: Ethereum blockchain interaction
- **Reown AppKit 1.8.4**: Multi-wallet connection
- **Wagmi 2.16.9**: React hooks for Ethereum
- **SIWE 3.0.0**: Sign-In with Ethereum

### Zero-Knowledge Proofs
- **SnarkJS 0.7.5**: ZK-SNARK proof generation and verification
- **Circomlibjs 0.1.7**: Circom circuit utilities
- **Custom Circuits**: Poseidon hash-based privacy circuits

### UI/UX Libraries
- **SweetAlert2 11.23.0**: Beautiful modal dialogs
- **Lottie-web 5.13.0**: Animation rendering
- **Canvas-confetti 1.9.3**: Celebration effects

### State Management
- **Zustand 4.5.5**: Lightweight state management
- **Jotai 2.10.7**: Atomic state management
- **TanStack React Query 5.87.4**: Server state management

## 📋 Prerequisites

Before running this application, ensure you have:

- **Node.js** (version 18 or higher)
- **npm** or **yarn** package manager
- **Git** for version control
- **Web3 Wallet** (MetaMask, WalletConnect, etc.)

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone <repository-url>
cd ETHDelhiCryptoInsurance/ripapp
```

### 2. Install Dependencies
```bash
npm install
# or
yarn install
```

### 3. Environment Setup
Create a `.env.local` file in the root directory:

```env
# Wallet Connect Project ID
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_wallet_connect_project_id

# RPC URLs
NEXT_PUBLIC_ANVIL_RPC_URL=http://127.0.0.1:8545
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://rpc.sepolia.org

# Contract Addresses (update with your deployed contracts)
NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_ORACLE_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_VERIFIER_CONTRACT_ADDRESS=0x...

# API Endpoints
NEXT_PUBLIC_ORACLE_API_URL=http://localhost:3001
```

### 4. Development Server
```bash
npm run dev
```

Visit [http://localhost:3002](http://localhost:3002) to view the application.

### 5. Production Build
```bash
npm run build
npm start
```

## 📁 Project Structure

```
ripapp/
├── components/           # React components
│   ├── widgets/         # Main widget components
│   │   ├── InvoiceWidget.tsx    # Core insurance interface
│   │   ├── ZkFlowWidget.tsx     # ZK proof workflow
│   │   ├── PolicyDashboardWidget.tsx  # Policy management
│   │   └── ExtensionDebugWidget.tsx   # Extension debugging
│   └── shared/          # Shared components
├── pages/               # Next.js pages
│   ├── index.tsx       # Main application page
│   └── _app.tsx        # App configuration
├── lib/                 # Utility libraries
│   ├── contracts.ts    # Smart contract interfaces
│   ├── zkUtils.ts      # Zero-knowledge utilities
│   └── storage.ts      # Local storage management
├── utils/               # Helper utilities
│   ├── oracleClient.ts # Oracle API client
│   └── formatters.ts   # Data formatting utilities
├── context/             # React contexts
│   └── WalletContext.tsx # Wallet connection context
├── config/              # Configuration files
│   └── appkit.ts       # Wallet configuration
├── styles/              # CSS modules and global styles
├── abi/                 # Smart contract ABIs
├── data/                # Static data files
├── public/              # Static assets
│   ├── pyusd.svg       # PYUSD token logo
│   └── icons/          # Application icons
├── certificate_animation.json  # Lottie certificate animation
└── money_stack.json    # Lottie money stack animation
```

## 🔧 Configuration

### Wallet Configuration
The application uses Reown AppKit for wallet connections. Configure supported wallets in `config/appkit.ts`:

```typescript
export const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID!;
export const networks = [anvil, sepolia]; // Add your networks
```

### Smart Contract Integration
Contract addresses and ABIs are configured in `lib/contracts.ts`. Update the addresses after deploying contracts:

```typescript
export const VAULT_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS!;
export const TOKEN_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS!;
```

## 📱 Browser Extension Integration

This application integrates with the RIP Browser Extension for seamless Amazon purchase tracking:

1. **Install Extension**: Load the extension from `../extension/` directory
2. **Enable Integration**: The extension automatically detects the application
3. **Order Sync**: Orders are synchronized in real-time via extension bridge

## 🔐 Zero-Knowledge Proofs

The application implements ZK-SNARKs for privacy-preserving insurance claims:

### Circuit Components
- **Poseidon Hash**: Privacy-preserving commitment scheme
- **Merkle Tree Verification**: Efficient price data verification
- **Range Proofs**: Price drop verification without revealing exact values

### Proof Generation Flow
1. User purchases insurance with secret commitment
2. Extension monitors price changes
3. On price drop, ZK proof is generated
4. Proof verifies eligibility without revealing purchase details
5. Smart contract validates and processes payout

## 🎨 User Interface Features

### Interactive Animations
- **Lottie Animations**: Smooth, scalable animations for better UX
- **Progress Indicators**: Visual feedback during ZK proof generation
- **Success Celebrations**: Confetti effects on successful transactions

### Modal System
- **SweetAlert2 Integration**: Beautiful, accessible modal dialogs
- **Custom Styling**: Branded modal themes
- **Animation Integration**: Lottie animations within modals

## 🧪 Testing

### Unit Tests
```bash
npm run test
```

### End-to-End Tests
```bash
npm run test:e2e
```

### Linting
```bash
npm run lint
```

## 🚀 Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Docker
```bash
docker build -t ripapp .
docker run -p 3002:3002 ripapp
```

### Manual Deployment
```bash
npm run build
npm start
```

## 🔍 Troubleshooting

### Common Issues

**Wallet Connection Issues**
- Ensure WALLET_CONNECT_PROJECT_ID is set
- Check network configuration in appkit.ts
- Verify wallet extension is installed and unlocked

**ZK Proof Generation Fails**
- Check browser console for detailed error messages
- Ensure circuit files are properly loaded
- Verify input data format and constraints

**Extension Communication Issues**
- Reload browser extension
- Check extension permissions
- Verify extension is running on correct domain

### Debug Mode
Enable debug logging by setting:
```env
NEXT_PUBLIC_DEBUG=true
```

## 📚 API Reference

### Storage Service
```typescript
// Get user policies
const policies = await StorageService.getInsurancePolicies(address);

// Save new policy
await StorageService.addInsurancePolicy(address, policyData);
```

### ZK Utilities
```typescript
// Generate commitment
const commitment = await generateCommitment(secret, orderData);

// Create proof
const proof = await generateClaimProof(policy, priceData);
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Join our Discord community
- Check the documentation wiki

## 🗺️ Roadmap

### Phase 1 (Current)
- ✅ Basic insurance functionality
- ✅ ZK proof integration
- ✅ Browser extension integration
- ✅ Multi-wallet support

### Phase 2 (Upcoming)
- 🔄 Multi-marketplace support (eBay, Shopify)
- 🔄 Mobile application
- 🔄 Advanced analytics dashboard
- 🔄 Governance token integration

### Phase 3 (Future)
- 📋 Cross-chain support
- 📋 Insurance pools and staking
- 📋 AI-powered risk assessment
- 📋 Social features and referrals

---

Built with ❤️ for ETH Delhi 2025
