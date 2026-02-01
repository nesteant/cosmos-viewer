export interface DatabaseInfo {
  id: string;
  name: string;
}

export interface ContainerInfo {
  id: string;
  name: string;
  partitionKeyPath: string;
  databaseId: string;
}

export interface TreeNode {
  id: string;
  name: string;
  type: 'database' | 'container';
  partitionKeyPath?: string;
  databaseId?: string;
  children?: TreeNode[];
}
