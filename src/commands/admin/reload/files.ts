import { Command } from "../../../types";
import { runReload } from "./reloadHelper";

const files: Command = {
  name: "files",
  description: "Reloads command files.",
  async execute(ctx) {
    await runReload(ctx, false);
  },
};

export default files;
