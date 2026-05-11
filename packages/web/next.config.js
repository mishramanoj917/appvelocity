/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile workspace packages so Next.js can resolve them
  transpilePackages: [
    '@appvelocity/shared-core',
    '@appvelocity/agent-design-to-code-workflow',
    '@appvelocity/agent-design-to-code-generators',
    '@appvelocity/agent-design-to-code-core',
    '@appvelocity/agent-design-to-code',
    '@appvelocity/agent-access',
    '@appvelocity/agent-shield',
    '@appvelocity/agent-testiq',
    '@appvelocity/agent-perfect',
    '@appvelocity/agent-compliance',
    '@appvelocity/agent-devboost',
  ],
  experimental: {
    // Enables server actions (used by agent launchers)
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        'appvelocity-xperion.centralindia.cloudapp.azure.com',
      ],
    },
  },
  // Required for streaming responses from API routes
  serverExternalPackages: ['@langchain/core', '@langchain/langgraph', '@anthropic-ai/sdk'],
};

module.exports = nextConfig;
