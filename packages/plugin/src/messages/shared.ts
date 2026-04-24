/**
 * Shared message utilities for plugin communication.
 */

export type PostMessageTarget = {
  postMessage: (msg: unknown, targetOrigin: string) => void;
};

export function postToUI(target: PostMessageTarget, msg: unknown): void {
  target.postMessage(msg, "*");
}
