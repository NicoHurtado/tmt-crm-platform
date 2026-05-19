/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        domains: ['localhost'],
        // In dev, next/image optimizes by fetching remotes from the Node server.
        // If DNS/network fails (ENOTFOUND to Vercel Blob, offline, VPN), that returns 500.
        // Skip optimization locally so the browser loads the URL directly (same as <img>).
        unoptimized: process.env.NODE_ENV === 'development',
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '*.public.blob.vercel-storage.com',
                port: '',
                pathname: '/**',
            },
        ],
    },
};

module.exports = nextConfig;
