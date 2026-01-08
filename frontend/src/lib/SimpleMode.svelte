<script lang="ts">
  import { triggerScan, getStats, type Stats } from './api';

  let isScanning = false;
  let stats: Stats | null = null;
  let showResults = false;
  let scanComplete = false;

  // Load stats on mount
  async function loadStats() {
    try {
      stats = await getStats();
    } catch (e) {
      console.error('Failed to load stats:', e);
    }
  }

  loadStats();

  async function handleCheckEmails() {
    if (isScanning) return;

    isScanning = true;
    scanComplete = false;
    showResults = false;

    try {
      await triggerScan(50);
      await loadStats();
      scanComplete = true;
      showResults = true;
    } catch (error) {
      console.error('Scan failed:', error);
      alert('Something went wrong checking your emails. Please try again.');
    } finally {
      isScanning = false;
    }
  }

  function handleViewResults() {
    // Emit event to parent to switch to emails view
    window.dispatchEvent(new CustomEvent('switch-to-emails'));
  }

  function handleSettings() {
    // Emit event to parent to switch to settings
    window.dispatchEvent(new CustomEvent('switch-to-settings'));
  }
</script>

<div class="simple-mode">
  <!-- Header -->
  <div class="header">
    <div class="truck-icon">
      <svg width="80" height="80" viewBox="0 0 80 50">
        <rect x="12" y="14" width="40" height="24" rx="3" fill="#10b981"/>
        <path d="M52 14h16a4 4 0 014 4v18a2 2 0 01-2 2H52V14z" fill="#059669"/>
        <circle cx="24" cy="42" r="6" fill="#374151"/>
        <circle cx="60" cy="42" r="6" fill="#374151"/>
        <rect x="18" y="20" width="16" height="10" rx="1" fill="#818cf8"/>
      </svg>
    </div>
    <h1 class="title">Email Cleanup Helper</h1>
    <p class="subtitle">I'll help you clean up unwanted emails</p>
  </div>

  <!-- Main Action Area -->
  <div class="action-area">
    {#if !showResults}
      <!-- Main Button -->
      <button
        class="big-button primary"
        on:click={handleCheckEmails}
        disabled={isScanning}
      >
        {#if isScanning}
          <div class="spinner"></div>
          <span>Checking your emails...</span>
        {:else}
          <svg class="button-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="16" rx="2"/>
            <path d="M3 6l9 6 9-6"/>
          </svg>
          <span>Check My Emails</span>
        {/if}
      </button>

      <p class="help-text">
        Click the button above to check your emails for spam and newsletters
      </p>

      <!-- Stats Display -->
      {#if stats && stats.totalEmails > 0}
        <div class="stats-card">
          <h3>What I Found Last Time:</h3>
          <div class="stat-grid">
            <div class="stat-item keep">
              <div class="stat-number">{stats.keepCount}</div>
              <div class="stat-label">Important Emails</div>
            </div>
            <div class="stat-item newsletter">
              <div class="stat-number">{stats.newsletterCount}</div>
              <div class="stat-label">Newsletters</div>
            </div>
            <div class="stat-item spam">
              <div class="stat-number">{stats.spamCount}</div>
              <div class="stat-label">Spam</div>
            </div>
          </div>
        </div>
      {/if}

    {:else}
      <!-- Results View -->
      <div class="results">
        <div class="success-icon">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#10b981" stroke-width="2" fill="#d1fae5"/>
            <path d="M8 12l2 2 4-4" stroke="#10b981" stroke-width="3" stroke-linecap="round"/>
          </svg>
        </div>
        <h2 class="results-title">All Done!</h2>
        <p class="results-text">I've checked your emails and sorted them for you.</p>

        {#if stats}
          <div class="results-stats">
            <div class="result-item">
              <span class="result-emoji">✅</span>
              <span class="result-text"><strong>{stats.keepCount}</strong> important emails to keep</span>
            </div>
            <div class="result-item">
              <span class="result-emoji">📰</span>
              <span class="result-text"><strong>{stats.newsletterCount}</strong> newsletters</span>
            </div>
            <div class="result-item">
              <span class="result-emoji">🗑️</span>
              <span class="result-text"><strong>{stats.spamCount}</strong> spam emails</span>
            </div>
          </div>
        {/if}

        <button class="big-button secondary" on:click={handleViewResults}>
          <span>See What I Found</span>
        </button>

        <button class="text-button" on:click={() => showResults = false}>
          <span>Check Again</span>
        </button>
      </div>
    {/if}
  </div>

  <!-- Settings Button (Bottom) -->
  <div class="footer">
    <button class="settings-button" on:click={handleSettings}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 1v6m0 6v6M5.6 5.6l4.2 4.2m4.2 4.2l4.2 4.2M1 12h6m6 0h6M5.6 18.4l4.2-4.2m4.2-4.2l4.2-4.2"/>
      </svg>
      <span>Settings</span>
    </button>
  </div>
</div>

<style>
  .simple-mode {
    max-width: 800px;
    margin: 0 auto;
    padding: 60px 32px 32px;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* Header */
  .header {
    text-align: center;
    margin-bottom: 60px;
  }

  .truck-icon {
    margin: 0 auto 24px;
    animation: bounce 2s ease-in-out infinite;
  }

  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }

  .title {
    font-size: 42px;
    font-weight: 700;
    color: #1f2937;
    margin: 0 0 12px 0;
    line-height: 1.2;
  }

  .subtitle {
    font-size: 22px;
    color: #6b7280;
    margin: 0;
  }

  /* Action Area */
  .action-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 32px;
  }

  /* Big Button */
  .big-button {
    min-width: 400px;
    padding: 32px 48px;
    font-size: 28px;
    font-weight: 700;
    border: none;
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  }

  .big-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .big-button.primary {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
  }

  .big-button.primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 15px 50px rgba(16, 185, 129, 0.3);
  }

  .big-button.primary:active:not(:disabled) {
    transform: translateY(0);
  }

  .big-button.secondary {
    background: white;
    color: #10b981;
    border: 3px solid #10b981;
  }

  .big-button.secondary:hover {
    background: #f0fdf4;
  }

  .button-icon {
    flex-shrink: 0;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 4px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .help-text {
    font-size: 20px;
    color: #6b7280;
    text-align: center;
    max-width: 500px;
    line-height: 1.6;
  }

  /* Stats Card */
  .stats-card {
    background: white;
    border-radius: 20px;
    padding: 32px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    width: 100%;
    max-width: 600px;
  }

  .stats-card h3 {
    font-size: 24px;
    color: #374151;
    margin: 0 0 24px 0;
    text-align: center;
  }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }

  .stat-item {
    text-align: center;
    padding: 20px;
    border-radius: 12px;
  }

  .stat-item.keep {
    background: #d1fae5;
  }

  .stat-item.newsletter {
    background: #dbeafe;
  }

  .stat-item.spam {
    background: #fee2e2;
  }

  .stat-number {
    font-size: 36px;
    font-weight: 700;
    color: #1f2937;
  }

  .stat-label {
    font-size: 16px;
    color: #6b7280;
    margin-top: 8px;
  }

  /* Results */
  .results {
    text-align: center;
    max-width: 600px;
  }

  .success-icon {
    margin: 0 auto 24px;
    animation: scale-in 0.5s ease-out;
  }

  @keyframes scale-in {
    from {
      transform: scale(0);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  .results-title {
    font-size: 36px;
    font-weight: 700;
    color: #1f2937;
    margin: 0 0 16px 0;
  }

  .results-text {
    font-size: 22px;
    color: #6b7280;
    margin: 0 0 32px 0;
  }

  .results-stats {
    background: white;
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 32px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  }

  .result-item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    font-size: 20px;
  }

  .result-emoji {
    font-size: 32px;
  }

  .result-text {
    text-align: left;
    color: #374151;
  }

  .text-button {
    background: none;
    border: none;
    color: #10b981;
    font-size: 20px;
    font-weight: 600;
    cursor: pointer;
    padding: 16px;
    margin-top: 16px;
  }

  .text-button:hover {
    text-decoration: underline;
  }

  /* Footer */
  .footer {
    margin-top: 40px;
    text-align: center;
  }

  .settings-button {
    background: white;
    border: 2px solid #e5e7eb;
    border-radius: 12px;
    padding: 16px 32px;
    font-size: 18px;
    font-weight: 600;
    color: #6b7280;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 12px;
    transition: all 0.2s ease;
  }

  .settings-button:hover {
    background: #f9fafb;
    border-color: #10b981;
    color: #10b981;
  }

  /* Responsive */
  @media (max-width: 640px) {
    .simple-mode {
      padding: 40px 20px 20px;
    }

    .title {
      font-size: 32px;
    }

    .subtitle {
      font-size: 18px;
    }

    .big-button {
      min-width: 100%;
      font-size: 24px;
      padding: 24px 32px;
    }

    .stat-grid {
      grid-template-columns: 1fr;
      gap: 12px;
    }
  }
</style>
