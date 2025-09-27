import {
    ethers,
    JsonRpcProvider,
    BrowserProvider,
    JsonRpcSigner,
    BaseContract,
    type Eip1193Provider,
    type InterfaceAbi
} from 'ethers'
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

type OracleContract = BaseContract & {
    getQuote?: (productId: string, invoicePrice: string) => Promise<unknown>
}

function getInjectedProvider(): Eip1193Provider | null {
    if (typeof window === 'undefined') {
        return null
    }

    const { ethereum } = window as typeof window & { ethereum?: unknown }
    if (ethereum && typeof ethereum === 'object') {
        const candidate = ethereum as { request?: (...args: unknown[]) => Promise<unknown> }
        if (typeof candidate.request === 'function') {
            return candidate as unknown as Eip1193Provider
        }
    }

    return null
}

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
    const injected = getInjectedProvider()
    if (injected) {
        return new ethers.BrowserProvider(injected, CHAIN_ID)
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
    const contract = new ethers.Contract(address, oracleArtifact.abi as InterfaceAbi, provider)
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
    return new ethers.Contract(address, verifierArtifact.abi as InterfaceAbi, provider)
}

export async function getPaymentTokenContract(address: string = PAYMENT_TOKEN_ADDRESS || '', providedSigner?: JsonRpcSigner): Promise<BaseContract> {
    const tokenAddress = ensureAddress(address, 'Payment token address')
    const signer = providedSigner || await getSigner()
    return new ethers.Contract(tokenAddress, tokenArtifact.abi as InterfaceAbi, signer)
}

export async function getPremiumQuote(productId: string, invoicePrice: string): Promise<unknown> {
    const oracle = (await getOracleContract()) as OracleContract
    if (typeof oracle.getQuote !== 'function') {
        throw new Error('Oracle contract does not expose getQuote')
    }
    return oracle.getQuote(productId, invoicePrice)
}

export async function getInsuranceVaultContract(): Promise<BaseContract> {
    const address = ensureAddress(VAULT_ADDRESS, 'Insurance Vault address')
    const provider = await getProvider()
    return new ethers.Contract(address, vaultArtifact.abi as InterfaceAbi, provider)
}

export async function getInsuranceVaultContractWithSigner(providedSigner?: JsonRpcSigner): Promise<BaseContract> {
    const contract = await getInsuranceVaultContract()
    const signer = providedSigner || await getSigner()
    return contract.connect(signer) as BaseContract
}
