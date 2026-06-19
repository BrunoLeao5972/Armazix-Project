export function generateCleanSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 30);
}

export function isCleanSlug(value: string): boolean {
  return /^[a-z0-9]+$/.test(value);
}