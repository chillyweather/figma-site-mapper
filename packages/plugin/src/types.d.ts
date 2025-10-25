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
  // Optional style extraction data for highlighting
  styleData?: {
    elements?: Array<{
      type?: string;
      text?: string;
      value?: string;
      boundingBox?: { x: number; y: number; width: number; height: number };
    }>;
  };
}
