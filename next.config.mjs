/** @type {import('next').NextConfig} */
const nextConfig = {
    // Rebuild trigger: 3
    reactStrictMode: true,
    ...(process.env.NEXT_DIST_DIR?.trim()
        ? { distDir: process.env.NEXT_DIST_DIR.trim() }
        : {}),
    allowedDevOrigins: [
        '127.0.0.1',
        'localhost',
        '192.168.1.177',
        '192.168.1.177:3000',
        '192.168.1.177:3001',
    ],
    experimental: {
        serverActions: {
            allowedOrigins: [
                '192.168.1.177:3000',
                '192.168.1.177:3001',
                '192.168.1.177',
                'localhost:3000',
                'localhost:3001',
                '0.0.0.0:3000',
                '0.0.0.0:3001',
            ],
        },
    },
};

export default nextConfig;
