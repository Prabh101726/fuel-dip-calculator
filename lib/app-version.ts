/** Build-time app version from package.json via NEXT_PUBLIC_APP_VERSION. */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";

export const APP_VERSION_LABEL = `v${APP_VERSION}`;
