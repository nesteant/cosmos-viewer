/**
 * Layout Preferences Model
 * Defines the structure for persisting layout state.
 */

export interface LayoutPreferences {
  /** Sidebar width as percentage (0-100) */
  sidebarSize: number;

  /** Query panel height as percentage of main area (0-100) */
  queryPanelSize: number;

  /** Whether the sidebar is collapsed */
  sidebarCollapsed: boolean;

  /** Whether the query panel is collapsed */
  queryPanelCollapsed: boolean;
}

export const DEFAULT_LAYOUT_PREFERENCES: LayoutPreferences = {
  sidebarSize: 20, // 20% of total width
  queryPanelSize: 25, // 25% of main area height
  sidebarCollapsed: false,
  queryPanelCollapsed: false,
};
