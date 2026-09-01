import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.nox.offlineplayer",
  appName: "NOX Offline Player",
  webDir: "dist/public",
  bundledWebRuntime: false,
  server: { cleartext: false },
};

export default config;
