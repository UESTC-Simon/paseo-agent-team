import {
  type PluginSurfaceProps,
  type SettingsState,
  usePaseo,
  useRpc,
  useSettings,
  useTranslation,
} from "@getpaseo/plugin/client";
import {
  ScrollView,
  SettingsAction,
  SettingsCard,
  SettingsInput,
  SettingsRow,
  SettingsSection,
  SettingsSelect,
  SettingsSwitch,
} from "@getpaseo/plugin/client/ui";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Text } from "react-native";
import { getRuntimeStatusRpc } from "../shared/protocol";
import { type AgentTeamSettings, teamSettings } from "../shared/settings";
import { messages } from "./i18n";

type TeamSettingsState = SettingsState<typeof teamSettings.schema>;
type ReadySettings = Extract<TeamSettingsState, { status: "ready" }>;
type Option = { value: string; label: string };

function withSavedOption(options: readonly Option[], value: string, label = value): Option[] {
  return options.some((option) => option.value === value) ? [...options] : [{ value, label }, ...options];
}

export function AgentTeamSettingsScreen(props: PluginSurfaceProps) {
  const settings = useSettings(teamSettings);
  const { t } = useTranslation(messages);
  const { host, layout, theme } = props;

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.surface0 }}
      contentContainerStyle={{ padding: layout.compact ? 12 : 24, gap: layout.compact ? 12 : 20 }}
    >
      {settings.status === "ready" ? (
        <SettingsForm key={host.id} {...props} settings={settings} />
      ) : (
        <SettingsSection title={t("settingsScreen")}>
          <SettingsCard>
            <SettingsRow
              label={settings.status === "loading" ? t("status.loading") : t("status.unavailable")}
              error={settings.status === "loading" ? null : settings.error}
            />
            {settings.status === "invalid" && (
              <SettingsAction
                label={t("status.invalid")}
                actionLabel={t("actions.reset")}
                disabled={settings.saving}
                onPress={() => { void settings.reset(); }}
              />
            )}
            {settings.saveError && <SettingsRow label={t("status.saveError")} error={settings.saveError} />}
          </SettingsCard>
        </SettingsSection>
      )}
    </ScrollView>
  );
}

function SettingsForm({ host, theme, settings }: PluginSurfaceProps & { settings: ReadySettings }) {
  const paseo = usePaseo();
  const getRuntimeStatus = useRpc(getRuntimeStatusRpc);
  const { t } = useTranslation(messages);
  const { values } = settings;
  const { workerProvider, workerModel, workerModeId } = values;
  const save = (patch: Partial<AgentTeamSettings>) => settings.save({ ...values, ...patch }, settings.revision);

  const providers = useQuery({
    queryKey: ["agent-team", host.id, "providers"],
    async queryFn() {
      const result = await paseo.providers.listAvailable();
      if (result.error) throw new Error(result.error);
      return result.providers.filter(({ available }) => available)
        .map(({ provider }) => ({ value: provider, label: provider }));
    },
  });
  const models = useQuery({
    queryKey: ["agent-team", host.id, "models", workerProvider],
    async queryFn() {
      const result = await paseo.providers.listModels(workerProvider);
      if (result.error) throw new Error(result.error);
      return (result.models ?? []).filter(({ isSelectable }) => isSelectable !== false)
        .map(({ id, label }) => ({ value: id, label }));
    },
  });
  const modes = useQuery({
    queryKey: ["agent-team", host.id, "modes", workerProvider],
    async queryFn() {
      const result = await paseo.providers.listModes(workerProvider);
      if (result.error) throw new Error(result.error);
      return (result.modes ?? []).map(({ id, label }) => ({ value: id, label }));
    },
  });
  const runtime = useQuery({
    queryKey: ["agent-team", host.id, "runtime"],
    queryFn: () => getRuntimeStatus({}),
  });

  return (
    <>
      <SettingsSection title={t("settings.defaults")}>
        <SettingsCard>
          <SettingsSelect
            label={t("settings.defaultMode")}
            hint={t("settings.defaultModeHint")}
            value={values.defaultMode}
            options={[
              { value: "team", label: t("settings.team") },
              { value: "single", label: t("settings.single") },
            ]}
            disabled={settings.saving}
            onValueChange={(defaultMode) => { void save({ defaultMode }); }}
          />
          <SettingsSwitch
            label={t("settings.singleModeHint")}
            value={values.singleModeHint}
            disabled={settings.saving}
            onValueChange={(singleModeHint) => { void save({ singleModeHint }); }}
          />
          <SettingsSwitch
            label={t("settings.exposeTool")}
            hint={t("settings.exposeToolHint")}
            value={values.exposeAgentTool}
            disabled={settings.saving}
            onValueChange={(exposeAgentTool) => { void save({ exposeAgentTool }); }}
          />
        </SettingsCard>
      </SettingsSection>
      <SettingsSection title={t("worker.title")}>
        <SettingsCard>
          <SettingsSelect
            label={t("worker.provider")}
            hint={t("worker.providerHint")}
            value={workerProvider}
            options={withSavedOption(providers.data ?? [], workerProvider)}
            error={providers.isError ? t("status.catalogUnavailable") : null}
            disabled={settings.saving}
            onValueChange={(provider) => {
              if (provider !== workerProvider) void save({ workerProvider: provider, workerModel: "", workerModeId: "" });
            }}
          />
          <SettingsSelect
            label={t("worker.model")}
            value={workerModel}
            options={withSavedOption([
              { value: "", label: t("worker.discoverModel") },
              ...(models.data ?? []),
            ], workerModel)}
            error={models.isError ? t("status.catalogUnavailable") : null}
            disabled={settings.saving}
            onValueChange={(workerModel) => { void save({ workerModel }); }}
          />
          <SettingsSelect
            label={t("worker.mode")}
            value={workerModeId}
            options={withSavedOption([
              { value: "", label: t("worker.discoverMode") },
              ...(modes.data ?? []),
            ], workerModeId)}
            error={modes.isError ? t("status.catalogUnavailable") : null}
            disabled={settings.saving}
            onValueChange={(workerModeId) => { void save({ workerModeId }); }}
          />
        </SettingsCard>
      </SettingsSection>
      <SettingsSection title={t("delegation.title")}>
        <SettingsCard>
          <DelegationInput
            key={JSON.stringify(["delegationScope", values.delegationScope])}
            label={t("delegation.scope")}
            initialValue={values.delegationScope}
            saving={settings.saving}
            onSave={(delegationScope) => save({ delegationScope })}
          />
          <DelegationInput
            key={JSON.stringify(["customInstructions", values.customInstructions])}
            label={t("delegation.custom")}
            initialValue={values.customInstructions}
            saving={settings.saving}
            onSave={(customInstructions) => save({ customInstructions })}
          />
        </SettingsCard>
      </SettingsSection>
      {settings.saveError && <SettingsRow label={t("status.saveError")} error={settings.saveError} />}
      <SettingsSection title={t("acp.title")}>
        <SettingsCard>
          <SettingsRow label={t("acp.stateFile")}>
            <Text selectable style={{ color: theme.colors.foreground }}>
              {runtime.data?.stateFilePath ?? (runtime.isError ? t("status.unavailable") : t("status.loading"))}
            </Text>
          </SettingsRow>
          <SettingsRow label={t("acp.integration")}>
            <Text style={{ color: theme.colors.foregroundMuted }}>{t("acp.note")}</Text>
            <Text selectable style={{ color: theme.colors.foreground }}>
              {t("acp.snippet", { path: runtime.data?.stateFilePath ?? "~/.paseo/plugin-data/agent-team/state.json" })}
            </Text>
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>
    </>
  );
}

function DelegationInput({ label, initialValue, saving, onSave }: {
  label: string;
  initialValue: string;
  saving: boolean;
  onSave(value: string): Promise<boolean>;
}) {
  const [draft, setDraft] = useState(initialValue);
  const { t } = useTranslation(messages);

  return (
    <>
      <SettingsInput label={label} initialValue={initialValue} onChangeText={setDraft} disabled={saving} />
      <SettingsAction
        label={t("actions.saveField", { field: label })}
        actionLabel={t("actions.save")}
        disabled={saving || initialValue === draft}
        onPress={() => { void onSave(draft); }}
      />
    </>
  );
}
