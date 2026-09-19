import type { PluginServerContext } from "@getpaseo/plugin/server";
import { getStatus, routeTask, saveSettings } from "./shared/contracts";
import { handleRoute, handleSave, handleStatus } from "./server/router";

export default function contribute(server: PluginServerContext) {
  server.handle(routeTask, handleRoute);
  server.handle(getStatus, handleStatus);
  server.handle(saveSettings, handleSave);
  return () => {};
}
