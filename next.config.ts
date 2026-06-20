import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Enable standalone output for Docker/Railway deployments
    output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,

    // Prevent these from being bundled (server-side only)
    // pdfkit needs to resolve its own font files at runtime
    serverExternalPackages: ['mjml', 'uglify-js', 'pdfkit'],

    // Image optimization
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**.supabase.co',
            },
            // Add other image hosts as needed
        ],
    },

    // Turbopack configuration (Next.js 16+)
    turbopack: {
        // Empty config to silence webpack warning
        // MJML is server-side only and doesn't need special bundling
    },

    // Security headers
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'X-DNS-Prefetch-Control',
                        value: 'on'
                    },
                    {
                        key: 'Strict-Transport-Security',
                        value: 'max-age=63072000; includeSubDomains; preload'
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'SAMEORIGIN'
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff'
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'origin-when-cross-origin'
                    }
                ],
            },
        ];
    },
};

export default nextConfig;

