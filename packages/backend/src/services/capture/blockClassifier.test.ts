import { describe, it, expect } from "vitest";
import { classifyBlock, type ClassifierInput } from "./blockClassifier.js";

function input(partial: Partial<ClassifierInput>): ClassifierInput {
  return {
    title: "",
    bodyText: "",
    html: "",
    ...partial,
  };
}

describe("classifyBlock", () => {
  it("classifies a normal page as ok", () => {
    const result = classifyBlock(
      input({
        title: "Welcome to Acme",
        bodyText: "Acme makes widgets and provides services.",
        html: "<html><body><h1>Welcome</h1></body></html>",
      })
    );

    expect(result.kind).toBe("ok");
    expect(result.reason).toBeNull();
  });

  it("classifies a generic 403 served by cloudflare as cloudflare_interstitial", () => {
    const result = classifyBlock(
      input({
        title: "Access denied",
        bodyText: "Access denied. You do not have permission to access this resource.",
        html: "<html><body><h1>Access denied</h1></body></html>",
        statusCode: 403,
        serverHeader: "cloudflare",
      })
    );

    expect(result.kind).toBe("cloudflare_interstitial");
    expect(result.provider).toBe("cloudflare");
    expect(result.reason).toMatch(/403/);
  });

  it("classifies a generic 403 blocked response without provider markers", () => {
    const result = classifyBlock(
      input({
        title: "403 Forbidden",
        bodyText: "Access denied. Your request was blocked.",
        html: "<html><body><h1>Forbidden</h1></body></html>",
        statusCode: 403,
        serverHeader: "nginx",
      })
    );

    expect(result.kind).toBe("blocked");
    expect(result.reason).toMatch(/403/);
    expect(result.provider).toBeUndefined();
  });

  it("classifies a reCAPTCHA gate with provider", () => {
    const result = classifyBlock(
      input({
        title: "Security check",
        bodyText: "Please verify you are human before continuing.",
        html: '<html><body><div class="g-recaptcha" data-sitekey="abc"></div></body></html>',
      })
    );

    expect(result.kind).toBe("captcha");
    expect(result.provider).toBe("recaptcha");
    expect(result.reason).toMatch(/recaptcha/i);
  });

  it("classifies an hCaptcha gate with provider", () => {
    const result = classifyBlock(
      input({
        title: "Human verification",
        bodyText: "Prove you are not a robot to continue.",
        html: '<html><body><iframe src="https://hcaptcha.com/captcha"></iframe></body></html>',
      })
    );

    expect(result.kind).toBe("captcha");
    expect(result.provider).toBe("hcaptcha");
    expect(result.reason).toMatch(/hcaptcha/i);
  });

  it("classifies an active Cloudflare browser-check challenge", () => {
    const result = classifyBlock(
      input({
        title: "Just a moment...",
        bodyText: "Checking your browser before accessing example.com",
        html: '<html><body><div class="cf-browser-verification">Verifying you are human.</div></body></html>',
      })
    );

    expect(result.kind).toBe("cloudflare_challenge");
    expect(result.provider).toBe("cloudflare");
    expect(result.reason).toMatch(/cloudflare/i);
  });

  it("classifies a Cloudflare 'Attention Required' interstitial", () => {
    const result = classifyBlock(
      input({
        title: "Attention Required! | Cloudflare",
        bodyText: "Please enable cookies. Sorry, you have been blocked.",
        html: '<html><body><div class="cf-error-details">Cloudflare Ray ID</div></body></html>',
      })
    );

    expect(result.kind).toBe("cloudflare_interstitial");
    expect(result.provider).toBe("cloudflare");
    expect(result.reason).toMatch(/cloudflare/i);
  });
});
