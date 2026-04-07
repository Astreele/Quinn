import { Command } from "../../types";
import { EmbedBuilder } from "discord.js";

const Uptime: Command = {
  name: "uptime",
  description: "Shows bot uptime.",

  async execute(ctx) {
    // Use ctx.args to parse target user via prefix
    // or interaction options for slash commands.

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

    const uptime = ctx.client.uptime!;
    const formattedTime = formatUptime(uptime);
    const startedAt = Math.floor((Date.now() - uptime) / 1000);

    const embed = new EmbedBuilder()
      .setColor("Yellow")
      .setTitle("⏱️ Bot Uptime")
      .setThumbnail(ctx.client.user!.displayAvatarURL())
      .setDescription(`I've been running for:\n\n**${formattedTime}**`)
      .addFields(
        {
          name: "📅 Started At",
          value: `<t:${startedAt}:F>`,
          inline: true,
        },
        {
          name: "⚡ Latency",
          value: `${ctx.client.ws.ping}ms`,
          inline: true,
        }
      )
      .setFooter({ text: `Requested by ${ctx.author.username}` })
      .setTimestamp();

    await ctx.reply({ embeds: [embed] });
  },
};

export default Uptime;
