/**
 * Layout Preferences Model
 * Defines the structure for persisting layout state.
 */

export interface LayoutPreferences {
  /** Sidebar width in pixels */
  sidebarWidth: number;

  /** Query panel height as percentage of main area (0-100) */
  queryPanelSize: number;

  /** Whether the sidebar is collapsed */
  sidebarCollapsed: boolean;

  /** Whether the query panel is collapsed */
  queryPanelCollapsed: boolean;
}

export const DEFAULT_LAYOUT_PREFERENCES: LayoutPreferences = {
  sidebarWidth: 220, // pixels
  queryPanelSize: 25, // 25% of main area height
  sidebarCollapsed: false,
  queryPanelCollapsed: false,
};
