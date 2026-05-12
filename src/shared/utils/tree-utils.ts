import type { GitHubFile } from '../types';
import type { Script } from '../../runtime';

export interface TreeNode<T = GitHubFile | Script> {
  id: string;
  name: string;
  type: 'dir' | 'file';
  path: string;
  children?: TreeNode<T>[];
  file?: T;
}

/**
 * 从扁平的文件列表构建目录树
 */
export function buildTree<T extends { path?: string; name: string; type?: 'dir' | 'file' }>(
  items: T[],
  pathField: keyof T = 'path' as keyof T
): TreeNode<T> {
  const root: TreeNode<T> = {
    id: 'root',
    name: '',
    type: 'dir',
    path: '',
    children: [],
  };

  const dirMap = new Map<string, TreeNode<T>>();
  dirMap.set('', root);

  // 先排序，目录在前，文件在后
  const sortedItems = [...items].sort((a, b) => {
    const aType = (a as any).type;
    const bType = (b as any).type;
    if (aType === 'dir' && bType !== 'dir') return -1;
    if (aType !== 'dir' && bType === 'dir') return 1;
    const aPath = (a[pathField] as string) || a.name;
    const bPath = (b[pathField] as string) || b.name;
    return aPath.localeCompare(bPath);
  });

  for (const item of sortedItems) {
    const itemPath = (item[pathField] as string) || item.name;
    const parts = itemPath.split('/').filter(Boolean);
    const itemType = (item as any).type || 'file';
    
    if (itemType === 'dir') {
      // 处理目录 - 逐层创建
      let currentDir = root;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const currentPath = parts.slice(0, i + 1).join('/');
        
        if (!dirMap.has(currentPath)) {
          const newDir: TreeNode<T> = {
            id: currentPath,
            name: part,
            type: 'dir',
            path: currentPath,
            children: [],
          };
          currentDir.children!.push(newDir);
          dirMap.set(currentPath, newDir);
        }
        currentDir = dirMap.get(currentPath)!;
      }
    } else {
      // 处理文件 - 先确保父目录存在
      let currentDir = root;
      
      // 创建父目录
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        const currentPath = parts.slice(0, i + 1).join('/');
        
        if (!dirMap.has(currentPath)) {
          const newDir: TreeNode<T> = {
            id: currentPath,
            name: part,
            type: 'dir',
            path: currentPath,
            children: [],
          };
          currentDir.children!.push(newDir);
          dirMap.set(currentPath, newDir);
        }
        currentDir = dirMap.get(currentPath)!;
      }
      
      // 添加文件节点
      const fileName = parts[parts.length - 1] || item.name;
      const fileNode: TreeNode<T> = {
        id: itemPath,
        name: fileName,
        type: 'file',
        path: itemPath,
        file: item,
      };
      currentDir.children!.push(fileNode);
    }
  }

  // 递归排序所有目录的子节点
  const sortChildren = (node: TreeNode<T>) => {
    if (node.children) {
      node.children.sort((a, b) => {
        if (a.type === 'dir' && b.type !== 'dir') return -1;
        if (a.type !== 'dir' && b.type === 'dir') return 1;
        return a.name.localeCompare(b.name);
      });
      node.children.forEach(sortChildren);
    }
  };
  sortChildren(root);

  return root;
}

/**
 * 将目录树扁平化为数组，包含深度信息
 */
export function flattenTree<T>(root: TreeNode<T>): (TreeNode<T> & { depth: number })[] {
  const result: (TreeNode<T> & { depth: number })[] = [];
  const traverse = (node: TreeNode<T>, depth: number = 0) => {
    result.push({ ...node, depth });
    if (node.children) {
      node.children.forEach(child => traverse(child, depth + 1));
    }
  };
  traverse(root);
  return result;
}
