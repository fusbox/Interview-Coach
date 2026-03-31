import type { Metadata, Viewport } from 'next'
import { Inter, Outfit } from 'next/font/google'

import '@/index.css'
import { cn } from '@/lib/cn'
import { ScrollToTop } from '@/components/navigation/ScrollToTop'
import NextTopLoader from 'nextjs-toploader'
import { Toaster } from "sonner";

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const display = Outfit({ subsets: ['latin'], variable: '--font-display' })


export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
}

export const metadata: Metadata = {
    title: 'Interview Coach',
    description: 'AI-powered interview practice',
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
                display.variable
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
