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
                    DEFAULT: '#F97316', // Orange
                    hover: '#EA580C',
                },
                sidebar: {
                    DEFAULT: '#FDF2E9', // Light peach/beige from image
                },
                background: '#FAF9F6', // Off-white
            }
        },
    },
    plugins: [],
}
