/** Format a TZS amount: 1500000 → "TZS 1,500,000" */
export const formatTZS = (amount: number): string => {
  return `TZS ${amount.toLocaleString("en-TZ")}`;
};

/** Format a date string to DD/MM/YYYY */
export const formatDate = (dateStr: string): string => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB");
};

/** Format a datetime to readable string */
export const formatDateTime = (dateStr: string): string => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** Relative time: "2 hours ago" */
export const timeAgo = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};
