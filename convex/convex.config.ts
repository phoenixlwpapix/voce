import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    APP_OWNER_EMAIL: v.string(),
  },
});

export default app;
