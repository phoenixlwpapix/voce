import { defineApp } from "convex/server";
import { v } from "convex/values";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";

const app = defineApp({
  env: {
    APP_OWNER_EMAIL: v.string(),
  },
});

app.use(rateLimiter);

export default app;
