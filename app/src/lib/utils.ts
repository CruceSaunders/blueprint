import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function newId(prefix: string, taken: Set<string>): string {
  for (let i = 1; ; i++) {
    const id = `${prefix}-${i}`;
    if (!taken.has(id)) return id;
  }
}
