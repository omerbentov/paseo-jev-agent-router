import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

/** What the app is told about the router's setup. The API key itself never leaves the daemon. */
export const routerStatusSchema = z.object({
  keySource: z.enum(["env", "file", "none"]),
  minConfidence: z.number(),
  fallbackProfileId: z.string(),
  profiles: z.array(z.object({ id: z.string(), name: z.string(), hasNotes: z.boolean() })),
});

export const routeDecisionSchema = z.object({
  profileName: z.string(),
  confidence: z.number().nullable(),
  reason: z.string(),
});

export const routeTask = defineRpc({
  name: "router.route",
  input: z.object({ workspaceId: z.string(), task: z.string().min(1) }),
  output: routeDecisionSchema.extend({ agentId: z.string() }),
});

export const getStatus = defineRpc({
  name: "router.status",
  input: z.object({}),
  output: routerStatusSchema,
});

export const saveSettings = defineRpc({
  name: "router.save",
  input: z.object({
    // Omitted keeps the stored key; an empty string removes it.
    typesafeApiKey: z.string().optional(),
    minConfidence: z.number().min(0).max(1),
    fallbackProfileId: z.string(),
  }),
  output: routerStatusSchema,
});

/** The row the router appends to the agent it started, saying why it chose that profile. */
export const ROUTE_ROW_KIND = "jev-route";
export const ROUTE_ROW_VERSION = 1;
export const routeRowSchema = routeDecisionSchema;
