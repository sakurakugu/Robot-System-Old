
/**
 * UI 配置
 */
export interface UIConfig {
    serverUrl: string;
    maxHistory: number;
    controlLayout: Record<string, { x: number; y: number }> | null;
}

export interface AIConfig {
    xunfeiAsr: {
        hasAppId: boolean;
        appIdLength: number;
        hasApiKey: boolean;
        apiKeyLength: number;
        hasApiSecret: boolean;
        apiSecretLength: number;
    };
}
