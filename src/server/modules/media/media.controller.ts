import { Hono } from "hono"

type GitLabTreeEntry = {
  name: string
  path: string
  type: "tree" | "blob"
}

type ModelPreviewManifest = {
  slug: string
  dexNumber: number
  generation: number
  directoryPath: string
  geoFile: string
  textureFile: string
  geoUrl: string
  textureUrl: string
}

const COBBLEMON_ASSETS_PROJECT_ID = "cable-mc%2Fcobblemon-assets"
const COBBLEMON_ASSETS_REF = "master"
const COBBLEMON_ASSETS_ROOT = "blockbench/pokemon"

const modelPreviewCache = new Map<string, ModelPreviewManifest | null>()

export const mediaController = new Hono()
  .get("/model-preview/:slug", async (c) => {
    const slug = String(c.req.param("slug") ?? "")
      .trim()
      .toLowerCase()
    const dexParam = c.req.query("dex")
    const dexNumber = Number.parseInt(String(dexParam ?? ""), 10)

    if (!slug || !Number.isFinite(dexNumber) || dexNumber <= 0) {
      return c.json({ error: "Expected slug and numeric dex query parameter." }, 400)
    }

    const cacheKey = `${slug}:${dexNumber}`
    const cached = modelPreviewCache.get(cacheKey)
    if (cached !== undefined) {
      return cached
        ? c.json(cached)
        : c.json({ error: "Model preview is unavailable for this species." }, 404)
    }

    try {
      const manifest = await resolveModelPreview(slug, dexNumber)
      modelPreviewCache.set(cacheKey, manifest)

      if (!manifest) {
        return c.json({ error: "Model preview is unavailable for this species." }, 404)
      }

      return c.json(manifest)
    } catch (error) {
      console.error("model-preview resolve failed", { slug, dexNumber, error })
      return c.json({ error: "Failed to resolve model preview." }, 502)
    }
  })
  .get("/cobblemon-asset", async (c) => {
    const assetPath = c.req.query("path")
    if (!isSafeAssetPath(assetPath)) {
      return c.json({ error: "Invalid asset path." }, 400)
    }

    const fileUrl = `https://gitlab.com/api/v4/projects/${COBBLEMON_ASSETS_PROJECT_ID}/repository/files/${encodeURIComponent(
      assetPath
    )}/raw?ref=${COBBLEMON_ASSETS_REF}`

    const response = await fetch(fileUrl)
    if (!response.ok) {
      return c.json({ error: "Asset was not found upstream." }, response.status === 404 ? 404 : 502)
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream"
    const bytes = await response.arrayBuffer()

    return c.newResponse(bytes, {
      status: 200,
      headers: {
        "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
        "content-type": contentType,
      },
    })
  })

async function resolveModelPreview(
  slug: string,
  dexNumber: number
): Promise<ModelPreviewManifest | null> {
  const generation = resolveGenerationFromDex(dexNumber)
  if (!generation) {
    return null
  }

  const paddedDex = String(dexNumber).padStart(4, "0")
  const normalizedSlug = slug.toLowerCase()
  const slugCandidates = unique([
    normalizedSlug,
    normalizedSlug.replace(/-/g, "_"),
    normalizedSlug.replace(/-/g, ""),
    normalizedSlug.replace(/[^a-z0-9]/g, ""),
  ]).filter(Boolean)

  const candidateDirectories = unique(
    slugCandidates.map(
      (candidate) => `${COBBLEMON_ASSETS_ROOT}/gen${generation}/${paddedDex}_${candidate}`
    )
  )

  for (const directoryPath of candidateDirectories) {
    const entries = await listTree(directoryPath)
    if (!entries || entries.length === 0) {
      continue
    }

    const geoFile = pickGeoFile(entries, slugCandidates)
    if (!geoFile) {
      continue
    }

    const textureFile = pickTextureFile(entries, geoFile)
    if (!textureFile) {
      continue
    }

    const geoAssetPath = `${directoryPath}/${geoFile}`
    const textureAssetPath = `${directoryPath}/${textureFile}`

    return {
      slug,
      dexNumber,
      generation,
      directoryPath,
      geoFile,
      textureFile,
      geoUrl: `/api/media/cobblemon-asset?path=${encodeURIComponent(geoAssetPath)}`,
      textureUrl: `/api/media/cobblemon-asset?path=${encodeURIComponent(textureAssetPath)}`,
    }
  }

  return null
}

async function listTree(path: string): Promise<GitLabTreeEntry[] | null> {
  const url = `https://gitlab.com/api/v4/projects/${COBBLEMON_ASSETS_PROJECT_ID}/repository/tree?path=${encodeURIComponent(
    path
  )}&ref=${COBBLEMON_ASSETS_REF}&per_page=200`

  const response = await fetch(url)
  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`GitLab tree lookup failed with status ${response.status} for ${path}`)
  }

  return (await response.json()) as GitLabTreeEntry[]
}

function pickGeoFile(entries: GitLabTreeEntry[], slugCandidates: string[]): string | null {
  const files = entries
    .filter((entry) => entry.type === "blob" && entry.name.endsWith(".geo.json"))
    .map((entry) => entry.name)

  if (files.length === 0) {
    return null
  }

  const sorted = files
    .map((file) => ({ file, score: scoreGeoFile(file, slugCandidates) }))
    .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file))

  return sorted[0]?.file ?? null
}

function pickTextureFile(entries: GitLabTreeEntry[], geoFile: string): string | null {
  const files = entries
    .filter((entry) => entry.type === "blob" && entry.name.endsWith(".png"))
    .map((entry) => entry.name)
    .filter(
      (file) => !file.includes("_alpha") && !file.includes("_shiny") && !file.includes("_emissive")
    )

  if (files.length === 0) {
    return null
  }

  const baseName = geoFile.replace(/\.geo\.json$/u, "")
  if (files.includes(`${baseName}.png`)) {
    return `${baseName}.png`
  }

  return files.sort((a, b) => a.length - b.length || a.localeCompare(b))[0] ?? null
}

function scoreGeoFile(file: string, slugCandidates: string[]): number {
  const normalized = file
    .replace(/\.geo\.json$/u, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")

  let score = 0
  for (const candidate of slugCandidates) {
    const normalizedCandidate = candidate.replace(/[^a-z0-9]/g, "")
    if (!normalizedCandidate) {
      continue
    }

    if (normalized === normalizedCandidate) {
      score += 200
    } else if (normalized.startsWith(normalizedCandidate)) {
      score += 100
    } else if (normalized.includes(normalizedCandidate)) {
      score += 40
    }
  }

  if (/(alolan|galarian|hisuian|paldean|mega|gmax|totem|bloodmoon)/u.test(normalized)) {
    score -= 80
  }

  score -= file.length * 0.2
  return score
}

function resolveGenerationFromDex(dexNumber: number): number | null {
  if (dexNumber >= 1 && dexNumber <= 151) return 1
  if (dexNumber >= 152 && dexNumber <= 251) return 2
  if (dexNumber >= 252 && dexNumber <= 386) return 3
  if (dexNumber >= 387 && dexNumber <= 493) return 4
  if (dexNumber >= 494 && dexNumber <= 649) return 5
  if (dexNumber >= 650 && dexNumber <= 721) return 6
  if (dexNumber >= 722 && dexNumber <= 809) return 7
  if (dexNumber >= 810 && dexNumber <= 905) return 8
  if (dexNumber >= 906 && dexNumber <= 1025) return 9
  return null
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values))
}

function isSafeAssetPath(value: unknown): value is string {
  if (typeof value !== "string") {
    return false
  }

  return (
    value.startsWith(`${COBBLEMON_ASSETS_ROOT}/`) &&
    !value.includes("..") &&
    /^[a-z0-9_./-]+$/iu.test(value)
  )
}
