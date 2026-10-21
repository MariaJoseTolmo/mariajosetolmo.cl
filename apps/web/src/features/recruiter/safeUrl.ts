/** The signed CV URL comes from the API; never navigate to anything but https. */
export function isNavigableUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:';
  } catch {
    return false;
  }
}
