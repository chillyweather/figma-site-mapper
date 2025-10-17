import { AuthData } from "../types/messages";

export function parseMaxRequests(maxRequests: string): number | undefined {
  const maxRequestsValue =
    maxRequests.trim() === "" ? 0 : parseInt(maxRequests);
  return isNaN(maxRequestsValue) ||
    maxRequestsValue === 0 ||
    maxRequestsValue >= 999
    ? undefined
    : maxRequestsValue;
}

export function parseScreenshotWidth(screenshotWidth: string): number {
  const value =
    screenshotWidth.trim() === "" ? 1440 : parseInt(screenshotWidth);
  return isNaN(value) || value <= 0 ? 1440 : value;
}

export function parseDeviceScaleFactor(deviceScaleFactor: string): number {
  const value =
    deviceScaleFactor.trim() === "" ? 1 : parseInt(deviceScaleFactor);
  return isNaN(value) || value < 1 || value > 2 ? 1 : value;
}

export function parseDelay(delay: string): number {
  const value = delay.trim() === "" ? 0 : parseInt(delay);
  return isNaN(value) || value < 0 ? 0 : value;
}

export function parseRequestDelay(requestDelay: string): number {
  const value = requestDelay.trim() === "" ? 1000 : parseInt(requestDelay);
  return isNaN(value) || value < 0 ? 1000 : value;
}

export function parseMaxDepth(maxDepth: string): number {
  const value = maxDepth.trim() === "" ? 0 : parseInt(maxDepth);
  return isNaN(value) || value < 0 || value > 10 ? 0 : value;
}

export function parseSampleSize(sampleSize: string): number {
  if (sampleSize.trim() === "") {
    return 3;
  }
  const parsedValue = parseInt(sampleSize);
  if (isNaN(parsedValue) || parsedValue < 0 || parsedValue > 20) {
    return 3;
  }
  return parsedValue;
}

export function parseAuthData(
  authMethod: "none" | "manual" | "credentials" | "cookies",
  loginUrl: string,
  username: string,
  password: string,
  cookies: string
): AuthData | null {
  if (authMethod === "manual") {
    // For manual auth, return a placeholder that will be replaced
    // with stored cookies in the message handler
    return {
      method: "manual",
    };
  }

  if (authMethod === "credentials" && loginUrl && username) {
    return {
      method: "credentials",
      loginUrl: loginUrl.trim(),
      username: username.trim(),
      password: password.trim(),
    };
  }

  if (authMethod === "cookies" && cookies.trim()) {
    try {
      const cookieArray = cookies
        .split(";")
        .map((c) => c.trim())
        .filter((c) => c);
      const parsedCookies = cookieArray.map((cookie) => {
        const [name, ...valueParts] = cookie.split("=");
        return {
          name: name.trim(),
          value: valueParts.join("=").trim(),
        };
      });
      return {
        method: "cookies",
        cookies: parsedCookies,
      };
    } catch (error) {
      throw new Error("Invalid cookie format. Use: name=value; name2=value2");
    }
  }

  return null;
}
