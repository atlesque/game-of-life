<template>
  <div class="app-layout">
    <!-- Background decoration -->
    <div class="bg-decoration" aria-hidden="true">
      <div class="bg-orb bg-orb-1" />
      <div class="bg-orb bg-orb-2" />
      <div class="bg-orb bg-orb-3" />
    </div>

    <!-- Header -->
    <header class="app-header glass-panel">
      <div class="header-left">
        <div class="logo-mark">
          <span class="logo-icon">◈</span>
        </div>
        <div class="header-titles">
          <h1 class="app-title text-glow">Game of Life</h1>
          <p class="app-subtitle">Conway's Cellular Automaton</p>
        </div>
      </div>

      <div class="header-stats">
        <div class="stat-badge">
          <span class="stat-label">GEN</span>
          <span class="stat-value">{{ generation.toString().padStart(6, '0') }}</span>
        </div>
        <div class="stat-badge">
          <span class="stat-label">ALIVE</span>
          <span class="stat-value">{{ aliveCellCount.toLocaleString() }}</span>
        </div>
        <div class="stat-badge">
          <span class="stat-label">GRID</span>
          <span class="stat-value">{{ GRID_COLS }}×{{ GRID_ROWS }}</span>
        </div>
        <div
          class="status-indicator"
          :class="isPlaying ? 'status-playing' : 'status-paused'"
        >
          <span class="status-dot" />
          <span>{{ isPlaying ? 'RUNNING' : 'PAUSED' }}</span>
        </div>
      </div>
    </header>

    <!-- Main area -->
    <main class="app-main">
      <!-- Canvas container -->
      <div
        class="canvas-container glass-panel"
        :class="{ 'playing-indicator': isPlaying }"
      >
        <div class="scanlines" />
        <GameRenderer
          :grid="grid"
          :grid-cols="GRID_COLS"
          :grid-rows="GRID_ROWS"
          :is-draw-mode="isDrawMode"
          :is-playing="isPlaying"
          @paint-cell="handlePaintCell"
        />
        <!-- Draw mode overlay label -->
        <Transition name="fade">
          <div v-if="isDrawMode" class="draw-overlay-label">
            <span class="draw-icon">✎</span>
            <span>DRAW MODE — click/drag to paint cells</span>
          </div>
        </Transition>
      </div>

      <!-- Controls panel -->
      <aside class="controls-panel glass-panel">
        <!-- Playback controls -->
        <section class="control-section">
          <div class="section-label">PLAYBACK</div>
          <div class="control-row">
            <button
              class="aero-btn step-btn"
              :disabled="!canStepBack || isPlaying"
              title="Step backward (←)"
              @click="stepBack"
            >
              <span class="btn-icon">◀◀</span>
            </button>
            <button
              class="aero-btn aero-btn-primary play-btn"
              :class="{ 'aero-btn-active': isPlaying }"
              :title="isPlaying ? 'Pause (Space)' : 'Play (Space)'"
              @click="togglePlay"
            >
              <span class="btn-icon">{{ isPlaying ? '⏸' : '▶' }}</span>
              <span>{{ isPlaying ? 'Pause' : 'Play' }}</span>
            </button>
            <button
              class="aero-btn step-btn"
              :disabled="isPlaying"
              title="Step forward (→)"
              @click="step"
            >
              <span class="btn-icon">▶▶</span>
            </button>
          </div>
        </section>

        <div class="aero-divider-h" />

        <!-- Speed control -->
        <section class="control-section">
          <div class="section-label">SPEED — {{ speedLabel }}</div>
          <div class="control-row">
            <span class="speed-icon">⚡</span>
            <input
              v-model.number="speedMs"
              type="range"
              min="20"
              max="2000"
              step="10"
              class="speed-slider"
              :style="{ '--fill': `${speedFillPercent}%` }"
            />
            <span class="speed-icon">🐢</span>
          </div>
        </section>

        <div class="aero-divider-h" />

        <!-- Drawing tools -->
        <section class="control-section">
          <div class="section-label">TOOLS</div>
          <div class="control-row">
            <button
              class="aero-btn"
              :class="{ 'aero-btn-active': isDrawMode }"
              title="Toggle draw mode (D)"
              @click="toggleDrawMode"
            >
              <span>✎</span>
              <span>Draw</span>
            </button>
            <button
              class="aero-btn"
              title="Randomize grid (R)"
              @click="randomize()"
            >
              <span>⚄</span>
              <span>Random</span>
            </button>
            <button
              class="aero-btn aero-btn-danger"
              :disabled="isPlaying"
              title="Clear grid (C)"
              @click="clear()"
            >
              <span>⊘</span>
              <span>Clear</span>
            </button>
          </div>
        </section>

        <div class="aero-divider-h" />

        <!-- Import / Export -->
        <section class="control-section">
          <div class="section-label">STATE</div>
          <div class="control-row">
            <button
              class="aero-btn"
              title="Export state to .txt file"
              @click="handleExport"
            >
              <span>↑</span>
              <span>Export</span>
            </button>
            <button
              class="aero-btn"
              title="Import state from .txt file"
              @click="triggerImport"
            >
              <span>↓</span>
              <span>Import</span>
            </button>
            <input
              ref="fileInputRef"
              type="file"
              accept=".txt,text/plain"
              style="display: none"
              @change="handleImport"
            />
          </div>
        </section>

        <div class="aero-divider-h" />

        <!-- Density slider for random -->
        <section class="control-section">
          <div class="section-label">RANDOM DENSITY — {{ Math.round(density * 100) }}%</div>
          <div class="control-row">
            <span class="speed-icon">·</span>
            <input
              v-model.number="density"
              type="range"
              min="0.05"
              max="0.7"
              step="0.01"
              class="speed-slider"
              :style="{ '--fill': `${(density / 0.7) * 100}%` }"
            />
            <span class="speed-icon">▪</span>
          </div>
        </section>

        <div class="aero-divider-h" />

        <!-- Keyboard shortcuts -->
        <section class="control-section shortcuts-section">
          <div class="section-label">SHORTCUTS</div>
          <div class="shortcuts-grid">
            <kbd>Space</kbd><span>Play/Pause</span>
            <kbd>→</kbd><span>Step forward</span>
            <kbd>←</kbd><span>Step back</span>
            <kbd>R</kbd><span>Randomize</span>
            <kbd>C</kbd><span>Clear</span>
            <kbd>D</kbd><span>Draw mode</span>
          </div>
        </section>

        <!-- Footer info -->
        <div class="panel-footer">
          <span>Conway's Game of Life</span>
          <span class="footer-dot">◆</span>
          <span>Three.js + Nuxt 4</span>
        </div>
      </aside>
    </main>

    <!-- Toast for notifications -->
    <Transition name="toast">
      <div v-if="toastMessage" class="aero-toast glass-panel">
        {{ toastMessage }}
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
const {
  grid,
  generation,
  isPlaying,
  isDrawMode,
  speed,
  canStepBack,
  aliveCellCount,
  GRID_COLS,
  GRID_ROWS,
  step,
  stepBack,
  toggleCell,
  paintCell,
  randomize,
  clear,
  exportState,
  importState,
  togglePlay,
  pause,
} = useGameOfLife()

// ──────────────────────────────────────────────
// Local state
// ──────────────────────────────────────────────
const density = ref(0.28)
const fileInputRef = ref<HTMLInputElement>()
const toastMessage = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null

// ──────────────────────────────────────────────
// Speed control
// ──────────────────────────────────────────────
const speedMs = computed({
  get: () => speed.value,
  set: (v) => {
    speed.value = v
  },
})

const speedFillPercent = computed(() => {
  const min = 20
  const max = 2000
  const val = Math.max(min, Math.min(max, speed.value))
  // Left = fast (min ms), right = slow (max ms)
  return ((val - min) / (max - min)) * 100
})

const speedLabel = computed(() => {
  const fps = Math.round(1000 / speed.value)
  return `${fps} step/s`
})

// ──────────────────────────────────────────────
// Draw mode
// ──────────────────────────────────────────────
function toggleDrawMode() {
  if (isPlaying.value) pause()
  isDrawMode.value = !isDrawMode.value
}

function handlePaintCell(col: number, row: number, value: 0 | 1) {
  paintCell(col, row, value)
}

// ──────────────────────────────────────────────
// Import / Export
// ──────────────────────────────────────────────
function handleExport() {
  const txt = exportState()
  const blob = new Blob([txt], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `game-of-life-gen${generation.value}.txt`
  a.click()
  URL.revokeObjectURL(url)
  showToast('State exported!')
}

function triggerImport() {
  fileInputRef.value?.click()
}

async function handleImport(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const txt = await file.text()
    importState(txt)
    showToast(`Imported ${file.name}`)
  } catch {
    showToast('Failed to import file')
  }
  // Reset input so same file can be imported again
  input.value = ''
}

// ──────────────────────────────────────────────
// Toast notifications
// ──────────────────────────────────────────────
function showToast(message: string) {
  toastMessage.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastMessage.value = ''
  }, 2500)
}

// ──────────────────────────────────────────────
// Keyboard shortcuts
// ──────────────────────────────────────────────
function onKeyDown(e: KeyboardEvent) {
  // Don't fire if typing in an input
  if ((e.target as HTMLElement).tagName === 'INPUT') return

  switch (e.key) {
    case ' ':
      e.preventDefault()
      togglePlay()
      break
    case 'ArrowRight':
      if (!isPlaying.value) step()
      break
    case 'ArrowLeft':
      if (!isPlaying.value) stepBack()
      break
    case 'r':
    case 'R':
      randomize(density.value)
      break
    case 'c':
    case 'C':
      if (!isPlaying.value) clear()
      break
    case 'd':
    case 'D':
      toggleDrawMode()
      break
  }
}

// ──────────────────────────────────────────────
// Lifecycle
// ──────────────────────────────────────────────
onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  // Start with a random state
  randomize(density.value)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  if (toastTimer) clearTimeout(toastTimer)
})
</script>

<style scoped>
/* ─── Layout ───────────────────────────────── */
.app-layout {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--aero-bg-deep);
}

/* ─── Background orbs ───────────────────────── */
.bg-decoration {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.bg-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.18;
}

.bg-orb-1 {
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, #0288d1 0%, transparent 70%);
  top: -200px;
  left: -100px;
}

.bg-orb-2 {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, #006064 0%, transparent 70%);
  bottom: -150px;
  right: -100px;
}

.bg-orb-3 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, #01579b 0%, transparent 70%);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* ─── Header ──────────────────────────────── */
.app-header {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  margin: 8px 8px 0;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: rgba(79, 195, 247, 0.12);
  border: 1px solid var(--aero-border-bright);
  box-shadow: 0 0 12px rgba(79, 195, 247, 0.3);
}

.logo-icon {
  font-size: 18px;
  color: var(--aero-accent-bright);
  text-shadow: 0 0 10px var(--aero-glow);
}

.header-titles {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.app-title {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--aero-accent-bright);
  margin: 0;
  text-transform: uppercase;
}

.app-subtitle {
  font-size: 10px;
  color: var(--aero-text-dim);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin: 0;
}

.header-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.stat-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  background: rgba(6, 18, 42, 0.8);
  border: 1px solid var(--aero-border);
  border-radius: 20px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}

.stat-label {
  color: var(--aero-text-dim);
  letter-spacing: 0.06em;
}

.stat-value {
  color: var(--aero-accent);
  font-weight: 600;
}

.status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  border: 1px solid transparent;
  font-family: 'JetBrains Mono', monospace;
}

.status-playing {
  background: rgba(0, 229, 255, 0.12);
  border-color: rgba(0, 229, 255, 0.4);
  color: #00e5ff;
  animation: pulse-glow 2s ease-in-out infinite;
}

.status-paused {
  background: rgba(79, 195, 247, 0.06);
  border-color: rgba(79, 195, 247, 0.2);
  color: var(--aero-text-dim);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.status-playing .status-dot {
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  50% { opacity: 0; }
}

/* ─── Main area ──────────────────────────── */
.app-main {
  position: relative;
  z-index: 5;
  display: flex;
  flex: 1;
  gap: 8px;
  padding: 8px;
  overflow: hidden;
  min-height: 0;
}

/* ─── Canvas container ─────────────────────── */
.canvas-container {
  position: relative;
  flex: 1;
  overflow: hidden;
  min-width: 0;
  border-radius: 12px;
}

.draw-overlay-label {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  background: rgba(0, 229, 255, 0.12);
  border: 1px solid rgba(0, 229, 255, 0.3);
  border-radius: 20px;
  font-size: 11px;
  font-weight: 500;
  color: #00e5ff;
  letter-spacing: 0.06em;
  pointer-events: none;
  z-index: 10;
  white-space: nowrap;
}

.draw-icon {
  font-size: 14px;
}

/* ─── Controls panel ─────────────────────── */
.controls-panel {
  display: flex;
  flex-direction: column;
  gap: 0;
  width: 220px;
  flex-shrink: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0;
}

.control-section {
  padding: 12px 14px;
}

.section-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--aero-text-dim);
  text-transform: uppercase;
  margin-bottom: 8px;
  font-family: 'JetBrains Mono', monospace;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.aero-divider-h {
  height: 1px;
  background: var(--aero-border);
  margin: 0 14px;
  flex-shrink: 0;
}

/* Play button wider */
.play-btn {
  flex: 1;
  min-width: 70px;
}

/* Step buttons */
.step-btn {
  font-size: 10px;
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: -0.02em;
  padding: 8px 12px;
  min-width: 40px;
}

/* Button icon */
.btn-icon {
  font-size: 11px;
  line-height: 1;
}

/* Speed */
.speed-slider {
  flex: 1;
}

.speed-icon {
  font-size: 14px;
  color: var(--aero-text-dim);
  flex-shrink: 0;
}

/* Shortcuts */
.shortcuts-section {
  flex: 1;
}

.shortcuts-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 8px;
  align-items: center;
}

kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  padding: 2px 6px;
  background: rgba(6, 18, 42, 0.9);
  border: 1px solid var(--aero-border);
  border-radius: 4px;
  font-size: 10px;
  font-family: 'JetBrains Mono', monospace;
  color: var(--aero-accent);
  white-space: nowrap;
}

.shortcuts-grid span {
  font-size: 11px;
  color: var(--aero-text-dim);
}

/* Panel footer */
.panel-footer {
  padding: 10px 14px;
  font-size: 9px;
  color: rgba(179, 229, 252, 0.3);
  letter-spacing: 0.08em;
  display: flex;
  align-items: center;
  gap: 6px;
  border-top: 1px solid var(--aero-border);
  margin-top: auto;
  flex-shrink: 0;
}

.footer-dot {
  color: var(--aero-accent-dim);
  font-size: 6px;
}

/* ─── Toast ─────────────────────────────── */
.aero-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 20px;
  font-size: 13px;
  color: var(--aero-accent-bright);
  border-color: rgba(0, 229, 255, 0.3);
  background: rgba(0, 30, 60, 0.9);
  z-index: 1000;
  pointer-events: none;
  white-space: nowrap;
}

/* ─── Transitions ──────────────────────── */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}

/* ─── Responsive ──────────────────────── */
@media (max-width: 640px) {
  .app-header {
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }

  .header-stats {
    gap: 4px;
  }

  .controls-panel {
    width: 100%;
    max-height: 200px;
    flex-direction: row;
    flex-wrap: wrap;
    overflow-x: auto;
  }

  .app-main {
    flex-direction: column;
  }
}
</style>
