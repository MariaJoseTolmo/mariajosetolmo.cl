const withoutTrailingSlash = (path: string) =>
  path.length > 1 ? path.replace(/\/$/, '') : path;

/** True when `href` is a page route equal to `currentPath` (anchors never match). */
export function isCurrentRoute(
  href: string,
  currentPath: string | undefined,
): boolean {
  if (currentPath === undefined || href.includes('#')) return false;
  return withoutTrailingSlash(href) === withoutTrailingSlash(currentPath);
}
