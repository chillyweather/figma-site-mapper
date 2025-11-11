import { Types } from "mongoose";
import { Page } from "../models/Page.js";
import { Element } from "../models/Element.js";

export interface ManifestData {
  pages: Array<Record<string, unknown>>;
  elements: Array<Record<string, unknown>>;
}

function normalizeObjectIds(
  ids: (string | Types.ObjectId)[]
): Types.ObjectId[] {
  const seen = new Set<string>();
  const result: Types.ObjectId[] = [];

  for (const id of ids) {
    const asString = id instanceof Types.ObjectId ? id.toString() : String(id);
    if (!Types.ObjectId.isValid(asString)) {
      continue;
    }
    if (seen.has(asString)) {
      continue;
    }
    seen.add(asString);
    result.push(new Types.ObjectId(asString));
  }

  return result;
}

function getIdString(doc: unknown): string | null {
  if (!doc || typeof doc !== "object") {
    return null;
  }
  const rawId = (doc as Record<string, unknown>)._id;
  if (!rawId) {
    return null;
  }
  if (typeof rawId === "string") {
    return rawId;
  }
  if (rawId instanceof Types.ObjectId) {
    return rawId.toString();
  }
  if (typeof (rawId as any).toString === "function") {
    return (rawId as any).toString();
  }
  return null;
}

export async function buildManifestForPageIds(
  projectId: string,
  pageIds: string[]
): Promise<ManifestData> {
  if (!projectId || !Types.ObjectId.isValid(projectId)) {
    throw new Error("Invalid projectId supplied to buildManifestForPageIds");
  }

  const normalizedPageIds = normalizeObjectIds(pageIds);
  if (normalizedPageIds.length === 0) {
    return { pages: [], elements: [] };
  }

  const projectObjectId = new Types.ObjectId(projectId);

  const pages = await Page.find({
    projectId: projectObjectId,
    _id: { $in: normalizedPageIds },
  })
    .lean()
    .exec();

  if (pages.length === 0) {
    return { pages: [], elements: [] };
  }

  const pageIdOrder = new Map<string, number>();
  normalizedPageIds.forEach((id, index) => {
    pageIdOrder.set(id.toString(), index);
  });

  const sortedPages = pages.slice().sort((a, b) => {
    const aIdString = getIdString(a);
    const bIdString = getIdString(b);
    const aPos = aIdString
      ? (pageIdOrder.get(aIdString) ?? Number.MAX_SAFE_INTEGER)
      : Number.MAX_SAFE_INTEGER;
    const bPos = bIdString
      ? (pageIdOrder.get(bIdString) ?? Number.MAX_SAFE_INTEGER)
      : Number.MAX_SAFE_INTEGER;
    return aPos - bPos;
  });

  const elements = await Element.find({
    projectId: projectObjectId,
    pageId: { $in: normalizedPageIds },
  })
    .lean()
    .exec();

  return {
    pages: sortedPages,
    elements,
  };
}
