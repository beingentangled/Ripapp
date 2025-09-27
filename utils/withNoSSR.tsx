import dynamic from 'next/dynamic';
import { ComponentType } from 'react';

// Wrapper to prevent hydration mismatches by only rendering on client-side
function withNoSSR<P extends object>(Component: ComponentType<P>) {
    return dynamic(() => Promise.resolve(Component), {
        ssr: false,
        loading: () => (
            <div style={{
                padding: '2rem',
                textAlign: 'center',
                color: '#666',
                background: '#f9f9f9',
                borderRadius: '8px',
                margin: '1rem 0'
            }}>
                Loading...
            </div>
        )
    });
}

export default withNoSSR;