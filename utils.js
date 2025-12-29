// 共通ユーティリティ関数

/**
 * ログレベル定義
 */
export const LOG_LEVEL = {
    ERROR: 0,   // 本番環境でも表示
    WARN: 1,    // 本番環境でも表示
    INFO: 2,    // 開発環境のみ
    DEBUG: 3    // 開発環境のみ（詳細）
};

/**
 * 現在のログレベル（開発環境ではDEBUG、本番環境ではWARN）
 */
const currentLogLevel = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production' 
    ? LOG_LEVEL.WARN 
    : LOG_LEVEL.DEBUG;

/**
 * 統一されたログ関数
 * @param {number} level - ログレベル
 * @param {string} message - ログメッセージ
 * @param {*} data - 追加データ（オプション）
 */
export function log(level, message, data = null) {
    if (level > currentLogLevel) return;

    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const prefix = `[${timestamp}]`;

    switch (level) {
        case LOG_LEVEL.ERROR:
            console.error(`%c${prefix} ERROR: ${message}`, 'color: #F44336; font-weight: bold', data || '');
            break;
        case LOG_LEVEL.WARN:
            console.warn(`%c${prefix} WARN: ${message}`, 'color: #FF9800; font-weight: bold', data || '');
            break;
        case LOG_LEVEL.INFO:
            console.log(`%c${prefix} INFO: ${message}`, 'color: #4CAF50; font-weight: bold', data || '');
            break;
        case LOG_LEVEL.DEBUG:
            console.log(`${prefix} DEBUG: ${message}`, data || '');
            break;
    }
}

/**
 * オブジェクトのディープクローンを作成
 * @param {*} obj - クローンするオブジェクト
 * @returns {*} クローンされたオブジェクト
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => deepClone(item));
    }

    const cloned = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            cloned[key] = deepClone(obj[key]);
        }
    }
    return cloned;
}

/**
 * 指定ミリ秒待機する
 * @param {number} ms - 待機時間（ミリ秒）
 * @returns {Promise<void>}
 */
export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * ランダムな遅延時間を生成
 * @param {number} min - 最小時間（ミリ秒）
 * @param {number} max - 最大時間（ミリ秒）
 * @returns {number} ランダムな遅延時間
 */
export function randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 時間をフォーマット（ミリ秒を秒に変換）
 * @param {number} ms - ミリ秒
 * @returns {string} フォーマットされた時間
 */
export function formatTime(ms) {
    return `${(ms / 1000).toFixed(2)}秒`;
}

/**
 * 配列からランダムな要素を取得
 * @param {Array} array - 配列
 * @returns {*} ランダムな要素
 */
export function randomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * 2つの配列が等しいかチェック
 * @param {Array} arr1 - 配列1
 * @param {Array} arr2 - 配列2
 * @returns {boolean} 等しい場合true
 */
export function arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
        if (Array.isArray(arr1[i]) && Array.isArray(arr2[i])) {
            if (!arraysEqual(arr1[i], arr2[i])) return false;
        } else if (arr1[i] !== arr2[i]) {
            return false;
        }
    }
    return true;
}
