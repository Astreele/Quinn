/**
 * Formats a date into a human-readable string with ordinal suffixes and relative timestamp.
 * Extracted from serverinfo.ts for reuse across commands.
 *
 * @param date - The date to format
 * @returns A formatted date string like "9th April 2026, 2:30 PM (<t:1744200600:R>)"
 */
export function formatDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((p) => [p.type, p.value])
  );

  const day = Number(parts.day);

  const suffix =
    day > 3 && day < 21
      ? "th"
      : ["th", "st", "nd", "rd"][Math.min(day % 10, 3)];

  const unix = Math.floor(date.getTime() / 1000);
  return `${day}${suffix} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute} ${parts.dayPeriod.toUpperCase()} (<t:${unix}:R>)`;
}
