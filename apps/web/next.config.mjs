/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile workspace packages so they can be imported as source.
  transpilePackages: ["@med/ui", "@med/shared"],
};

export default nextConfig;
