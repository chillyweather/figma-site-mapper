export type PageType =
  | "homepage"
  | "pricing"
  | "product-detail"
  | "feature-detail"
  | "integration"
  | "customer-story"
  | "blog-listing"
  | "blog-article"
  | "support-doc"
  | "legal"
  | "utility"
  | "unknown";

export interface NormalizedUrl {
  url: string;
  host: string;
  path: string;
}

export interface Classification {
  pageType: PageType;
  patternKey: string;
}
