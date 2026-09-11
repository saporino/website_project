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
        // Coffee LiVRE — paleta oficial da home laranja. REGISTRADA para uso
        // futuro: a pagina /coffeelivre usa o CSS proprio, fiel ao HTML
        // oficial, e NAO deve ser reescrita com estas utilitarias.
        'livre-laranja': '#DA6418',
        'livre-laranja-cabecalho': '#E97524',
        'livre-laranja-claro': '#F3A066',
        'livre-marrom': '#3A2318',
        'livre-marrom-escuro': '#24150E',
        'livre-texto': '#2A1911',
        'livre-texto-2': '#351E14',
        'livre-colheita-a': '#2A1911',
        'livre-colheita-b': '#5A3524',
        'livre-etiqueta': '#EFE3DA',
        'livre-logo-laranja': '#FD7502',
        'livre-logo-marrom': '#4F2407',
      },
    },
  },
  plugins: [],
};
