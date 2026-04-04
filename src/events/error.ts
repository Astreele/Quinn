import { ExtendedClient } from "../client";
import { BotEvent } from "../types";
import { logger } from "../utils/logger";

const event: BotEvent<"error"> = {
  name: "error",
  execute: (client: ExtendedClient, error: Error) => {
    logger.error(`Discord client encountered an error:`, error);
  },
};

export default event;
