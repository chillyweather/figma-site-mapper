/// <reference types="@figma/plugin-typings" />
//

export interface TreeNode {
  url: string;
  title: string;
  screenshot: string[];
  thumbnail: string;
  children: TreeNode[];
}
