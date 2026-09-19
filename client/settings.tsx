import { type PluginSurfaceProps, useRpc } from "@getpaseo/plugin/client";
import {
  type SettingsInputHandle,
  SettingsAction,
  SettingsCard,
  SettingsInput,
  SettingsRow,
  SettingsSection,
  SettingsSelect,
} from "@getpaseo/plugin/client/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Text } from "react-native";
import type { z } from "zod";
import { getStatus, type routerStatusSchema, saveSettings } from "../shared/contracts";

type Status = z.output<typeof routerStatusSchema>;

const KEY_HINT: Record<Status["keySource"], string> = {
  env: "Using TYPESAFE_API_KEY from the daemon's environment; it overrides a saved key.",
  file: "A key is saved on this host. Paste a new one to replace it.",
  none: "Required. Get one at typesafe.ai. It is stored on this host only.",
};

export function RouterSettings({ theme }: PluginSurfaceProps) {
  const fetchStatus = useRpc(getStatus);
  const status = useQuery({ queryKey: ["router-status"], queryFn: () => fetchStatus({}) });

  if (status.isPending) return <Text style={{ color: theme.colors.foregroundMuted }}>Loading…</Text>;
  if (status.isError) {
    return <Text style={{ color: theme.colors.statusDanger }}>{String(status.error)}</Text>;
  }
  return <SettingsForm status={status.data} />;
}

function SettingsForm({ status }: { status: Status }) {
  const queryClient = useQueryClient();
  const save = useRpc(saveSettings);
  const [key, setKey] = useState("");
  const keyInput = useRef<SettingsInputHandle>(null);
  const [minConfidence, setMinConfidence] = useState(String(status.minConfidence));
  const [fallbackProfileId, setFallbackProfileId] = useState(status.fallbackProfileId);

  const parsedConfidence = Number(minConfidence);
  const confidenceError =
    minConfidence.trim() === "" || !(parsedConfidence >= 0 && parsedConfidence <= 1)
      ? "A number from 0 to 1"
      : undefined;

  const mutation = useMutation({
    mutationFn: (input: { typesafeApiKey?: string }) =>
      save({ ...input, minConfidence: parsedConfidence, fallbackProfileId }),
    onSuccess: (next) => {
      setKey("");
      keyInput.current?.replaceText("");
      queryClient.setQueryData(["router-status"], next);
    },
  });

  return (
    <>
      <SettingsSection title="TypeSafe">
        <SettingsCard>
          <SettingsInput
            label="API key"
            hint={KEY_HINT[status.keySource]}
            placeholder={status.keySource === "none" ? "ts_…" : "••••••••"}
            secureTextEntry
            ref={keyInput}
            onChangeText={setKey}
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="Routing">
        <SettingsCard>
          <SettingsInput
            label="Minimum confidence"
            hint="Below this, the fallback profile is used instead of Jev's pick."
            initialValue={minConfidence}
            error={confidenceError}
            onChangeText={setMinConfidence}
          />
          <SettingsSelect
            label="Fallback profile"
            value={fallbackProfileId}
            options={[
              { label: "None: keep Jev's pick", value: "" },
              ...status.profiles.map((profile) => ({ label: profile.name, value: profile.id })),
            ]}
            onValueChange={setFallbackProfileId}
          />
          <SettingsAction
            label="Save"
            error={mutation.isError ? String(mutation.error) : undefined}
            hint={mutation.isSuccess ? "Saved." : undefined}
            actionLabel={mutation.isPending ? "Saving…" : "Save"}
            disabled={mutation.isPending || confidenceError !== undefined}
            onPress={() => mutation.mutate(key.trim() ? { typesafeApiKey: key.trim() } : {})}
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        title="Profiles"
        info="Jev chooses between your agent profiles by their name and notes. Profiles are read on every /route, so changes apply immediately."
      >
        <SettingsCard>
          {status.profiles.length === 0 ? (
            <SettingsRow label="No agent profiles" hint="Add some under Settings → Agent profiles." />
          ) : (
            status.profiles.map((profile) => (
              <SettingsRow
                key={profile.id}
                label={profile.name}
                hint={profile.hasNotes ? undefined : "No notes: add one saying when to use it, so Jev can tell."}
              />
            ))
          )}
        </SettingsCard>
      </SettingsSection>
    </>
  );
}
