export interface TabState {
  id: string;
  connectionId: string;
  containerId: string;
  containerName: string;
  databaseId: string;
  partitionKeyPath: string;
  query: string;
}

export interface TabsPreferences {
  tabs: TabState[];
  activeTabId: string | null;
}

export const DEFAULT_TABS_PREFERENCES: TabsPreferences = {
  tabs: [],
  activeTabId: null,
};
