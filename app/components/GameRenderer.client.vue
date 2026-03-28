<template>
  <canvas
    ref="canvasRef"
    class="game-canvas"
    :class="{ 'draw-cursor': isDrawMode }"
    @mousedown="onMouseDown"
    @mousemove="onMouseMove"
    @mouseup="onMouseUp"
    @mouseleave="onMouseUp"
    @touchstart.prevent="onTouchStart"
    @touchmove.prevent="onTouchMove"
    @touchend.prevent="onMouseUp"
  />
</template>

<script setup lang="ts">
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

const props = defineProps<{
  grid: Uint8Array
  gridCols: number
  gridRows: number
  isDrawMode: boolean
  isPlaying: boolean
}>()

const emit = defineEmits<{
  (e: 'toggleCell', col: number, row: number): void
  (e: 'paintCell', col: number, row: number, value: 0 | 1): void
  (e: 'startPaint', col: number, row: number): void
}>()

// ──────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────
const CELL_SIZE = 11
const CELL_GAP = 1.5
const CELL_DRAW_SIZE = CELL_SIZE - CELL_GAP

// Aero Vista colors
const COLOR_ALIVE_BRIGHT = new THREE.Color(0x00e5ff)
const COLOR_ALIVE_MID = new THREE.Color(0x4fc3f7)
const COLOR_ALIVE_DIM = new THREE.Color(0x0288d1)
const COLOR_DEAD = new THREE.Color(0x0a1428)
const COLOR_BG = new THREE.Color(0x030912)

const canvasRef = ref<HTMLCanvasElement>()

// Three.js objects
let renderer: THREE.WebGLRenderer
let scene: THREE.Scene
let camera: THREE.OrthographicCamera
let composer: EffectComposer
let bloomPass: UnrealBloomPass

// Instanced mesh for alive cells
let aliveMesh: THREE.InstancedMesh
// Background grid mesh
let gridMesh: THREE.InstancedMesh

const dummy = new THREE.Object3D()
const tempColor = new THREE.Color()

// Interaction state
let isPointerDown = false
let paintMode: 0 | 1 = 1
let lastPaintedCol = -1
let lastPaintedRow = -1

// View state
let viewWidth = 0
let viewHeight = 0

// ──────────────────────────────────────────────────────
// Init Three.js
// ──────────────────────────────────────────────────────
function initThree() {
  const canvas = canvasRef.value
  if (!canvas) return
  const w = canvas.clientWidth || 800
  const h = canvas.clientHeight || 600

  // Renderer
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(w, h, false)
  renderer.setClearColor(COLOR_BG, 1)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0

  // Scene
  scene = new THREE.Scene()

  // Orthographic camera fitted to grid
  updateCamera(w, h)

  // Grid background dots
  createGridBackground()

  const maxInstances = props.gridCols * props.gridRows

  // Alive cells instanced mesh
  const cellGeo = new THREE.PlaneGeometry(CELL_DRAW_SIZE, CELL_DRAW_SIZE)
  const cellMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    depthWrite: false,
    transparent: false,
  })
  aliveMesh = new THREE.InstancedMesh(cellGeo, cellMat, maxInstances)
  aliveMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  aliveMesh.frustumCulled = false
  scene.add(aliveMesh)

  // Post-processing
  composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))

  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(w, h),
    0.65, // subtle but clear glow
    0.55, // medium spread
    0.6, // higher threshold = only bright cells glow
  )
  composer.addPass(bloomPass)
  composer.addPass(new OutputPass())

  // Initial render
  updateMesh()
}

function updateCamera(w: number, h: number) {
  const gridW = props.gridCols * CELL_SIZE
  const gridH = props.gridRows * CELL_SIZE
  const aspect = w / h
  const gridAspect = gridW / gridH

  if (aspect >= gridAspect) {
    // Fit by height
    viewHeight = gridH + CELL_SIZE * 2
    viewWidth = viewHeight * aspect
  } else {
    // Fit by width
    viewWidth = gridW + CELL_SIZE * 2
    viewHeight = viewWidth / aspect
  }

  if (camera) {
    camera.left = -viewWidth / 2
    camera.right = viewWidth / 2
    camera.top = viewHeight / 2
    camera.bottom = -viewHeight / 2
    camera.updateProjectionMatrix()
  } else {
    camera = new THREE.OrthographicCamera(
      -viewWidth / 2,
      viewWidth / 2,
      viewHeight / 2,
      -viewHeight / 2,
      0.1,
      100,
    )
    camera.position.z = 10
  }
}

function createGridBackground() {
  const dotSize = 1.2
  const dotGeo = new THREE.PlaneGeometry(dotSize, dotSize)
  const dotMat = new THREE.MeshBasicMaterial({
    color: 0x0d2145,
    depthWrite: false,
  })
  const totalDots = props.gridCols * props.gridRows
  gridMesh = new THREE.InstancedMesh(dotGeo, dotMat, totalDots)
  gridMesh.frustumCulled = false

  let i = 0
  for (let row = 0; row < props.gridRows; row++) {
    for (let col = 0; col < props.gridCols; col++) {
      const { x, y } = cellToWorld(col, row)
      dummy.position.set(x, y, -1)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      gridMesh.setMatrixAt(i++, dummy.matrix)
    }
  }
  gridMesh.instanceMatrix.needsUpdate = true
  scene.add(gridMesh)
}

// ──────────────────────────────────────────────────────
// Coordinate conversion
// ──────────────────────────────────────────────────────
function cellToWorld(col: number, row: number): { x: number; y: number } {
  const x = (col - props.gridCols / 2 + 0.5) * CELL_SIZE
  const y = (props.gridRows / 2 - row - 0.5) * CELL_SIZE
  return { x, y }
}

function worldToCell(wx: number, wy: number): { col: number; row: number } {
  const col = Math.floor(wx / CELL_SIZE + props.gridCols / 2)
  const row = Math.floor(props.gridRows / 2 - wy / CELL_SIZE)
  return { col, row }
}

function canvasToWorld(canvasX: number, canvasY: number): { wx: number; wy: number } {
  const canvas = canvasRef.value!
  const rect = canvas.getBoundingClientRect()
  const ndcX = ((canvasX - rect.left) / rect.width) * 2 - 1
  const ndcY = -((canvasY - rect.top) / rect.height) * 2 + 1
  const wx = (ndcX * viewWidth) / 2
  const wy = (ndcY * viewHeight) / 2
  return { wx, wy }
}

// ──────────────────────────────────────────────────────
// Mesh update
// ──────────────────────────────────────────────────────
function updateMesh() {
  if (!aliveMesh) return
  let count = 0
  const tick = Date.now() * 0.0005 // slow shimmer

  for (let row = 0; row < props.gridRows; row++) {
    for (let col = 0; col < props.gridCols; col++) {
      if (!props.grid[row * props.gridCols + col]) continue

      const { x, y } = cellToWorld(col, row)

      dummy.position.set(x, y, 0)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      aliveMesh.setMatrixAt(count, dummy.matrix)

      // Subtle per-cell shimmer based on position (no time-based wave to avoid overbloom)
      const shimmer = (Math.sin(col * 0.7 + row * 0.5 + tick) * 0.5 + 0.5) * 0.4
      tempColor.lerpColors(COLOR_ALIVE_DIM, COLOR_ALIVE_BRIGHT, 0.35 + shimmer)
      aliveMesh.setColorAt(count, tempColor)

      count++
    }
  }

  aliveMesh.count = count
  aliveMesh.instanceMatrix.needsUpdate = true
  if (aliveMesh.instanceColor) {
    aliveMesh.instanceColor.needsUpdate = true
  }
}

// ──────────────────────────────────────────────────────
// Render loop
// ──────────────────────────────────────────────────────
let rafId: number | null = null

function renderLoop() {
  rafId = requestAnimationFrame(renderLoop)
  updateMesh()
  composer.render()
}

// ──────────────────────────────────────────────────────
// Resize handler
// ──────────────────────────────────────────────────────
function handleResize() {
  const canvas = canvasRef.value
  if (!canvas || !renderer) return
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  if (w === 0 || h === 0) return

  renderer.setSize(w, h, false)
  composer.setSize(w, h)
  bloomPass.resolution.set(w, h)
  updateCamera(w, h)
}

// ──────────────────────────────────────────────────────
// Pointer interaction
// ──────────────────────────────────────────────────────
function getGridCell(clientX: number, clientY: number) {
  const { wx, wy } = canvasToWorld(clientX, clientY)
  return worldToCell(wx, wy)
}

function onMouseDown(e: MouseEvent) {
  if (!props.isDrawMode) return
  isPointerDown = true
  const { col, row } = getGridCell(e.clientX, e.clientY)
  if (col >= 0 && col < props.gridCols && row >= 0 && row < props.gridRows) {
    // Determine paint value from cell under cursor
    paintMode = props.grid[row * props.gridCols + col] ? 0 : 1
    emit('paintCell', col, row, paintMode)
    lastPaintedCol = col
    lastPaintedRow = row
  }
}

function onMouseMove(e: MouseEvent) {
  if (!props.isDrawMode || !isPointerDown) return
  const { col, row } = getGridCell(e.clientX, e.clientY)
  if (col === lastPaintedCol && row === lastPaintedRow) return
  if (col >= 0 && col < props.gridCols && row >= 0 && row < props.gridRows) {
    emit('paintCell', col, row, paintMode)
    lastPaintedCol = col
    lastPaintedRow = row
  }
}

function onMouseUp() {
  isPointerDown = false
  lastPaintedCol = -1
  lastPaintedRow = -1
}

function onTouchStart(e: TouchEvent) {
  if (!props.isDrawMode || !e.touches[0]) return
  isPointerDown = true
  const t = e.touches[0]
  const { col, row } = getGridCell(t.clientX, t.clientY)
  if (col >= 0 && col < props.gridCols && row >= 0 && row < props.gridRows) {
    paintMode = props.grid[row * props.gridCols + col] ? 0 : 1
    emit('paintCell', col, row, paintMode)
    lastPaintedCol = col
    lastPaintedRow = row
  }
}

function onTouchMove(e: TouchEvent) {
  if (!props.isDrawMode || !isPointerDown || !e.touches[0]) return
  const t = e.touches[0]
  const { col, row } = getGridCell(t.clientX, t.clientY)
  if (col === lastPaintedCol && row === lastPaintedRow) return
  if (col >= 0 && col < props.gridCols && row >= 0 && row < props.gridRows) {
    emit('paintCell', col, row, paintMode)
    lastPaintedCol = col
    lastPaintedRow = row
  }
}

// ──────────────────────────────────────────────────────
// Lifecycle
// ──────────────────────────────────────────────────────
let resizeObserver: ResizeObserver | null = null

onMounted(async () => {
  await nextTick()
  if (!canvasRef.value) return
  initThree()
  renderLoop()

  resizeObserver = new ResizeObserver(() => {
    handleResize()
  })
  if (canvasRef.value.parentElement) {
    resizeObserver.observe(canvasRef.value.parentElement)
  }
})

onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId)
  resizeObserver?.disconnect()
  renderer?.dispose()
  composer?.dispose()
})
</script>

<style scoped>
.game-canvas {
  display: block;
  width: 100%;
  height: 100%;
  outline: none;
  user-select: none;
  cursor: default;
}

.draw-cursor {
  cursor: crosshair;
}
</style>
