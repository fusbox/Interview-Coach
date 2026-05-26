/** @type {import('next').NextConfig} */
const nextConfig = {
    // Rebuild trigger: 3
    reactStrictMode: true,
    experimental: {
        serverActions: {
            allowedOrigins: [
                '192.168.1.177:3000',
                '192.168.1.177:3002',
                '192.168.1.177',
                'localhost:3000',
                'localhost:3002',
                '0.0.0.0:3000',
                '0.0.0.0:3002',
            ],
        },
    },
};

export default nextConfig;
