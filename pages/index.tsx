import Head from 'next/head';
import styles from '../styles/Home.module.css';
import HeaderWidgetClient from "@/components/HeaderWidgetClient";
import InvoiceWidget from "@/components/InvoiceWidget";

export default function Home(): React.JSX.Element {

    return (
        <div className={styles.container}>
            <Head>
                <title>RIP - Remorse Insurance Protocol</title>
                <meta name="description" content="Secure your Amazon purchases with blockchain-powered insurance" />
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <HeaderWidgetClient title="🛡️ RIP - Remorse Insurance Protocol" />

            <main className={styles.main}>
                <InvoiceWidget />
            </main>

            <footer className={styles.footer}>
                <p>
                    Powered by <strong>RIP</strong> - Remorse Insurance Protocol - Securing your purchases with blockchain technology
                </p>
            </footer>
        </div>
    );
}