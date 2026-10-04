export {};

declare global {
  interface Window {
    SmallGamesDev: Readonly<{
      isEnabled(): boolean;
      state(): { enabled: boolean; source: 'url' | 'parent-url' | 'storage' | 'default' };
      withMode(search?: string): string;
      inspect(): unknown;
      refresh(): void;
      setPanelHidden(hidden: boolean): void;
      registerActions(
        actions: readonly { id: string; label: string; run(): unknown }[],
      ): () => void;
      registerSnapshot(read: () => unknown): () => void;
    }>;
  }
}
