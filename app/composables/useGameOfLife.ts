export const GRID_COLS = 120
export const GRID_ROWS = 70

const MAX_HISTORY = 300

// Precomputed flat neighbor offsets for fast step() — initialized once at module level
const NEIGHBOR_OFFSETS = new Int32Array(GRID_COLS * GRID_ROWS * 8)
;(function initNeighborOffsets() {
  let k = 0
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue
          const nr = row + dr
          const nc = col + dc
          NEIGHBOR_OFFSETS[k++] = (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS)
            ? nr * GRID_COLS + nc
            : -1
        }
      }
    }
  }
})()

export function useGameOfLife() {
  const grid = ref<Uint8Array>(new Uint8Array(GRID_COLS * GRID_ROWS))
  const generation = ref(0)
  const isPlaying = ref(false)
  const isDrawMode = ref(false)
  const drawValue = ref<0 | 1>(1)
  const speed = ref(80) // ms per step
  const history = ref<Uint8Array[]>([])
  const aliveCellCount = ref(0)
  const aliveIndices = ref<Uint32Array>(new Uint32Array(0))

  // Internal animation state
  let animationFrame: number | null = null
  let lastStepTime = 0

  // ──────────────────────────────────────────────
  // Cell accessors
  // ──────────────────────────────────────────────
  function getCell(col: number, row: number): number {
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return 0
    return grid.value[row * GRID_COLS + col]
  }

  function rebuildAliveIndices() {
    const g = grid.value
    const count = aliveCellCount.value
    const indices = new Uint32Array(count)
    let j = 0
    for (let i = 0; i < g.length; i++) {
      if (g[i]) indices[j++] = i
    }
    aliveIndices.value = indices
  }

  // ──────────────────────────────────────────────
  // Simulation controls
  // ──────────────────────────────────────────────
  function step() {
    // Push snapshot to history
    const snapshot = new Uint8Array(grid.value)
    if (history.value.length >= MAX_HISTORY) {
      history.value.shift()
    }
    history.value.push(snapshot)

    // Apply Conway rules using precomputed neighbor offsets
    const g = grid.value
    const next = new Uint8Array(GRID_COLS * GRID_ROWS)
    const offsets = NEIGHBOR_OFFSETS
    let aliveCount = 0

    for (let i = 0; i < g.length; i++) {
      let n = 0
      const base = i * 8
      if (offsets[base]     >= 0) n += g[offsets[base]]
      if (offsets[base + 1] >= 0) n += g[offsets[base + 1]]
      if (offsets[base + 2] >= 0) n += g[offsets[base + 2]]
      if (offsets[base + 3] >= 0) n += g[offsets[base + 3]]
      if (offsets[base + 4] >= 0) n += g[offsets[base + 4]]
      if (offsets[base + 5] >= 0) n += g[offsets[base + 5]]
      if (offsets[base + 6] >= 0) n += g[offsets[base + 6]]
      if (offsets[base + 7] >= 0) n += g[offsets[base + 7]]

      const alive = g[i] === 1
      next[i] = alive ? (n === 2 || n === 3 ? 1 : 0) : (n === 3 ? 1 : 0)
      if (next[i]) aliveCount++
    }

    grid.value = next
    aliveCellCount.value = aliveCount
    generation.value++
    rebuildAliveIndices()
  }

  function stepBack() {
    if (history.value.length === 0) return
    grid.value = history.value.pop()!
    generation.value = Math.max(0, generation.value - 1)
    // Recalculate alive count from restored grid
    let count = 0
    const g = grid.value
    for (let i = 0; i < g.length; i++) {
      if (g[i]) count++
    }
    aliveCellCount.value = count
    rebuildAliveIndices()
  }

  // ──────────────────────────────────────────────
  // Drawing
  // ──────────────────────────────────────────────
  function toggleCell(col: number, row: number) {
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return
    const idx = row * GRID_COLS + col
    const wasAlive = grid.value[idx]
    const next = new Uint8Array(grid.value)
    next[idx] = wasAlive ? 0 : 1
    grid.value = next
    aliveCellCount.value += wasAlive ? -1 : 1
    rebuildAliveIndices()
  }

  function paintCell(col: number, row: number, value: 0 | 1) {
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return
    const idx = row * GRID_COLS + col
    if (grid.value[idx] === value) return
    const next = new Uint8Array(grid.value)
    next[idx] = value
    grid.value = next
    aliveCellCount.value += value ? 1 : -1
    rebuildAliveIndices()
  }

  // ──────────────────────────────────────────────
  // State manipulation
  // ──────────────────────────────────────────────
  function randomize(density = 0.28) {
    const next = new Uint8Array(GRID_COLS * GRID_ROWS)
    let aliveCount = 0
    for (let i = 0; i < next.length; i++) {
      const v = Math.random() < density ? 1 : 0
      next[i] = v
      if (v) aliveCount++
    }
    grid.value = next
    aliveCellCount.value = aliveCount
    history.value = []
    generation.value = 0
    rebuildAliveIndices()
  }

  function clear() {
    if (isPlaying.value) pause()
    grid.value = new Uint8Array(GRID_COLS * GRID_ROWS)
    aliveCellCount.value = 0
    history.value = []
    generation.value = 0
    rebuildAliveIndices()
  }

  // ──────────────────────────────────────────────
  // Import / Export
  // ──────────────────────────────────────────────
  function exportState(): string {
    const lines: string[] = []
    for (let row = 0; row < GRID_ROWS; row++) {
      let line = ''
      for (let col = 0; col < GRID_COLS; col++) {
        line += getCell(col, row) ? '1' : '0'
      }
      lines.push(line)
    }
    return lines.join('\n')
  }

  function importState(txt: string) {
    if (isPlaying.value) pause()
    const lines = txt.trim().split('\n')
    const next = new Uint8Array(GRID_COLS * GRID_ROWS)
    let aliveCount = 0
    for (let row = 0; row < Math.min(lines.length, GRID_ROWS); row++) {
      const line = lines[row].replace(/\r/g, '').trim()
      for (let col = 0; col < Math.min(line.length, GRID_COLS); col++) {
        const v = line[col] === '1' ? 1 : 0
        next[row * GRID_COLS + col] = v
        if (v) aliveCount++
      }
    }
    grid.value = next
    aliveCellCount.value = aliveCount
    history.value = []
    generation.value = 0
    rebuildAliveIndices()
  }

  // ──────────────────────────────────────────────
  // Playback
  // ──────────────────────────────────────────────
  function animate(timestamp: number) {
    if (!isPlaying.value) return
    if (timestamp - lastStepTime >= speed.value) {
      step()
      lastStepTime = timestamp
    }
    animationFrame = requestAnimationFrame(animate)
  }

  function play() {
    if (isPlaying.value) return
    isPlaying.value = true
    lastStepTime = performance.now()
    animationFrame = requestAnimationFrame(animate)
  }

  function pause() {
    isPlaying.value = false
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame)
      animationFrame = null
    }
  }

  function togglePlay() {
    isPlaying.value ? pause() : play()
  }

  // ──────────────────────────────────────────────
  // Computed
  // ──────────────────────────────────────────────
  const canStepBack = computed(() => history.value.length > 0)

  // Cleanup on unmount
  onUnmounted(() => {
    pause()
  })

  return {
    // State
    grid,
    generation,
    isPlaying,
    isDrawMode,
    drawValue,
    speed,
    canStepBack,
    aliveCellCount,
    aliveIndices,
    GRID_COLS,
    GRID_ROWS,
    // Actions
    step,
    stepBack,
    toggleCell,
    paintCell,
    randomize,
    clear,
    exportState,
    importState,
    togglePlay,
    play,
    pause,
  }
}
