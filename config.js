// コンフィグファイルを読み込むモジュール

// デフォルト設定（フォールバック用）
const DEFAULT_CONFIG = {
    ollama: {
        endpoint: 'http://localhost:11434',
        model: 'gemma3:1b',
        timeout: 30000
    },
    usi: {
        serverUrl: 'http://localhost:8080',
        timeout: 30000
    }
};

// 設定を保持する変数
let loadedConfig = null;

/**
 * コンフィグファイルを読み込む
 * @returns {Promise<Object>} 設定オブジェクト
 */
export async function loadConfig() {
    if (loadedConfig) {
        return loadedConfig;
    }

    try {
        const response = await fetch('./config.json');
        if (!response.ok) {
            throw new Error(`Failed to load config.json: ${response.status}`);
        }
        const config = await response.json();
        
        // デフォルト値とマージ
        loadedConfig = {
            ollama: {
                endpoint: config.ollama?.endpoint ?? DEFAULT_CONFIG.ollama.endpoint,
                model: config.ollama?.model ?? DEFAULT_CONFIG.ollama.model,
                timeout: config.ollama?.timeout ?? DEFAULT_CONFIG.ollama.timeout
            },
            usi: {
                serverUrl: config.usi?.serverUrl ?? DEFAULT_CONFIG.usi.serverUrl,
                timeout: config.usi?.timeout ?? DEFAULT_CONFIG.usi.timeout
            }
        };
        
        return loadedConfig;
    } catch (error) {
        console.warn('Failed to load config.json, using default values:', error);
        loadedConfig = DEFAULT_CONFIG;
        return loadedConfig;
    }
}

/**
 * 設定を取得（既に読み込まれている場合は即座に返す）
 * @returns {Object} 設定オブジェクト（デフォルト値）
 */
export function getConfig() {
    return loadedConfig || DEFAULT_CONFIG;
}

