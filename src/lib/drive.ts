import { invoke } from "@tauri-apps/api/core";
import type { ParsedCourse } from "@/types";

export interface DriveAuthStatus {
  connected: boolean;
  expiresAt: number | null;
  scope: string | null;
}

export interface PickedFolder {
  id: string;
  name: string;
}

// --- Bring-your-own credentials (stored in the OS keychain by Rust) ---

export async function driveSetCredentials(
  clientId: string,
  clientSecret: string,
  apiKey: string,
): Promise<void> {
  return invoke("drive_set_credentials", { clientId, clientSecret, apiKey });
}

export async function driveCredentialsStatus(): Promise<boolean> {
  return invoke<boolean>("drive_credentials_status");
}

export async function driveClearCredentials(): Promise<void> {
  return invoke("drive_clear_credentials");
}

// --- Auth + folder selection (credentials are loaded from the keychain in Rust) ---

/** Interactive connect: opens the system browser, returns once tokens are stored. */
export async function driveConnect(): Promise<DriveAuthStatus> {
  return invoke<DriveAuthStatus>("drive_connect");
}

/** A currently-valid access token (refreshed in Rust if needed). */
export async function driveAccessToken(): Promise<string> {
  return invoke<string>("drive_access_token");
}

/** Open the Google Picker in the system browser; resolves with the picked folder. */
export async function drivePickFolder(): Promise<PickedFolder> {
  return invoke<PickedFolder>("drive_pick_folder");
}

/** Recursively list a Drive folder and build the same ParsedCourse the local parser produces. */
export async function parseDriveFolder(
  folderId: string,
  folderName: string,
): Promise<ParsedCourse> {
  return invoke<ParsedCourse>("parse_drive_folder", { folderId, folderName });
}

export async function driveAuthStatus(): Promise<DriveAuthStatus> {
  return invoke<DriveAuthStatus>("drive_auth_status");
}

export async function driveDisconnect(): Promise<void> {
  return invoke("drive_disconnect");
}
