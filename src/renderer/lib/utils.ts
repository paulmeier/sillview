import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tremor's class helper: merge conditional classes, dedupe Tailwind conflicts. */
export function cx(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** A short, stable id for widget instances / dashboards (renderer has crypto). */
export function uid(): string {
  return crypto.randomUUID();
}
