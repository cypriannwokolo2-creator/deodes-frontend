/**
 * L2: URL slugs are attacker-controlled — reject traversal before touching
 * the fs. Returns the joined slug, "index" for empty, or null when blocked.
 */
export function safeSlug(parts?: string[]): string | null {
  if (!parts || parts.length === 0) return "index";
  if (
    parts.some(
      (p) =>
        !p ||
        p === "." ||
        p === ".." ||
        p.includes("\\") ||
        p.includes("\0") ||
        p.startsWith("/"),
    )
  )
    return null;
  return parts.join("/");
}

/** True for same-origin app paths only (no //, scheme, or backslash). */
export function isSafeAppLink(link: string): boolean {
  return link.startsWith("/") && !link.startsWith("//") && !link.includes("\\");
}
