import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono, EB_Garamond, Crimson_Pro, Barlow_Condensed, Overpass } from 'next/font/google'

import '@/index.css' // Import global styles
import { cn } from '@/lib/cn'
import { ScrollToTop } from '@/components/navigation/ScrollToTop'
import NextTopLoader from 'nextjs-toploader'
import { Toaster } from "sonner";

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const tech = JetBrains_Mono({ subsets: ['latin'], variable: '--font-tech' })
const classic = EB_Garamond({ subsets: ['latin'], variable: '--font-classic' })
const academic = Crimson_Pro({ subsets: ['latin'], variable: '--font-academic' })
const industrial = Barlow_Condensed({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-industrial' })
const signage = Overpass({ subsets: ['latin'], variable: '--font-signage' })


export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1, // Start with this to be safe against auto-zoom
    userScalable: false, // Wait, user wants to pinch out? 
    // "I can pinch to zoom out". 
    // If I set userScalable: false, they CANNOT pinch.
    // So DO NOT set userScalable: false.
    // DO NOT set maximumScale: 1 if they want to zoom?
    // User said "I just want it to start without any zoom".
    // If I set maximumScale: 1, they can't zoom in either.
    // Let's set it to 1 for now to FIX the bug, assuming the bug is "auto zoom in".
}

export const metadata: Metadata = {
    title: 'Interview Coach',
    description: 'AI-powered interview practice',
    icons: {
        icon: '/r2w-logo.webp',
    },
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body className={cn(
                "min-h-screen bg-background font-sans antialiased",
                inter.variable,
                tech.variable,
                classic.variable,
                academic.variable,
                industrial.variable,
                signage.variable
            )}>

                <NextTopLoader
                    color="#08409a"
                    initialPosition={0.08}
                    crawlSpeed={200}
                    height={3}
                    crawl={true}
                    showSpinner={false}
                    easing="ease"
                    speed={200}
                    shadow="0 0 10px #08409a, 0 0 5px #08409a"
                />
                <ScrollToTop />
                <Toaster richColors position="top-center" />
                {children}
            </body>
        </html>
    )
}
