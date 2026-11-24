import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const getRuntimeStatusRpc = defineRpc({
  name: "team.status",
  input: z.object({}),
  output: z.object({
    stateFilePath: z.string(),
    defaultMode: z.enum(["team", "single"]),
    workerSpec: z.string(),
  }),
});
