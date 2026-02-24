import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js"
import {
  Box3,
  BoxGeometry,
  type BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  NearestFilter,
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
  transparencyTextureUrl?: string
  animationUrl?: string
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

type AnimatedBoneBinding = {
  node: Group
  basePosition: Vector3
  baseScale: Vector3
  baseRotation: [number, number, number]
}

type BuiltModel = {
  group: Group
  meshMeta: MeshVolumeMeta[]
  animatedBones: Map<string, AnimatedBoneBinding>
  visibleBoundsOffset?: Vector3
  visibleBoundsHeight?: number
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
    visible_bounds_offset?: [number, number, number]
    visible_bounds_width?: number
    visible_bounds_height?: number
  }
  bones?: BedrockBone[]
}

type BedrockGeoFile = {
  "minecraft:geometry"?: BedrockGeometry[]
}

type BedrockAnimationFile = {
  animations?: Record<string, BedrockAnimation>
}

type BedrockAnimation = {
  loop?: boolean | "hold_on_last_frame" | "loop"
  animation_length?: number
  bones?: Record<string, BedrockAnimationBone>
}

type BedrockAnimationBone = {
  rotation?: BedrockAnimationChannelValue
  position?: BedrockAnimationChannelValue
  scale?: BedrockAnimationChannelValue
}

type BedrockAnimationKeyframe = {
  pre?: BedrockAnimationVectorValue
  post?: BedrockAnimationVectorValue
  lerp_mode?: string
}

type BedrockAnimationVectorValue =
  | number
  | string
  | [number | string, number | string, number | string]

type BedrockAnimationChannelValue =
  | BedrockAnimationVectorValue
  | BedrockAnimationKeyframe
  | Record<string, BedrockAnimationVectorValue | BedrockAnimationKeyframe>

type PreviewState = "idle" | "loading" | "ready" | "error"

type AnimationEvalContext = {
  animTime: number
  lifeTime: number
  deltaTime: number
}

type ScalarEvaluator = (context: AnimationEvalContext) => number

type VectorEvaluator = (context: AnimationEvalContext) => [number, number, number]

type CompiledAnimationChannel = {
  sample: (time: number, context: AnimationEvalContext) => [number, number, number]
  maxTime: number
}

type CompiledBoneAnimation = {
  target: AnimatedBoneBinding
  rotation?: CompiledAnimationChannel
  position?: CompiledAnimationChannel
  scale?: CompiledAnimationChannel
}

type CompiledAnimationPlayer = {
  update: (deltaSeconds: number) => void
}

type OrbitController = {
  update: (deltaSeconds: number) => void
  syncFromCamera: (lookTarget: Vector3, modelSize: Vector3) => void
  dispose: () => void
}

type FitModelResult = {
  lookTarget: Vector3
  size: Vector3
}

type SceneRuntime = {
  scene: Scene
  renderer: WebGLRenderer
  camera: PerspectiveCamera
  modelRoot: Group
  animationPlayer: CompiledAnimationPlayer | null
  orbitController: OrbitController
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

    const orbitController = createOrbitController(camera, renderer.domElement)

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
      animationPlayer: null,
      orbitController,
      resizeObserver,
      frame: 0,
    }

    let lastFrameTime = performance.now()

    const animate = () => {
      const now = performance.now()
      const deltaSeconds = Math.min(Math.max((now - lastFrameTime) / 1000, 0), 0.2)
      lastFrameTime = now

      runtimeState.frame = window.requestAnimationFrame(animate)

      if (runtimeState.animationPlayer) {
        runtimeState.animationPlayer.update(deltaSeconds)
      }

      runtimeState.orbitController.update(deltaSeconds)

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
      runtime.animationPlayer = null
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
    runtime.animationPlayer = null
    runtime.orbitController.dispose()
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
  runtime.animationPlayer = null
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

  const [geoResponse, texture, animationFile] = await Promise.all([
    fetch(manifest.geoUrl),
    loadTexture(manifest.textureUrl, manifest.transparencyTextureUrl),
    loadAnimationFile(manifest.animationUrl),
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
  const fitResult = fitModelInPreview(model, runtime.camera)
  if (fitResult) {
    runtime.orbitController.syncFromCamera(fitResult.lookTarget, fitResult.size)
  }
  runtime.animationPlayer = createIdleAnimationPlayer(model, animationFile)

  return true
}

async function loadAnimationFile(url?: string): Promise<BedrockAnimationFile | null> {
  if (!url) {
    return null
  }

  const response = await fetch(url)
  if (!response.ok) {
    return null
  }

  return (await response.json()) as BedrockAnimationFile
}

async function loadTexture(url: string, transparencyUrl?: string): Promise<Texture> {
  const textureLoader = new TextureLoader()

  if (transparencyUrl) {
    const [baseTexture, transparencyTexture] = await Promise.all([
      textureLoader.loadAsync(url),
      textureLoader.loadAsync(transparencyUrl),
    ])

    const mergedTexture = mergeLayeredTextures(baseTexture, transparencyTexture)
    baseTexture.dispose()
    transparencyTexture.dispose()
    return mergedTexture
  }

  const texture = await textureLoader.loadAsync(url)
  texture.colorSpace = SRGBColorSpace
  texture.flipY = true
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

function mergeLayeredTextures(baseTexture: Texture, transparencyTexture: Texture): Texture {
  const baseImage = baseTexture.image as CanvasImageSource | undefined
  const transparencyImage = transparencyTexture.image as CanvasImageSource | undefined

  if (
    !(baseImage instanceof HTMLImageElement) ||
    !(transparencyImage instanceof HTMLImageElement)
  ) {
    const fallbackTexture = baseTexture.clone()
    fallbackTexture.colorSpace = SRGBColorSpace
    fallbackTexture.flipY = true
    fallbackTexture.magFilter = NearestFilter
    fallbackTexture.minFilter = NearestFilter
    fallbackTexture.generateMipmaps = false
    fallbackTexture.needsUpdate = true
    return fallbackTexture
  }

  const canvas = document.createElement("canvas")
  canvas.width = baseImage.naturalWidth || baseImage.width
  canvas.height = baseImage.naturalHeight || baseImage.height

  const context = canvas.getContext("2d")
  if (!context) {
    const fallbackTexture = baseTexture.clone()
    fallbackTexture.colorSpace = SRGBColorSpace
    fallbackTexture.flipY = true
    fallbackTexture.magFilter = NearestFilter
    fallbackTexture.minFilter = NearestFilter
    fallbackTexture.generateMipmaps = false
    fallbackTexture.needsUpdate = true
    return fallbackTexture
  }

  context.imageSmoothingEnabled = false
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.drawImage(baseImage, 0, 0, canvas.width, canvas.height)
  context.drawImage(transparencyImage, 0, 0, canvas.width, canvas.height)

  const mergedTexture = new CanvasTexture(canvas)
  mergedTexture.colorSpace = SRGBColorSpace
  mergedTexture.flipY = true
  mergedTexture.magFilter = NearestFilter
  mergedTexture.minFilter = NearestFilter
  mergedTexture.generateMipmaps = false
  mergedTexture.needsUpdate = true
  return mergedTexture
}

const MOLANG_ALLOWED_IDENTIFIERS = new Set([
  "true",
  "false",
  "__anim_time",
  "__life_time",
  "__delta_time",
  "__math",
  "__math.sin",
  "__math.cos",
  "__math.tan",
  "__math.asin",
  "__math.acos",
  "__math.atan",
  "__math.atan2",
  "__math.abs",
  "__math.floor",
  "__math.ceil",
  "__math.round",
  "__math.min",
  "__math.max",
  "__math.sqrt",
  "__math.pow",
  "__math.exp",
  "__math.log",
  "__math.clamp",
  "__math.lerp",
  "__math.mod",
  "__math.pi",
])

const MOLANG_MATH = {
  sin: (degrees: number) => Math.sin(MathUtils.degToRad(degrees)),
  cos: (degrees: number) => Math.cos(MathUtils.degToRad(degrees)),
  tan: (degrees: number) => Math.tan(MathUtils.degToRad(degrees)),
  asin: (value: number) => MathUtils.radToDeg(Math.asin(value)),
  acos: (value: number) => MathUtils.radToDeg(Math.acos(value)),
  atan: (value: number) => MathUtils.radToDeg(Math.atan(value)),
  atan2: (y: number, x: number) => MathUtils.radToDeg(Math.atan2(y, x)),
  abs: (value: number) => Math.abs(value),
  floor: (value: number) => Math.floor(value),
  ceil: (value: number) => Math.ceil(value),
  round: (value: number) => Math.round(value),
  min: (...values: number[]) => Math.min(...values),
  max: (...values: number[]) => Math.max(...values),
  sqrt: (value: number) => Math.sqrt(value),
  pow: (base: number, exponent: number) => base ** exponent,
  exp: (value: number) => Math.exp(value),
  log: (value: number) => Math.log(value),
  clamp: (value: number, min: number, max: number) => MathUtils.clamp(value, min, max),
  lerp: (start: number, end: number, alpha: number) => MathUtils.lerp(start, end, alpha),
  mod: (value: number, divisor: number) => {
    if (divisor === 0) {
      return 0
    }
    return ((value % divisor) + divisor) % divisor
  },
  pi: Math.PI,
}

type CompiledAnimation = {
  loop: boolean
  duration: number
  bones: CompiledBoneAnimation[]
}

type CompiledKeyframe = {
  time: number
  pre: VectorEvaluator
  post: VectorEvaluator
  interpolation: string
}

function createIdleAnimationPlayer(
  model: BuiltModel,
  animationFile: BedrockAnimationFile | null
): CompiledAnimationPlayer | null {
  const selectedAnimation = pickIdleAnimation(animationFile)
  if (!selectedAnimation) {
    return null
  }

  const compiledAnimation = compileAnimation(selectedAnimation, model.animatedBones)
  if (!compiledAnimation || compiledAnimation.bones.length === 0) {
    return null
  }

  let elapsedSeconds = 0
  let lifeTimeSeconds = 0

  return {
    update: (deltaSeconds: number) => {
      const safeDelta = Math.max(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0)
      elapsedSeconds += safeDelta
      lifeTimeSeconds += safeDelta

      const sampleTime =
        compiledAnimation.loop && compiledAnimation.duration > 0
          ? wrapTime(elapsedSeconds, compiledAnimation.duration)
          : elapsedSeconds

      const evalContext: AnimationEvalContext = {
        animTime: lifeTimeSeconds,
        lifeTime: lifeTimeSeconds,
        deltaTime: safeDelta,
      }

      for (const boneAnimation of compiledAnimation.bones) {
        const { target } = boneAnimation

        if (boneAnimation.position) {
          const [offsetX, offsetY, offsetZ] = boneAnimation.position.sample(sampleTime, evalContext)
          target.node.position.set(
            target.basePosition.x - offsetX,
            target.basePosition.y + offsetY,
            target.basePosition.z + offsetZ
          )
        } else {
          target.node.position.copy(target.basePosition)
        }

        if (boneAnimation.rotation) {
          const [rotationX, rotationY, rotationZ] = boneAnimation.rotation.sample(
            sampleTime,
            evalContext
          )
          setBedrockEulerDegrees(
            target.node,
            target.baseRotation[0] + rotationX,
            target.baseRotation[1] + rotationY,
            target.baseRotation[2] + rotationZ
          )
        } else {
          setBedrockEulerDegrees(
            target.node,
            target.baseRotation[0],
            target.baseRotation[1],
            target.baseRotation[2]
          )
        }

        if (boneAnimation.scale) {
          const [scaleX, scaleY, scaleZ] = boneAnimation.scale.sample(sampleTime, evalContext)
          target.node.scale.set(
            target.baseScale.x * keepNonZero(scaleX, 1),
            target.baseScale.y * keepNonZero(scaleY, 1),
            target.baseScale.z * keepNonZero(scaleZ, 1)
          )
        } else {
          target.node.scale.copy(target.baseScale)
        }
      }
    },
  }
}

function pickIdleAnimation(animationFile: BedrockAnimationFile | null): BedrockAnimation | null {
  const animations = animationFile?.animations
  if (!animations) {
    return null
  }

  const entries = Object.entries(animations).filter(([, animation]) => !!animation)
  if (entries.length === 0) {
    return null
  }

  const scored = entries
    .map(([name, animation]) => ({ name, animation, score: scoreAnimationName(name, animation) }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))

  return scored[0]?.animation ?? null
}

function scoreAnimationName(name: string, animation: BedrockAnimation): number {
  const normalizedName = name.toLowerCase()
  let score = 0

  if (normalizedName.includes("idle")) {
    score += 220
  }
  if (normalizedName.includes("ground_idle")) {
    score += 120
  }
  if (normalizedName.includes("idle_ground")) {
    score += 110
  }
  if (/\.idle(?:$|\.)/u.test(normalizedName)) {
    score += 70
  }
  if (/(walk|run|attack|hit|cry|faint|death|sleep)/u.test(normalizedName)) {
    score -= 180
  }
  if (animation.loop === true || animation.loop === "loop") {
    score += 40
  }

  return score
}

function compileAnimation(
  animation: BedrockAnimation,
  animatedBones: Map<string, AnimatedBoneBinding>
): CompiledAnimation | null {
  const bones = animation.bones
  if (!bones) {
    return null
  }

  const loop = animation.loop === true || animation.loop === "loop"
  const compiledBones: CompiledBoneAnimation[] = []
  const lowerCaseTargets = new Map<string, AnimatedBoneBinding>()
  for (const [boneName, target] of animatedBones) {
    lowerCaseTargets.set(boneName.toLowerCase(), target)
  }

  let keyframeTimeUpperBound = 0

  for (const [boneName, boneAnimation] of Object.entries(bones)) {
    if (!boneAnimation || typeof boneAnimation !== "object") {
      continue
    }

    const target = animatedBones.get(boneName) ?? lowerCaseTargets.get(boneName.toLowerCase())
    if (!target) {
      continue
    }

    const position = compileAnimationChannel(boneAnimation.position, [0, 0, 0], loop)
    const rotation = compileAnimationChannel(boneAnimation.rotation, [0, 0, 0], loop)
    const scale = compileAnimationChannel(boneAnimation.scale, [1, 1, 1], loop)

    if (!position && !rotation && !scale) {
      continue
    }

    keyframeTimeUpperBound = Math.max(
      keyframeTimeUpperBound,
      position?.maxTime ?? 0,
      rotation?.maxTime ?? 0,
      scale?.maxTime ?? 0
    )

    compiledBones.push({
      target,
      position,
      rotation,
      scale,
    })
  }

  const animationLength = parseFiniteNumber(animation.animation_length, 0)

  return {
    loop,
    duration: Math.max(animationLength, keyframeTimeUpperBound, 0),
    bones: compiledBones,
  }
}

function compileAnimationChannel(
  source: BedrockAnimationChannelValue | undefined,
  fallback: [number, number, number],
  loop: boolean
): CompiledAnimationChannel | undefined {
  if (source === undefined) {
    return undefined
  }

  const keyframes = compileAnimationKeyframes(source, fallback)
  if (keyframes.length === 0) {
    const evaluator = compileVectorEvaluator(source, fallback)
    return {
      sample: (_time, context) => evaluator(context),
      maxTime: 0,
    }
  }

  const maxTime = keyframes[keyframes.length - 1]?.time ?? 0

  return {
    sample: (time, context) => sampleAnimationKeyframes(keyframes, time, context, loop, maxTime),
    maxTime,
  }
}

function compileAnimationKeyframes(
  source: BedrockAnimationChannelValue,
  fallback: [number, number, number]
): CompiledKeyframe[] {
  if (isAnimationKeyframe(source)) {
    return [
      {
        time: 0,
        pre: compileVectorEvaluator(source.pre ?? source.post ?? fallback, fallback),
        post: compileVectorEvaluator(source.post ?? source.pre ?? fallback, fallback),
        interpolation: normalizeInterpolation(source.lerp_mode),
      },
    ]
  }

  if (
    typeof source !== "object" ||
    source === null ||
    Array.isArray(source) ||
    typeof source === "string" ||
    typeof source === "number"
  ) {
    return []
  }

  const compiled: CompiledKeyframe[] = []

  for (const [timestamp, value] of Object.entries(source)) {
    const time = Number.parseFloat(timestamp)
    if (!Number.isFinite(time)) {
      continue
    }

    if (isAnimationKeyframe(value)) {
      compiled.push({
        time,
        pre: compileVectorEvaluator(value.pre ?? value.post ?? fallback, fallback),
        post: compileVectorEvaluator(value.post ?? value.pre ?? fallback, fallback),
        interpolation: normalizeInterpolation(value.lerp_mode),
      })
      continue
    }

    const evaluator = compileVectorEvaluator(value, fallback)
    compiled.push({
      time,
      pre: evaluator,
      post: evaluator,
      interpolation: "linear",
    })
  }

  compiled.sort((left, right) => left.time - right.time)
  return compiled
}

function sampleAnimationKeyframes(
  keyframes: CompiledKeyframe[],
  time: number,
  context: AnimationEvalContext,
  loop: boolean,
  duration: number
): [number, number, number] {
  if (keyframes.length === 0) {
    return [0, 0, 0]
  }

  if (keyframes.length === 1) {
    return keyframes[0].post(context)
  }

  const sampledTime = loop && duration > 0 ? wrapTime(time, duration) : Math.max(time, 0)

  const first = keyframes[0]
  const last = keyframes[keyframes.length - 1]

  if (sampledTime < first.time) {
    if (loop && duration > 0) {
      const previousTime = last.time - duration
      return interpolateKeyframes(
        keyframes,
        keyframes.length - 1,
        previousTime,
        0,
        first.time,
        sampledTime,
        context,
        true
      )
    }
    return first.pre(context)
  }

  if (sampledTime >= last.time) {
    if (loop && duration > 0) {
      return interpolateKeyframes(
        keyframes,
        keyframes.length - 1,
        last.time,
        0,
        first.time + duration,
        sampledTime,
        context,
        true
      )
    }
    return last.post(context)
  }

  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const current = keyframes[index]
    const next = keyframes[index + 1]

    if (sampledTime < current.time || sampledTime > next.time) {
      continue
    }

    return interpolateKeyframes(
      keyframes,
      index,
      current.time,
      index + 1,
      next.time,
      sampledTime,
      context,
      loop
    )
  }

  return last.post(context)
}

function interpolateKeyframes(
  keyframes: CompiledKeyframe[],
  beforeIndex: number,
  beforeTime: number,
  afterIndex: number,
  afterTime: number,
  sampledTime: number,
  context: AnimationEvalContext,
  loop: boolean
): [number, number, number] {
  const before = keyframes[beforeIndex]
  const after = keyframes[afterIndex]

  const beforeValue = before.post(context)
  const afterValue = after.pre(context)

  if (sampledTime <= beforeTime) {
    return beforeValue
  }

  const timeSpan = afterTime - beforeTime
  if (timeSpan <= 0.000001 || before.interpolation === "step") {
    return beforeValue
  }

  const alpha = MathUtils.clamp((sampledTime - beforeTime) / timeSpan, 0, 1)

  if (before.interpolation === "catmullrom" || after.interpolation === "catmullrom") {
    const previousIndex =
      beforeIndex > 0 ? beforeIndex - 1 : loop ? keyframes.length - 1 : beforeIndex
    const nextIndex = afterIndex < keyframes.length - 1 ? afterIndex + 1 : loop ? 0 : afterIndex

    const previousValue = keyframes[previousIndex].post(context)
    const nextValue = keyframes[nextIndex].pre(context)

    return [
      interpolateCatmullRom(alpha, previousValue[0], beforeValue[0], afterValue[0], nextValue[0]),
      interpolateCatmullRom(alpha, previousValue[1], beforeValue[1], afterValue[1], nextValue[1]),
      interpolateCatmullRom(alpha, previousValue[2], beforeValue[2], afterValue[2], nextValue[2]),
    ]
  }

  return [
    MathUtils.lerp(beforeValue[0], afterValue[0], alpha),
    MathUtils.lerp(beforeValue[1], afterValue[1], alpha),
    MathUtils.lerp(beforeValue[2], afterValue[2], alpha),
  ]
}

function compileVectorEvaluator(
  source: BedrockAnimationVectorValue | BedrockAnimationKeyframe,
  fallback: [number, number, number]
): VectorEvaluator {
  if (Array.isArray(source)) {
    const x = compileScalarEvaluator(source[0], fallback[0])
    const y = compileScalarEvaluator(source[1], fallback[1])
    const z = compileScalarEvaluator(source[2], fallback[2])

    return (context) => [x(context), y(context), z(context)]
  }

  if (typeof source === "number" || typeof source === "string") {
    const uniform = compileScalarEvaluator(source, fallback[0])
    return (context) => {
      const value = uniform(context)
      return [value, value, value]
    }
  }

  if (isAnimationKeyframe(source)) {
    return compileVectorEvaluator(source.post ?? source.pre ?? fallback, fallback)
  }

  return () => [...fallback] as [number, number, number]
}

function compileScalarEvaluator(source: unknown, fallback: number): ScalarEvaluator {
  if (typeof source === "number" && Number.isFinite(source)) {
    return () => source
  }

  if (typeof source === "string") {
    const expressionEvaluator = compileMolangExpression(source)
    if (expressionEvaluator) {
      return (context) => {
        const value = expressionEvaluator(context)
        return Number.isFinite(value) ? value : fallback
      }
    }
  }

  return () => fallback
}

function compileMolangExpression(
  expression: string
): ((context: AnimationEvalContext) => number) | null {
  const normalized = expression
    .trim()
    .toLowerCase()
    .replace(/\bq\./gu, "query.")
    .replace(/\bv\./gu, "variable.")
    .replace(/\bt\./gu, "temp.")
    .replace(/\bc\./gu, "context.")

  if (!normalized) {
    return null
  }

  const jsExpression = normalized
    .replace(/\bquery\.anim_time\b/gu, "__anim_time")
    .replace(/\bquery\.life_time\b/gu, "__life_time")
    .replace(/\bquery\.delta_time\b/gu, "__delta_time")
    .replace(/\bquery\.[a-z_][a-z0-9_]*\b/gu, "0")
    .replace(/\b(?:variable|context|temp)\.[a-z_][a-z0-9_]*\b/gu, "0")
    .replace(/\bmath\./gu, "__math.")

  if (/[^0-9a-z_+\-*/%().,\s<>=!?:&|]/u.test(jsExpression)) {
    return null
  }

  const identifiers = jsExpression.match(/[a-z_][a-z0-9_.]*/gu) ?? []
  for (const identifier of identifiers) {
    if (!MOLANG_ALLOWED_IDENTIFIERS.has(identifier)) {
      return null
    }
  }

  try {
    const evaluator = new Function(
      "__anim_time",
      "__life_time",
      "__delta_time",
      "__math",
      `return Number(${jsExpression});`
    ) as (animTime: number, lifeTime: number, deltaTime: number, math: typeof MOLANG_MATH) => number

    return (context) =>
      evaluator(context.animTime, context.lifeTime, context.deltaTime, MOLANG_MATH)
  } catch {
    return null
  }
}

function isAnimationKeyframe(value: unknown): value is BedrockAnimationKeyframe {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false
  }

  const keyframe = value as BedrockAnimationKeyframe
  return keyframe.pre !== undefined || keyframe.post !== undefined
}

function normalizeInterpolation(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "linear"
}

function keepNonZero(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback
  }

  if (value === 0) {
    return 0.00001
  }

  return value
}

function wrapTime(value: number, length: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(length) || length <= 0) {
    return 0
  }

  return ((value % length) + length) % length
}

function interpolateCatmullRom(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const tSquared = t * t
  const tCubed = tSquared * t
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * tSquared +
      (-p0 + 3 * p1 - 3 * p2 + p3) * tCubed)
  )
}

function parseFiniteNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  return fallback
}

function toRotationTuple(value?: [number, number, number]): [number, number, number] {
  if (!value) {
    return [0, 0, 0]
  }

  return [
    parseFiniteNumber(value[0], 0),
    parseFiniteNumber(value[1], 0),
    parseFiniteNumber(value[2], 0),
  ]
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
  const root = new Group()
  root.add(skeletonRoot)
  const meshMeta: MeshVolumeMeta[] = []
  const animatedBones = new Map<string, AnimatedBoneBinding>()
  const boneObjects = new Map<string, Group>()
  const bonePivots = new Map<string, Vector3>()

  for (const bone of bones) {
    const boneGroup = new Group()
    boneGroup.name = bone.name
    boneObjects.set(bone.name, boneGroup)
    bonePivots.set(bone.name, toBedrockPivotVector(bone.pivot))
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
    applyBedrockEulerDegrees(boneObject, bone.rotation)
    parentObject.add(boneObject)

    animatedBones.set(bone.name, {
      node: boneObject,
      basePosition: boneObject.position.clone(),
      baseScale: boneObject.scale.clone(),
      baseRotation: toRotationTuple(bone.rotation),
    })

    for (const cube of bone.cubes ?? []) {
      const mirror = cube.mirror ?? bone.mirror ?? false
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

  const visibleBoundsOffset = geometryRoot.description.visible_bounds_offset
    ? toBedrockPivotVector(geometryRoot.description.visible_bounds_offset)
    : undefined

  return {
    group: root,
    meshMeta,
    animatedBones,
    visibleBoundsOffset,
    visibleBoundsHeight: geometryRoot.description.visible_bounds_height,
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
  const signedSize = cube.size.map((value) => Number(value)) as [number, number, number]
  const boxUvSize = signedSize.map((value) => Math.floor(Math.abs(value) + 0.0000001)) as [
    number,
    number,
    number,
  ]

  const inflate = cube.inflate ?? 0
  const inflatedSize = signedSize.map((value) => {
    const inflatedValue = Math.abs(value) + inflate * 2
    return Math.max(inflatedValue, 0.001)
  }) as [number, number, number]

  const geometry = new BoxGeometry(inflatedSize[0], inflatedSize[1], inflatedSize[2])

  if (Array.isArray(cube.uv)) {
    applyBoxUvMap(
      geometry,
      cube.uv as [number, number],
      boxUvSize,
      textureWidth,
      textureHeight,
      mirror
    )
  }

  if (isFaceUvMap(cube.uv)) {
    applyFaceUvMap(geometry, cube.uv, boxUvSize, textureWidth, textureHeight)
  }

  const mesh = new Mesh(geometry, material)
  mesh.frustumCulled = false

  const volume = Math.max(Math.abs(signedSize[0] * signedSize[1] * signedSize[2]), 0.001)
  meshMeta.push({
    mesh,
    volume,
  })

  const from = toBedrockCubeFrom(cube.origin, signedSize)
  const to = from.clone().add(new Vector3(signedSize[0], signedSize[1], signedSize[2]))
  const center = from.clone().add(to).multiplyScalar(0.5)

  if (!cube.pivot && !cube.rotation) {
    mesh.position.copy(center.sub(bonePivot))
    return mesh
  }

  const pivot = toBedrockPivotVector(cube.pivot)
  const wrapper = new Group()
  wrapper.position.copy(pivot.sub(bonePivot))
  applyBedrockEulerDegrees(wrapper, cube.rotation)
  mesh.position.copy(center.sub(toBedrockPivotVector(cube.pivot)))
  wrapper.add(mesh)
  return wrapper
}

function applyBoxUvMap(
  geometry: BufferGeometry,
  uvOffset: [number, number],
  size: [number, number, number],
  textureWidth: number,
  textureHeight: number,
  mirror: boolean
) {
  const [width, height, depth] = size

  const faceLayout: Record<CubeFaceName, { from: [number, number]; size: [number, number] }> = {
    east: {
      from: [0, depth],
      size: [depth, height],
    },
    west: {
      from: [depth + width, depth],
      size: [depth, height],
    },
    up: {
      from: [depth + width, depth],
      size: [-width, -depth],
    },
    down: {
      from: [depth + width * 2, 0],
      size: [-width, depth],
    },
    south: {
      from: [depth * 2 + width, depth],
      size: [width, height],
    },
    north: {
      from: [depth, depth],
      size: [width, height],
    },
  }

  if (mirror) {
    for (const faceName of CUBE_FACE_ORDER) {
      const layout = faceLayout[faceName]
      layout.from[0] += layout.size[0]
      layout.size[0] *= -1
    }

    const eastLayout = faceLayout.east
    faceLayout.east = faceLayout.west
    faceLayout.west = eastLayout
  }

  const faceRects: Partial<Record<CubeFaceName, FaceRect>> = {}

  for (const faceName of CUBE_FACE_ORDER) {
    const layout = faceLayout[faceName]
    const fromU = uvOffset[0] + layout.from[0]
    const fromV = uvOffset[1] + layout.from[1]
    faceRects[faceName] = [fromU, fromV, fromU + layout.size[0], fromV + layout.size[1]]
  }

  applyFaceRectMap(geometry, faceRects, textureWidth, textureHeight)
}

function applyFaceUvMap(
  geometry: BufferGeometry,
  faceUvMap: Record<string, unknown>,
  size: [number, number, number],
  textureWidth: number,
  textureHeight: number
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

  applyFaceRectMap(geometry, faceRects, textureWidth, textureHeight)
}

function applyFaceRectMap(
  geometry: BufferGeometry,
  faceRects: Partial<Record<CubeFaceName, FaceRect>>,
  textureWidth: number,
  textureHeight: number
) {
  const uvAttribute = geometry.getAttribute("uv")

  for (const faceName of CUBE_FACE_ORDER) {
    const rect = faceRects[faceName]
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

const ORBIT_MIN_POLAR = 0.16
const ORBIT_MAX_POLAR = Math.PI - 0.08
const ORBIT_DRAG_SENSITIVITY = 0.008
const ORBIT_ZOOM_SENSITIVITY = 0.0015
const ORBIT_AUTO_ROTATE_SPEED = 0.2
const ORBIT_RESUME_DELAY_MS = 1200

function createOrbitController(
  camera: PerspectiveCamera,
  element: HTMLCanvasElement
): OrbitController {
  const previousTouchAction = element.style.touchAction
  const previousCursor = element.style.cursor

  const state = {
    target: new Vector3(0, 0.95, 0),
    radius: 4,
    minRadius: 0.9,
    maxRadius: 14,
    azimuth: 0,
    polar: Math.PI * 0.33,
    isDragging: false,
    activePointerId: null as number | null,
    lastPointerX: 0,
    lastPointerY: 0,
    lastInteractionAt: 0,
  }

  const applyCamera = () => {
    state.polar = MathUtils.clamp(state.polar, ORBIT_MIN_POLAR, ORBIT_MAX_POLAR)
    state.radius = MathUtils.clamp(state.radius, state.minRadius, state.maxRadius)

    const sinPolar = Math.sin(state.polar)
    camera.position.set(
      state.target.x + state.radius * sinPolar * Math.sin(state.azimuth),
      state.target.y + state.radius * Math.cos(state.polar),
      state.target.z + state.radius * sinPolar * Math.cos(state.azimuth)
    )
    camera.lookAt(state.target)
    camera.updateProjectionMatrix()
  }

  const syncFromCurrentCamera = () => {
    const offset = camera.position.clone().sub(state.target)
    const length = Math.max(offset.length(), 0.0001)
    state.radius = length
    state.azimuth = Math.atan2(offset.x, offset.z)
    state.polar = Math.acos(MathUtils.clamp(offset.y / length, -1, 1))
  }

  const markInteraction = () => {
    state.lastInteractionAt = performance.now()
  }

  const handlePointerDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return
    }

    state.isDragging = true
    state.activePointerId = event.pointerId
    state.lastPointerX = event.clientX
    state.lastPointerY = event.clientY
    markInteraction()

    element.setPointerCapture(event.pointerId)
    element.style.cursor = "grabbing"
  }

  const handlePointerMove = (event: PointerEvent) => {
    if (!state.isDragging || state.activePointerId !== event.pointerId) {
      return
    }

    const deltaX = event.clientX - state.lastPointerX
    const deltaY = event.clientY - state.lastPointerY
    state.lastPointerX = event.clientX
    state.lastPointerY = event.clientY

    state.azimuth -= deltaX * ORBIT_DRAG_SENSITIVITY
    state.polar = MathUtils.clamp(
      state.polar - deltaY * ORBIT_DRAG_SENSITIVITY,
      ORBIT_MIN_POLAR,
      ORBIT_MAX_POLAR
    )

    markInteraction()
    applyCamera()
  }

  const stopDragging = (event: PointerEvent) => {
    if (state.activePointerId !== event.pointerId) {
      return
    }

    state.isDragging = false
    state.activePointerId = null
    markInteraction()
    element.style.cursor = "grab"
  }

  const handleWheel = (event: WheelEvent) => {
    event.preventDefault()

    const scale = Math.exp(event.deltaY * ORBIT_ZOOM_SENSITIVITY)
    state.radius = MathUtils.clamp(state.radius * scale, state.minRadius, state.maxRadius)

    markInteraction()
    applyCamera()
  }

  element.style.touchAction = "none"
  element.style.cursor = "grab"

  element.addEventListener("pointerdown", handlePointerDown)
  element.addEventListener("pointermove", handlePointerMove)
  element.addEventListener("pointerup", stopDragging)
  element.addEventListener("pointercancel", stopDragging)
  element.addEventListener("lostpointercapture", stopDragging)
  element.addEventListener("wheel", handleWheel, { passive: false })

  syncFromCurrentCamera()

  return {
    update: (deltaSeconds: number) => {
      if (
        !state.isDragging &&
        performance.now() - state.lastInteractionAt > ORBIT_RESUME_DELAY_MS
      ) {
        state.azimuth += ORBIT_AUTO_ROTATE_SPEED * deltaSeconds
      }

      applyCamera()
    },
    syncFromCamera: (lookTarget: Vector3, modelSize: Vector3) => {
      state.target.copy(lookTarget)

      const dominantDimension = Math.max(modelSize.x, modelSize.y, modelSize.z, 0.0001)
      state.minRadius = Math.max(dominantDimension * 0.5, 0.9)
      state.maxRadius = Math.max(dominantDimension * 4.8, state.minRadius + 0.75)

      const offset = camera.position.clone().sub(state.target)
      const radius = Math.max(offset.length(), 0.0001)
      state.radius = MathUtils.clamp(radius, state.minRadius, state.maxRadius)
      state.azimuth = Math.atan2(offset.x, offset.z)
      state.polar = Math.acos(MathUtils.clamp(offset.y / radius, -1, 1))
      state.polar = MathUtils.clamp(state.polar, ORBIT_MIN_POLAR, ORBIT_MAX_POLAR)

      markInteraction()
      applyCamera()
    },
    dispose: () => {
      element.removeEventListener("pointerdown", handlePointerDown)
      element.removeEventListener("pointermove", handlePointerMove)
      element.removeEventListener("pointerup", stopDragging)
      element.removeEventListener("pointercancel", stopDragging)
      element.removeEventListener("lostpointercapture", stopDragging)
      element.removeEventListener("wheel", handleWheel)

      element.style.touchAction = previousTouchAction
      element.style.cursor = previousCursor
    },
  }
}

function fitModelInPreview(model: BuiltModel, camera: PerspectiveCamera): FitModelResult | null {
  const group = model.group
  group.position.set(0, 0, 0)
  group.scale.setScalar(1)

  group.updateMatrixWorld(true)

  const rawBox = new Box3().setFromObject(group)
  if (rawBox.isEmpty()) {
    return null
  }

  const rawSize = new Vector3()
  rawBox.getSize(rawSize)

  const dominantDimension = Math.max(rawSize.x, rawSize.y, rawSize.z, 0.0001)
  group.scale.setScalar(1.58 / dominantDimension)

  group.updateMatrixWorld(true)

  const scaledBox = new Box3().setFromObject(group)
  if (scaledBox.isEmpty()) {
    return null
  }

  const scaledCenter = new Vector3()
  scaledBox.getCenter(scaledCenter)

  group.position.x = -scaledCenter.x
  group.position.y = -scaledBox.min.y
  group.position.z = -scaledCenter.z

  group.updateMatrixWorld(true)

  const finalBox = new Box3().setFromObject(group)
  if (finalBox.isEmpty()) {
    return null
  }

  const finalSize = new Vector3()
  finalBox.getSize(finalSize)

  const finalCenter = new Vector3()
  finalBox.getCenter(finalCenter)

  const lookTarget = finalCenter.clone()

  if (model.visibleBoundsOffset) {
    const visibleBoundsHeight = model.visibleBoundsHeight
    if (typeof visibleBoundsHeight === "number" && visibleBoundsHeight > 0) {
      const fractionFromBottom = MathUtils.clamp(
        model.visibleBoundsOffset.y / visibleBoundsHeight,
        0.15,
        0.85
      )
      lookTarget.y = finalBox.min.y + finalSize.y * fractionFromBottom
    }
  } else {
    lookTarget.y = Math.max(finalBox.min.y + finalSize.y * 0.5, 0.2)
  }

  const halfHeight = finalSize.y * 0.5
  const halfWidth = Math.max(finalSize.x, finalSize.z) * 0.5

  const verticalFov = MathUtils.degToRad(camera.fov)
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov * 0.5) * Math.max(camera.aspect, 0.0001))
  const distanceForHeight = halfHeight / Math.tan(verticalFov * 0.5)
  const distanceForWidth = halfWidth / Math.tan(horizontalFov * 0.5)
  const distance = Math.max(distanceForHeight, distanceForWidth, 1.35) * 1.2

  const newX = lookTarget.x + distance * 0.82
  const newY = lookTarget.y + finalSize.y * 0.12
  const newZ = lookTarget.z - distance * 0.82
  camera.position.set(newX, newY, newZ)
  camera.lookAt(lookTarget)
  camera.updateProjectionMatrix()

  return {
    lookTarget,
    size: finalSize,
  }
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

function setBedrockEulerDegrees(
  target: Group,
  xDegrees: number,
  yDegrees: number,
  zDegrees: number
) {
  target.rotation.order = "ZYX"
  target.rotation.set(
    MathUtils.degToRad(-xDegrees),
    MathUtils.degToRad(-yDegrees),
    MathUtils.degToRad(zDegrees)
  )
}

function applyBedrockEulerDegrees(target: Group, degrees?: [number, number, number]) {
  if (!degrees) {
    setBedrockEulerDegrees(target, 0, 0, 0)
    return
  }

  setBedrockEulerDegrees(target, degrees[0], degrees[1], degrees[2])
}

function toBedrockPivotVector(value?: [number, number, number]): Vector3 {
  if (!value) {
    return new Vector3()
  }

  return new Vector3(-value[0], value[1], value[2])
}

function toBedrockCubeFrom(
  origin: [number, number, number],
  size: [number, number, number]
): Vector3 {
  return new Vector3(-(origin[0] + size[0]), origin[1], origin[2])
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
