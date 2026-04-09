import { Command } from "../../../types";
import { runReload } from "./reloadHelper";

const register: Command = {
  name: "register",
  description: "Reloads command files and registers slash commands.",
  async execute(ctx) {
    await runReload(ctx, true);
  },
};

export default register;
