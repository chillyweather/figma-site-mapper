/// <reference types="@figma/plugin-typings" />
//

export interface InteractiveElement {
  type: 'link' | 'button';
  x: number;
  y: number;
  width: number;
  height: number;
  href?: string;
  text?: string;
}

export interface TreeNode {
  url: string;
  title: string;
  screenshot: string[];
  thumbnail: string;
  children: TreeNode[];
  interactiveElements?: InteractiveElement[];
}
