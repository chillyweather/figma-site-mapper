## Memory Breakdown for Your App

What's Running on Your Server:
Operating System (Ubuntu): ~150-200 MB
Docker Daemon: ~100-150 MB
MongoDB: ~200-300 MB (even with Atlas, local MongoDB was running)
Redis: ~50-100 MB
Node.js Backend API: ~100-150 MB
Node.js Worker Process: ~150-200 MB
Playwright Chromium Browser: ~300-500 MB per crawl instance
Total Minimum: ~1,050 MB (already over 1GB!)

When crawling happens: +300-500 MB more

## Why Playwright is So Heavy

When you run await crawler.run([url]), Playwright:

Launches a full Chromium browser (~200MB base)
Loads the webpage (HTML, CSS, JS, images, fonts)
Executes JavaScript (React apps can use 100-300MB just to render)
Takes screenshots (high-res images stored in memory before S3 upload)
Extracts styles (your app parses all CSS rules, computes styles)
A single crawl of a complex React site can easily use 400-600 MB RAM.

## What Happens When RAM Runs Out

Your server stats showed:

```
%Cpu(s): 13.3 us, 86.7 sy  ← 86% in "system" mode (bad!)
Swap:  511.9 used  ← 100% swap used (very bad!)
kswapd0: 7.1% CPU  ← Kernel desperately moving memory to disk
```

## The death spiral:

RAM fills up → System starts swapping to disk
Disk is 1000x slower than RAM → Everything slows down
BullMQ thinks worker died → Job fails
Playwright tries to launch → Not enough RAM → Hangs/crashes
More swapping → System becomes unresponsive

## Why 2-4GB Would Work

With 2GB RAM:

OS + Docker + MongoDB + Redis: ~500 MB
Backend + Worker: ~400 MB
Playwright crawl: ~500 MB
Buffer: ~600 MB (safe!)
With 4GB RAM:

You could run multiple crawls concurrently
Style extraction would be faster
No swapping = 10-20x speed improvement
