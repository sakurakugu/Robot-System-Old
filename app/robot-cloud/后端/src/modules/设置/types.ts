
/**
 * UI 配置
 */
export interface UIConfig {
    serverUrl: string;
    wsPath: string;
    wsControlUrl: string;
    wsBusinessUrl: string;
    wsAudioUploadUrl: string;
    wsAudioDownloadUrl: string;
    maxHistory: number;
    controlLayout: Record<string, { x: number; y: number }> | null;
}
