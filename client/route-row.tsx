import type { PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { Text, View } from "react-native";
import type { z } from "zod";
import type { routeRowSchema } from "../shared/contracts";

/** The note at the top of a routed agent: which profile Jev picked, and why. */
export function RouteRow({ item, theme }: PluginTimelineItemProps<z.output<typeof routeRowSchema>>) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}>
      <Icon name="Route" size={14} color={theme.colors.foregroundMuted} />
      <Text style={{ color: theme.colors.foregroundMuted, fontSize: 13, flexShrink: 1 }}>
        <Text style={{ color: theme.colors.foreground }}>{item.data.profileName}</Text>
        {" · "}
        {item.data.reason}
      </Text>
    </View>
  );
}
