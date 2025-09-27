import dynamic from 'next/dynamic';
import React from 'react';

const ClientHeaderWidget = dynamic(() => import('./HeaderWidget'), {
    ssr: false,
    loading: () => (
        <header style={{
            background: 'linear-gradient(135deg, #232F3E 0%, #37475A 100%)',
            color: 'white',
            padding: '1rem 2rem',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
            borderBottom: '3px solid #FF9900'
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                maxWidth: '1200px',
                margin: '0 auto'
            }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 700, color: 'white' }}>
                        🛡️ ripextension
                    </h1>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', opacity: 0.9, color: '#FF9900', fontWeight: 500 }}>
                        Decentralized Insurance Platform
                    </p>
                </div>
                <div>
                    <button
                        style={{
                            background: 'linear-gradient(135deg, #FF9900, #E8860C)',
                            color: '#232F3E',
                            border: 'none',
                            padding: '0.75rem 1.5rem',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '1rem',
                            opacity: 0.6
                        }}
                        disabled={true}
                    >
                        Loading...
                    </button>
                </div>
            </div>
        </header>
    )
});

interface HeaderWidgetClientProps {
    title: string;
}

const HeaderWidgetClient: React.FC<HeaderWidgetClientProps> = (props) => {
    return <ClientHeaderWidget {...props} />;
};

export default HeaderWidgetClient;