// Chrome's "install this site as an app" prompt arrives as a one-shot event,
// often before React has mounted — so the listener lives at module scope and
// stashes it. The app subscribes and, when a prompt is being held and the app
// is running in a plain browser tab, offers a real Install button. Tapping it
// hands the stored prompt to Chrome, which installs the standalone offline
// app with its own icon — the thing "Add to Home screen" only sometimes does.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as BeforeInstallPromptEvent;
  emit();
});

window.addEventListener('appinstalled', () => {
  deferred = null;
  emit();
});

export function canInstall(): boolean {
  return deferred !== null;
}

export function subscribeInstall(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const res = await deferred.userChoice;
  if (res.outcome === 'accepted') deferred = null;
  emit();
  return res.outcome === 'accepted';
}

/** Already running as the installed standalone app? */
export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true;
}
