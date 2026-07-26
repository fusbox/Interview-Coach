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
				display: [
					'var(--font-display)',
					...fontFamily.sans
				],
			},
			fontSize: {
				micro: ['0.625rem', { lineHeight: '1rem', letterSpacing: '0.05em' }]
			},

			colors: {
				border: 'rgb(var(--border) / <alpha-value>)',
				input: 'rgb(var(--input) / <alpha-value>)',
				ring: 'rgb(var(--ring) / <alpha-value>)',
				background: 'rgb(var(--background) / <alpha-value>)',
				foreground: 'rgb(var(--foreground) / <alpha-value>)',
				primary: {
					DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
					foreground: 'rgb(var(--primary-foreground) / <alpha-value>)'
				},
				secondary: {
					DEFAULT: 'rgb(var(--secondary) / <alpha-value>)',
					foreground: 'rgb(var(--secondary-foreground) / <alpha-value>)'
				},
				destructive: {
					DEFAULT: 'rgb(var(--destructive) / <alpha-value>)',
					foreground: 'rgb(var(--destructive-foreground) / <alpha-value>)'
				},
				muted: {
					DEFAULT: 'rgb(var(--muted) / <alpha-value>)',
					foreground: 'rgb(var(--muted-foreground) / <alpha-value>)'
				},
				accent: {
					DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
					foreground: 'rgb(var(--accent-foreground) / <alpha-value>)',
					alt: 'rgb(var(--accent-alt) / <alpha-value>)'
				},
				popover: {
					DEFAULT: 'rgb(var(--popover) / <alpha-value>)',
					foreground: 'rgb(var(--popover-foreground) / <alpha-value>)'
				},
				card: {
					DEFAULT: 'rgb(var(--card) / <alpha-value>)',
					foreground: 'rgb(var(--card-foreground) / <alpha-value>)'
				},
				success: {
					DEFAULT: 'rgb(var(--success) / <alpha-value>)',
					foreground: 'rgb(var(--success-foreground) / <alpha-value>)'
				},
				warning: {
					DEFAULT: 'rgb(var(--warning) / <alpha-value>)',
					foreground: 'rgb(var(--warning-foreground) / <alpha-value>)'
				},
				surface: {
					base: 'rgb(var(--surface-base) / <alpha-value>)',
					subtle: 'rgb(var(--surface-subtle) / <alpha-value>)',
					platinum: 'rgb(var(--surface-platinum) / <alpha-value>)',
					raised: 'rgb(var(--surface-raised) / <alpha-value>)',
					overlay: 'rgb(var(--surface-overlay) / <alpha-value>)',
				},
				'text-primary': 'rgb(var(--text-primary) / <alpha-value>)',
				'text-secondary': 'rgb(var(--text-secondary) / <alpha-value>)',
				'text-muted': 'rgb(var(--text-muted) / <alpha-value>)',
				'text-inverse': 'rgb(var(--text-inverse) / <alpha-value>)',
				state: {
					success: 'rgb(var(--state-success) / <alpha-value>)',
					warning: 'rgb(var(--state-warning) / <alpha-value>)',
					critical: 'rgb(var(--state-critical) / <alpha-value>)',
					info: 'rgb(var(--state-info) / <alpha-value>)',
				},
				preparedness: {
					'not-practiced': 'rgb(var(--prep-not-practiced) / <alpha-value>)',
					emerging: 'rgb(var(--prep-emerging) / <alpha-value>)',
					clear: 'rgb(var(--prep-clear) / <alpha-value>)',
					strong: 'rgb(var(--prep-strong) / <alpha-value>)',
				},
				brand: {
					deep: 'rgb(var(--primary-deep) / <alpha-value>)',
					orange: 'rgb(var(--secondary-brand) / <alpha-value>)',
					'glass-start': 'rgb(var(--brand-glass-start) / <alpha-value>)',
					'glass-end': 'rgb(var(--brand-glass-end) / <alpha-value>)'
				},
				chart: {
					'1': 'rgb(var(--chart-1) / <alpha-value>)',
					'2': 'rgb(var(--chart-2) / <alpha-value>)',
					'3': 'rgb(var(--chart-3) / <alpha-value>)',
					'4': 'rgb(var(--chart-4) / <alpha-value>)',
					'5': 'rgb(var(--chart-5) / <alpha-value>)'
				}
			},
			spacing: {
				'space-0': 'var(--space-0)',
				'space-1': 'var(--space-1)',
				'space-2': 'var(--space-2)',
				'space-3': 'var(--space-3)',
				'space-4': 'var(--space-4)',
				'space-5': 'var(--space-5)',
				'space-6': 'var(--space-6)',
				'space-7': 'var(--space-7)',
				'space-8': 'var(--space-8)',
				'space-9': 'var(--space-9)',
				'gap-field': 'var(--gap-field)',
				'gap-cluster': 'var(--gap-cluster)',
				'pad-card': 'var(--pad-card)',
				'pad-widget': 'var(--pad-widget)',
			},
			maxWidth: {
				'grid-max': 'var(--grid-max)',
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
				card: 'var(--radius-card)',
				panel: 'var(--radius-panel)',
				widget: 'var(--radius-widget)',
				row: 'var(--radius-row)',
				control: 'var(--radius-control)',
				chip: 'var(--radius-chip)',
			},
			boxShadow: {
				flat: 'var(--shadow-flat)',
				'raised-1': 'var(--shadow-raised-1)',
				'raised-2': 'var(--shadow-raised-2)',
				floating: 'var(--shadow-floating)',
				row: 'var(--elevation-row)',
				card: 'var(--elevation-card)',
				panel: 'var(--elevation-panel)',
				cta: 'var(--elevation-cta)',
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
			fontWeight: {
				normal: 'var(--font-weight-normal)',
				medium: 'var(--font-weight-medium)',
				semibold: 'var(--font-weight-semibold)',
				bold: 'var(--font-weight-bold)',
				black: 'var(--font-weight-black)',
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
