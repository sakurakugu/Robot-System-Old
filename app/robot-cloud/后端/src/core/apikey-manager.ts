import type { 所有供应商枚举 } from '../modules/大模型管理/types';

class ApiKeyManager {
  private keys = new Map<所有供应商枚举, string>();

  set(provider: 所有供应商枚举, apiKey: string): void {
    const normalized = apiKey.trim();
    if (!normalized) {
      this.keys.delete(provider);
      return;
    }
    this.keys.set(provider, normalized);
  }

  get(provider: 所有供应商枚举): string {
    return this.keys.get(provider) || '';
  }

  has(provider: 所有供应商枚举): boolean {
    return this.get(provider).length > 0;
  }

  length(provider: 所有供应商枚举): number {
    return this.get(provider).length;
  }
}

export const apiKeyManager = new ApiKeyManager();

