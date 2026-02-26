import type { Config } from "vike/types"
import vikePhoton from "vike-photon/config"
import config from "vike-solid/config"

// Default config (can be overridden by pages)
export default {
  extends: [config, vikePhoton],
  photon: {
    target: process.env.NODE_ENV === "development" ? "node" : "auto",
    server: "../server/server.ts",
  },
} satisfies Config
