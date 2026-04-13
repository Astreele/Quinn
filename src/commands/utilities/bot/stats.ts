import { Command } from "../../../types";
import { createInfoEmbed } from "../../../utils/embedBuilder";
import process from "process";
import os from "os";
import pidusage from "pidusage";
import { version as djsVersion } from "discord.js";

const stats: Command = {
  name: "stats",
  description: "Shows the bot's uptime, memory usage, and version details.",
  conf: {
    cooldown: {
      time: 60,
      limit: 3,
    },
  },

  async execute(ctx) {
    const client = ctx.client;

    // ===== UPTIME FORMATTER=====
    function formatUptime(ms: number) {
      const seconds = Math.floor((ms / 1000) % 60);
      const minutes = Math.floor((ms / (1000 * 60)) % 60);
      const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
      const days = Math.floor(ms / (1000 * 60 * 60 * 24));

      const parts = [];

      if (days) parts.push(`${days} day${days !== 1 ? "s" : ""}`);
      if (hours) parts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
      if (minutes) parts.push(`${minutes} minute${minutes !== 1 ? "s" : ""}`);
      if (seconds) parts.push(`${seconds} second${seconds !== 1 ? "s" : ""}`);

      if (parts.length === 0) return "0 seconds";
      if (parts.length === 1) return parts[0];

      return parts.slice(0, -1).join(", ") + " and " + parts.slice(-1);
    }

    function formatDate(timestamp: number): string {
      const d = new Date(timestamp);
      const day = d.getDate();

      return `${day}${
        day > 3 && day < 21
          ? "th"
          : ["th", "st", "nd", "rd"][Math.min(day % 10, 3)]
      } ${d.toLocaleString("en-GB", { month: "long" })} ${d.getFullYear()}`;
    }

    // ===== DATA =====
    const application = await client.application?.fetch();
    const uptimeMs = client.uptime ?? 0;
    const uptime = formatUptime(uptimeMs);
    const createdAt = formatDate(application!.createdTimestamp);

    const osName = os.platform();
    const stat = await pidusage(process.pid);
    const cpuUsage = stat.cpu.toFixed(2);
    const totalMem = os.totalmem() / 1024 / 1024;
    const freeMem = os.freemem() / 1024 / 1024;
    const usedMem = totalMem - freeMem;
    const usedMemPercent = (usedMem / totalMem) * 100;

    const embed = createInfoEmbed(
      ctx,
      `${client.user!.username} - Stats`,
      "Here Are My Stats!"
    )
      .setThumbnail(client.user!.displayAvatarURL())
      .setFields(
        {
          name: "**Bot Stats**",
          value: `\u200B`,
          inline: false,
        },
        {
          name: "👑 Bot Owner",
          value: `${client.application?.owner ?? "Unknown"}`,
          inline: true,
        },
        {
          name: "<:servers:1490690708426723370> Server Count",
          value: `${client.guilds.cache.size}`,
          inline: true,
        },
        {
          name: "⚡  Bot Latency",
          value: `${client.ws.ping}ms`,
          inline: true,
        },
        {
          name: "🕒 Uptime",
          value: `${uptime}`,
          inline: true,
        },
        {
          name: "📅 Creation Date",
          value: `${createdAt}`,
          inline: true,
        },
        {
          name: "**Server Stats**",
          value: `\u200B`,
          inline: false,
        },
        {
          name: "<:Ubuntu:1490690566546264246> Os",
          value: `${osName[0].toUpperCase() + osName.slice(1)}`,
          inline: true,
        },
        {
          name: "<:CPU:1490691541964951602> CPU Cores",
          value: `${os.cpus().length}`,
          inline: true,
        },
        {
          name: "<:CPU:1490691541964951602> CPU Usage",
          value: `${cpuUsage}%`,
          inline: true,
        },
        {
          name: "<:Ram:1490690854757597298> Total Memory",
          value: `${(totalMem / 1024).toFixed(2)} GB`,
          inline: true,
        },
        {
          name: "<:Ram:1490690854757597298> Memory Usage",
          value: `${usedMem.toFixed(2)} MB (${usedMemPercent.toFixed(2)}%)`,
          inline: true,
        },
        {
          name: "<:NodeJs:1490692230694834246> Node.js Version",
          value: `${process.version}`,
          inline: true,
        },
        {
          name: "<:Discord:1490692456201584730> Discord.js Version",
          value: `${djsVersion}`,
          inline: true,
        }
      );

    await ctx.reply({ embeds: [embed] });
  },
};

export default stats;
