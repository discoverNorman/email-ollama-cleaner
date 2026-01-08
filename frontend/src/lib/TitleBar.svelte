<script lang="ts">
  import { onMount } from 'svelte';

  let isElectron = false;
  let platform = 'unknown';
  let isMaximized = false;

  onMount(async () => {
    // Check if running in Electron
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      isElectron = await (window as any).electronAPI.isElectron();
      platform = (window as any).electronAPI.platform;

      // Get initial maximized state
      if (isElectron) {
        isMaximized = await (window as any).electronAPI.window.isMaximized();
      }
    }
  });

  async function minimize() {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      await (window as any).electronAPI.window.minimize();
    }
  }

  async function maximize() {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      await (window as any).electronAPI.window.maximize();
      isMaximized = await (window as any).electronAPI.window.isMaximized();
    }
  }

  async function close() {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      await (window as any).electronAPI.window.close();
    }
  }
</script>

{#if isElectron}
  <div class="titlebar" class:macos={platform === 'darwin'} class:windows={platform === 'win32'}>
    <!-- Draggable region -->
    <div class="titlebar-drag-region">
      <div class="titlebar-title">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
        <span>Email Ollama Cleaner</span>
      </div>
    </div>

    <!-- Window controls (right side for Windows/Linux) -->
    {#if platform !== 'darwin'}
      <div class="window-controls">
        <button
          class="window-button minimize"
          on:click={minimize}
          title="Minimize"
          aria-label="Minimize window"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="1" y="5.5" width="10" height="1" fill="currentColor"/>
          </svg>
        </button>

        <button
          class="window-button maximize"
          on:click={maximize}
          title={isMaximized ? "Restore" : "Maximize"}
          aria-label={isMaximized ? "Restore window" : "Maximize window"}
        >
          {#if isMaximized}
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect x="2.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1"/>
              <rect x="0.5" y="2.5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1"/>
            </svg>
          {:else}
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect x="0.5" y="0.5" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1"/>
            </svg>
          {/if}
        </button>

        <button
          class="window-button close"
          on:click={close}
          title="Close"
          aria-label="Close window"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M1 1 L11 11 M11 1 L1 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .titlebar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    z-index: 10000;
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(16, 185, 129, 0.1);
    user-select: none;
    -webkit-user-select: none;
    -webkit-app-region: drag;
  }

  .titlebar.macos {
    padding-left: 80px; /* Space for macOS traffic lights */
    justify-content: center;
  }

  .titlebar.windows {
    padding-left: 16px;
  }

  .titlebar-drag-region {
    flex: 1;
    display: flex;
    align-items: center;
    height: 100%;
  }

  .titlebar-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: #059669;
    opacity: 0.9;
  }

  .titlebar-title svg {
    width: 18px;
    height: 18px;
    opacity: 0.7;
  }

  .window-controls {
    display: flex;
    height: 100%;
    -webkit-app-region: no-drag;
  }

  .window-button {
    width: 46px;
    height: 100%;
    border: none;
    background: transparent;
    color: #374151;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    outline: none;
  }

  .window-button:hover {
    background: rgba(0, 0, 0, 0.05);
  }

  .window-button:active {
    background: rgba(0, 0, 0, 0.1);
  }

  .window-button.close:hover {
    background: #ef4444;
    color: white;
  }

  .window-button.close:active {
    background: #dc2626;
  }

  .window-button svg {
    pointer-events: none;
  }

  /* Dark theme support */
  @media (prefers-color-scheme: dark) {
    .titlebar {
      background: rgba(17, 24, 39, 0.8);
      border-bottom-color: rgba(16, 185, 129, 0.2);
    }

    .titlebar-title {
      color: #10b981;
    }

    .window-button {
      color: #d1d5db;
    }

    .window-button:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .window-button:active {
      background: rgba(255, 255, 255, 0.15);
    }
  }

  /* Glass morphism effect */
  .titlebar::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg,
      rgba(16, 185, 129, 0.03) 0%,
      rgba(16, 185, 129, 0.01) 100%);
    pointer-events: none;
  }

  /* Smooth animations */
  .window-button {
    transform: scale(1);
  }

  .window-button:active {
    transform: scale(0.95);
  }
</style>
