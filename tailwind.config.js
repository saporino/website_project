/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Tokens novos — valem só para código NOVO. NÃO substituem os 448 #8B2214 existentes.
        saporino: { DEFAULT: '#8B2214', deep: '#8a1f0c', alt: '#a4240e' },
        // cofico.ink para texto/links/botões pequenos (#FF3131 sobre branco reprova WCAG AA);
        // cofico.DEFAULT só para superfícies/áreas grandes.
        cofico: { DEFAULT: '#FF3131', ink: '#E02020', dark: '#B81C1C' },
      },
    },
  },
  plugins: [],
};
