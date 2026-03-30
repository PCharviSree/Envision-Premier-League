import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /* config options here */
  // Prevent Turbopack from picking the wrong lockfile/workspace root.
  // (This is harmless in Webpack mode, but keeps local dev stable.)
  turbopack: {
    root: dirname,
  },
};

export default nextConfig;
