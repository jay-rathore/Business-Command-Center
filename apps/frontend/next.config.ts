import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Disabled — its Babel transform crashed the Turbopack build on a conditional-JSX pattern
  // in DataTable.tsx. It's a performance optimization Phase 1 doesn't depend on functionally;
  // worth revisiting once React Compiler's Turbopack integration matures.
  reactCompiler: false,
};

export default nextConfig;
