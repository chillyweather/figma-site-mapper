import { TreeNode } from "../../main";

// --- Helper function with types ---

export function flattenTree(node: TreeNode): TreeNode[] {
  if (!node) return [];
  const list = [node];
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      list.push(...flattenTree(child));
    }
  }
  return list;
}
