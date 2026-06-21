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
        // Origins allowed to embed the public claim-intake form via <iframe>.
        // Keep this list aligned with the NTS brand family that links out to
        // ntslogistics.com/claims (or equivalents) from their own contact pages.
        const intakeFrameAncestors = [
            "'self'",
            "https://ntslogistics.com",
            "https://*.ntslogistics.com",
            "https://heavyhaulers.com",
            "https://*.heavyhaulers.com",
            "https://heavyequipmenttransport.com",
            "https://*.heavyequipmenttransport.com",
            "https://containertransport.com",
            "https://*.containertransport.com",
            "https://tractortransport.com",
            "https://*.tractortransport.com",
            "https://autotransport.com",
            "https://*.autotransport.com",
            "https://wideloadshipping.com",
            "https://*.wideloadshipping.com",
        ].join(" ");

        return [
            {
                // Global hardening for the authenticated app surface. Negative
                // lookahead excludes `/intake/*` so the public claim form can
                // be embedded into the NTS brand sites.
                source: "/((?!intake/).*)",
                headers: [
                    { key: "X-DNS-Prefetch-Control", value: "on" },
                    {
                        key: "Strict-Transport-Security",
                        value: "max-age=63072000; includeSubDomains; preload",
                    },
                    { key: "X-Frame-Options", value: "SAMEORIGIN" },
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "Referrer-Policy", value: "origin-when-cross-origin" },
                ],
            },
            {
                // Iframe-friendly headers for the public intake form. We use
                // CSP `frame-ancestors` (not X-Frame-Options) because XFO
                // can't whitelist multiple origins.
                source: "/intake/:path*",
                headers: [
                    { key: "X-DNS-Prefetch-Control", value: "on" },
                    {
                        key: "Strict-Transport-Security",
                        value: "max-age=63072000; includeSubDomains; preload",
                    },
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "Referrer-Policy", value: "origin-when-cross-origin" },
                    {
                        key: "Content-Security-Policy",
                        value: `frame-ancestors ${intakeFrameAncestors};`,
                    },
                ],
            },
        ];
    },
};

export default nextConfig;

