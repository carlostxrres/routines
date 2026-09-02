import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const REQUIRED_ENV = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // src/lib/supabase.ts throws at module scope when these are missing. In a
  // production build those reads are inlined as `undefined`, so the throw
  // becomes unconditional and the bundler drops the entire app after it — the
  // build still "succeeds" and ships a blank page. Failing here instead makes
  // a misconfigured deploy loud.
  if (command === "build") {
    const env = loadEnv(mode, process.cwd(), "");
    const missing = REQUIRED_ENV.filter((key) => !env[key]);
    if (missing.length > 0) {
      throw new Error(
        `Faltan variables de entorno para el build: ${missing.join(", ")}. ` +
          "Copia .env.example a .env (o configúralas en Vercel).",
      );
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
        "@shared": path.resolve(import.meta.dirname, "./shared"),
      },
    },
  };
});
