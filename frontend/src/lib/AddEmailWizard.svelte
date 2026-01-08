<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let show = false;
  export let providers: any[] = [];

  const dispatch = createEventDispatcher();

  let step = 1;
  let accountData = {
    name: '',
    provider: '',
    email: '',
    password: '',
    host: '',
    port: 993,
    customHost: false
  };

  let testing = false;
  let testResult: { success: boolean; message: string } | null = null;
  let saving = false;

  const providerDefaults = {
    gmail: { host: 'imap.gmail.com', port: 993 },
    outlook: { host: 'outlook.office365.com', port: 993 },
    yahoo: { host: 'imap.mail.yahoo.com', port: 993 },
    icloud: { host: 'imap.mail.me.com', port: 993 },
    aol: { host: 'imap.aol.com', port: 993 },
  };

  function selectProvider(provider: string) {
    accountData.provider = provider;
    if (provider in providerDefaults) {
      const defaults = providerDefaults[provider as keyof typeof providerDefaults];
      accountData.host = defaults.host;
      accountData.port = defaults.port;
      accountData.customHost = false;
    } else {
      accountData.customHost = true;
    }
    nextStep();
  }

  function nextStep() {
    if (step === 1 && !accountData.provider) return;
    if (step === 2 && (!accountData.email || !accountData.password)) return;
    if (step === 3 && accountData.customHost && (!accountData.host || !accountData.port)) return;

    step++;
  }

  function prevStep() {
    if (step > 1) step--;
  }

  async function testConnection() {
    testing = true;
    testResult = null;

    try {
      const response = await fetch('/api/email-accounts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: accountData.provider,
          email: accountData.email,
          password: accountData.password,
          imapHost: accountData.host,
          imapPort: accountData.port
        })
      });

      const result = await response.json();

      if (result.success) {
        testResult = { success: true, message: 'Connection successful!' };
        // Auto-advance after success
        setTimeout(() => nextStep(), 1500);
      } else {
        testResult = { success: false, message: result.error || 'Connection failed' };
      }
    } catch (error) {
      testResult = { success: false, message: `Network error: ${error}` };
    } finally {
      testing = false;
    }
  }

  async function saveAccount() {
    saving = true;

    try {
      const response = await fetch('/api/email-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: accountData.name || `${accountData.provider} - ${accountData.email}`,
          email: accountData.email,
          provider: accountData.provider,
          imapHost: accountData.host,
          imapPort: accountData.port,
          imapUser: accountData.email,
          imapPassword: accountData.password
        })
      });

      const result = await response.json();

      if (result.success) {
        dispatch('accountAdded', result.account);
        closeWizard();
      } else {
        testResult = { success: false, message: result.error || 'Failed to save account' };
      }
    } catch (error) {
      testResult = { success: false, message: `Failed to save: ${error}` };
    } finally {
      saving = false;
    }
  }

  function closeWizard() {
    step = 1;
    accountData = {
      name: '',
      provider: '',
      email: '',
      password: '',
      host: '',
      port: 993,
      customHost: false
    };
    testResult = null;
    dispatch('close');
  }
</script>

{#if show}
  <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden animate-scale-in">
      <!-- Header -->
      <div class="p-6 bg-gradient-to-br from-emerald-500 to-green-600 text-white">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-2xl font-bold">Add Email Account</h2>
            <p class="text-emerald-100 text-sm mt-1">Step {step} of 4</p>
          </div>
          <button onclick={closeWizard} class="p-2 rounded-xl hover:bg-white/20 transition-colors">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Progress bar -->
        <div class="mt-4 h-3 bg-white/30 rounded-full overflow-hidden">
          <div class="h-full bg-white rounded-full transition-all duration-300" style="width: {step * 25}%"></div>
        </div>
      </div>

      <div class="p-8">
        <!-- Step 1: Select Provider -->
        {#if step === 1}
          <div class="space-y-6">
            <p class="text-gray-700 text-lg font-medium mb-6">Choose your email provider:</p>

            <div class="grid grid-cols-2 gap-4">
              <button
                onclick={() => selectProvider('gmail')}
                class="p-6 rounded-2xl border-3 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group"
              >
                <div class="text-2xl mb-2">📧</div>
                <div class="font-bold text-gray-900 text-lg">Gmail</div>
                <div class="text-sm text-gray-500 mt-1">Google Mail</div>
              </button>

              <button
                onclick={() => selectProvider('outlook')}
                class="p-6 rounded-2xl border-3 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group"
              >
                <div class="text-2xl mb-2">📨</div>
                <div class="font-bold text-gray-900 text-lg">Outlook</div>
                <div class="text-sm text-gray-500 mt-1">Microsoft Mail</div>
              </button>

              <button
                onclick={() => selectProvider('yahoo')}
                class="p-6 rounded-2xl border-3 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group"
              >
                <div class="text-2xl mb-2">💌</div>
                <div class="font-bold text-gray-900 text-lg">Yahoo</div>
                <div class="text-sm text-gray-500 mt-1">Yahoo Mail</div>
              </button>

              <button
                onclick={() => selectProvider('custom')}
                class="p-6 rounded-2xl border-3 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group"
              >
                <div class="text-2xl mb-2">⚙️</div>
                <div class="font-bold text-gray-900 text-lg">Other</div>
                <div class="text-sm text-gray-500 mt-1">Custom Settings</div>
              </button>
            </div>
          </div>
        {/if}

        <!-- Step 2: Email & Password -->
        {#if step === 2}
          <div class="space-y-6">
            <h3 class="text-xl font-bold text-gray-900">Enter your credentials</h3>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <input
                type="email"
                bind:value={accountData.email}
                placeholder="you@example.com"
                class="w-full px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-emerald-500 focus:ring-emerald-500 text-lg"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                {accountData.provider === 'gmail' ? 'App Password' : 'Password'}
              </label>
              <input
                type="password"
                bind:value={accountData.password}
                placeholder="••••••••••••••••"
                class="w-full px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-emerald-500 focus:ring-emerald-500 text-lg"
              />
              {#if accountData.provider === 'gmail'}
                <p class="text-sm text-gray-500 mt-2">
                  💡 Use an <a href="https://myaccount.google.com/apppasswords" target="_blank" class="text-emerald-600 hover:underline">App Password</a>, not your regular password
                </p>
              {/if}
            </div>

            <div class="flex gap-3 mt-8">
              <button
                onclick={prevStep}
                class="flex-1 px-6 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onclick={nextStep}
                disabled={!accountData.email || !accountData.password}
                class="flex-1 px-6 py-3 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        {/if}

        <!-- Step 3: Test Connection -->
        {#if step === 3}
          <div class="space-y-6">
            <h3 class="text-xl font-bold text-gray-900">Test Connection</h3>

            <div class="bg-gray-50 rounded-xl p-4 space-y-2">
              <div class="flex justify-between">
                <span class="text-gray-600">Email:</span>
                <span class="font-medium">{accountData.email}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Server:</span>
                <span class="font-medium">{accountData.host}:{accountData.port}</span>
              </div>
            </div>

            {#if testResult}
              <div class="p-4 rounded-xl {testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}">
                <div class="flex items-center gap-3">
                  {#if testResult.success}
                    <svg class="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                  {:else}
                    <svg class="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  {/if}
                  <span class="font-medium {testResult.success ? 'text-green-800' : 'text-red-800'}">{testResult.message}</span>
                </div>
              </div>
            {/if}

            <div class="flex gap-3 mt-8">
              <button
                onclick={prevStep}
                class="flex-1 px-6 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onclick={testConnection}
                disabled={testing}
                class="flex-1 px-6 py-3 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {#if testing}
                  <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Testing...</span>
                {:else}
                  <span>Test Connection</span>
                {/if}
              </button>
            </div>
          </div>
        {/if}

        <!-- Step 4: Name & Save -->
        {#if step === 4}
          <div class="space-y-6">
            <h3 class="text-xl font-bold text-gray-900">Almost done!</h3>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Account Name (Optional)
              </label>
              <input
                type="text"
                bind:value={accountData.name}
                placeholder="Personal Gmail, Work Email, etc."
                class="w-full px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-emerald-500 focus:ring-emerald-500 text-lg"
              />
              <p class="text-sm text-gray-500 mt-2">
                Give this account a friendly name to identify it easily
              </p>
            </div>

            <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <p class="text-sm text-emerald-800">
                ✓ Connection verified! Ready to save this account.
              </p>
            </div>

            <div class="flex gap-3 mt-8">
              <button
                onclick={prevStep}
                class="flex-1 px-6 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onclick={saveAccount}
                disabled={saving}
                class="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold hover:from-emerald-600 hover:to-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {#if saving}
                  <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving...</span>
                {:else}
                  <span>Save Account</span>
                {/if}
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .border-3 {
    border-width: 3px;
  }

  @keyframes scale-in {
    from {
      transform: scale(0.9);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  .animate-scale-in {
    animation: scale-in 0.3s ease-out;
  }
</style>
