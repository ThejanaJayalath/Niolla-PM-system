/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#FB8C19', // Rect 11 - Vibrant Orange
                    hover: '#E67E0F',
                    light: '#FED8B1', // Rect 8
                },
                sidebar: {
                    DEFAULT: '#FFF1E4', // Rect 7 - Peach (Base)
                    active: '#FED8B1', // Rect 8 - Darker Peach for accents
                },
                background: '#FAF9F6', // Off-white
                'table-header': '#FFF1E4', // Matching sidebar
            }
        },
    },
    plugins: [],
}
