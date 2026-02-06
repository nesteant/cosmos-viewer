export interface AppSettings {
  allowPrerelease: boolean;
  autoCheckUpdates: boolean;
  fontSize: number;       // 12-18, default 13
  editorFontSize: number; // 12-24, default 14
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  allowPrerelease: true,
  autoCheckUpdates: true,
  fontSize: 13,
  editorFontSize: 14,
};
