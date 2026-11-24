import { useComposer, useSettings, useTranslation } from "@getpaseo/plugin/client";
import { Toggle } from "@getpaseo/plugin/client/ui";
import {
  formatWorkerSpec,
  MODE_METADATA_KEY,
  parseWorkMode,
  ROLE_METADATA_KEY,
  teamSettings,
  WORKER_ROLE_VALUE,
} from "../shared/settings";
import { messages } from "./i18n";

const defaults = teamSettings.schema.parse({});

export function AgentTeamComposerToggle() {
  const composer = useComposer();
  const settings = useSettings(teamSettings);
  const { t } = useTranslation(messages);
  const { metadata } = composer.agent;

  if (metadata[ROLE_METADATA_KEY] === WORKER_ROLE_VALUE) return null;

  const values = settings.status === "ready" ? settings.values : defaults;
  const isTeam = (parseWorkMode(metadata[MODE_METADATA_KEY]) ?? values.defaultMode) === "team";
  return (
    <Toggle
      title={isTeam ? t("composer.teamTitle", { worker: formatWorkerSpec(values) }) : t("composer.singleTitle")}
      icon={isTeam ? "Users" : "User"}
      value={isTeam}
      onValueChange={async ({ value }) => {
        await composer.setMetadata({ [MODE_METADATA_KEY]: value ? "team" : "single" });
      }}
    />
  );
}
