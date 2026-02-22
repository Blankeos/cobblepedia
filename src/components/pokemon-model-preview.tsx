import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js"
import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  NearestFilter,
  NearestMipmapNearestFilter,
  type Object3D,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  Vector3,
  WebGLRenderer,
} from "three"

type ModelPreviewManifest = {
  geoUrl: string
  textureUrl: string
}

type BedrockCube = {
  origin: [number, number, number]
  size: [number, number, number]
  inflate?: number
  uv?: [number, number] | Record<string, unknown>
  pivot?: [number, number, number]
  rotation?: [number, number, number]
  mirror?: boolean
}

type CubeFaceName = "east" | "west" | "up" | "down" | "south" | "north"

type FaceRect = [number, number, number, number]

type MeshVolumeMeta = {
  mesh: Mesh
  volume: number
}

type BuiltModel = {
  group: Group
  meshMeta: MeshVolumeMeta[]
}

type BedrockBone = {
  name: string
  parent?: string
  pivot?: [number, number, number]
  rotation?: [number, number, number]
  cubes?: BedrockCube[]
  mirror?: boolean
}

type BedrockGeometry = {
  description: {
    texture_width?: number
    texture_height?: number
  }
  bones?: BedrockBone[]
}

type BedrockGeoFile = {
  "minecraft:geometry"?: BedrockGeometry[]
}

type PreviewState = "idle" | "loading" | "ready" | "error"

type SceneRuntime = {
  scene: Scene
  renderer: WebGLRenderer
  camera: PerspectiveCamera
  modelRoot: Group
  resizeObserver: ResizeObserver
  frame: number
}

export function PokemonModelPreview(props: { slug: string; dexNumber: number; name: string }) {
  let containerRef: HTMLDivElement | undefined
  let runtime: SceneRuntime | null = null
  let loadVersion = 0

  const [previewState, setPreviewState] = createSignal<PreviewState>("idle")
  const [runtimeReady, setRuntimeReady] = createSignal(false)

  onMount(() => {
    if (!containerRef) {
      return
    }

    const scene = new Scene()
    scene.background = new Color("#e7e5e4")

    const camera = new PerspectiveCamera(34, 1, 0.1, 100)
    camera.position.set(3.1, 2.3, 3.1)
    camera.lookAt(0, 0.95, 0)

    const keyLight = new HemisphereLight("#f9fafb", "#d4d4d8", 1.6)
    scene.add(keyLight)

    const rimLight = new DirectionalLight("#ffffff", 0.55)
    rimLight.position.set(4, 6, 3)
    scene.add(rimLight)

    const modelRoot = new Group()
    scene.add(modelRoot)

    const renderer = new WebGLRenderer({
      antialias: true,
      alpha: false,
    })
    renderer.outputColorSpace = SRGBColorSpace
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

    containerRef.append(renderer.domElement)

    const resize = () => {
      if (!containerRef) {
        return
      }

      const width = Math.max(containerRef.clientWidth, 1)
      const height = Math.max(containerRef.clientHeight, 1)
      renderer.setSize(width, height, true)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    resize()

    const resizeObserver = new ResizeObserver(() => {
      resize()
    })
    resizeObserver.observe(containerRef)

    const runtimeState: SceneRuntime = {
      scene,
      renderer,
      camera,
      modelRoot,
      resizeObserver,
      frame: 0,
    }

    const animate = () => {
      runtimeState.frame = window.requestAnimationFrame(animate)
      modelRoot.rotation.y += 0.0032
      renderer.render(scene, camera)
    }
    animate()

    runtime = runtimeState
    setRuntimeReady(true)
  })

  createEffect(() => {
    if (!runtimeReady() || !runtime) {
      return
    }

    const slug = props.slug.trim().toLowerCase()
    const dexNumber = props.dexNumber

    if (!slug || !Number.isFinite(dexNumber) || dexNumber <= 0) {
      setPreviewState("error")
      clearGroup(runtime.modelRoot)
      return
    }

    const currentVersion = ++loadVersion
    setPreviewState("loading")

    void loadModel(runtime, slug, dexNumber, () => currentVersion === loadVersion)
      .then((loaded) => {
        if (currentVersion !== loadVersion) {
          return
        }
        setPreviewState(loaded ? "ready" : "error")
      })
      .catch(() => {
        if (currentVersion !== loadVersion) {
          return
        }
        setPreviewState("error")
      })
  })

  onCleanup(() => {
    loadVersion += 1

    if (!runtime) {
      return
    }

    window.cancelAnimationFrame(runtime.frame)
    runtime.resizeObserver.disconnect()
    clearGroup(runtime.modelRoot)
    runtime.renderer.dispose()
    runtime.renderer.domElement.remove()
    runtime = null
    setRuntimeReady(false)
  })

  return (
    <div class="relative h-full w-full">
      <div ref={(element) => (containerRef = element)} class="h-full w-full" />

      <Show when={previewState() !== "ready"}>
        <div class="pointer-events-none absolute inset-0 flex items-center justify-center bg-secondary/70">
          <Show
            when={previewState() === "loading"}
            fallback={
              <span class="font-mono text-4xl text-muted-foreground">
                {props.name.slice(0, 1).toUpperCase()}
              </span>
            }
          >
            <div class="h-7 w-7 animate-spin border-2 border-border border-t-foreground" />
          </Show>
        </div>
      </Show>
    </div>
  )
}

async function loadModel(
  runtime: SceneRuntime,
  slug: string,
  dexNumber: number,
  isCurrentVersion: () => boolean
): Promise<boolean> {
  clearGroup(runtime.modelRoot)

  const manifestResponse = await fetch(
    `/api/media/model-preview/${encodeURIComponent(slug)}?dex=${dexNumber}`
  )
  if (!manifestResponse.ok) {
    return false
  }

  const manifest = (await manifestResponse.json()) as ModelPreviewManifest

  if (!isCurrentVersion()) {
    return false
  }

  const [geoResponse, texture] = await Promise.all([
    fetch(manifest.geoUrl),
    loadTexture(manifest.textureUrl),
  ])

  if (!geoResponse.ok) {
    texture.dispose()
    return false
  }

  const geoFile = (await geoResponse.json()) as BedrockGeoFile
  const model = buildModelFromBedrock(geoFile, texture)
  if (!model) {
    texture.dispose()
    return false
  }

  if (!isCurrentVersion()) {
    disposeObjectTree(model.group)
    return false
  }

  runtime.modelRoot.rotation.set(0, 0, 0)
  runtime.modelRoot.add(model.group)
  fitModelInPreview(model, runtime.camera)
  return true
}

async function loadTexture(url: string): Promise<Texture> {
  const textureLoader = new TextureLoader()
  const texture = await textureLoader.loadAsync(url)
  texture.colorSpace = SRGBColorSpace
  texture.flipY = false
  texture.magFilter = NearestFilter
  texture.minFilter = NearestMipmapNearestFilter
  texture.needsUpdate = true
  return texture
}

function buildModelFromBedrock(geoFile: BedrockGeoFile, texture: Texture): BuiltModel | null {
  const geometryRoot = geoFile["minecraft:geometry"]?.[0]
  const bones = geometryRoot?.bones

  if (!geometryRoot || !bones || bones.length === 0) {
    return null
  }

  const textureWidth = geometryRoot.description.texture_width || 64
  const textureHeight = geometryRoot.description.texture_height || 64

  const material = new MeshStandardMaterial({
    color: "#ffffff",
    map: texture,
    transparent: false,
    alphaTest: 0.5,
    roughness: 0.9,
    metalness: 0,
  })

  const skeletonRoot = new Group()
  const renderRoot = new Group()
  renderRoot.scale.set(-1, 1, 1)
  renderRoot.add(skeletonRoot)

  const root = new Group()
  root.add(renderRoot)
  const meshMeta: MeshVolumeMeta[] = []
  const boneObjects = new Map<string, Group>()
  const bonePivots = new Map<string, Vector3>()

  for (const bone of bones) {
    boneObjects.set(bone.name, new Group())
    bonePivots.set(bone.name, toVector3(bone.pivot))
  }

  for (const bone of bones) {
    const boneObject = boneObjects.get(bone.name)
    if (!boneObject) {
      continue
    }

    const bonePivot = bonePivots.get(bone.name) ?? new Vector3()
    const parentPivot = bone.parent ? (bonePivots.get(bone.parent) ?? new Vector3()) : new Vector3()
    const parentObject = bone.parent ? (boneObjects.get(bone.parent) ?? skeletonRoot) : skeletonRoot

    boneObject.position.copy(bonePivot.clone().sub(parentPivot))
    applyEulerDegrees(boneObject, bone.rotation)
    parentObject.add(boneObject)

    for (const cube of bone.cubes ?? []) {
      const mirror = cube.mirror ?? false
      const cubeObject = createCubeObject(
        cube,
        bonePivot,
        material,
        textureWidth,
        textureHeight,
        meshMeta,
        mirror
      )
      boneObject.add(cubeObject)
    }
  }

  return {
    group: root,
    meshMeta,
  }
}

function createCubeObject(
  cube: BedrockCube,
  bonePivot: Vector3,
  material: MeshStandardMaterial,
  textureWidth: number,
  textureHeight: number,
  meshMeta: MeshVolumeMeta[],
  mirror: boolean
): Group | Mesh {
  const baseSize = cube.size.map((value) => Math.abs(value)) as [number, number, number]
  const inflate = cube.inflate ?? 0
  const inflatedSize = baseSize.map((value) => Math.max(value + inflate * 2, 0.01)) as [
    number,
    number,
    number,
  ]

  const geometry: BufferGeometry = Array.isArray(cube.uv)
    ? createModelPartCubeGeometry(
        baseSize,
        inflatedSize,
        cube.uv as [number, number],
        textureWidth,
        textureHeight,
        mirror
      )
    : new BoxGeometry(inflatedSize[0], inflatedSize[1], inflatedSize[2])

  if (isFaceUvMap(cube.uv)) {
    applyFaceUvMap(geometry, cube.uv, baseSize, textureWidth, textureHeight, mirror)
  }

  const mesh = new Mesh(geometry, material)
  mesh.frustumCulled = false

  const volume = Math.max(baseSize[0] * baseSize[1] * baseSize[2], 0.001)
  meshMeta.push({
    mesh,
    volume,
  })

  const origin = toVector3(cube.origin)
  const center = new Vector3(
    origin.x + baseSize[0] / 2,
    origin.y + baseSize[1] / 2,
    origin.z + baseSize[2] / 2
  )

  if (!cube.pivot && !cube.rotation) {
    mesh.position.copy(center.sub(bonePivot))
    return mesh
  }

  const pivot = toVector3(cube.pivot)
  const wrapper = new Group()
  wrapper.position.copy(pivot.sub(bonePivot))
  applyEulerDegrees(wrapper, cube.rotation)
  mesh.position.copy(center.sub(toVector3(cube.pivot)))
  wrapper.add(mesh)
  return wrapper
}

function createModelPartCubeGeometry(
  size: [number, number, number],
  inflatedSize: [number, number, number],
  uv: [number, number],
  textureWidth: number,
  textureHeight: number,
  mirror: boolean
): BufferGeometry {
  const [width, height, depth] = size
  const [inflatedWidth, inflatedHeight, inflatedDepth] = inflatedSize

  let minX = -inflatedWidth / 2
  const minY = -inflatedHeight / 2
  const minZ = -inflatedDepth / 2
  let maxX = inflatedWidth / 2
  const maxY = inflatedHeight / 2
  const maxZ = inflatedDepth / 2

  if (mirror) {
    ;[minX, maxX] = [maxX, minX]
  }

  const vertex000 = new Vector3(minX, minY, minZ)
  const vertex100 = new Vector3(maxX, minY, minZ)
  const vertex110 = new Vector3(maxX, maxY, minZ)
  const vertex010 = new Vector3(minX, maxY, minZ)
  const vertex001 = new Vector3(minX, minY, maxZ)
  const vertex101 = new Vector3(maxX, minY, maxZ)
  const vertex111 = new Vector3(maxX, maxY, maxZ)
  const vertex011 = new Vector3(minX, maxY, maxZ)

  const [u, v] = uv
  const w = u
  const x = u + depth
  const y = u + depth + width
  const z = u + depth + width + width
  const aa = u + depth + width + depth
  const ab = u + depth + width + depth + width
  const ac = v
  const ad = v + depth
  const ae = v + depth + height

  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []

  pushModelPartFace(
    positions,
    normals,
    uvs,
    [vertex101, vertex001, vertex000, vertex100],
    [x, ac, y, ad],
    textureWidth,
    textureHeight,
    mirror,
    [0, -1, 0]
  )
  pushModelPartFace(
    positions,
    normals,
    uvs,
    [vertex110, vertex010, vertex011, vertex111],
    [y, ad, z, ac],
    textureWidth,
    textureHeight,
    mirror,
    [0, 1, 0]
  )
  pushModelPartFace(
    positions,
    normals,
    uvs,
    [vertex000, vertex001, vertex011, vertex010],
    [w, ad, x, ae],
    textureWidth,
    textureHeight,
    mirror,
    [-1, 0, 0]
  )
  pushModelPartFace(
    positions,
    normals,
    uvs,
    [vertex100, vertex000, vertex010, vertex110],
    [x, ad, y, ae],
    textureWidth,
    textureHeight,
    mirror,
    [0, 0, -1]
  )
  pushModelPartFace(
    positions,
    normals,
    uvs,
    [vertex101, vertex100, vertex110, vertex111],
    [y, ad, aa, ae],
    textureWidth,
    textureHeight,
    mirror,
    [1, 0, 0]
  )
  pushModelPartFace(
    positions,
    normals,
    uvs,
    [vertex001, vertex101, vertex111, vertex011],
    [aa, ad, ab, ae],
    textureWidth,
    textureHeight,
    mirror,
    [0, 0, 1]
  )

  const geometry = new BufferGeometry()
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3))
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3))
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2))
  return geometry
}

function pushModelPartFace(
  positions: number[],
  normals: number[],
  uvs: number[],
  vertices: [Vector3, Vector3, Vector3, Vector3],
  rect: FaceRect,
  textureWidth: number,
  textureHeight: number,
  mirror: boolean,
  normal: [number, number, number]
) {
  const [u0, v0, u1, v1] = rect

  const mapped = [
    {
      position: vertices[0],
      uv: [u1 / textureWidth, 1 - v0 / textureHeight] as [number, number],
    },
    {
      position: vertices[1],
      uv: [u0 / textureWidth, 1 - v0 / textureHeight] as [number, number],
    },
    {
      position: vertices[2],
      uv: [u0 / textureWidth, 1 - v1 / textureHeight] as [number, number],
    },
    {
      position: vertices[3],
      uv: [u1 / textureWidth, 1 - v1 / textureHeight] as [number, number],
    },
  ]

  const ordered = mirror ? [...mapped].reverse() : mapped
  const [nx, ny, nz] = mirror ? ([-normal[0], normal[1], normal[2]] as const) : normal

  pushTriangle(positions, normals, uvs, ordered[0], ordered[1], ordered[2], nx, ny, nz)
  pushTriangle(positions, normals, uvs, ordered[0], ordered[2], ordered[3], nx, ny, nz)
}

function pushTriangle(
  positions: number[],
  normals: number[],
  uvs: number[],
  a: { position: Vector3; uv: [number, number] },
  b: { position: Vector3; uv: [number, number] },
  c: { position: Vector3; uv: [number, number] },
  nx: number,
  ny: number,
  nz: number
) {
  positions.push(
    a.position.x,
    a.position.y,
    a.position.z,
    b.position.x,
    b.position.y,
    b.position.z,
    c.position.x,
    c.position.y,
    c.position.z
  )

  normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz)

  uvs.push(a.uv[0], a.uv[1], b.uv[0], b.uv[1], c.uv[0], c.uv[1])
}

function applyFaceUvMap(
  geometry: BufferGeometry,
  faceUvMap: Record<string, unknown>,
  size: [number, number, number],
  textureWidth: number,
  textureHeight: number,
  mirror: boolean
) {
  const faceSizeByName: Record<CubeFaceName, [number, number]> = {
    east: [size[2], size[1]],
    west: [size[2], size[1]],
    north: [size[0], size[1]],
    south: [size[0], size[1]],
    up: [size[0], size[2]],
    down: [size[0], size[2]],
  }

  const faceRects: Partial<Record<CubeFaceName, FaceRect>> = {}

  for (const faceName of CUBE_FACE_ORDER) {
    const rawFace = faceUvMap[faceName]
    if (!rawFace || typeof rawFace !== "object") {
      continue
    }

    const face = rawFace as {
      uv?: unknown
      uv_size?: unknown
    }

    let faceRect: FaceRect | null = null

    if (Array.isArray(face.uv) && face.uv.length === 4) {
      faceRect = [Number(face.uv[0]), Number(face.uv[1]), Number(face.uv[2]), Number(face.uv[3])]
    } else if (
      Array.isArray(face.uv) &&
      face.uv.length >= 2 &&
      Number.isFinite(Number(face.uv[0])) &&
      Number.isFinite(Number(face.uv[1]))
    ) {
      const originU = Number(face.uv[0])
      const originV = Number(face.uv[1])

      const [defaultWidth, defaultHeight] = faceSizeByName[faceName]
      const width =
        Array.isArray(face.uv_size) && face.uv_size.length >= 2
          ? Number(face.uv_size[0])
          : defaultWidth
      const height =
        Array.isArray(face.uv_size) && face.uv_size.length >= 2
          ? Number(face.uv_size[1])
          : defaultHeight

      if (faceName === "up") {
        faceRect = [originU + width, originV + height, originU, originV]
      } else if (faceName === "down") {
        faceRect = [originU + width, originV, originU, originV + height]
      } else {
        faceRect = [originU, originV, originU + width, originV + height]
      }
    } else {
      continue
    }

    if (!faceRect || !Number.isFinite(faceRect[0] + faceRect[1] + faceRect[2] + faceRect[3])) {
      continue
    }

    faceRects[faceName] = faceRect
  }

  applyFaceRectMap(geometry, faceRects, textureWidth, textureHeight, mirror)
}

function applyFaceRectMap(
  geometry: BufferGeometry,
  faceRects: Partial<Record<CubeFaceName, FaceRect>>,
  textureWidth: number,
  textureHeight: number,
  mirror: boolean
) {
  const resolvedRects: Partial<Record<CubeFaceName, FaceRect>> = {
    ...faceRects,
  }

  if (mirror) {
    const east = resolvedRects.east
    const west = resolvedRects.west
    resolvedRects.east = west
    resolvedRects.west = east

    for (const faceName of CUBE_FACE_ORDER) {
      const rect = resolvedRects[faceName]
      if (!rect) {
        continue
      }
      resolvedRects[faceName] = [rect[2], rect[1], rect[0], rect[3]]
    }
  }

  const uvAttribute = geometry.getAttribute("uv")

  for (const faceName of CUBE_FACE_ORDER) {
    const rect = resolvedRects[faceName]
    if (!rect) {
      continue
    }

    const [left, top, right, bottom] = rect
    const offset = CUBE_FACE_INDEX[faceName] * 4

    uvAttribute.setXY(offset, left / textureWidth, 1 - top / textureHeight)
    uvAttribute.setXY(offset + 1, right / textureWidth, 1 - top / textureHeight)
    uvAttribute.setXY(offset + 2, left / textureWidth, 1 - bottom / textureHeight)
    uvAttribute.setXY(offset + 3, right / textureWidth, 1 - bottom / textureHeight)
  }

  uvAttribute.needsUpdate = true
}

function isFaceUvMap(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function fitModelInPreview(model: BuiltModel, camera: PerspectiveCamera) {
  const group = model.group
  group.position.set(0, 0, 0)
  group.scale.setScalar(1)

  group.updateMatrixWorld(true)

  const rawBox = new Box3().setFromObject(group)
  if (rawBox.isEmpty()) {
    return
  }

  const rawCenter = new Vector3()
  rawBox.getCenter(rawCenter)

  const weightedCenter = getWeightedCenter(model.meshMeta) ?? rawCenter
  group.position.x -= weightedCenter.x
  group.position.z -= weightedCenter.z

  group.updateMatrixWorld(true)

  const groundedBox = new Box3().setFromObject(group)
  if (groundedBox.isEmpty()) {
    return
  }

  group.position.y -= groundedBox.min.y
  group.updateMatrixWorld(true)

  const normalizedBox = new Box3().setFromObject(group)
  if (normalizedBox.isEmpty()) {
    return
  }

  const normalizedSize = new Vector3()
  normalizedBox.getSize(normalizedSize)

  const dominantDimension = Math.max(normalizedSize.x, normalizedSize.y, normalizedSize.z, 0.0001)
  group.scale.setScalar(1.58 / dominantDimension)

  group.updateMatrixWorld(true)

  const finalBox = new Box3().setFromObject(group)
  if (finalBox.isEmpty()) {
    return
  }

  const finalSize = new Vector3()
  finalBox.getSize(finalSize)

  const lookY = Math.max(finalBox.min.y + finalSize.y * 0.56, 0.2)
  const halfHeight = finalSize.y * 0.5
  const halfWidth = Math.max(finalSize.x, finalSize.z) * 0.5

  const verticalFov = MathUtils.degToRad(camera.fov)
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov * 0.5) * Math.max(camera.aspect, 0.0001))
  const distanceForHeight = halfHeight / Math.tan(verticalFov * 0.5)
  const distanceForWidth = halfWidth / Math.tan(horizontalFov * 0.5)
  const distance = Math.max(distanceForHeight, distanceForWidth, 1.35) * 1.2

  camera.position.set(distance * 0.82, lookY + finalSize.y * 0.12, distance * 0.82)
  camera.lookAt(0, lookY, 0)
  camera.updateProjectionMatrix()
}

function getWeightedCenter(meshMeta: MeshVolumeMeta[]): Vector3 | null {
  if (meshMeta.length === 0) {
    return null
  }

  const weightedCenter = new Vector3()
  const center = new Vector3()
  let totalWeight = 0

  for (const entry of meshMeta) {
    entry.mesh.updateWorldMatrix(true, false)
    const meshBox = new Box3().setFromObject(entry.mesh)
    if (meshBox.isEmpty()) {
      continue
    }

    meshBox.getCenter(center)
    const weight = Math.max(Math.cbrt(entry.volume), 0.001)
    weightedCenter.addScaledVector(center, weight)
    totalWeight += weight
  }

  if (totalWeight <= 0) {
    return null
  }

  return weightedCenter.divideScalar(totalWeight)
}

const CUBE_FACE_ORDER: CubeFaceName[] = ["east", "west", "up", "down", "south", "north"]

const CUBE_FACE_INDEX: Record<CubeFaceName, number> = {
  east: 0,
  west: 1,
  up: 2,
  down: 3,
  south: 4,
  north: 5,
}

function applyEulerDegrees(target: Group, degrees?: [number, number, number]) {
  if (!degrees) {
    return
  }

  target.rotation.set(
    MathUtils.degToRad(degrees[0]),
    MathUtils.degToRad(degrees[1]),
    MathUtils.degToRad(degrees[2])
  )
}

function toVector3(value?: [number, number, number]): Vector3 {
  if (!value) {
    return new Vector3()
  }
  return new Vector3(value[0], value[1], value[2])
}

function clearGroup(group: Group) {
  for (const child of [...group.children]) {
    disposeObjectTree(child)
    group.remove(child)
  }
}

function disposeObjectTree(object: Object3D) {
  if (object instanceof Mesh) {
    object.geometry.dispose()
    if (Array.isArray(object.material)) {
      for (const material of object.material) {
        material.dispose()
      }
    } else {
      const material = object.material as MeshStandardMaterial
      material.map?.dispose()
      material.dispose()
    }
  }

  for (const child of [...object.children]) {
    disposeObjectTree(child)
  }
}
