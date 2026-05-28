export function classifyBlock(input) {
    const title = input.title.toLowerCase();
    const bodyText = input.bodyText.toLowerCase();
    const html = input.html.toLowerCase();
    const server = (input.serverHeader ?? "").toLowerCase();
    const status = input.statusCode ?? 0;
    const blockingStatus = status === 403 || status === 429 || status === 503;
    const servedByCloudflare = server.includes("cloudflare");
    const cfChallengeSelector = html.includes("cf-browser-verification") ||
        html.includes("cf-im-under-attack");
    const cfChallengeTitle = title.includes("just a moment") ||
        title.includes("checking your browser");
    if (cfChallengeSelector || cfChallengeTitle) {
        return {
            kind: "cloudflare_challenge",
            provider: "cloudflare",
            reason: "Cloudflare browser-check challenge in progress",
        };
    }
    const cfTitleMatch = title.includes("attention required") && title.includes("cloudflare");
    const cfBodyMatch = bodyText.includes("sorry, you have been blocked") &&
        (bodyText.includes("cloudflare") || html.includes("cloudflare"));
    const cfSelectorMatch = html.includes("cf-error-details") || html.includes("cf-wrapper");
    if (cfTitleMatch || cfBodyMatch || cfSelectorMatch) {
        return {
            kind: "cloudflare_interstitial",
            provider: "cloudflare",
            reason: "Cloudflare interstitial block page",
        };
    }
    if (blockingStatus && servedByCloudflare) {
        return {
            kind: "cloudflare_interstitial",
            provider: "cloudflare",
            reason: `Cloudflare returned HTTP ${status}`,
        };
    }
    const accessDenied = title.includes("access denied") ||
        title.includes("403 forbidden") ||
        title.includes("forbidden") ||
        bodyText.includes("access denied") ||
        bodyText.includes("request was blocked");
    if (blockingStatus || accessDenied) {
        return {
            kind: "blocked",
            reason: status
                ? `Server returned HTTP ${status}`
                : "Page reports access denied",
        };
    }
    const captcha = detectCaptchaProvider(html);
    if (captcha) {
        const verificationCue = bodyText.includes("verify you are human") ||
            bodyText.includes("prove you are not a robot") ||
            bodyText.includes("security check") ||
            bodyText.includes("i'm not a robot") ||
            title.includes("security check") ||
            title.includes("human verification") ||
            title.includes("captcha") ||
            title.includes("are you a robot");
        if (verificationCue) {
            return {
                kind: "captcha",
                provider: captcha,
                reason: `${captcha} verification gate`,
            };
        }
    }
    return { kind: "ok", reason: null };
}
export async function classifyPage(page) {
    const extracted = await page.evaluate(() => ({
        title: document.title,
        bodyText: document.body?.innerText || document.body?.textContent || "",
        html: document.documentElement?.outerHTML ?? "",
    }));
    return classifyBlock(extracted);
}
function detectCaptchaProvider(html) {
    if (html.includes("g-recaptcha") || html.includes("recaptcha")) {
        return "recaptcha";
    }
    if (html.includes("h-captcha") || html.includes("hcaptcha")) {
        return "hcaptcha";
    }
    if (html.includes("shieldsquare"))
        return "shieldsquare";
    if (html.includes("captcha"))
        return "captcha";
    return null;
}
