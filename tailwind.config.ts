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
				/* STAGED FOR MERGE: Candidate Typography Fonts (Uncomment to enable)
				display: [
					'var(--font-display)',
					...fontFamily.sans
				],
				*/
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
				/* STAGED FOR MERGE: Candidate RGB Color Scale (Uncomment to enable)
				candidate: {
					background: 'rgb(var(--candidate-background))',
					surface: 'rgb(var(--candidate-surface))',
					border: 'rgb(var(--candidate-border))',
					foreground: 'rgb(var(--candidate-foreground))',
					'display-foreground': 'rgb(var(--candidate-display-foreground))',
					muted: 'rgb(var(--candidate-muted))',
					primary: 'rgb(var(--candidate-primary))',
					accent: 'rgb(var(--candidate-accent))',
					success: 'rgb(var(--candidate-success))',
					'primary-soft': 'rgb(var(--candidate-primary-soft))',
					'accent-soft': 'rgb(var(--candidate-accent-soft))',
				},
				*/
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
			spacing: {
				// Primitives
				'space-0': 'var(--space-0)',
				'space-0-5': 'var(--space-0-5)',
				'space-1': 'var(--space-1)',
				'space-1-5': 'var(--space-1-5)',
				'space-2': 'var(--space-2)',
				'space-3': 'var(--space-3)',
				'space-4': 'var(--space-4)',
				'space-5': 'var(--space-5)',
				'space-6': 'var(--space-6)',
				'space-8': 'var(--space-8)',
				'space-10': 'var(--space-10)',
				'space-12': 'var(--space-12)',
				'space-16': 'var(--space-16)',

				// Gaps
				'gap-inline': 'var(--gap-inline)',
				'gap-control': 'var(--gap-control)',
				'gap-field': 'var(--gap-field)',
				'gap-cluster': 'var(--gap-cluster)',
				'gap-grid': 'var(--gap-grid)',
				'gap-section': 'var(--gap-section)',

				// Paddings
				'pad-control-y': 'var(--pad-control-y)',
				'pad-control-x': 'var(--pad-control-x)',
				'pad-field-y': 'var(--pad-field-y)',
				'pad-field-x': 'var(--pad-field-x)',
				'pad-card': 'var(--pad-card)',
				'pad-panel': 'var(--pad-panel)',
				'pad-page': 'var(--pad-page)',
				'pad-session': 'var(--pad-session)',

				// Density
				'density-compact-pad': 'var(--density-compact-pad)',
				'density-compact-gap': 'var(--density-compact-gap)',
				'density-compact-row': 'var(--density-compact-row)',
				'density-comfort-pad': 'var(--density-comfort-pad)',
				'density-comfort-gap': 'var(--density-comfort-gap)',
				'density-comfort-row': 'var(--density-comfort-row)',
				'density-focus-pad': 'var(--density-focus-pad)',
				'density-focus-gap': 'var(--density-focus-gap)',
				'density-focus-row': 'var(--density-focus-row)',

				/* STAGED FOR MERGE: Candidate UI Spacing Tokens (Uncomment to enable)
				'pad-card-compact-y': 'var(--pad-card-compact-y)',
				'pad-card-compact-x': 'var(--pad-card-compact-x)',
				'pad-card-compact-bottom': 'var(--pad-card-compact-bottom)',
				'layout-composer-text': 'var(--layout-composer-text-height)',
				'layout-composer-voice': 'var(--layout-composer-voice-height)',
				'layout-visualizer': 'var(--layout-visualizer-height)',
				// 3-Tier Component Control Heights:
				'control-sm': '2rem', // 32px: chips, tags, auxiliary triggers
				'control-md': '2.75rem', // 44px: standard actions, input fields, alert pills
				'control-lg': '4.125rem', // 66px: voice capture bars, recording containers
				*/
			},
			maxWidth: {
				'grid-max': 'var(--candidate-grid-max)',
				'public-max': 'var(--layout-public-max)',
				'app-max': 'var(--layout-app-max)',
				'readable-max': 'var(--layout-readable-max)',
				'form-max': 'var(--layout-form-max)',
				'session-max': 'var(--layout-session-max)',
			},
			width: {
				'sidebar-width': 'var(--layout-sidebar-width)',
				'rail-width': 'var(--layout-rail-width)',
			},
			height: {
				'header-height': 'var(--layout-header-height)',
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
				/* STAGED FOR MERGE: Candidate Semantic Radii (Uncomment to enable)
				'radius-card': 'var(--radius-card)',
				'radius-panel': 'var(--radius-panel)',
				'radius-session': 'var(--radius-session)',
				'radius-pill': 'var(--radius-pill)',
				'radius-control': 'var(--radius-control)',
				*/
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
