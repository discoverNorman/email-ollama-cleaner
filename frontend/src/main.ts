import './app.css';
import App from './App.svelte';
import { mount } from 'svelte';

const app = mount(App, {
  target: document.getElementById('app')!,
});

// Hide initial loading screen after app mounts
if (typeof window !== 'undefined' && (window as any).hideInitialLoader) {
  (window as any).hideInitialLoader();
}

export default app;
