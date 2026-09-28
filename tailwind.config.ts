import type { Config } from 'tailwindcss';

const config: Config = {
    content: ['./src/**/*.{ts,tsx}'],
    theme: {
        extend: {
            colors: {
                navy: {
                    900: '#0b1b33',
                    800: '#10243f',
                    700: '#163150',
                    600: '#1d4066'
                },
                // ServiZing logo blue (#34a4f6 = 500); 600+ are darkened for white-text contrast.
                brand: {
                    50: '#eef8ff',
                    100: '#d9effe',
                    200: '#bce3fe',
                    300: '#8ed2fd',
                    400: '#59b8fa',
                    500: '#34a4f6',
                    600: '#1a7fd1',
                    700: '#1567ab',
                    800: '#17568b',
                    900: '#194973'
                },
                // ServiZing logo orange (#fbb12c = 400).
                accent: {
                    50: '#fff8eb',
                    100: '#feedc7',
                    200: '#fdd98a',
                    300: '#fcc24d',
                    400: '#fbb12c',
                    500: '#f59e0b',
                    600: '#d97b06',
                    700: '#b45a09'
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
