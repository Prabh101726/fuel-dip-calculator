import type { Metadata } from "next";

/**
 * Metadata for a public page. Title flows through the root layout's
 * `%s — Fuel Dip Calculator` template; OG/twitter tags inherit from the
 * root layout defaults, and the OG image comes from app/opengraph-image.tsx.
 */
export function pageMetadata(title: string, description: string): Metadata {
  return { title, description };
}
