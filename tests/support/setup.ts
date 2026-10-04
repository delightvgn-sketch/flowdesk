import { config } from "dotenv";

config({ path: [".env.test", ".env.local", ".env"], quiet: true });
