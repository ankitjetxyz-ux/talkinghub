// @lovable.dev/vite-tanstack-config merges these — avoid duplicating:
//   tanstackStart, viteReact, tailwindcss, tsConfigPaths, componentTagger (dev),
//   VITE_* envDefine, alias @, dedupe. Cloudflare is opt-out (see cloudflare:false) for Vercel.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

// SSR entry stays src/server.ts; Nitro emits Vercel-compatible output (.vercel/output).
export default defineConfig({
  cloudflare: false,
  tanstackStart: {
    server: { entry: "server" },
  },
  plugins: [
    nitro({
      config: {
        preset: "vercel",
      },
    }),
  ],
});
