export const GRID_COLS = 120
export const GRID_ROWS = 70

const MAX_HISTORY = 300

export function useGameOfLife() {
  const grid = ref<Uint8Array>(new Uint8Array(GRID_COLS * GRID_ROWS))
  const generation = ref(0)
  const isPlaying = ref(false)
  const isDrawMode = ref(false)
  const drawValue = ref<0 | 1>(1)
  const speed = ref(80) // ms per step
  const history = ref<Uint8Array[]>([])

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

  function countNeighbors(col: number, row: number): number {
    let n = 0
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue
        n += getCell(col + dc, row + dr)
      }
    }
    return n
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

    // Apply Conway rules
    const next = new Uint8Array(GRID_COLS * GRID_ROWS)
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const alive = getCell(col, row)
        const neighbors = countNeighbors(col, row)
        if (alive) {
          next[row * GRID_COLS + col] = neighbors === 2 || neighbors === 3 ? 1 : 0
        } else {
          next[row * GRID_COLS + col] = neighbors === 3 ? 1 : 0
        }
      }
    }
    grid.value = next
    generation.value++
  }

  function stepBack() {
    if (history.value.length === 0) return
    grid.value = history.value.pop()!
    generation.value = Math.max(0, generation.value - 1)
  }

  // ──────────────────────────────────────────────
  // Drawing
  // ──────────────────────────────────────────────
  function toggleCell(col: number, row: number) {
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return
    const next = new Uint8Array(grid.value)
    next[row * GRID_COLS + col] = next[row * GRID_COLS + col] ? 0 : 1
    grid.value = next
  }

  function paintCell(col: number, row: number, value: 0 | 1) {
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return
    if (grid.value[row * GRID_COLS + col] === value) return
    const next = new Uint8Array(grid.value)
    next[row * GRID_COLS + col] = value
    grid.value = next
  }

  // ──────────────────────────────────────────────
  // State manipulation
  // ──────────────────────────────────────────────
  function randomize(density = 0.28) {
    const next = new Uint8Array(GRID_COLS * GRID_ROWS)
    for (let i = 0; i < next.length; i++) {
      next[i] = Math.random() < density ? 1 : 0
    }
    grid.value = next
    history.value = []
    generation.value = 0
  }

  function clear() {
    if (isPlaying.value) pause()
    grid.value = new Uint8Array(GRID_COLS * GRID_ROWS)
    history.value = []
    generation.value = 0
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
    for (let row = 0; row < Math.min(lines.length, GRID_ROWS); row++) {
      const line = lines[row].replace(/\r/g, '').trim()
      for (let col = 0; col < Math.min(line.length, GRID_COLS); col++) {
        next[row * GRID_COLS + col] = line[col] === '1' ? 1 : 0
      }
    }
    grid.value = next
    history.value = []
    generation.value = 0
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

  const aliveCellCount = computed(() => {
    let count = 0
    for (let i = 0; i < grid.value.length; i++) {
      if (grid.value[i]) count++
    }
    return count
  })

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
