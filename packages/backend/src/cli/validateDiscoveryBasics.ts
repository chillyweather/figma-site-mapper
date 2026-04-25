import "../logger.js";
import { normalizeUrl } from "../services/discovery/urlNormalize.js";
import { classifyPage } from "../services/discovery/pageClassifier.js";

interface NormCase {
  input: string;
  expected: { url: string; host: string; path: string } | null;
}

interface ClassifyCase {
  path: string;
  expectedType: string;
  expectedPattern: string;
}

const normCases: NormCase[] = [
  {
    input: "https://example.com/products/?utm_source=x#top",
    expected: {
      url: "https://example.com/products",
      host: "example.com",
      path: "/products",
    },
  },
  {
    input: "https://EXAMPLE.COM/About/",
    expected: {
      url: "https://example.com/About",
      host: "example.com",
      path: "/About",
    },
  },
  {
    input: "https://example.com/blog/post?utm_campaign=summer&gclid=123",
    expected: {
      url: "https://example.com/blog/post",
      host: "example.com",
      path: "/blog/post",
    },
  },
  {
    input: "https://example.com/page/?fbclid=abc&sort=desc",
    expected: {
      url: "https://example.com/page?sort=desc",
      host: "example.com",
      path: "/page",
    },
  },
  {
    input: "https://example.com/a?utm_id=1&utm_creative=x&b=2",
    expected: {
      url: "https://example.com/a?b=2",
      host: "example.com",
      path: "/a",
    },
  },
  {
    input: "http://localhost:3006/a?utm_medium=email",
    expected: {
      url: "http://localhost:3006/a",
      host: "localhost:3006",
      path: "/a",
    },
  },
  {
    input: "mailto:test@example.com",
    expected: null,
  },
  {
    input: "tel:+1234567890",
    expected: null,
  },
  {
    input: "javascript:void(0)",
    expected: null,
  },
  {
    input: "https://example.com",
    expected: {
      url: "https://example.com/",
      host: "example.com",
      path: "/",
    },
  },
  {
    input: "https://example.com///a//b//",
    expected: {
      url: "https://example.com/a/b",
      host: "example.com",
      path: "/a/b",
    },
  },
];

const classifyCases: ClassifyCase[] = [
  { path: "/", expectedType: "homepage", expectedPattern: "homepage:/" },
  { path: "/pricing", expectedType: "pricing", expectedPattern: "pricing:/pricing" },
  { path: "/plans", expectedType: "pricing", expectedPattern: "pricing:/plans" },
  {
    path: "/products/ticketing/",
    expectedType: "product-detail",
    expectedPattern: "product-detail:/products/*",
  },
  {
    path: "/features/remote-monitoring-and-management/it-documentation/",
    expectedType: "feature-detail",
    expectedPattern: "feature-detail:/features/*/*",
  },
  {
    path: "/integrations/bitdefender/",
    expectedType: "integration",
    expectedPattern: "integration:/integrations/*",
  },
  {
    path: "/blog/it-efficiency/",
    expectedType: "blog-article",
    expectedPattern: "blog-article:/blog/*",
  },
  { path: "/blog", expectedType: "blog-listing", expectedPattern: "blog-listing:/blog" },
  {
    path: "/resources",
    expectedType: "blog-listing",
    expectedPattern: "blog-listing:/resources",
  },
  {
    path: "/customers",
    expectedType: "customer-story",
    expectedPattern: "customer-story:/customers",
  },
  {
    path: "/customers/acme",
    expectedType: "customer-story",
    expectedPattern: "customer-story:/customers/*",
  },
  {
    path: "/case-studies",
    expectedType: "customer-story",
    expectedPattern: "customer-story:/case-studies",
  },
  {
    path: "/case-studies/acme/",
    expectedType: "customer-story",
    expectedPattern: "customer-story:/case-studies/*",
  },
  {
    path: "/docs/getting-started",
    expectedType: "support-doc",
    expectedPattern: "support-doc:/docs/*",
  },
  {
    path: "/hc/en-us/articles/123",
    expectedType: "support-doc",
    expectedPattern: "support-doc:/hc/*/*/*",
  },
  { path: "/privacy", expectedType: "legal", expectedPattern: "legal:/privacy" },
  { path: "/terms-of-service", expectedType: "legal", expectedPattern: "legal:/terms*" },
  { path: "/login", expectedType: "utility", expectedPattern: "utility:/login" },
  { path: "/signup", expectedType: "utility", expectedPattern: "utility:/signup" },
  { path: "/contact", expectedType: "utility", expectedPattern: "utility:/contact" },
  { path: "/demo", expectedType: "utility", expectedPattern: "utility:/demo" },
  { path: "/webinars", expectedType: "utility", expectedPattern: "utility:/webinars" },
  {
    path: "/some-random-page",
    expectedType: "unknown",
    expectedPattern: "unknown:/some-random-page",
  },
];

function assertEqual(actual: unknown, expected: unknown, label: string): boolean {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    process.stderr.write(`  ❌ ${label}\n     expected: ${e}\n     actual:   ${a}\n`);
    return false;
  }
  process.stdout.write(`  ✅ ${label}\n`);
  return true;
}

function main(): void {
  let passed = 0;
  let failed = 0;

  process.stdout.write("\nURL Normalization\n");
  for (const c of normCases) {
    const result = normalizeUrl(c.input);
    const ok = assertEqual(result, c.expected, `normalize("${c.input}")`);
    if (ok) passed++; else failed++;
  }

  process.stdout.write("\nPage Classification\n");
  for (const c of classifyCases) {
    const result = classifyPage(c.path);
    const okType = assertEqual(
      result.pageType,
      c.expectedType,
      `classify("${c.path}").pageType`
    );
    const okPattern = assertEqual(
      result.patternKey,
      c.expectedPattern,
      `classify("${c.path}").patternKey`
    );
    if (okType && okPattern) {
      passed++;
    } else {
      failed++;
    }
  }

  process.stdout.write(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
