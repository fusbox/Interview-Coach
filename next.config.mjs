/** @type {import('next').NextConfig} */
const nextConfig = {
    // Rebuild trigger: 3
    reactStrictMode: true,
    allowedDevOrigins: ['127.0.0.1', 'localhost'],
    experimental: {
        serverActions: {
            allowedOrigins: ['192.168.1.177:3000', '192.168.1.177', 'localhost:3000', '127.0.0.1:3000', '0.0.0.0:3000'],
        },
    },
};

export default nextConfig;
