import { ethers, Contract, JsonRpcProvider, BrowserProvider, JsonRpcSigner, BaseContract } from 'ethers'
import oracleArtifact from '../abi/PriceProtectionOracle.json'
import verifierArtifact from '../abi/Groth16Verifier.json'
import tokenArtifact from '../abi/Token.json'
import vaultArtifact from '../abi/InsuranceVault.json'

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL
const ORACLE_ADDRESS = process.env.NEXT_PUBLIC_ORACLE_ADDRESS
const VERIFIER_ADDRESS = process.env.NEXT_PUBLIC_VERIFIER_ADDRESS
const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS
const PAYMENT_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_PAYMENT_TOKEN
const CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID ? Number(process.env.NEXT_PUBLIC_CHAIN_ID) : undefined

function ensureAddress(address: string | undefined, label: string): string {
    console.log(`🔍 Checking ${label}:`, address);
    if (!address || !ethers.isAddress(address)) {
        console.error(`❌ Invalid address for ${label}:`, address);
        throw new Error(`${label} is not configured or invalid`)
    }
    console.log(`✅ Valid address for ${label}:`, address);
    return address
}

export async function getProvider(): Promise<JsonRpcProvider | BrowserProvider> {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
        const provider = new ethers.BrowserProvider((window as any).ethereum, CHAIN_ID)
        return provider
    }

    if (RPC_URL) {
        return new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID)
    }

    throw new Error('No wallet provider available. Please configure NEXT_PUBLIC_RPC_URL or connect via browser wallet.')
}

export async function getSigner(): Promise<JsonRpcSigner> {
    const provider = await getProvider()
    if (provider instanceof ethers.BrowserProvider) {
        await provider.send('eth_requestAccounts', [])
    }
    return provider.getSigner()
}

export async function getOracleContract(): Promise<BaseContract> {
    const address = ensureAddress(ORACLE_ADDRESS, 'Oracle address')
    const provider = await getProvider()
    const contract = new ethers.Contract(address, oracleArtifact.abi, provider)
    return contract
}

export async function getOracleContractWithSigner(): Promise<BaseContract> {
    const contract = await getOracleContract()
    const signer = await getSigner()
    return contract.connect(signer) as BaseContract
}

export async function getVerifierContract(): Promise<BaseContract> {
    const address = ensureAddress(VERIFIER_ADDRESS, 'Verifier address')
    const provider = await getProvider()
    return new ethers.Contract(address, verifierArtifact.abi, provider)
}

export async function getPaymentTokenContract(address: string = PAYMENT_TOKEN_ADDRESS || '', providedSigner?: JsonRpcSigner): Promise<BaseContract> {
    const tokenAddress = ensureAddress(address, 'Payment token address')
    const signer = providedSigner || await getSigner()
    return new ethers.Contract(tokenAddress, tokenArtifact.abi, signer)
}

export async function getPremiumQuote(productId: string, invoicePrice: string): Promise<any> {
    const oracle = await getOracleContract()
    const price = await (oracle as any).getQuote?.(productId, invoicePrice)
    return price
}

export async function getInsuranceVaultContract(): Promise<BaseContract> {
    const address = ensureAddress(VAULT_ADDRESS, 'Insurance Vault address')
    const provider = await getProvider()
    return new ethers.Contract(address, vaultArtifact.abi, provider)
}

export async function getInsuranceVaultContractWithSigner(providedSigner?: JsonRpcSigner): Promise<BaseContract> {
    const contract = await getInsuranceVaultContract()
    const signer = providedSigner || await getSigner()
    return contract.connect(signer) as BaseContract
}