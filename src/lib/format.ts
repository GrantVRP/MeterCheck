/** "just now", "8 min ago", "2 hours ago", "yesterday", "3 days ago" */
export function timeAgo(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

/** Shows an address as text that can't be tapped or auto-linked: "bad-site[.]online". */
export function defang(host: string): string {
  return host.replace(/\./g, "[.]");
}

/** A whole scanned address as safe text: "hxxps://bad-site[.]online/pay". */
export function defangUrl(url: string): string {
  return defang(url.replace(/^http/i, "hxxp"));
}
