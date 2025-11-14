export function timeAgo(date: string): string {
    const now = Date.now();
    const past = new Date(date).getTime();
    const diff = Math.floor((now - past) / 1000);

    if (diff < 5) return "just now";
    if (diff < 60) return `${diff} sec ago`;

    const minutes = Math.floor(diff / 60);
    if (minutes < 60) return `${minutes} min ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
}
