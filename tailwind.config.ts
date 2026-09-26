import type { Config } from 'tailwindcss';

const config: Config = {
    content: ['./src/**/*.{ts,tsx}'],
    theme: {
        extend: {
            colors: {
                navy: {
                    // Sidebar surface, taken from the design reference.
                    900: '#0b1533',
                    800: '#101d43',
                    700: '#16285a',
                    600: '#1d3a7a'
                },
                brand: {
                    50: '#eff6ff',
                    100: '#dbeafe',
                    200: '#bfdbfe',
                    500: '#3b82f6',
                    600: '#2563eb',
                    700: '#1d4ed8'
                },
                ink: '#0f172a',
                muted: '#64748b',
                line: '#e2e8f0',
                canvas: '#f1f5f9'
            },
            boxShadow: {
                card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.05)',
                pop: '0 8px 30px rgba(15, 23, 42, 0.12)'
            },
            borderRadius: {
                xl: '12px',
                '2xl': '16px'
            },
            fontFamily: {
                sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif']
            }
        }
    },
    plugins: []
};

export default config;
