import type { GroupPreferences } from "../types";
import { serializePreferences } from "./preferences";

export const APP_VIEWS = ["library", "roulette", "wishlist", "maintain", "setup"] as const;

export type AppView = (typeof APP_VIEWS)[number];

export function parseAppView(search: string): AppView {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const view = params.get("view");
  return APP_VIEWS.includes(view as AppView) ? (view as AppView) : "library";
}

export function buildAppUrl(
  pathname: string,
  preferences: GroupPreferences,
  view: AppView
): string {
  const params = new URLSearchParams(serializePreferences(preferences));
  if (view !== "library") params.set("view", view);
  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}
