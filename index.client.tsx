import type { PluginClientContext } from "@getpaseo/plugin/client";
import { RouteRow } from "./client/route-row";
import { RouterSettings } from "./client/settings";
import { ROUTE_ROW_KIND, ROUTE_ROW_VERSION, routeRowSchema, routeTask } from "./shared/contracts";

export default function contribute(client: PluginClientContext) {
  client.addSlashCommand({
    name: "route",
    description: "Start an agent with the profile Jev picks for this task",
    argumentHint: "<task>",
    context: "workspace",
    async onSubmit({ args, workspace, rpc, openSettings }) {
      if (!args) throw new Error("Usage: /route <task>");
      try {
        await rpc(routeTask, { workspaceId: workspace.id, task: args });
      } catch (error) {
        // A missing key is the likely first-run failure; take the user straight to the fix.
        if (String(error).includes("API key")) openSettings("settings");
        throw error;
      }
    },
  });
  client.addSettingsScreen({
    id: "settings",
    title: "Jev agent router",
    icon: "Route",
    Component: RouterSettings,
  });
  client.addTimelineRenderer({
    kind: ROUTE_ROW_KIND,
    version: ROUTE_ROW_VERSION,
    schema: routeRowSchema,
    Component: RouteRow,
  });
  return () => {};
}
