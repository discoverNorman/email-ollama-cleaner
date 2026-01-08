<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    getHealth,
    getStats,
    getEmails,
    triggerScan,
    getPendingUnsubscribes,
    completeUnsubscribe,
    getSettings,
    updateSettings,
    getQueueStats,
    startQueue,
    stopQueue,
    clearQueue,
    getOllamaModels,
    pullOllamaModel,
    deleteOllamaModel,
    testPrompt,
    pingOllama,
    trashAllSpam,
    trashEmail,
    getImapProviders,
    getImapConfig,
    testImapConnection,
    saveImapConfig,
    getScanStatus,
    getImportStatus,
    startImport,
    clearLocalEmails,
    getEmailCount,
    classifyEmails,
    classifySingleEmail,
    getClassifyStatus,
    executeUnsubscribe,
    executeAllUnsubscribes,
    getModelConfig,
    type Stats,
    type Email,
    type UnsubscribeTask,
    type HealthStatus,
    type OllamaSettings,
    type QueueStats,
    type OllamaModel,
    type PingResult,
    type ImapProvider,
    type ImapConfig,
    type ScanStatus,
    type ImportStatus,
    type ModelConfig,
  } from './lib/api';

  // Core state
  let health: HealthStatus | null = $state(null);
  let stats: Stats | null = $state(null);
  let emailList: Email[] = $state([]);
  let unsubscribeTasks: UnsubscribeTask[] = $state([]);
  let activeTab: 'dashboard' | 'emails' | 'settings' = $state('dashboard');
  let showSettingsPopover = $state(false);
  let loading = $state(true);
  let scanning = $state(false);
  let classificationFilter: string = $state('');
  let loadingEmails = $state(false);
  let refreshingData = $state(false);

  // Charts
  let pieChart: any = $state(null);
  let lineChart: any = $state(null);

  // Settings state
  let settings: OllamaSettings | null = $state(null);
  let queueStats: QueueStats | null = $state(null);
  let models: OllamaModel[] = $state([]);
  let saving = $state(false);
  let testing = $state(false);
  let testResult: string = $state('');
  let testResultType: 'success' | 'error' | '' = $state('');

  // Unsubscribe state
  let unsubscribeAllRunning = $state(false);
  let unsubscribeProgress = $state({ current: 0, total: 0 });

  // Test email
  let testEmail = $state({
    fromAddr: 'newsletter@example.com',
    subject: 'Weekly Newsletter: Top Stories',
    bodyPreview: "Check out this week's top stories and updates from our team...",
  });

  // Model management
  let newModelName = $state('');
  let pullingModel = $state(false);
  let pullProgress = $state('');
  let deletingModel = $state<string | null>(null);

  // Connection test
  let pinging = $state(false);
  let pingResult: PingResult | null = $state(null);

  // Trash state
  let trashingSpam = $state(false);
  let trashingEmailId = $state<number | null>(null);

  // Classify state
  let classifyingEmailId = $state<number | null>(null);
  let clearingEmails = $state(false);

  // Email detail modal
  let selectedEmail: Email | null = $state(null);

  // Search, sort, and pagination
  let searchQuery = $state('');
  let sortColumn: 'fromAddr' | 'subject' | 'classification' | 'confidence' | 'date' = $state('date');
  let sortDirection: 'asc' | 'desc' = $state('desc');
  let currentPage = $state(1);
  let pageSize = $state(25);

  // Selection
  let selectedIds = $state<Set<number>>(new Set());
  let bulkActionRunning = $state(false);

  // Derived: filtered, sorted, and paginated emails
  let filteredEmails = $derived.by(() => {
    let result = [...emailList];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e =>
        e.fromAddr.toLowerCase().includes(q) ||
        e.subject.toLowerCase().includes(q) ||
        (e.bodyPreview?.toLowerCase().includes(q) ?? false)
      );
    }

    // Sort
    result.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortColumn) {
        case 'fromAddr': aVal = a.fromAddr.toLowerCase(); bVal = b.fromAddr.toLowerCase(); break;
        case 'subject': aVal = a.subject.toLowerCase(); bVal = b.subject.toLowerCase(); break;
        case 'classification': aVal = a.classification; bVal = b.classification; break;
        case 'confidence': aVal = a.confidence; bVal = b.confidence; break;
        case 'date': aVal = a.processedAt ?? 0; bVal = b.processedAt ?? 0; break;
        default: aVal = 0; bVal = 0;
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  });

  let totalPages = $derived(Math.ceil(filteredEmails.length / pageSize) || 1);
  let paginatedEmails = $derived(filteredEmails.slice((currentPage - 1) * pageSize, currentPage * pageSize));

  function toggleSort(column: typeof sortColumn) {
    if (sortColumn === column) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = column;
      sortDirection = 'asc';
    }
    currentPage = 1;
  }

  // Toast notifications
  let toasts: Array<{ id: number; message: string; type: 'success' | 'error' | 'info' }> = $state([]);
  let toastId = 0;

  // EULA state
  let eulaAccepted = $state(localStorage.getItem('eula_accepted') === 'true');

  function acceptEula() {
    localStorage.setItem('eula_accepted', 'true');
    eulaAccepted = true;
  }

  // Setup Wizard state
  let showSetupWizard = $state(false);
  let wizardStep = $state(1); // 1=provider, 2=credentials, 3=test, 4=done
  let imapProviders: ImapProvider[] = $state([]);
  let imapConfig: ImapConfig | null = $state(null);
  let wizardData = $state({
    provider: 'gmail',
    host: '',
    port: 993,
    user: '',
    password: '',
  });
  let wizardTesting = $state(false);
  let wizardTestResult: { success: boolean; error?: string; mailboxCount?: number } | null = $state(null);
  let wizardSaving = $state(false);

  // Scan Status
  let scanStatus: ScanStatus | null = $state(null);
  let scanStatusInterval: ReturnType<typeof setInterval> | null = null;

  // Import Status
  let showImportModal = $state(false);
  let importStatus: ImportStatus | null = $state(null);
  let importStatusInterval: ReturnType<typeof setInterval> | null = null;
  let importing = $state(false);

  // Spam Pickup Animation
  interface SpamPickup {
    id: number;
    subject: string;
    from: string;
    phase: 'appear' | 'shake' | 'pickup' | 'done';
  }
  let spamPickups: SpamPickup[] = $state([]);
  let spamPickupId = 0;

  // Tab indicator
  let tabIndicatorStyle = $state('left: 0; width: 0;');

  let refreshInterval: ReturnType<typeof setInterval> | null = null;

  function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    const id = ++toastId;
    toasts = [...toasts, { id, message, type }];
    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
    }, 4000);
  }

  // Trigger spam pickup animation
  function triggerSpamPickup(subject: string, from: string) {
    const id = ++spamPickupId;
    const pickup: SpamPickup = { id, subject, from, phase: 'appear' };
    spamPickups = [...spamPickups, pickup];

    // Phase transitions
    setTimeout(() => {
      spamPickups = spamPickups.map(p => p.id === id ? { ...p, phase: 'shake' } : p);
    }, 500);

    setTimeout(() => {
      spamPickups = spamPickups.map(p => p.id === id ? { ...p, phase: 'pickup' } : p);
    }, 900);

    setTimeout(() => {
      spamPickups = spamPickups.filter(p => p.id !== id);
    }, 2500);
  }

  onMount(async () => {
    await refreshData();
    await loadSettings();

    // Check if IMAP is configured
    imapConfig = await getImapConfig();
    imapProviders = await getImapProviders();

    // Show setup wizard if IMAP not configured and EULA accepted
    if (!imapConfig.configured && eulaAccepted) {
      showSetupWizard = true;
    }

    loading = false;
    updateTabIndicator();

    // Hide the initial HTML loader (shows instantly before JS loads)
    if (typeof window !== 'undefined' && (window as any).hideInitialLoader) {
      (window as any).hideInitialLoader();
    }

    // Check if classification job is already running (survives page refresh)
    const jobStatus = await getClassifyStatus();
    if (jobStatus.running) {
      showToast('Classification in progress...', 'info');
      startClassifyPolling();
    }

    refreshInterval = setInterval(async () => {
      if (activeTab === 'settings' && queueStats) {
        queueStats = await getQueueStats();
      }
    }, 2000);
  });

  onDestroy(() => {
    if (refreshInterval) clearInterval(refreshInterval);
    if (scanStatusInterval) clearInterval(scanStatusInterval);
    if (importStatusInterval) clearInterval(importStatusInterval);
  });

  // Wizard functions
  function selectProvider(providerId: string) {
    const provider = imapProviders.find(p => p.id === providerId);
    wizardData.provider = providerId;
    if (provider && provider.host) {
      wizardData.host = provider.host;
      wizardData.port = provider.port;
    }
    wizardTestResult = null;
  }

  async function testWizardConnection() {
    wizardTesting = true;
    wizardTestResult = null;
    wizardTestResult = await testImapConnection(wizardData);
    wizardTesting = false;
  }

  async function saveWizardConfig() {
    wizardSaving = true;
    await saveImapConfig(wizardData);
    imapConfig = await getImapConfig();
    wizardSaving = false;
    wizardStep = 4;
    showToast('Email connected successfully!', 'success');
  }

  function closeWizard() {
    showSetupWizard = false;
    wizardStep = 1;
    wizardTestResult = null;
  }

  function openWizard() {
    wizardStep = 1;
    wizardTestResult = null;
    showSetupWizard = true;
  }

  async function refreshData() {
    refreshingData = true;
    try {
      [health, stats] = await Promise.all([getHealth(), getStats()]);
      await Promise.all([loadEmails(), loadUnsubscribeTasks()]);
      setTimeout(updateCharts, 100);
    } finally {
      refreshingData = false;
    }
  }

  async function loadEmails() {
    loadingEmails = true;
    try {
      // Fetch all emails (high limit) - client-side pagination handles display
      emailList = await getEmails(classificationFilter || undefined, 10000);
    } finally {
      loadingEmails = false;
    }
  }

  async function loadUnsubscribeTasks() {
    unsubscribeTasks = await getPendingUnsubscribes();
  }

  async function loadSettings() {
    [settings, queueStats, models] = await Promise.all([getSettings(), getQueueStats(), getOllamaModels()]);
  }

  async function handleScan() {
    // Check if we have emails to classify
    const { count } = await getEmailCount();

    if (count === 0) {
      // No emails - need to import first
      showToast('No emails to classify. Importing from Gmail...', 'info');
      await handleImport();

      // Wait for import to complete
      while (importing) {
        await new Promise(r => setTimeout(r, 500));
      }

      // Reload emails
      await loadEmails();

      if (emailList.length === 0) {
        showToast('No emails found to classify', 'info');
        return;
      }
    }

    // Get only UNCLASSIFIED email IDs in the order they appear in the grid
    // This prevents reprocessing already-classified emails
    const unknownEmails = filteredEmails.filter(e => e.classification === 'unknown');
    const emailIds = unknownEmails.map(e => e.id);

    if (emailIds.length === 0) {
      const alreadyClassified = filteredEmails.length - unknownEmails.length;
      if (alreadyClassified > 0) {
        showToast(`All ${alreadyClassified} emails already classified`, 'info');
      } else {
        showToast('No emails to classify', 'info');
      }
      return;
    }

    // Start the background job
    const startResult = await classifyEmails(emailIds);

    if (startResult.status === 'already_running') {
      showToast('Classification already in progress', 'info');
    } else if (startResult.status === 'started') {
      const skipped = filteredEmails.length - emailIds.length;
      const msg = skipped > 0
        ? `Started classifying ${emailIds.length} emails (${skipped} already classified)`
        : `Started classifying ${emailIds.length} emails...`;
      showToast(msg, 'info');
    }

    // Start polling for status
    startClassifyPolling();
  }

  function startClassifyPolling() {
    if (scanStatusInterval) return; // Already polling

    scanning = true;
    scanStatus = { active: true, phase: 'starting', current: 0, total: 0 };

    let lastProcessed = 0;
    let lastSpamCount = stats?.spamCount || 0;
    scanStatusInterval = setInterval(async () => {
      // Check scan status for progress
      scanStatus = await getScanStatus();

      // Refresh email list when progress changes
      if (scanStatus && scanStatus.current !== lastProcessed) {
        lastProcessed = scanStatus.current;
        const newEmails = await getEmails(classificationFilter || undefined, 10000);

        // Check if new spam was detected - trigger pickup animation!
        const newSpamEmails = newEmails.filter(e => e.classification === 'spam');
        if (newSpamEmails.length > lastSpamCount) {
          // Find the newest spam email and show pickup animation
          const newestSpam = newSpamEmails[0]; // Most recent first
          if (newestSpam) {
            triggerSpamPickup(
              newestSpam.subject?.slice(0, 40) || 'Spam email',
              newestSpam.fromAddr?.split('@')[0] || 'Unknown'
            );
          }
          lastSpamCount = newSpamEmails.length;
        }

        emailList = newEmails;
      }

      // Check if job completed
      const jobStatus = await getClassifyStatus();
      if (!jobStatus.running && jobStatus.result) {
        // Job finished
        if (scanStatusInterval) {
          clearInterval(scanStatusInterval);
          scanStatusInterval = null;
        }
        scanStatus = null;
        scanning = false;
        await refreshData();

        if (jobStatus.result.status === 'completed') {
          showToast(`Classified ${jobStatus.result.emailsProcessed} emails`, 'success');
        } else {
          showToast('Classification failed', 'error');
        }
      }
    }, 500);
  }

  async function handleClearLocalEmails() {
    if (!confirm('Clear all local emails? This will not delete them from Gmail.')) {
      return;
    }

    clearingEmails = true;
    try {
      await clearLocalEmails();
      await refreshData();
      showToast('Local emails cleared', 'success');
    } catch (e) {
      showToast('Failed to clear emails', 'error');
    }
    clearingEmails = false;
  }

  // Selection helpers
  function toggleSelectAll() {
    if (selectedIds.size === paginatedEmails.length) {
      selectedIds = new Set();
    } else {
      selectedIds = new Set(paginatedEmails.map(e => e.id));
    }
  }

  function toggleSelect(id: number) {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    selectedIds = newSet;
  }

  function selectAllFiltered() {
    selectedIds = new Set(filteredEmails.map(e => e.id));
  }

  function clearSelection() {
    selectedIds = new Set();
  }

  // Bulk actions
  async function bulkTrash() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Move ${selectedIds.size} email(s) to trash?`)) return;

    bulkActionRunning = true;
    let successCount = 0;

    for (const id of selectedIds) {
      try {
        const result = await trashEmail(id);
        if (result.status === 'trashed') successCount++;
      } catch {}
    }

    await refreshData();
    showToast(`Trashed ${successCount} email(s)`, 'success');
    selectedIds = new Set();
    bulkActionRunning = false;
  }

  async function bulkClassify() {
    if (selectedIds.size === 0) return;

    // Filter to only unknown (unclassified) emails - never reprocess
    const selectedEmails = emailList.filter(e => selectedIds.has(e.id));
    const unknownEmails = selectedEmails.filter(e => e.classification === 'unknown');
    const ids = unknownEmails.map(e => e.id);

    if (ids.length === 0) {
      const skipped = selectedIds.size - ids.length;
      showToast(`All ${skipped} selected emails already classified`, 'info');
      selectedIds = new Set();
      return;
    }

    selectedIds = new Set(); // Clear selection

    const startResult = await classifyEmails(ids);

    if (startResult.status === 'already_running') {
      showToast('Classification already in progress', 'info');
    } else if (startResult.status === 'started') {
      const skipped = selectedEmails.length - ids.length;
      const msg = skipped > 0
        ? `Started classifying ${ids.length} emails (${skipped} already classified)`
        : `Started classifying ${ids.length} emails...`;
      showToast(msg, 'info');
    }

    startClassifyPolling();
  }

  async function handleImport() {
    showImportModal = true;
    importing = true;
    importStatus = {
      active: true,
      phase: 'Starting...',
      currentFolder: '',
      foldersProcessed: 0,
      totalFolders: 0,
      emailsFound: 0,
      emailsImported: 0,
      duplicatesSkipped: 0,
    };

    // Start the import
    const result = await startImport();
    if (result.error) {
      importStatus = {
        ...importStatus!,
        active: false,
        phase: 'Error',
        error: result.error,
      };
      importing = false;
      showToast(`Import failed: ${result.error}`, 'error');
      return;
    }

    // Start polling import status
    importStatusInterval = setInterval(async () => {
      importStatus = await getImportStatus();

      // Check if complete
      if (importStatus && !importStatus.active) {
        if (importStatusInterval) {
          clearInterval(importStatusInterval);
          importStatusInterval = null;
        }
        importing = false;

        if (importStatus.phase === 'Complete') {
          showToast(`Imported ${importStatus.emailsImported} emails`, 'success');
          await refreshData();
        } else if (importStatus.error) {
          showToast(`Import failed: ${importStatus.error}`, 'error');
        }
      }
    }, 500);
  }

  function closeImportModal() {
    showImportModal = false;
    if (!importing) {
      importStatus = null;
    }
  }

  async function handleCompleteUnsubscribe(taskId: number) {
    await completeUnsubscribe(taskId);
    await loadUnsubscribeTasks();
    stats = await getStats();
    showToast('Marked as complete', 'success');
  }

  async function handleExecuteUnsubscribe(taskId: number) {
    try {
      const result = await executeUnsubscribe(taskId);
      await loadUnsubscribeTasks();
      stats = await getStats();
      if (result.success) {
        showToast(`Unsubscribed from ${result.taskId}`, 'success');
      } else {
        showToast(result.explanation || 'Unsubscribe failed', 'error');
      }
    } catch (e) {
      showToast('Failed to execute unsubscribe', 'error');
    }
  }

  async function handleUnsubscribeAll() {
    if (unsubscribeTasks.length === 0) {
      showToast('No pending unsubscribes', 'info');
      return;
    }

    if (!confirm(`Automatically unsubscribe from ${unsubscribeTasks.length} newsletter(s)? This will attempt to click unsubscribe links.`)) {
      return;
    }

    unsubscribeAllRunning = true;
    unsubscribeProgress = { current: 0, total: unsubscribeTasks.length };

    try {
      const result = await executeAllUnsubscribes();
      await loadUnsubscribeTasks();
      stats = await getStats();

      if (result.successful > 0 || result.failed > 0) {
        showToast(`Unsubscribed: ${result.successful} successful, ${result.failed} failed`, result.failed > 0 ? 'info' : 'success');
      } else {
        showToast('No unsubscribes to process', 'info');
      }
    } catch (e) {
      showToast('Failed to execute unsubscribes', 'error');
    } finally {
      unsubscribeAllRunning = false;
    }
  }

  async function handleSaveSettings() {
    if (!settings) return;
    saving = true;
    await updateSettings(settings);
    queueStats = await getQueueStats();
    saving = false;
    showToast('Settings saved', 'success');
  }

  async function handleStartQueue() {
    await startQueue();
    queueStats = await getQueueStats();
    showToast('Workers started', 'success');
  }

  async function handleStopQueue() {
    await stopQueue();
    queueStats = await getQueueStats();
    showToast('Workers stopped', 'info');
  }

  async function handleClearQueue(status?: 'completed' | 'failed') {
    await clearQueue(status);
    queueStats = await getQueueStats();
    showToast('Queue cleared', 'success');
  }

  async function handleTestPrompt() {
    testing = true;
    testResult = '';
    testResultType = '';
    try {
      const result = await testPrompt(testEmail);
      if (result.error) {
        testResultType = 'error';
        let errorOutput = `ERROR: ${result.error}`;
        if (result.details) errorOutput += `\n\nDetails: ${result.details}`;
        if (result.rawError && result.rawError !== result.error) errorOutput += `\n\nRaw: ${result.rawError}`;
        errorOutput += `\n\nHost: ${result.host ?? 'unknown'}\nModel: ${result.model ?? 'unknown'}`;
        testResult = errorOutput;
      } else if (result.parsed) {
        testResultType = 'success';
        const parsed = result.parsed as { classification?: string; confidence?: number; reasoning?: string };
        testResult = `CLASSIFICATION: ${parsed.classification ?? 'unknown'}
Confidence: ${((parsed.confidence ?? 0) * 100).toFixed(0)}%
Reasoning: ${parsed.reasoning ?? 'N/A'}

Host: ${result.host ?? 'unknown'}
Model: ${result.model ?? 'unknown'}

${JSON.stringify(result.parsed, null, 2)}`;
      } else if (result.raw) {
        testResultType = 'success';
        testResult = `Raw Response:\n${result.raw}`;
      } else {
        testResultType = 'error';
        testResult = 'No response received';
      }
    } catch (e) {
      testResultType = 'error';
      testResult = `Network Error: ${e}`;
    }
    testing = false;
  }

  async function handlePullModel() {
    if (!newModelName.trim()) return;
    pullingModel = true;
    pullProgress = 'Starting download...';
    showToast(`Pulling ${newModelName}...`, 'info');

    try {
      const result = await pullOllamaModel(newModelName.trim());
      if (result.error) {
        pullProgress = `Error: ${result.error}`;
        showToast('Download failed', 'error');
      } else {
        pullProgress = '';
        newModelName = '';
        models = await getOllamaModels();
        showToast('Model downloaded successfully', 'success');
      }
    } catch (e) {
      pullProgress = `Error: ${e}`;
      showToast('Download failed', 'error');
    }
    pullingModel = false;
  }

  async function handleDeleteModel(name: string) {
    if (!confirm(`Delete model "${name}"?`)) return;
    deletingModel = name;
    try {
      const result = await deleteOllamaModel(name);
      if (result.error) {
        showToast(`Error: ${result.error}`, 'error');
      } else {
        models = await getOllamaModels();
        showToast('Model deleted', 'success');
      }
    } catch (e) {
      showToast(`Error: ${e}`, 'error');
    }
    deletingModel = null;
  }

  async function handlePingOllama() {
    pinging = true;
    pingResult = null;
    pingResult = await pingOllama();
    pinging = false;
    if (pingResult.connected) {
      models = await getOllamaModels();
      showToast('Connected to Ollama', 'success');
    } else {
      showToast('Connection failed', 'error');
    }
  }

  async function handleTrashAllSpam() {
    if (!confirm(`Move all ${stats?.spamCount ?? 0} spam emails to trash?`)) return;
    trashingSpam = true;
    showToast('Moving spam to trash...', 'info');
    try {
      const result = await trashAllSpam();
      showToast(`Moved ${result.trashedCount} emails to trash`, 'success');
      await refreshData();
    } catch (e) {
      showToast('Failed to trash spam', 'error');
    }
    trashingSpam = false;
  }

  async function handleTrashEmail(emailId: number) {
    trashingEmailId = emailId;
    try {
      const result = await trashEmail(emailId);
      if (result.status === 'trashed') {
        showToast('Email moved to trash', 'success');
        await loadEmails();
        stats = await getStats();
      } else {
        showToast(result.error || 'Failed', 'error');
      }
    } catch (e) {
      showToast('Failed to trash email', 'error');
    }
    trashingEmailId = null;
  }

  async function handleClassifySingle(emailId: number) {
    const email = emailList.find(e => e.id === emailId);
    if (!email) return;

    if (email.classification !== 'unknown') {
      showToast('Email already classified', 'info');
      return;
    }

    classifyingEmailId = emailId;

    // Immediately show scanning state with this email
    scanning = true;
    scanStatus = {
      active: true,
      phase: 'Classifying...',
      current: 0,
      total: 1,
      currentEmail: email.subject?.slice(0, 60) ?? '',
      currentEmailFrom: email.fromAddr,
      currentEmailId: emailId,
      concurrency: 1,
    };

    // Poll for server status updates while classifying
    const statusPoll = setInterval(async () => {
      const serverStatus = await getScanStatus();
      if (serverStatus.active) {
        scanStatus = serverStatus;
      }
    }, 200);

    try {
      // Use synchronous single-email endpoint (immediate priority)
      const result = await classifySingleEmail(emailId);

      if (result.status === 'classified') {
        // Update status to show completion
        scanStatus = {
          active: true,
          phase: 'Complete!',
          current: 1,
          total: 1,
          currentEmail: email.subject?.slice(0, 60) ?? '',
          currentEmailFrom: email.fromAddr,
          currentEmailId: emailId,
          concurrency: 1,
        };
        showToast(`Classified as ${result.classification}`, 'success');
        await loadEmails();
      } else if (result.status === 'already_classified') {
        showToast('Email already classified', 'info');
      } else {
        showToast(result.message || 'Classification failed', 'error');
      }
    } catch (e) {
      showToast('Failed to classify email', 'error');
    } finally {
      clearInterval(statusPoll);
      classifyingEmailId = null;
      // Brief delay before hiding status bar
      setTimeout(() => {
        scanning = false;
        scanStatus = null;
      }, 500);
    }
  }

  function handleTabChange(tab: 'dashboard' | 'emails' | 'settings') {
    activeTab = tab;
    if (tab === 'settings') {
      loadSettings();
    } else if (tab === 'emails') {
      loadUnsubscribeTasks();
    }
    setTimeout(updateTabIndicator, 0);
  }

  function toggleSettingsPopover() {
    showSettingsPopover = !showSettingsPopover;
    if (showSettingsPopover) {
      loadSettings();
    }
  }

  async function handleQuickModelChange(modelName: string) {
    if (!settings) return;
    await applyModelConfig(modelName);
    showToast(`Switched to ${modelName} with optimal settings`, 'success');
  }

  // Apply optimal settings for a model
  async function applyModelConfig(modelName: string) {
    if (!settings) return;

    try {
      const cfg = await getModelConfig(modelName);

      // Update local state
      settings.ollama_model = modelName;
      settings.ollama_prompt = cfg.prompt;
      settings.worker_count = String(cfg.workers);

      // Save all settings at once
      await updateSettings({
        ollama_model: modelName,
        ollama_prompt: cfg.prompt,
        worker_count: String(cfg.workers),
      });

      // Refresh queue stats to reflect new worker count
      queueStats = await getQueueStats();
    } catch (err) {
      console.error('Failed to apply model config:', err);
      // Fallback: just update the model name
      settings.ollama_model = modelName;
      await updateSettings({ ollama_model: modelName });
    }
  }

  function updateTabIndicator() {
    const tabs = document.querySelectorAll('[data-tab]');
    const activeTabEl = document.querySelector(`[data-tab="${activeTab}"]`) as HTMLElement;
    if (activeTabEl) {
      tabIndicatorStyle = `left: ${activeTabEl.offsetLeft}px; width: ${activeTabEl.offsetWidth}px;`;
    }
  }

  function updateCharts() {
    if (!stats) return;
    const pieCtx = document.getElementById('pieChart') as HTMLCanvasElement;
    const lineCtx = document.getElementById('lineChart') as HTMLCanvasElement;
    if (!pieCtx || !lineCtx) return;

    if (pieChart) pieChart.destroy();
    if (lineChart) lineChart.destroy();

    // @ts-ignore
    pieChart = new Chart(pieCtx, {
      type: 'doughnut',
      data: {
        labels: ['Spam', 'Newsletter', 'Keep'],
        datasets: [
          {
            data: [stats.spamCount, stats.newsletterCount, stats.keepCount],
            backgroundColor: ['#f87171', '#fbbf24', '#34d399'],
            borderWidth: 0,
            hoverOffset: 8,
          },
        ],
      },
      options: {
        responsive: true,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 20,
              usePointStyle: true,
              pointStyle: 'circle',
              font: { family: "'SF Pro Text', sans-serif", size: 12 },
            },
          },
        },
        animation: {
          animateRotate: true,
          animateScale: true,
        },
      },
    });

    const dates = Object.keys(stats.emailsByDate).sort().slice(-7);
    const counts = dates.map((d) => stats!.emailsByDate[d]);

    // @ts-ignore
    lineChart = new Chart(lineCtx, {
      type: 'line',
      data: {
        labels: dates.map((d) => new Date(d).toLocaleDateString('en-US', { weekday: 'short' })),
        datasets: [
          {
            label: 'Emails',
            data: counts,
            borderColor: '#818cf8',
            backgroundColor: 'rgba(129, 140, 248, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#fff',
            pointBorderColor: '#818cf8',
            pointBorderWidth: 2,
            pointHoverRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: { font: { size: 11 } },
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 } },
          },
        },
        animation: {
          duration: 1000,
          easing: 'easeOutQuart',
        },
      },
    });
  }

  function formatDate(dateValue: number | Date | null): string {
    if (!dateValue) return '-';
    // Handle both Unix timestamps (seconds) and Date objects
    const date = typeof dateValue === 'number'
      ? new Date(dateValue * 1000)
      : new Date(dateValue);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  function formatBytes(bytes: number): string {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  }

  function getBadgeClass(classification: string): string {
    switch (classification) {
      case 'spam': return 'badge badge-spam';
      case 'newsletter': return 'badge badge-newsletter';
      case 'keep': return 'badge badge-keep';
      default: return 'badge badge-unknown';
    }
  }
</script>

<div class="min-h-screen relative z-10">
  <!-- EULA Modal -->
  {#if !eulaAccepted}
    <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-scale-in">
        <div class="p-6 bg-gradient-to-br from-emerald-500 to-green-600 text-white text-center">
          <svg viewBox="0 0 48 48" class="w-16 h-16 mx-auto mb-3">
            <rect x="8" y="22" width="28" height="14" rx="2" fill="#fff"/>
            <path d="M36 22h6a2 2 0 012 2v10a2 2 0 01-2 2h-6v-14z" fill="#fef3c7"/>
            <circle cx="16" cy="38" r="4" fill="#374151"/>
            <circle cx="32" cy="38" r="4" fill="#374151"/>
            <rect x="14" y="26" width="16" height="10" rx="1" fill="#818cf8"/>
            <path d="M14 27l8 5 8-5" stroke="#fff" stroke-width="1.5" fill="none"/>
            <rect x="6" y="18" width="32" height="4" rx="1" fill="#6ee7b7"/>
          </svg>
          <h2 class="text-xl font-bold">Norman's Email Trash Hauling</h2>
          <p class="text-emerald-100 text-sm mt-1">Terms of Service</p>
        </div>
        <div class="p-6">
          <div class="text-sm text-gray-600 space-y-3 max-h-48 overflow-y-auto">
            <p class="font-semibold text-gray-900">BY USING THIS SOFTWARE, YOU AGREE:</p>
            <p>This software is provided <strong>"AS IS"</strong> without warranty of any kind, express or implied.</p>
            <p><strong>WARNING:</strong> This application can permanently delete emails from your inbox. Use at your own risk.</p>
            <p>The developer(s) shall not be liable for any damages, data loss, or deleted emails resulting from the use of this software.</p>
            <p>You acknowledge that email deletion is <strong>irreversible</strong> and accept full responsibility for any actions taken by this application.</p>
            <p class="text-xs text-gray-400 pt-2 border-t">By clicking "I Accept" you agree to these terms and waive any claims against the developer(s).</p>
          </div>
          <button
            onclick={acceptEula}
            class="w-full mt-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold hover:from-emerald-600 hover:to-green-700 transition-all shadow-lg"
          >
            I Accept - Let's Haul Some Trash!
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Setup Wizard Modal -->
  {#if showSetupWizard && eulaAccepted}
    <div class="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden animate-scale-in">
        <!-- Header -->
        <div class="p-6 bg-gradient-to-br from-emerald-500 to-green-600 text-white">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-xl font-bold">Connect Your Email</h2>
              <p class="text-emerald-100 text-sm mt-1">Step {wizardStep} of 4</p>
            </div>
            <button onclick={closeWizard} class="p-2 rounded-xl hover:bg-white/20 transition-colors">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <!-- Progress bar -->
          <div class="mt-4 h-2 bg-white/30 rounded-full overflow-hidden">
            <div class="h-full bg-white rounded-full transition-all duration-300" style="width: {wizardStep * 25}%"></div>
          </div>
        </div>

        <div class="p-6">
          <!-- Step 1: Select Provider -->
          {#if wizardStep === 1}
            <div class="space-y-4">
              <p class="text-gray-600 mb-4">Select your email provider:</p>
              <div class="grid grid-cols-2 gap-3">
                {#each imapProviders.filter(p => p.id !== 'custom') as provider}
                  <button
                    onclick={() => selectProvider(provider.id)}
                    class="p-4 rounded-2xl border-2 text-left transition-all {wizardData.provider === provider.id ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-emerald-300'}"
                  >
                    <div class="font-semibold text-gray-900">{provider.name}</div>
                    <div class="text-xs text-gray-500 mt-1">{provider.host}</div>
                  </button>
                {/each}
              </div>
              <button
                onclick={() => selectProvider('custom')}
                class="w-full p-3 rounded-xl border-2 text-left transition-all {wizardData.provider === 'custom' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-emerald-300'}"
              >
                <span class="font-medium text-gray-700">Custom IMAP Server</span>
              </button>

              {#if wizardData.provider === 'gmail'}
                <div class="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <p class="text-sm text-amber-800 font-medium mb-2">Gmail requires an App Password</p>
                  <ol class="text-xs text-amber-700 space-y-1 list-decimal list-inside">
                    <li>Go to <a href="https://myaccount.google.com/security" target="_blank" class="underline">Google Account Security</a></li>
                    <li>Enable 2-Factor Authentication</li>
                    <li>Go to <a href="https://myaccount.google.com/apppasswords" target="_blank" class="underline">App Passwords</a></li>
                    <li>Generate a password for "Mail"</li>
                  </ol>
                </div>
              {/if}

              <div class="flex justify-end mt-6">
                <button onclick={() => wizardStep = 2} class="btn-primary">
                  Next
                </button>
              </div>
            </div>
          {/if}

          <!-- Step 2: Enter Credentials -->
          {#if wizardStep === 2}
            <div class="space-y-4">
              {#if wizardData.provider === 'custom'}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">IMAP Server</label>
                  <input type="text" bind:value={wizardData.host} class="input-premium" placeholder="imap.example.com" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Port</label>
                  <input type="number" bind:value={wizardData.port} class="input-premium w-32" />
                </div>
              {/if}

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input type="email" bind:value={wizardData.user} class="input-premium" placeholder="you@example.com" />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  {wizardData.provider === 'gmail' ? 'App Password' : 'Password'}
                </label>
                <input type="password" bind:value={wizardData.password} class="input-premium" placeholder="••••••••••••" />
              </div>

              <div class="flex justify-between mt-6">
                <button onclick={() => wizardStep = 1} class="btn-secondary">
                  Back
                </button>
                <button onclick={() => wizardStep = 3} class="btn-primary" disabled={!wizardData.user || !wizardData.password}>
                  Next
                </button>
              </div>
            </div>
          {/if}

          <!-- Step 3: Test Connection -->
          {#if wizardStep === 3}
            <div class="space-y-4">
              <div class="text-center py-4">
                <div class="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-emerald-500/10 to-green-500/10 flex items-center justify-center mb-4">
                  <svg viewBox="0 0 48 48" class="w-12 h-12">
                    <rect x="8" y="22" width="28" height="14" rx="2" fill="#10b981"/>
                    <path d="M36 22h6a2 2 0 012 2v10a2 2 0 01-2 2h-6v-14z" fill="#059669"/>
                    <circle cx="16" cy="38" r="4" fill="#374151"/>
                    <circle cx="32" cy="38" r="4" fill="#374151"/>
                    <rect x="14" y="26" width="16" height="10" rx="1" fill="#818cf8"/>
                    <path d="M14 27l8 5 8-5" stroke="#fff" stroke-width="1.5" fill="none"/>
                    <rect x="6" y="18" width="32" height="4" rx="1" fill="#6ee7b7"/>
                  </svg>
                </div>
                <p class="text-gray-600">Click below to test your email connection</p>
              </div>

              {#if wizardTestResult}
                <div class="p-4 rounded-xl {wizardTestResult.success ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}">
                  {#if wizardTestResult.success}
                    <div class="flex items-center gap-2 text-emerald-700">
                      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                      <span class="font-medium">Connected! Found {wizardTestResult.mailboxCount} mailboxes.</span>
                    </div>
                  {:else}
                    <div class="flex items-center gap-2 text-red-700">
                      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span class="font-medium">Connection failed</span>
                    </div>
                    <p class="text-sm text-red-600 mt-2">{wizardTestResult.error}</p>
                  {/if}
                </div>
              {/if}

              <button
                onclick={testWizardConnection}
                disabled={wizardTesting}
                class="w-full py-3 rounded-2xl border-2 border-emerald-500 text-emerald-600 font-semibold hover:bg-emerald-50 transition-colors disabled:opacity-50"
              >
                {#if wizardTesting}
                  <span class="flex items-center justify-center gap-2">
                    <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Testing...
                  </span>
                {:else}
                  Test Connection
                {/if}
              </button>

              <div class="flex justify-between mt-6">
                <button onclick={() => wizardStep = 2} class="btn-secondary">
                  Back
                </button>
                <button
                  onclick={saveWizardConfig}
                  class="btn-primary"
                  disabled={!wizardTestResult?.success || wizardSaving}
                >
                  {wizardSaving ? 'Saving...' : 'Save & Connect'}
                </button>
              </div>
            </div>
          {/if}

          <!-- Step 4: Done -->
          {#if wizardStep === 4}
            <div class="text-center py-8">
              <div class="w-24 h-24 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-6">
                <svg class="w-12 h-12 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 class="text-2xl font-bold text-gray-900 mb-2">You're all set!</h3>
              <p class="text-gray-600 mb-6">Your email is connected. Time to start hauling some trash!</p>
              <button onclick={closeWizard} class="btn-primary">
                Start Haulin'!
              </button>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Import Status Modal -->
  {#if showImportModal && importStatus}
    <div class="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden animate-scale-in">
        <!-- Header -->
        <div class="p-6 bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-xl font-bold">Importing Emails</h2>
              <p class="text-blue-100 text-sm mt-1">{importStatus.phase}</p>
            </div>
            {#if !importing}
              <button onclick={closeImportModal} class="p-2 rounded-xl hover:bg-white/20 transition-colors">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            {/if}
          </div>
          <!-- Progress bar -->
          {#if importStatus.totalFolders > 0}
            <div class="mt-4 h-2 bg-white/30 rounded-full overflow-hidden">
              <div
                class="h-full bg-white rounded-full transition-all duration-300"
                style="width: {(importStatus.foldersProcessed / importStatus.totalFolders) * 100}%"
              ></div>
            </div>
          {/if}
        </div>

        <div class="p-6">
          {#if importStatus.error}
            <!-- Error state -->
            <div class="text-center py-4">
              <div class="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-4">
                <svg class="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 class="text-lg font-semibold text-gray-900 mb-2">Import Failed</h3>
              <p class="text-gray-600 text-sm">{importStatus.error}</p>
            </div>
          {:else if importStatus.phase === 'Complete'}
            <!-- Success state -->
            <div class="text-center py-4">
              <div class="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                <svg class="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 class="text-lg font-semibold text-gray-900 mb-2">Import Complete!</h3>
              <div class="grid grid-cols-3 gap-4 mt-4">
                <div class="text-center">
                  <div class="text-2xl font-bold text-blue-600">{importStatus.emailsFound}</div>
                  <div class="text-xs text-gray-500">Found</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-bold text-emerald-600">{importStatus.emailsImported}</div>
                  <div class="text-xs text-gray-500">Imported</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-bold text-gray-400">{importStatus.duplicatesSkipped}</div>
                  <div class="text-xs text-gray-500">Skipped</div>
                </div>
              </div>
            </div>
          {:else}
            <!-- In progress state -->
            <div class="space-y-4">
              {#if importStatus.currentFolder}
                <div>
                  <label class="text-xs font-medium text-gray-500 uppercase tracking-wider">Current Folder</label>
                  <p class="text-sm text-gray-900 mt-1 truncate">{importStatus.currentFolder}</p>
                </div>
              {/if}

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="text-xs font-medium text-gray-500 uppercase tracking-wider">Folders</label>
                  <p class="text-lg font-semibold text-gray-900">{importStatus.foldersProcessed} / {importStatus.totalFolders}</p>
                </div>
                <div>
                  <label class="text-xs font-medium text-gray-500 uppercase tracking-wider">Emails Found</label>
                  <p class="text-lg font-semibold text-blue-600">{importStatus.emailsFound}</p>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="text-xs font-medium text-gray-500 uppercase tracking-wider">Imported</label>
                  <p class="text-lg font-semibold text-emerald-600">{importStatus.emailsImported}</p>
                </div>
                <div>
                  <label class="text-xs font-medium text-gray-500 uppercase tracking-wider">Duplicates Skipped</label>
                  <p class="text-lg font-semibold text-gray-400">{importStatus.duplicatesSkipped}</p>
                </div>
              </div>

              <div class="flex items-center justify-center pt-4">
                <svg class="w-6 h-6 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            </div>
          {/if}

          {#if !importing}
            <div class="mt-6 flex justify-center">
              <button onclick={closeImportModal} class="btn-primary">
                Close
              </button>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Email Detail Modal -->
  {#if selectedEmail}
    <div class="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm" onclick={() => selectedEmail = null}>
      <div class="bg-white rounded-3xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden animate-scale-in" onclick={(e) => e.stopPropagation()}>
        <!-- Header -->
        <div class="p-6 bg-gradient-to-br from-gray-700 to-gray-800 text-white">
          <div class="flex items-center justify-between">
            <div class="flex-1 min-w-0">
              <h2 class="text-lg font-bold truncate">{selectedEmail.subject}</h2>
              <p class="text-gray-300 text-sm mt-1">From: {selectedEmail.fromAddr}</p>
            </div>
            <button onclick={() => selectedEmail = null} class="p-2 rounded-xl hover:bg-white/20 transition-colors ml-4">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div class="p-6 overflow-y-auto max-h-[60vh]">
          <!-- Classification Badge -->
          <div class="flex items-center gap-4 mb-4">
            <span class={getBadgeClass(selectedEmail.classification) + ' text-sm px-3 py-1'}>
              {selectedEmail.classification}
            </span>
            <span class="text-sm text-gray-500">
              {(selectedEmail.confidence * 100).toFixed(0)}% confidence
            </span>
            <span class="text-sm text-gray-400">
              {formatDate(selectedEmail.processedAt)}
            </span>
          </div>

          <!-- Email Body Preview -->
          <div class="mt-4">
            <label class="text-xs font-medium text-gray-500 uppercase tracking-wider">Preview</label>
            <div class="mt-2 p-4 bg-gray-50 rounded-xl text-sm text-gray-700 whitespace-pre-wrap">
              {selectedEmail.bodyPreview || '(No preview available)'}
            </div>
          </div>

          <!-- Actions -->
          <div class="mt-6 flex gap-3">
            <button
              onclick={() => { handleTrashEmail(selectedEmail!.id); selectedEmail = null; }}
              class="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-100 text-red-700 font-medium hover:bg-red-200 transition-colors"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Move to Trash
            </button>
            <button
              onclick={() => selectedEmail = null}
              class="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Toast Notifications -->
  {#if toasts.length > 0}
    <div class="toast-container">
      {#each toasts as toast (toast.id)}
        <div class="toast toast-{toast.type}">
          {#if toast.type === 'success'}
            <svg class="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          {:else if toast.type === 'error'}
            <svg class="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          {:else}
            <svg class="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          {/if}
          <span class="text-white text-sm font-medium">{toast.message}</span>
        </div>
      {/each}
    </div>
  {/if}


  <!-- Header -->
  <header class="glass-strong sticky top-0 z-40">
    <div class="max-w-7xl mx-auto px-6 py-4">
      <div class="flex justify-between items-center">
        <div class="flex items-center gap-4">
          <!-- Trash Truck Email Logo -->
          <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg overflow-hidden">
            <svg viewBox="0 0 48 48" class="w-10 h-10">
              <!-- Truck body -->
              <rect x="8" y="22" width="28" height="14" rx="2" fill="#fff"/>
              <!-- Truck cabin -->
              <path d="M36 22h6a2 2 0 012 2v10a2 2 0 01-2 2h-6v-14z" fill="#fef3c7"/>
              <!-- Window -->
              <rect x="38" y="24" width="4" height="4" rx="1" fill="#60a5fa"/>
              <!-- Wheels -->
              <circle cx="16" cy="38" r="4" fill="#374151"/>
              <circle cx="16" cy="38" r="2" fill="#9ca3af"/>
              <circle cx="32" cy="38" r="4" fill="#374151"/>
              <circle cx="32" cy="38" r="2" fill="#9ca3af"/>
              <!-- Email envelope in truck -->
              <rect x="14" y="26" width="16" height="10" rx="1" fill="#818cf8"/>
              <path d="M14 27l8 5 8-5" stroke="#fff" stroke-width="1.5" fill="none"/>
              <!-- Trash lid -->
              <rect x="6" y="18" width="32" height="4" rx="1" fill="#d1d5db"/>
              <rect x="18" y="16" width="8" height="2" rx="1" fill="#9ca3af"/>
            </svg>
          </div>
          <div>
            <h1 class="text-xl font-bold text-gray-900">Norman's Email Trash Hauling</h1>
            <p class="text-xs text-gray-500">Hauling spam outta your inbox since 2025</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <!-- Quick Settings Popover -->
          <div class="relative">
            <button
              onclick={toggleSettingsPopover}
              class="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/70 border border-gray-200 hover:bg-white transition-all"
            >
              <!-- Connection dot -->
              <span class="w-2.5 h-2.5 rounded-full {health?.ollamaConnected ? 'bg-emerald-500' : 'bg-red-500'}"></span>
              <!-- Model name -->
              <span class="text-sm font-medium text-gray-700 hidden sm:inline">{settings?.ollama_model ?? 'No model'}</span>
              <!-- Gear icon -->
              <svg class="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            <!-- Settings Popover Dropdown -->
            {#if showSettingsPopover}
              <div class="absolute right-0 top-full mt-2 w-80 rounded-2xl bg-white shadow-2xl border border-gray-100 z-50 animate-scale-in overflow-hidden">
                <!-- Connection Status -->
                <div class="p-4 border-b border-gray-100 bg-gradient-to-r {health?.ollamaConnected ? 'from-emerald-50 to-green-50' : 'from-red-50 to-orange-50'}">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span class="w-3 h-3 rounded-full {health?.ollamaConnected ? 'bg-emerald-500' : 'bg-red-500'}"></span>
                      <span class="font-medium {health?.ollamaConnected ? 'text-emerald-700' : 'text-red-700'}">
                        {health?.ollamaConnected ? 'Ollama Connected' : 'Ollama Offline'}
                      </span>
                    </div>
                    <button onclick={handlePingOllama} disabled={pinging} class="text-xs px-2 py-1 rounded-lg bg-white/50 hover:bg-white transition-colors">
                      {pinging ? 'Testing...' : 'Test'}
                    </button>
                  </div>
                  <p class="text-xs text-gray-500 mt-1 truncate">{settings?.ollama_host}</p>
                </div>

                <!-- Model Selection -->
                <div class="p-4">
                  <label class="text-xs font-medium text-gray-500 uppercase tracking-wider">Active Model</label>
                  <div class="mt-2 space-y-1 max-h-48 overflow-y-auto">
                    {#each models as model}
                      <button
                        onclick={() => handleQuickModelChange(model.name)}
                        class="w-full flex items-center justify-between p-2 rounded-xl text-left transition-colors {settings?.ollama_model === model.name ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-gray-50'}"
                      >
                        <div class="flex items-center gap-2">
                          {#if settings?.ollama_model === model.name}
                            <svg class="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                            </svg>
                          {:else}
                            <span class="w-4 h-4 rounded-full border-2 border-gray-300"></span>
                          {/if}
                          <span class="text-sm font-medium text-gray-900">{model.name}</span>
                        </div>
                        <span class="text-xs text-gray-400">{formatBytes(model.size)}</span>
                      </button>
                    {/each}
                    {#if models.length === 0}
                      <p class="text-sm text-gray-400 text-center py-4">No models found</p>
                    {/if}
                  </div>
                </div>

                <!-- Email Connection -->
                <div class="p-4 border-t border-gray-100">
                  <label class="text-xs font-medium text-gray-500 uppercase tracking-wider">Email Connection</label>
                  <div class="mt-2 flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span class="w-2.5 h-2.5 rounded-full {imapConfig?.configured ? 'bg-emerald-500' : 'bg-amber-500'}"></span>
                      <span class="text-sm text-gray-700">
                        {imapConfig?.configured ? imapConfig.user : 'Not configured'}
                      </span>
                    </div>
                    <button
                      onclick={() => { showSettingsPopover = false; openWizard(); }}
                      class="text-xs px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                    >
                      {imapConfig?.configured ? 'Change' : 'Setup'}
                    </button>
                  </div>
                </div>

                <!-- Quick Actions -->
                <div class="p-3 bg-gray-50 border-t border-gray-100 flex gap-2">
                  <button onclick={() => { showSettingsPopover = false; handleTabChange('settings'); }} class="flex-1 text-sm font-medium text-emerald-600 hover:text-emerald-700 py-2 rounded-xl hover:bg-emerald-50 transition-colors">
                    All Settings
                  </button>
                  {#if imapConfig?.configured}
                    <button
                      onclick={() => { showSettingsPopover = false; handleImport(); }}
                      disabled={importing}
                      class="flex-1 text-sm font-medium text-blue-600 hover:text-blue-700 py-2 rounded-xl hover:bg-blue-50 transition-colors disabled:opacity-50"
                    >
                      Import All
                    </button>
                  {/if}
                </div>
              </div>
              <!-- Backdrop to close popover -->
              <button class="fixed inset-0 z-40 cursor-default" onclick={() => showSettingsPopover = false}></button>
            {/if}
          </div>

          <!-- Refresh Indicator -->
          {#if refreshingData}
            <div class="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
              <svg class="w-4 h-4 text-emerald-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span class="text-sm font-medium text-emerald-700">Refreshing...</span>
            </div>
          {/if}

          <!-- Import Button -->
          <button
            onclick={handleImport}
            disabled={importing || refreshingData}
            class="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {#if importing}
              <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Importing...</span>
            {:else}
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span>Import Now</span>
            {/if}
          </button>
        </div>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-6 py-8">
    {#if loading}
      <!-- Premium Loading State - Animated Trash Truck Scene -->
      <div class="loading-bg min-h-[70vh] flex flex-col items-center justify-center relative overflow-hidden">
        <!-- Sky with clouds -->
        <div class="absolute inset-0 pointer-events-none">
          <!-- Floating clouds -->
          <div class="absolute top-12 left-[10%] opacity-60">
            <svg width="80" height="40" viewBox="0 0 80 40">
              <ellipse cx="40" cy="25" rx="35" ry="15" fill="white"/>
              <ellipse cx="25" cy="20" rx="20" ry="12" fill="white"/>
              <ellipse cx="55" cy="20" rx="20" ry="12" fill="white"/>
            </svg>
          </div>
          <div class="absolute top-20 right-[15%] opacity-40" style="animation: float 4s ease-in-out infinite 1s;">
            <svg width="60" height="30" viewBox="0 0 60 30">
              <ellipse cx="30" cy="18" rx="25" ry="12" fill="white"/>
              <ellipse cx="18" cy="15" rx="15" ry="10" fill="white"/>
              <ellipse cx="42" cy="15" rx="15" ry="10" fill="white"/>
            </svg>
          </div>
          <div class="absolute top-8 left-[50%] opacity-30" style="animation: float 5s ease-in-out infinite 0.5s;">
            <svg width="50" height="25" viewBox="0 0 50 25">
              <ellipse cx="25" cy="15" rx="20" ry="10" fill="white"/>
              <ellipse cx="15" cy="12" rx="12" ry="8" fill="white"/>
            </svg>
          </div>
        </div>

        <!-- Main content -->
        <div class="relative z-10 flex flex-col items-center">
          <!-- Animated scene container -->
          <div class="relative w-96 h-48 mb-8">
            <!-- Background elements - trees/buildings -->
            <div class="absolute bottom-16 left-4 opacity-40">
              <svg width="30" height="50" viewBox="0 0 30 50">
                <polygon points="15,0 30,40 0,40" fill="#166534"/>
                <rect x="12" y="40" width="6" height="10" fill="#92400e"/>
              </svg>
            </div>
            <div class="absolute bottom-16 right-8 opacity-30">
              <svg width="25" height="45" viewBox="0 0 25 45">
                <polygon points="12.5,0 25,35 0,35" fill="#166534"/>
                <rect x="10" y="35" width="5" height="10" fill="#92400e"/>
              </svg>
            </div>
            <div class="absolute bottom-16 left-[40%] opacity-20">
              <svg width="20" height="40" viewBox="0 0 20 40">
                <polygon points="10,0 20,30 0,30" fill="#166534"/>
                <rect x="8" y="30" width="4" height="10" fill="#92400e"/>
              </svg>
            </div>

            <!-- Grass -->
            <div class="absolute bottom-10 left-0 right-0 h-6 grass rounded-t-lg"></div>

            <!-- Road -->
            <div class="absolute bottom-0 left-0 right-0 h-10 road rounded-lg overflow-hidden">
              <!-- Animated road markings -->
              <div class="absolute inset-0 flex items-center animate-road">
                <div class="flex gap-6" style="width: 200%;">
                  {#each Array(20) as _}
                    <div class="w-8 h-1 bg-yellow-400 rounded-full flex-shrink-0"></div>
                  {/each}
                </div>
              </div>
            </div>

            <!-- Truck driving across -->
            <div class="absolute bottom-6 animate-truck-cruise" style="animation-duration: 5s;">
              <div class="animate-truck-suspension">
                <svg width="100" height="60" viewBox="0 0 100 60" class="animate-glow">
                  <!-- Shadow -->
                  <ellipse cx="50" cy="58" rx="40" ry="4" fill="rgba(0,0,0,0.15)"/>

                  <!-- Exhaust puffs -->
                  <g class="animate-exhaust" style="animation-delay: 0s;">
                    <circle cx="5" cy="42" r="4" fill="#d1d5db"/>
                  </g>
                  <g class="animate-exhaust" style="animation-delay: 0.4s;">
                    <circle cx="0" cy="38" r="3" fill="#e5e7eb"/>
                  </g>
                  <g class="animate-exhaust" style="animation-delay: 0.8s;">
                    <circle cx="8" cy="35" r="2.5" fill="#f3f4f6"/>
                  </g>

                  <!-- Truck body (bin) -->
                  <rect x="15" y="18" width="50" height="30" rx="4" fill="url(#truckGradient)"/>

                  <!-- Truck body shine -->
                  <rect x="17" y="20" width="46" height="4" rx="2" fill="rgba(255,255,255,0.3)"/>

                  <!-- Recycling symbol on side -->
                  <circle cx="40" cy="35" r="8" fill="rgba(255,255,255,0.2)"/>
                  <text x="40" y="39" font-size="12" fill="rgba(255,255,255,0.6)" text-anchor="middle">♻</text>

                  <!-- Truck cabin -->
                  <path d="M65 18h20a5 5 0 015 5v22a3 3 0 01-3 3H65V18z" fill="#059669"/>
                  <path d="M65 18h20a5 5 0 015 5v3H65V18z" fill="#047857"/>

                  <!-- Window -->
                  <rect x="70" y="22" width="14" height="12" rx="2" fill="#60a5fa"/>
                  <!-- Window shine -->
                  <rect x="71" y="23" width="4" height="8" rx="1" fill="#93c5fd"/>

                  <!-- Headlight -->
                  <circle cx="88" cy="40" r="3" fill="#fef3c7"/>
                  <circle cx="88" cy="40" r="2" fill="#fde68a"/>

                  <!-- Front wheel -->
                  <g style="transform-origin: 75px 52px;" class="animate-wheel-roll">
                    <circle cx="75" cy="52" r="8" fill="#1f2937"/>
                    <circle cx="75" cy="52" r="5" fill="#374151"/>
                    <circle cx="75" cy="52" r="2" fill="#6b7280"/>
                    <!-- Wheel spokes -->
                    <rect x="74" y="45" width="2" height="14" fill="#4b5563"/>
                    <rect x="68" y="51" width="14" height="2" fill="#4b5563"/>
                  </g>

                  <!-- Back wheel -->
                  <g style="transform-origin: 30px 52px;" class="animate-wheel-roll">
                    <circle cx="30" cy="52" r="8" fill="#1f2937"/>
                    <circle cx="30" cy="52" r="5" fill="#374151"/>
                    <circle cx="30" cy="52" r="2" fill="#6b7280"/>
                    <rect x="29" y="45" width="2" height="14" fill="#4b5563"/>
                    <rect x="23" y="51" width="14" height="2" fill="#4b5563"/>
                  </g>

                  <!-- Lid -->
                  <rect x="13" y="12" width="54" height="6" rx="2" fill="#6ee7b7"/>
                  <rect x="32" y="8" width="16" height="4" rx="2" fill="#34d399"/>

                  <!-- Emails bouncing in truck -->
                  <g class="animate-email-bounce" style="animation-delay: 0s;">
                    <rect x="22" y="24" width="14" height="10" rx="1" fill="#818cf8"/>
                    <path d="M22 25l7 4 7-4" stroke="#fff" stroke-width="1.5" fill="none"/>
                  </g>
                  <g class="animate-email-bounce" style="animation-delay: 0.2s;">
                    <rect x="38" y="26" width="12" height="8" rx="1" fill="#a78bfa"/>
                    <path d="M38 27l6 3 6-3" stroke="#fff" stroke-width="1" fill="none"/>
                  </g>
                  <g class="animate-email-bounce" style="animation-delay: 0.4s;">
                    <rect x="52" y="25" width="10" height="7" rx="1" fill="#c4b5fd"/>
                    <path d="M52 26l5 2.5 5-2.5" stroke="#fff" stroke-width="1" fill="none"/>
                  </g>

                  <!-- Gradient definitions -->
                  <defs>
                    <linearGradient id="truckGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" style="stop-color:#34d399"/>
                      <stop offset="100%" style="stop-color:#10b981"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>

            <!-- Floating emails being collected -->
            <div class="absolute bottom-20 left-[20%] animate-email-wait" style="animation-delay: 0s;">
              <svg width="24" height="18" viewBox="0 0 24 18" class="opacity-60">
                <rect x="0" y="0" width="24" height="18" rx="2" fill="#818cf8"/>
                <path d="M0 2l12 7 12-7" stroke="#fff" stroke-width="1.5" fill="none"/>
              </svg>
            </div>
            <div class="absolute bottom-24 left-[45%] animate-email-wait" style="animation-delay: 0.5s;">
              <svg width="20" height="15" viewBox="0 0 20 15" class="opacity-50">
                <rect x="0" y="0" width="20" height="15" rx="2" fill="#a78bfa"/>
                <path d="M0 2l10 5 10-5" stroke="#fff" stroke-width="1.5" fill="none"/>
              </svg>
            </div>
            <div class="absolute bottom-22 right-[25%] animate-email-wait" style="animation-delay: 1s;">
              <svg width="22" height="16" viewBox="0 0 22 16" class="opacity-40">
                <rect x="0" y="0" width="22" height="16" rx="2" fill="#c4b5fd"/>
                <path d="M0 2l11 6 11-6" stroke="#fff" stroke-width="1.5" fill="none"/>
              </svg>
            </div>
          </div>

          <!-- Loading text with animated dots -->
          <div class="text-center animate-spring-up" style="animation-delay: 0.2s;">
            <h2 class="text-2xl font-bold text-gray-800 mb-2">Hauling your emails</h2>
            <div class="flex items-center justify-center gap-1">
              <span class="text-gray-500">Loading inbox</span>
              <span class="flex gap-1 ml-1">
                <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full loading-dot-1"></span>
                <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full loading-dot-2"></span>
                <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full loading-dot-3"></span>
              </span>
            </div>
          </div>

          <!-- Fun fact while loading -->
          <div class="mt-8 px-6 py-3 rounded-2xl bg-white/60 backdrop-blur border border-emerald-100 animate-spring-up" style="animation-delay: 0.4s;">
            <p class="text-sm text-gray-600 text-center">
              <span class="text-emerald-600 font-medium">Did you know?</span> The average person receives 121 emails per day
            </p>
          </div>
        </div>
      </div>
    {:else}
      <!-- 2028 Futuristic Navigation -->
      <div class="flex justify-center mb-8 animate-spring-up">
        <nav class="nav-pills">
          <button
            data-tab="dashboard"
            onclick={() => handleTabChange('dashboard')}
            class="nav-pill {activeTab === 'dashboard' ? 'active' : ''}"
          >
            <svg class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
            Dashboard
          </button>
          <button
            data-tab="emails"
            onclick={() => handleTabChange('emails')}
            class="nav-pill {activeTab === 'emails' ? 'active' : ''}"
          >
            <svg class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Emails
            {#if emailList.length > 0}
              <span class="ml-1 px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-700">{emailList.length}</span>
            {/if}
          </button>
          <button
            data-tab="settings"
            onclick={() => handleTabChange('settings')}
            class="nav-pill {activeTab === 'settings' ? 'active' : ''}"
          >
            <svg class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>
        </nav>
      </div>

      <!-- Dashboard Tab -->
      {#if activeTab === 'dashboard'}
        <div class="space-y-8 animate-spring-up">
          <!-- Stats Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div class="stat-card-2028 total">
              <p class="text-sm font-medium text-gray-500 mb-2">Total Emails</p>
              <p class="stat-value">{stats?.totalEmails ?? 0}</p>
              <div class="mt-4 flex items-center gap-2">
                <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 flex items-center justify-center">
                  <svg class="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <span class="text-xs text-gray-400">in your inbox</span>
              </div>
            </div>

            <div class="stat-card-2028 spam">
              <p class="text-sm font-medium text-gray-500 mb-2">Spam Detected</p>
              <p class="stat-value">{stats?.spamCount ?? 0}</p>
              {#if stats?.spamCount}
                <button
                  onclick={handleTrashAllSpam}
                  disabled={trashingSpam}
                  class="mt-4 w-full btn-2028 btn-2028-danger text-sm justify-center"
                >
                  {trashingSpam ? 'Trashing...' : 'Trash All'}
                </button>
              {:else}
                <div class="mt-4 flex items-center gap-2">
                  <span class="text-xs text-gray-400">No spam found</span>
                </div>
              {/if}
            </div>

            <div class="stat-card-2028 newsletter">
              <p class="text-sm font-medium text-gray-500 mb-2">Newsletters</p>
              <p class="stat-value">{stats?.newsletterCount ?? 0}</p>
              <div class="mt-4 flex items-center gap-2">
                <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 flex items-center justify-center">
                  <svg class="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                </div>
                <span class="text-xs text-gray-400">subscriptions</span>
              </div>
            </div>

            <div class="stat-card-2028 keep">
              <p class="text-sm font-medium text-gray-500 mb-2">Important</p>
              <p class="stat-value">{stats?.keepCount ?? 0}</p>
              <div class="mt-4 flex items-center gap-2">
                <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 flex items-center justify-center">
                  <svg class="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span class="text-xs text-gray-400">to keep</span>
              </div>
            </div>
          </div>

          <!-- Charts Row -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="chart-card-2028">
              <div class="section-header">
                <h3 class="section-title">Classification Breakdown</h3>
              </div>
              <div class="aspect-square max-h-72 mx-auto">
                <canvas id="pieChart"></canvas>
              </div>
            </div>
            <div class="chart-card-2028">
              <div class="section-header">
                <h3 class="section-title">Activity This Week</h3>
              </div>
              <div class="h-72">
                <canvas id="lineChart"></canvas>
              </div>
            </div>
          </div>

          <!-- Quick Actions -->
          <div class="chart-card-2028">
            <div class="section-header">
              <h3 class="section-title">Quick Actions</h3>
            </div>
            <div class="quick-actions">
              <button onclick={handleImport} disabled={importing} class="quick-action-card text-left">
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                    <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>
                  <div>
                    <p class="font-semibold text-gray-900">{importing ? 'Importing...' : 'Import Emails'}</p>
                    <p class="text-sm text-gray-500">Fetch new emails from Gmail</p>
                  </div>
                </div>
              </button>

              <button onclick={handleScan} disabled={scanning} class="quick-action-card text-left">
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                    <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <div>
                    <p class="font-semibold text-gray-900">{scanning ? 'Classifying...' : 'Classify Emails'}</p>
                    <p class="text-sm text-gray-500">AI-powered spam detection</p>
                  </div>
                </div>
              </button>

              <button onclick={() => handleTabChange('emails')} class="quick-action-card text-left">
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                    <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p class="font-semibold text-gray-900">View Emails</p>
                    <p class="text-sm text-gray-500">Browse and manage your inbox</p>
                  </div>
                </div>
              </button>

              {#if stats?.spamCount}
                <button onclick={handleTrashAllSpam} disabled={trashingSpam} class="quick-action-card danger text-left">
                  <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                      <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </div>
                    <div>
                      <p class="font-semibold text-gray-900">{trashingSpam ? 'Trashing...' : 'Trash All Spam'}</p>
                      <p class="text-sm text-gray-500">Remove {stats.spamCount} spam emails</p>
                    </div>
                  </div>
                </button>
              {:else}
                <div class="quick-action-card opacity-50 cursor-default">
                  <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-2xl bg-gray-200 flex items-center justify-center">
                      <svg class="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p class="font-semibold text-gray-500">All Clean!</p>
                      <p class="text-sm text-gray-400">No spam to delete</p>
                    </div>
                  </div>
                </div>
              {/if}
            </div>
          </div>

          <!-- Unsubscribe Tasks (if any) -->
          {#if unsubscribeTasks.length > 0}
            <div class="chart-card-2028">
              <div class="section-header">
                <h3 class="section-title">Pending Unsubscribes</h3>
                <span class="px-3 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-700">{unsubscribeTasks.length}</span>
              </div>
              <div class="space-y-3">
                {#each unsubscribeTasks.slice(0, 5) as task}
                  <div class="flex items-center justify-between p-4 rounded-xl bg-gray-50">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                        <svg class="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <p class="font-medium text-gray-900 text-sm">{task.sender}</p>
                        <p class="text-xs text-gray-500">{task.method}</p>
                      </div>
                    </div>
                    <button class="btn-2028 btn-2028-secondary text-xs">Unsubscribe</button>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Emails Tab -->
      {#if activeTab === 'emails'}
        <div class="content-panel animate-spring-up">
          <div class="p-6">
            <div class="flex flex-col gap-4 mb-6">
              <div class="flex items-center justify-between">
                <h3 class="text-lg font-semibold text-gray-900">
                  Emails
                  <span class="text-sm font-normal text-gray-500">({filteredEmails.length} of {emailList.length})</span>
                </h3>
                <div class="flex items-center gap-3">
                  <button
                    onclick={handleScan}
                    disabled={scanning || refreshingData}
                    class="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {#if scanning}
                      <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Classifying...</span>
                    {:else}
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      <span>Classify Emails</span>
                    {/if}
                  </button>
                <button
                  onclick={handleClearLocalEmails}
                  disabled={clearingEmails || emailList.length === 0}
                  class="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {#if clearingEmails}
                    <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  {:else}
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  {/if}
                  <span>Clear Local</span>
                </button>
                <select
                  bind:value={classificationFilter}
                  onchange={() => { loadEmails(); currentPage = 1; }}
                  class="select-premium text-sm"
                >
                  <option value="">All Classifications</option>
                  <option value="spam">Spam</option>
                  <option value="newsletter">Newsletter</option>
                  <option value="keep">Keep</option>
                </select>
                </div>
              </div>

              <!-- Search Bar -->
              <div class="relative">
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  bind:value={searchQuery}
                  oninput={() => currentPage = 1}
                  placeholder="Search emails..."
                  class="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
                />
                {#if searchQuery}
                  <button
                    onclick={() => { searchQuery = ''; currentPage = 1; }}
                    class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                {/if}
              </div>
            </div>

            {#if loadingEmails}
              <div class="text-center py-16">
                <div class="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
                  <svg class="w-8 h-8 text-emerald-600 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                <p class="text-gray-500">Loading emails...</p>
              </div>
            {:else if emailList.length === 0}
              <div class="text-center py-16">
                <div class="w-16 h-16 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                  <svg class="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <p class="text-gray-500">No emails found</p>
              </div>
            {:else}
              <!-- Bulk Action Bar -->
              {#if selectedIds.size > 0}
                <div class="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 flex items-center justify-between">
                  <div class="flex items-center gap-4">
                    <span class="text-sm font-medium text-blue-800">
                      {selectedIds.size} selected
                    </span>
                    <button
                      onclick={selectAllFiltered}
                      class="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Select all {filteredEmails.length}
                    </button>
                    <button
                      onclick={clearSelection}
                      class="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Clear
                    </button>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      onclick={bulkClassify}
                      disabled={bulkActionRunning || scanning}
                      class="px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
                    >
                      Classify Selected
                    </button>
                    <button
                      onclick={bulkTrash}
                      disabled={bulkActionRunning}
                      class="px-3 py-1.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg disabled:opacity-50"
                    >
                      Trash Selected
                    </button>
                  </div>
                </div>
              {/if}

              <div class="overflow-hidden rounded-2xl border border-gray-100">
                <table class="table-premium">
                  <thead>
                    <tr>
                      <th class="w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === paginatedEmails.length && paginatedEmails.length > 0}
                          indeterminate={selectedIds.size > 0 && selectedIds.size < paginatedEmails.length}
                          onchange={toggleSelectAll}
                          class="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </th>
                      <th class="cursor-pointer hover:bg-gray-50 select-none" onclick={() => toggleSort('fromAddr')}>
                        <div class="flex items-center gap-1">
                          From
                          {#if sortColumn === 'fromAddr'}
                            <svg class="w-3 h-3 {sortDirection === 'desc' ? 'rotate-180' : ''}" fill="currentColor" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                          {/if}
                        </div>
                      </th>
                      <th class="cursor-pointer hover:bg-gray-50 select-none" onclick={() => toggleSort('subject')}>
                        <div class="flex items-center gap-1">
                          Subject
                          {#if sortColumn === 'subject'}
                            <svg class="w-3 h-3 {sortDirection === 'desc' ? 'rotate-180' : ''}" fill="currentColor" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                          {/if}
                        </div>
                      </th>
                      <th class="cursor-pointer hover:bg-gray-50 select-none" onclick={() => toggleSort('classification')}>
                        <div class="flex items-center gap-1">
                          Classification
                          {#if sortColumn === 'classification'}
                            <svg class="w-3 h-3 {sortDirection === 'desc' ? 'rotate-180' : ''}" fill="currentColor" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                          {/if}
                        </div>
                      </th>
                      <th class="cursor-pointer hover:bg-gray-50 select-none" onclick={() => toggleSort('confidence')}>
                        <div class="flex items-center gap-1">
                          Confidence
                          {#if sortColumn === 'confidence'}
                            <svg class="w-3 h-3 {sortDirection === 'desc' ? 'rotate-180' : ''}" fill="currentColor" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                          {/if}
                        </div>
                      </th>
                      <th class="cursor-pointer hover:bg-gray-50 select-none" onclick={() => toggleSort('date')}>
                        <div class="flex items-center gap-1">
                          Date
                          {#if sortColumn === 'date'}
                            <svg class="w-3 h-3 {sortDirection === 'desc' ? 'rotate-180' : ''}" fill="currentColor" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                          {/if}
                        </div>
                      </th>
                      <th class="w-16">Classify</th>
                      <th class="w-16">Trash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each paginatedEmails as email, i}
                      {@const isProcessing = scanStatus?.currentEmailId === email.id}
                      {@const isClassifying = classifyingEmailId === email.id}
                      {@const isSelected = selectedIds.has(email.id)}
                      <tr
                        class="animate-fade-in cursor-pointer hover:bg-emerald-50 transition-colors {isProcessing ? 'bg-emerald-100' : ''} {isSelected ? 'bg-blue-50' : ''}"
                        style="animation-delay: {i * 30}ms"
                        onclick={() => selectedEmail = email}
                      >
                        <td onclick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onchange={() => toggleSelect(email.id)}
                            class="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                        </td>
                        <td class="text-sm font-medium text-gray-900 relative">
                          {#if isProcessing}
                            <div class="absolute left-0 top-1/2 -translate-y-1/2 -ml-2">
                              <svg viewBox="0 0 40 24" class="w-10 h-6 animate-bounce-truck">
                                <rect x="8" y="8" width="20" height="10" rx="2" fill="#10b981"/>
                                <path d="M28 8h8a2 2 0 012 2v6a2 2 0 01-2 2h-8V8z" fill="#059669"/>
                                <circle cx="14" cy="18" r="3" fill="#374151"/>
                                <circle cx="32" cy="18" r="3" fill="#374151"/>
                                <rect x="30" y="10" width="4" height="4" rx="1" fill="#7dd3fc"/>
                              </svg>
                            </div>
                          {/if}
                          <span class={isProcessing ? 'ml-8' : ''}>{email.fromAddr}</span>
                        </td>
                        <td class="text-sm text-gray-600 max-w-xs truncate">{email.subject}</td>
                        <td>
                          <span class={getBadgeClass(email.classification)}>{email.classification}</span>
                        </td>
                        <td>
                          <div class="flex items-center gap-2">
                            <div class="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                              <div
                                class="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-400"
                                style="width: {email.confidence * 100}%"
                              ></div>
                            </div>
                            <span class="text-xs text-gray-500">{(email.confidence * 100).toFixed(0)}%</span>
                          </div>
                        </td>
                        <td class="text-sm text-gray-500">{formatDate(email.processedAt)}</td>
                        <td>
                          <button
                            onclick={(e) => { e.stopPropagation(); handleClassifySingle(email.id); }}
                            disabled={isClassifying || email.classification !== 'unknown'}
                            class="p-2 rounded-lg transition-colors {email.classification === 'unknown' ? 'text-indigo-600 hover:bg-indigo-50' : 'text-gray-300 cursor-not-allowed'}"
                            title={email.classification === 'unknown' ? 'Classify this email' : 'Already classified'}
                          >
                            {#if isClassifying}
                              <svg class="w-5 h-5 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            {:else}
                              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                            {/if}
                          </button>
                        </td>
                        <td>
                          <button
                            onclick={(e) => { e.stopPropagation(); handleTrashEmail(email.id); }}
                            disabled={trashingEmailId === email.id}
                            class="btn-trash"
                            title="Move to trash"
                          >
                            {#if trashingEmailId === email.id}
                              <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            {:else}
                              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            {/if}
                          </button>
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>

              <!-- Pagination -->
              {#if totalPages > 1}
                <div class="flex items-center justify-between mt-4 px-2">
                  <div class="text-sm text-gray-500">
                    Showing {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredEmails.length)} of {filteredEmails.length}
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      onclick={() => currentPage = 1}
                      disabled={currentPage === 1}
                      class="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/></svg>
                    </button>
                    <button
                      onclick={() => currentPage = Math.max(1, currentPage - 1)}
                      disabled={currentPage === 1}
                      class="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
                    </button>
                    <span class="px-3 py-1 text-sm font-medium text-gray-700">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onclick={() => currentPage = Math.min(totalPages, currentPage + 1)}
                      disabled={currentPage === totalPages}
                      class="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                    </button>
                    <button
                      onclick={() => currentPage = totalPages}
                      disabled={currentPage === totalPages}
                      class="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg>
                    </button>
                  </div>
                </div>
              {/if}
            {/if}
          </div>
        </div>
      {/if}

      <!-- Settings Tab -->
      {#if activeTab === 'settings'}
        <div class="content-panel animate-spring-up">
          <div class="p-6">
            {#if settings}
              <!-- Header with Save Button -->
              <div class="flex items-center justify-between mb-6 pb-6 border-b border-gray-100">
                <div>
                  <h2 class="text-2xl font-bold text-gray-900">Settings</h2>
                  <p class="text-sm text-gray-500 mt-1">Configure Ollama connection and classification options</p>
                </div>
                <button
                  onclick={handleSaveSettings}
                  disabled={saving}
                  class="btn-primary flex items-center gap-2"
                >
                  {#if saving}
                    <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Saving...</span>
                  {:else}
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Save Settings</span>
                  {/if}
                </button>
              </div>

              <div class="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <!-- Left Column: Ollama Config -->
                <div class="space-y-8">
                  <!-- Active Model Display -->
                  <div class="p-5 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white mb-6">
                    <div class="flex items-center justify-between">
                      <div>
                        <p class="text-emerald-200 text-sm font-medium">Active Model</p>
                        <p class="text-2xl font-bold mt-1">{settings.ollama_model}</p>
                      </div>
                      <div class="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                        <svg class="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                    </div>
                    <p class="text-emerald-200 text-xs mt-3">This model will be used for all email classifications</p>
                  </div>

                  <!-- Connection Section -->
                  <div>
                    <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <svg class="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                      </svg>
                      Ollama Connection
                    </h3>

                    <div class="space-y-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Host URL</label>
                        <div class="flex gap-3">
                          <input
                            type="text"
                            bind:value={settings.ollama_host}
                            class="input-premium flex-1"
                            placeholder="http://localhost:11434"
                          />
                          <button
                            onclick={handlePingOllama}
                            disabled={pinging}
                            class="btn-secondary whitespace-nowrap"
                          >
                            {pinging ? 'Testing...' : 'Test'}
                          </button>
                        </div>
                      </div>

                      {#if pingResult}
                        <div class="connection-card {pingResult.connected ? 'connected' : 'disconnected'} animate-scale-in">
                          <div class="flex items-center gap-3">
                            {#if pingResult.connected}
                              <div class="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                                <svg class="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                              <div>
                                <p class="font-medium text-emerald-700">Connected</p>
                                <p class="text-sm text-emerald-600">{pingResult.modelCount} models available</p>
                              </div>
                            {:else}
                              <div class="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                                <svg class="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </div>
                              <div class="flex-1 min-w-0">
                                <p class="font-medium text-red-700">Connection Failed</p>
                                <p class="text-sm text-red-600 truncate">{pingResult.error}</p>
                              </div>
                            {/if}
                          </div>
                        </div>
                      {/if}

                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Change Model</label>
                        <select
                          value={settings.ollama_model}
                          onchange={async (e) => {
                            const newModel = (e.target as HTMLSelectElement).value;
                            if (settings && newModel !== settings.ollama_model) {
                              try {
                                const cfg = await getModelConfig(newModel);
                                settings.ollama_model = newModel;
                                settings.ollama_prompt = cfg.prompt;
                                settings.worker_count = String(cfg.workers);
                                showToast(`Applied optimal settings for ${newModel} (${cfg.speed}, ${cfg.workers} workers)`, 'success');
                              } catch {
                                settings.ollama_model = newModel;
                              }
                            }
                          }}
                          class="select-premium"
                        >
                          {#each models as model}
                            <option value={model.name}>{model.name} ({formatBytes(model.size)})</option>
                          {/each}
                          {#if models.length === 0}
                            <option value={settings.ollama_model}>{settings.ollama_model}</option>
                          {/if}
                        </select>
                        <p class="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                          <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                          </svg>
                          Optimal prompt and workers auto-applied. Save to persist.
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- Model Management -->
                  <div>
                    <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <svg class="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      Models
                    </h3>

                    <!-- Pull New Model -->
                    <div class="p-4 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100/50 mb-4">
                      <div class="flex gap-3 mb-3">
                        <input
                          type="text"
                          bind:value={newModelName}
                          placeholder="llama3.2, mistral, phi3..."
                          class="input-premium flex-1 text-sm"
                          disabled={pullingModel}
                        />
                        <button
                          onclick={handlePullModel}
                          disabled={pullingModel || !newModelName.trim()}
                          class="btn-primary text-sm disabled:opacity-50"
                        >
                          {pullingModel ? 'Pulling...' : 'Pull'}
                        </button>
                      </div>
                      {#if pullProgress}
                        <p class="text-sm {pullProgress.startsWith('Error') ? 'text-red-600' : 'text-emerald-600'}">{pullProgress}</p>
                      {/if}
                      <div class="flex flex-wrap gap-2 mt-3">
                        <a href="https://ollama.com/library" target="_blank" rel="noopener" class="text-xs px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-600 transition-colors">
                          Ollama Library
                        </a>
                        <a href="https://huggingface.co/models?library=gguf&sort=trending" target="_blank" rel="noopener" class="text-xs px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-600 transition-colors">
                          Hugging Face
                        </a>
                      </div>
                    </div>

                    <!-- Installed Models -->
                    <div class="space-y-2 max-h-64 overflow-y-auto">
                      {#each models as model, i}
                        <div class="model-card {settings.ollama_model === model.name ? 'active' : ''}" style="animation-delay: {i * 30}ms">
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                              <span class="font-medium text-gray-900">{model.name}</span>
                              {#if settings.ollama_model === model.name}
                                <span class="px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">Active</span>
                              {/if}
                            </div>
                            <p class="text-xs text-gray-500 mt-0.5">{formatBytes(model.size)}</p>
                          </div>
                          <div class="flex items-center gap-2">
                            <button
                              onclick={async () => {
                                if (settings) {
                                  try {
                                    const cfg = await getModelConfig(model.name);
                                    settings.ollama_model = model.name;
                                    settings.ollama_prompt = cfg.prompt;
                                    settings.worker_count = String(cfg.workers);
                                    showToast(`Applied optimal settings for ${model.name} (${cfg.speed} mode, ${cfg.workers} workers)`, 'success');
                                  } catch {
                                    settings.ollama_model = model.name;
                                    showToast(`Selected ${model.name}`, 'info');
                                  }
                                }
                              }}
                              class="btn-ghost text-sm"
                              disabled={settings.ollama_model === model.name}
                            >
                              {settings.ollama_model === model.name ? 'Selected' : 'Use'}
                            </button>
                            <button
                              onclick={() => handleDeleteModel(model.name)}
                              disabled={deletingModel === model.name || settings.ollama_model === model.name}
                              class="btn-danger text-sm disabled:opacity-30"
                            >
                              {deletingModel === model.name ? '...' : 'Delete'}
                            </button>
                          </div>
                        </div>
                      {/each}
                      {#if models.length === 0}
                        <p class="text-sm text-gray-500 text-center py-8">No models installed</p>
                      {/if}
                    </div>
                  </div>

                  <!-- Prompt -->
                  <div>
                    <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <svg class="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Classification Prompt
                    </h3>
                    <textarea
                      bind:value={settings.ollama_prompt}
                      rows="10"
                      class="textarea-premium"
                    ></textarea>
                    <p class="text-xs text-gray-500 mt-2">Variables: {'{fromAddr}'}, {'{subject}'}, {'{bodyPreview}'}</p>
                  </div>
                </div>

                <!-- Right Column: Queue & Test -->
                <div class="space-y-8">
                  <!-- Queue & Workers -->
                  <div>
                    <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <svg class="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Queue & Workers
                    </h3>

                    <div class="space-y-4">
                      <div class="flex items-center gap-4">
                        <label class="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.queue_enabled === 'true'}
                            onchange={(e) => (settings!.queue_enabled = e.currentTarget.checked ? 'true' : 'false')}
                            class="sr-only peer"
                          />
                          <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                        <span class="text-sm font-medium text-gray-700">Enable Queue Processing</span>
                      </div>

                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Worker Count</label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          bind:value={settings.worker_count}
                          class="input-premium w-24"
                        />
                      </div>

                      {#if queueStats}
                        <div class="p-4 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100/50">
                          <div class="grid grid-cols-4 gap-4 mb-4">
                            <div class="text-center">
                              <p class="text-2xl font-bold text-amber-600">{queueStats.pending}</p>
                              <p class="text-xs text-gray-500">Pending</p>
                            </div>
                            <div class="text-center">
                              <p class="text-2xl font-bold text-blue-600">{queueStats.processing}</p>
                              <p class="text-xs text-gray-500">Processing</p>
                            </div>
                            <div class="text-center">
                              <p class="text-2xl font-bold text-emerald-600">{queueStats.completed}</p>
                              <p class="text-xs text-gray-500">Completed</p>
                            </div>
                            <div class="text-center">
                              <p class="text-2xl font-bold text-red-600">{queueStats.failed}</p>
                              <p class="text-xs text-gray-500">Failed</p>
                            </div>
                          </div>

                          <div class="flex items-center gap-2 mb-4">
                            {#each queueStats.workers as worker}
                              <div class="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-gray-200">
                                <span class="worker-dot {worker.running ? 'running' : 'idle'}"></span>
                                <span class="text-xs text-gray-600">{worker.id.replace('worker-', 'W')}</span>
                              </div>
                            {/each}
                          </div>

                          <div class="flex gap-2">
                            <button onclick={handleStartQueue} class="btn-ghost text-sm bg-emerald-50 text-emerald-600 hover:bg-emerald-100">
                              Start
                            </button>
                            <button onclick={handleStopQueue} class="btn-ghost text-sm bg-red-50 text-red-600 hover:bg-red-100">
                              Stop
                            </button>
                            <button onclick={() => handleClearQueue('completed')} class="btn-ghost text-sm">
                              Clear Done
                            </button>
                          </div>
                        </div>
                      {/if}
                    </div>
                  </div>

                  <!-- Test Prompt -->
                  <div>
                    <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <svg class="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      Test Classification
                    </h3>
                    <div class="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                      <p class="text-xs text-emerald-600">
                        Testing with: <span class="font-bold">{settings.ollama_model}</span>
                      </p>
                    </div>

                    <div class="space-y-3">
                      <input
                        type="text"
                        bind:value={testEmail.fromAddr}
                        placeholder="From address"
                        class="input-premium text-sm"
                      />
                      <input
                        type="text"
                        bind:value={testEmail.subject}
                        placeholder="Subject line"
                        class="input-premium text-sm"
                      />
                      <textarea
                        bind:value={testEmail.bodyPreview}
                        placeholder="Email body preview..."
                        rows="3"
                        class="textarea-premium text-sm"
                      ></textarea>
                      <button
                        onclick={handleTestPrompt}
                        disabled={testing}
                        class="btn-primary w-full flex items-center justify-center gap-2"
                      >
                        {#if testing}
                          <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Testing...</span>
                        {:else}
                          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span>Run Test</span>
                        {/if}
                      </button>

                      {#if testResult}
                        <div class="code-block {testResultType} animate-scale-in whitespace-pre-wrap max-h-64 overflow-auto">
                          {testResult}
                        </div>
                      {/if}
                    </div>
                  </div>
                </div>
              </div>
            {:else}
              <div class="flex items-center justify-center py-16">
                <div class="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    {/if}
  </main>

  <!-- Footer -->
  <footer class="py-8 text-center">
    <div class="flex items-center justify-center gap-2 mb-2">
      <svg viewBox="0 0 48 48" class="w-6 h-6">
        <rect x="8" y="22" width="28" height="14" rx="2" fill="#10b981"/>
        <path d="M36 22h6a2 2 0 012 2v10a2 2 0 01-2 2h-6v-14z" fill="#059669"/>
        <circle cx="16" cy="38" r="3" fill="#374151"/>
        <circle cx="32" cy="38" r="3" fill="#374151"/>
        <rect x="14" y="26" width="16" height="10" rx="1" fill="#818cf8"/>
        <path d="M14 27l8 5 8-5" stroke="#fff" stroke-width="1.5" fill="none"/>
        <rect x="6" y="18" width="32" height="4" rx="1" fill="#6ee7b7"/>
      </svg>
      <span class="text-sm font-medium text-gray-500">Norman's Email Trash Hauling</span>
    </div>
    <p class="text-xs text-gray-400">Powered by Ollama AI - Beep beep!</p>
  </footer>

  <!-- Premium Floating Classification Status Bar -->
  {#if scanning && scanStatus}
    {@const remaining = scanStatus.total - scanStatus.current}
    {@const etaMs = remaining * (scanStatus.avgTimePerEmail || 0)}
    {@const etaMin = Math.floor(etaMs / 60000)}
    {@const etaSec = Math.floor((etaMs % 60000) / 1000)}
    {@const progress = scanStatus.total > 0 ? (scanStatus.current / scanStatus.total) * 100 : 0}
    {@const workers = scanStatus.concurrency || 1}
    <div class="fixed bottom-0 left-0 right-0 z-[100] shadow-2xl">
      <!-- Glassmorphic background -->
      <div class="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-xl"></div>

      <!-- Animated road progress at top - EPIC height for big truck -->
      <div class="relative h-16 bg-gradient-to-b from-slate-700 to-slate-800 overflow-visible">
        <!-- Road texture -->
        <div class="absolute inset-0" style="background: repeating-linear-gradient(90deg, transparent 0px, transparent 40px, rgba(255,255,255,0.03) 40px, rgba(255,255,255,0.03) 42px);"></div>

        <!-- Road edge markings -->
        <div class="absolute top-2 left-0 right-0 h-0.5 bg-white/10"></div>
        <div class="absolute bottom-2 left-0 right-0 h-0.5 bg-white/10"></div>

        <!-- Center line (progress) -->
        <div class="absolute top-1/2 left-0 right-0 h-1.5 -translate-y-1/2">
          <div class="h-full bg-slate-600 rounded-full">
            <div
              class="h-full bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-400 rounded-full transition-all duration-500 ease-out relative overflow-hidden"
              style="width: {progress}%"
            >
              <!-- Dashed line effect -->
              <div class="absolute inset-0" style="background: repeating-linear-gradient(90deg, transparent 0px, transparent 15px, rgba(0,0,0,0.3) 15px, rgba(0,0,0,0.3) 25px); animation: road-move 0.5s linear infinite;"></div>
            </div>
          </div>
        </div>

        <!-- EPIC Animated truck driving on road -->
        <div
          class="absolute top-1/2 -translate-y-1/2 transition-all duration-500 ease-out z-10"
          style="left: calc({Math.min(progress, 97)}% - 50px);"
        >
          <!-- Speed lines trailing behind -->
          <div class="absolute right-full top-1/2 -translate-y-1/2 flex flex-col gap-1 mr-2">
            <div class="h-0.5 bg-gradient-to-l from-emerald-400 to-transparent rounded-full animate-speed-streak" style="width: 40px; animation-delay: 0s;"></div>
            <div class="h-0.5 bg-gradient-to-l from-emerald-300 to-transparent rounded-full animate-speed-streak" style="width: 30px; animation-delay: 0.1s;"></div>
            <div class="h-0.5 bg-gradient-to-l from-emerald-400 to-transparent rounded-full animate-speed-streak" style="width: 35px; animation-delay: 0.2s;"></div>
          </div>

          <!-- Dust clouds from wheels -->
          <div class="absolute -left-4 bottom-0">
            <div class="w-6 h-6 rounded-full bg-amber-200/30 animate-dust-billow" style="animation-delay: 0s;"></div>
            <div class="w-4 h-4 rounded-full bg-amber-100/20 animate-dust-billow absolute top-1" style="animation-delay: 0.2s;"></div>
            <div class="w-5 h-5 rounded-full bg-amber-200/25 animate-dust-billow absolute -top-1 left-2" style="animation-delay: 0.4s;"></div>
          </div>

          <div class="animate-epic-suspension animate-power-surge">
            <svg width="100" height="56" viewBox="0 0 100 56" class="drop-shadow-2xl">
              <!-- Gradient definitions -->
              <defs>
                <linearGradient id="epicTruckBody" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style="stop-color:#4ade80"/>
                  <stop offset="50%" style="stop-color:#22c55e"/>
                  <stop offset="100%" style="stop-color:#16a34a"/>
                </linearGradient>
                <linearGradient id="epicTruckCabin" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style="stop-color:#10b981"/>
                  <stop offset="100%" style="stop-color:#047857"/>
                </linearGradient>
                <linearGradient id="flameGrad" x1="100%" y1="50%" x2="0%" y2="50%">
                  <stop offset="0%" style="stop-color:#fbbf24"/>
                  <stop offset="40%" style="stop-color:#f97316"/>
                  <stop offset="100%" style="stop-color:#ef4444"/>
                </linearGradient>
                <linearGradient id="nitroGrad" x1="100%" y1="50%" x2="0%" y2="50%">
                  <stop offset="0%" style="stop-color:#60a5fa"/>
                  <stop offset="50%" style="stop-color:#3b82f6"/>
                  <stop offset="100%" style="stop-color:#1d4ed8"/>
                </linearGradient>
                <radialGradient id="headlightGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" style="stop-color:#fef3c7"/>
                  <stop offset="60%" style="stop-color:#fde68a"/>
                  <stop offset="100%" style="stop-color:#fbbf24;stop-opacity:0"/>
                </radialGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>

              <!-- EPIC FLAMES from exhaust -->
              <g class="animate-nitro-flame" style="transform-origin: 8px 38px;">
                <ellipse cx="2" cy="38" rx="10" ry="4" fill="url(#flameGrad)" opacity="0.9"/>
                <ellipse cx="5" cy="38" rx="6" ry="2.5" fill="#fbbf24"/>
                <ellipse cx="7" cy="38" rx="3" ry="1.5" fill="#fef3c7"/>
              </g>
              <g class="animate-nitro-flame" style="transform-origin: 8px 42px; animation-delay: 0.05s;">
                <ellipse cx="4" cy="42" rx="8" ry="3" fill="url(#flameGrad)" opacity="0.7"/>
                <ellipse cx="6" cy="42" rx="4" ry="2" fill="#fbbf24"/>
              </g>

              <!-- Smoke/exhaust puffs -->
              <g class="animate-exhaust" style="animation-delay: 0s;">
                <circle cx="0" cy="35" r="4" fill="rgba(255,255,255,0.5)"/>
              </g>
              <g class="animate-exhaust" style="animation-delay: 0.3s;">
                <circle cx="-5" cy="32" r="3" fill="rgba(255,255,255,0.4)"/>
              </g>
              <g class="animate-exhaust" style="animation-delay: 0.6s;">
                <circle cx="-2" cy="28" r="2.5" fill="rgba(255,255,255,0.3)"/>
              </g>

              <!-- Truck shadow (larger) -->
              <ellipse cx="50" cy="54" rx="40" ry="3" fill="rgba(0,0,0,0.25)"/>

              <!-- Truck body (cargo area) -->
              <rect x="8" y="14" width="50" height="28" rx="4" fill="url(#epicTruckBody)"/>
              <!-- Chrome trim line -->
              <rect x="10" y="16" width="46" height="5" rx="2" fill="rgba(255,255,255,0.35)"/>
              <rect x="10" y="16" width="46" height="2" rx="1" fill="rgba(255,255,255,0.2)"/>

              <!-- Recycling logo -->
              <circle cx="33" cy="30" r="8" fill="rgba(255,255,255,0.15)"/>
              <text x="33" y="34" font-size="12" fill="rgba(255,255,255,0.6)" text-anchor="middle">♻</text>

              <!-- Side panel detail -->
              <rect x="12" y="24" width="16" height="14" rx="2" fill="rgba(0,0,0,0.1)"/>
              <rect x="30" y="24" width="16" height="14" rx="2" fill="rgba(0,0,0,0.1)"/>

              <!-- Truck cabin -->
              <path d="M58 14h22a6 6 0 016 6v20a3 3 0 01-3 3H58V14z" fill="url(#epicTruckCabin)"/>
              <path d="M58 14h22a6 6 0 016 6v4H58V14z" fill="#047857"/>

              <!-- Window with epic reflection -->
              <rect x="64" y="18" width="14" height="12" rx="2" fill="#60a5fa"/>
              <rect x="65" y="19" width="4" height="8" rx="1" fill="#93c5fd"/>
              <rect x="76" y="19" width="1" height="8" fill="rgba(255,255,255,0.3)"/>

              <!-- Side mirror -->
              <rect x="80" y="22" width="5" height="4" rx="1" fill="#374151"/>
              <rect x="81" y="23" width="3" height="2" rx="0.5" fill="#60a5fa"/>

              <!-- EPIC Headlight with glow -->
              <g class="animate-headlight-pulse">
                <circle cx="84" cy="36" r="6" fill="url(#headlightGlow)" filter="url(#glow)"/>
                <circle cx="84" cy="36" r="4" fill="#fef3c7"/>
                <circle cx="84" cy="36" r="2.5" fill="#fde68a"/>
                <circle cx="83" cy="35" r="1" fill="#fff"/>
              </g>

              <!-- Front bumper chrome -->
              <rect x="82" y="41" width="6" height="2" rx="1" fill="#9ca3af"/>
              <rect x="82" y="41" width="6" height="1" rx="0.5" fill="#d1d5db"/>

              <!-- Epic wheels with chrome rims -->
              <g style="transform-origin: 26px 46px;" class="animate-wheel-roll">
                <circle cx="26" cy="46" r="9" fill="#1f2937"/>
                <circle cx="26" cy="46" r="7" fill="#374151"/>
                <circle cx="26" cy="46" r="5" fill="#4b5563"/>
                <circle cx="26" cy="46" r="3" fill="#9ca3af"/>
                <circle cx="26" cy="46" r="1.5" fill="#d1d5db"/>
                <!-- Spokes -->
                <rect x="25" y="38" width="2" height="16" fill="#6b7280"/>
                <rect x="18" y="45" width="16" height="2" fill="#6b7280"/>
              </g>
              <g style="transform-origin: 72px 46px;" class="animate-wheel-roll">
                <circle cx="72" cy="46" r="9" fill="#1f2937"/>
                <circle cx="72" cy="46" r="7" fill="#374151"/>
                <circle cx="72" cy="46" r="5" fill="#4b5563"/>
                <circle cx="72" cy="46" r="3" fill="#9ca3af"/>
                <circle cx="72" cy="46" r="1.5" fill="#d1d5db"/>
                <!-- Spokes -->
                <rect x="71" y="38" width="2" height="16" fill="#6b7280"/>
                <rect x="64" y="45" width="16" height="2" fill="#6b7280"/>
              </g>

              <!-- Wheel sparks -->
              <g class="animate-wheel-spark" style="animation-delay: 0s;">
                <circle cx="18" cy="48" r="1" fill="#fbbf24"/>
              </g>
              <g class="animate-wheel-spark" style="animation-delay: 0.15s;">
                <circle cx="20" cy="50" r="0.8" fill="#f97316"/>
              </g>

              <!-- Lid with handle -->
              <rect x="6" y="8" width="54" height="6" rx="3" fill="#6ee7b7"/>
              <rect x="6" y="8" width="54" height="2" rx="1" fill="#86efac"/>
              <rect x="28" y="2" width="16" height="6" rx="3" fill="#4ade80"/>
              <rect x="32" y="4" width="8" height="2" rx="1" fill="#86efac"/>

              <!-- Emails bouncing in back - EPIC version -->
              <g class="animate-epic-email-bounce">
                <rect x="16" y="20" width="14" height="10" rx="2" fill="#818cf8"/>
                <path d="M16 22l7 4 7-4" stroke="#fff" stroke-width="1.2" fill="none"/>
                <rect x="17" y="21" width="12" height="2" fill="rgba(255,255,255,0.2)"/>
              </g>
              <g class="animate-epic-email-bounce" style="animation-delay: 0.1s;">
                <rect x="32" y="22" width="10" height="8" rx="1.5" fill="#a78bfa"/>
                <path d="M32 24l5 3 5-3" stroke="#fff" stroke-width="1" fill="none"/>
              </g>
              <g class="animate-epic-email-bounce" style="animation-delay: 0.2s;">
                <rect x="44" y="21" width="8" height="7" rx="1.5" fill="#c4b5fd"/>
              </g>

              <!-- Chrome shine effect -->
              <rect x="10" y="14" width="2" height="28" fill="rgba(255,255,255,0.3)" class="animate-chrome-shine" style="animation-delay: 0.5s;"/>
            </svg>
          </div>
        </div>

        <!-- Roadside elements -->
        <div class="absolute left-4 top-1/2 -translate-y-1/2 flex items-end gap-8 opacity-30">
          {#each Array(3) as _, i}
            <div class="w-1 bg-emerald-500 rounded-full" style="height: {8 + i * 4}px;"></div>
          {/each}
        </div>
      </div>

      <!-- Main content area -->
      <div class="relative px-6 py-4">
        <div class="max-w-6xl mx-auto flex items-center gap-8">
          <!-- Left: Animated worker trucks -->
          <div class="flex items-center gap-3 flex-shrink-0">
            {#each Array(Math.min(workers, 4)) as _, i}
              <div class="relative" style="animation: float 2s ease-in-out infinite; animation-delay: {i * 0.2}s;">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 flex items-center justify-center border border-emerald-500/30">
                  <svg width="24" height="16" viewBox="0 0 24 16" class="animate-truck-suspension" style="animation-duration: {0.6 + i * 0.1}s;">
                    <rect x="2" y="4" width="12" height="8" rx="1.5" fill="#10b981"/>
                    <path d="M14 4h5a2 2 0 012 2v4a1 1 0 01-1 1h-6V4z" fill="#059669"/>
                    <circle cx="6" cy="13" r="2" fill="#374151"/>
                    <circle cx="16" cy="13" r="2" fill="#374151"/>
                  </svg>
                </div>
                <!-- Active indicator -->
                <div class="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></div>
              </div>
            {/each}
            {#if workers > 4}
              <span class="text-emerald-400 text-sm font-medium">+{workers - 4}</span>
            {/if}
          </div>

          <!-- Center: Email being processed -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-3 mb-1.5">
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Hauling
              </span>
              <span class="text-slate-300 text-sm font-medium tabular-nums">{scanStatus.current} <span class="text-slate-500">of</span> {scanStatus.total}</span>
            </div>
            <div class="flex items-center gap-2.5 text-white">
              <!-- Email icon with animation -->
              <div class="relative flex-shrink-0">
                <svg class="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <span class="truncate font-medium text-lg">{scanStatus.currentEmail || 'Warming up...'}</span>
            </div>
            {#if scanStatus.currentEmailFrom}
              <div class="flex items-center gap-2 text-slate-400 text-sm mt-1">
                <svg class="w-4 h-4 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span class="truncate">{scanStatus.currentEmailFrom}</span>
              </div>
            {/if}
          </div>

          <!-- Right: ETA with large display -->
          <div class="flex items-center gap-5 flex-shrink-0">
            <!-- Progress percentage circle -->
            <div class="relative w-14 h-14">
              <svg class="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="3"/>
                <circle
                  cx="18" cy="18" r="15" fill="none"
                  stroke="url(#progressGrad)"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-dasharray="{progress * 0.942} 94.2"
                  class="transition-all duration-500"
                />
                <defs>
                  <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:#34d399"/>
                    <stop offset="100%" style="stop-color:#10b981"/>
                  </linearGradient>
                </defs>
              </svg>
              <div class="absolute inset-0 flex items-center justify-center">
                <span class="text-white font-bold text-sm tabular-nums">{Math.round(progress)}%</span>
              </div>
            </div>

            <div class="text-right">
              {#if scanStatus.avgTimePerEmail && remaining > 0}
                <div class="text-3xl font-bold tabular-nums text-white tracking-tight">
                  {etaMin > 0 ? `${etaMin}m ` : ''}{etaSec}s
                </div>
                <div class="text-emerald-400 text-xs uppercase tracking-widest font-semibold">remaining</div>
              {:else if scanStatus.current === 0}
                <div class="flex items-center gap-2">
                  <span class="text-lg font-medium text-slate-300">Starting</span>
                  <span class="flex gap-1">
                    <span class="w-1.5 h-1.5 bg-emerald-400 rounded-full loading-dot-1"></span>
                    <span class="w-1.5 h-1.5 bg-emerald-400 rounded-full loading-dot-2"></span>
                    <span class="w-1.5 h-1.5 bg-emerald-400 rounded-full loading-dot-3"></span>
                  </span>
                </div>
              {:else}
                <div class="text-xl font-bold text-emerald-400">Almost done!</div>
                <div class="text-slate-400 text-xs">Finishing up</div>
              {/if}
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom glow line -->
      <div class="h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"></div>
    </div>
  {/if}

  <!-- Spam Pickup Animations -->
  {#each spamPickups as pickup (pickup.id)}
    <div class="fixed bottom-32 right-8 z-[200] pointer-events-none">
      <div class="relative flex items-end gap-4">
        <!-- Trash Can with spam email -->
        <div class="relative {pickup.phase === 'appear' ? 'animate-trashcan-appear' : ''} {pickup.phase === 'shake' ? 'animate-trashcan-shake' : ''} {pickup.phase === 'pickup' ? 'animate-trashcan-pickup' : ''}">
          <svg width="60" height="80" viewBox="0 0 60 80" class="drop-shadow-xl">
            <!-- Trash can body -->
            <defs>
              <linearGradient id="trashcanGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#6b7280"/>
                <stop offset="50%" style="stop-color:#9ca3af"/>
                <stop offset="100%" style="stop-color:#6b7280"/>
              </linearGradient>
            </defs>

            <!-- Can body -->
            <path d="M8 20 L12 75 Q13 78 16 78 L44 78 Q47 78 48 75 L52 20 Z" fill="url(#trashcanGrad)"/>

            <!-- Ridges on can -->
            <rect x="10" y="30" width="40" height="3" fill="rgba(0,0,0,0.15)" rx="1"/>
            <rect x="10" y="45" width="40" height="3" fill="rgba(0,0,0,0.15)" rx="1"/>
            <rect x="10" y="60" width="40" height="3" fill="rgba(0,0,0,0.15)" rx="1"/>

            <!-- Lid -->
            <ellipse cx="30" cy="20" rx="26" ry="6" fill="#4b5563"/>
            <ellipse cx="30" cy="18" rx="24" ry="5" fill="#6b7280"/>

            <!-- Handle -->
            <rect x="26" y="8" width="8" height="10" rx="2" fill="#4b5563"/>
            <rect x="27" y="10" width="6" height="6" rx="1" fill="#6b7280"/>

            <!-- Spam email sticking out -->
            <g style="transform-origin: 30px 15px;" class="{pickup.phase === 'shake' ? 'animate-email-bounce' : ''}">
              <rect x="18" y="4" width="24" height="16" rx="2" fill="#ef4444" transform="rotate(-10 30 12)"/>
              <path d="M20 7 L30 14 L40 7" stroke="#fff" stroke-width="1.5" fill="none" transform="rotate(-10 30 12)"/>
              <text x="30" y="16" font-size="8" fill="#fff" text-anchor="middle" font-weight="bold" transform="rotate(-10 30 12)">SPAM</text>
            </g>
          </svg>

          <!-- Email info badge -->
          <div class="absolute -top-2 -left-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold shadow-lg animate-spam-pulse whitespace-nowrap max-w-32 truncate">
            {pickup.from}
          </div>
        </div>

        <!-- Mini truck that comes to pick up (only show during pickup phase) -->
        {#if pickup.phase === 'pickup'}
          <div class="absolute -right-24 bottom-0 animate-minitruck-enter">
            <svg width="80" height="50" viewBox="0 0 80 50" class="drop-shadow-lg">
              <!-- Truck body -->
              <rect x="8" y="15" width="35" height="22" rx="3" fill="#10b981"/>
              <rect x="10" y="17" width="31" height="4" rx="1" fill="rgba(255,255,255,0.25)"/>

              <!-- Cabin -->
              <path d="M43 15h20a4 4 0 014 4v14a2 2 0 01-2 2H43V15z" fill="#059669"/>
              <rect x="48" y="18" width="10" height="8" rx="1.5" fill="#60a5fa"/>

              <!-- Headlight -->
              <circle cx="65" cy="28" r="2.5" fill="#fde68a"/>

              <!-- Wheels -->
              <circle cx="20" cy="40" r="6" fill="#1f2937"/>
              <circle cx="20" cy="40" r="3" fill="#4b5563"/>
              <circle cx="55" cy="40" r="6" fill="#1f2937"/>
              <circle cx="55" cy="40" r="3" fill="#4b5563"/>

              <!-- Grabber arm -->
              <rect x="2" y="12" width="4" height="20" rx="1" fill="#374151"/>
              <path d="M0 32 L8 32 L8 28 L0 28 Z" fill="#4b5563"/>
            </svg>
          </div>
        {/if}

        <!-- Sparkles on pickup -->
        {#if pickup.phase === 'pickup'}
          <div class="absolute top-0 left-1/2 -translate-x-1/2">
            <div class="absolute animate-sparkle-burst" style="animation-delay: 0s;">
              <svg width="20" height="20" viewBox="0 0 20 20">
                <path d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8 Z" fill="#fbbf24"/>
              </svg>
            </div>
            <div class="absolute -left-4 top-2 animate-sparkle-burst" style="animation-delay: 0.1s;">
              <svg width="14" height="14" viewBox="0 0 20 20">
                <path d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8 Z" fill="#f97316"/>
              </svg>
            </div>
            <div class="absolute left-4 top-4 animate-sparkle-burst" style="animation-delay: 0.2s;">
              <svg width="12" height="12" viewBox="0 0 20 20">
                <path d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8 Z" fill="#ef4444"/>
              </svg>
            </div>
          </div>
        {/if}
      </div>

      <!-- Subject line tooltip -->
      <div class="mt-2 bg-slate-900/90 backdrop-blur text-white text-xs px-3 py-2 rounded-lg shadow-xl max-w-48 truncate">
        <span class="text-red-400 font-bold">SPAM:</span> {pickup.subject}
      </div>
    </div>
  {/each}
</div>
