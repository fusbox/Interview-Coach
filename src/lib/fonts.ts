import { JetBrains_Mono, EB_Garamond, Crimson_Pro, Barlow_Condensed, Overpass } from 'next/font/google';

export const tech = JetBrains_Mono({ 
    subsets: ['latin'], 
    variable: '--font-tech',
    display: 'swap',
    preload: false,
});

export const classic = EB_Garamond({ 
    subsets: ['latin'], 
    variable: '--font-classic',
    display: 'swap',
    preload: false,
});

export const academic = Crimson_Pro({ 
    subsets: ['latin'], 
    variable: '--font-academic',
    display: 'swap',
    preload: false,
});

export const industrial = Barlow_Condensed({ 
    subsets: ['latin'], 
    weight: ['400', '700'], 
    variable: '--font-industrial',
    display: 'swap',
    preload: false,
});

export const signage = Overpass({ 
    subsets: ['latin'], 
    variable: '--font-signage',
    display: 'swap',
    preload: false,
});
