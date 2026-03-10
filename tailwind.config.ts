import type { Config } from "tailwindcss"
import { fontFamily } from "tailwindcss/defaultTheme"
import tailwindAnimate from "tailwindcss-animate"


const config = {
	darkMode: ["class"],
	content: [
		'./pages/**/*.{ts,tsx}',
		'./components/**/*.{ts,tsx}',
		'./app/**/*.{ts,tsx}',
		'./src/**/*.{ts,tsx}',
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				sans: [
					'var(--font-sans)',
					...fontFamily.sans
				],
				tech: ['var(--font-tech)', ...fontFamily.mono],
				classic: ['var(--font-classic)', ...fontFamily.serif],
				academic: ['var(--font-academic)', ...fontFamily.serif],
				industrial: ['var(--font-industrial)', ...fontFamily.sans],
				signage: ['var(--font-signage)', ...fontFamily.sans],
			},
			fontSize: {
				micro: ['0.625rem', { lineHeight: '1rem', letterSpacing: '0.05em' }]
			},

			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))',
					alt: 'hsl(var(--accent-alt))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				success: {
					DEFAULT: 'hsl(var(--success))',
					foreground: 'hsl(var(--success-foreground))'
				},
				warning: {
					DEFAULT: 'hsl(var(--warning))',
					foreground: 'hsl(var(--warning-foreground))'
				},
				surface: {
					base: 'hsl(var(--surface-base))',
					subtle: 'hsl(var(--surface-subtle))',
					platinum: 'hsl(var(--surface-platinum))',
					raised: 'hsl(var(--surface-raised))',
					overlay: 'hsl(var(--surface-overlay))',
				},
				'text-primary': 'hsl(var(--text-primary))',
				'text-secondary': 'hsl(var(--text-secondary))',
				'text-muted': 'hsl(var(--text-muted))',
				'text-inverse': 'hsl(var(--text-inverse))',
				state: {
					success: 'hsl(var(--state-success))',
					warning: 'hsl(var(--state-warning))',
					critical: 'hsl(var(--state-critical))',
					info: 'hsl(var(--state-info))',
				},
				readiness: {
					high: 'hsl(var(--readiness-high))',
					medium: 'hsl(var(--readiness-medium))',
					low: 'hsl(var(--readiness-low))',
					unknown: 'hsl(var(--readiness-unknown))',
				},
				brand: {
					deep: 'hsl(var(--brand-deep))',
					orange: 'hsl(var(--brand-orange))',
					'glass-start': 'hsl(var(--brand-glass-start))',
					'glass-end': 'hsl(var(--brand-glass-end))'
				},
				chart: {
					'1': 'hsl(var(--chart-1))',
					'2': 'hsl(var(--chart-2))',
					'3': 'hsl(var(--chart-3))',
					'4': 'hsl(var(--chart-4))',
					'5': 'hsl(var(--chart-5))'
				}
			},
			borderRadius: {
				'3xl': 'var(--radius-3xl)',
				'2xl': 'var(--radius-2xl)',
				xl: 'var(--radius-xl)',
				lg: 'var(--radius-lg)',
				md: 'var(--radius-md)',
				sm: 'var(--radius-sm)',
				full: '9999px',
				DEFAULT: 'var(--radius)',
			},
			boxShadow: {
				flat: 'var(--shadow-flat)',
				'raised-1': 'var(--shadow-raised-1)',
				'raised-2': 'var(--shadow-raised-2)',
				floating: 'var(--shadow-floating)',
			},
			transitionDuration: {
				fast: 'var(--duration-fast)',
				base: 'var(--duration-base)',
				slow: 'var(--duration-slow)',
				700: '700ms',
			},
			transitionTimingFunction: {
				standard: 'var(--ease-standard)',
				emphasized: 'var(--ease-emphasized)',
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down var(--duration-base) var(--ease-emphasized)',
				'accordion-up': 'accordion-up var(--duration-base) var(--ease-emphasized)'
			}
		}
	},
	plugins: [tailwindAnimate],

} satisfies Config

export default config
