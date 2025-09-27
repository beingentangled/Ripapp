import '../styles/globals.css'
import { WalletProvider } from '../context/WalletContext'
import '../config/appkit' // Initialize AppKit
import type { AppProps } from 'next/app'

export default function App({ Component, pageProps }: AppProps) {
    return (
        <WalletProvider>
            <Component {...pageProps} />
        </WalletProvider>
    )
}