// 将棋ゲームの定数定義

export const BOARD_SIZE = 9;
export const ENEMY_TERRITORY_SENTE = 3; // 先手の敵陣（0-2行目）
export const ENEMY_TERRITORY_GOTE = 5; // 後手の敵陣（6-8行目）

// プレイヤー
export const PLAYER = {
    SENTE: 'sente',
    GOTE: 'gote'
};

// ゲームモード
export const GAME_MODE = {
    HUMAN_VS_HUMAN: 'human-vs-human',
    HUMAN_VS_AI: 'human-vs-ai',
    AI_VS_AI: 'ai-vs-ai'
};

// AIレベル
export const AI_LEVEL = {
    BEGINNER: 'beginner',
    INTERMEDIATE: 'intermediate',
    ADVANCED: 'advanced',
    OLLAMA: 'ollama', // Ollama LLMを使用
    USI: 'usi' // USIプロトコルを使用
};

// Ollama設定
export const OLLAMA_CONFIG = {
    ENDPOINT: 'http://localhost:11434', // Ollama APIエンドポイント
    MODEL: 'gemma3:1b', // デフォルトモデル
    TIMEOUT: 30000 // タイムアウト（ミリ秒）
};

// USI設定
export const USI_CONFIG = {
    SERVER_URL: 'http://localhost:8080', // USIサーバーのURL
    TIMEOUT: 30000 // タイムアウト（ミリ秒）
};

// 駒の種類
export const PIECE_TYPE = {
    KING: 'k',
    GOLD: 'g',
    SILVER: 's',
    KNIGHT: 'n',
    LANCE: 'l',
    BISHOP: 'b',
    ROOK: 'r',
    PAWN: 'p'
};

// 駒の表示名
export const PIECE_NAMES = {
    'K': '王', 'k': '王',
    'G': '金', 'g': '金',
    'S': '銀', 's': '銀',
    'N': '桂', 'n': '桂',
    'L': '香', 'l': '香',
    'B': '角', 'b': '角',
    'R': '飛', 'r': '飛',
    'P': '歩', 'p': '歩',
    '+B': '馬', '+b': '馬',
    '+R': '龍', '+r': '龍',
    '+S': '全', '+s': '全',
    '+N': '圭', '+n': '圭',
    '+L': '杏', '+l': '杏',
    '+P': 'と', '+p': 'と'
};

// 駒の価値（AI評価用）
export const PIECE_VALUES = {
    'k': 10000, 'K': 10000, // 王
    'r': 500, 'R': 500,     // 飛
    'b': 400, 'B': 400,     // 角
    'g': 300, 'G': 300,     // 金
    's': 200, 'S': 200,     // 銀
    'n': 150, 'N': 150,     // 桂
    'l': 150, 'L': 150,     // 香
    'p': 100, 'P': 100,     // 歩
    '+r': 600, '+R': 600,   // 龍
    '+b': 550, '+B': 550,   // 馬
    '+s': 250, '+S': 250,   // 全
    '+n': 200, '+N': 200,   // 圭
    '+l': 200, '+L': 200,   // 杏
    '+p': 150, '+P': 150    // と
};

// 初期盤面配置
export const INITIAL_BOARD = (() => {
    const board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
    
    // 後手（上側）の初期配置
    board[0] = ['l', 'n', 's', 'g', 'k', 'g', 's', 'n', 'l'];
    board[1][1] = 'r';
    board[1][7] = 'b';
    board[2] = ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'];
    
    // 先手（下側）の初期配置
    board[6] = ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'];
    board[7][1] = 'B';
    board[7][7] = 'R';
    board[8] = ['L', 'N', 'S', 'G', 'K', 'G', 'S', 'N', 'L'];
    
    return board;
})();

// AI思考時間（ミリ秒）
export const AI_THINKING_TIME = {
    MIN: 500,
    MAX: 1500
};

// ミニマックス探索の深度
export const MINIMAX_DEPTH = 2;
export const MINIMAX_MOVE_LIMIT = 10; // 評価する手の数（パフォーマンス向上のため）

// UI更新の遅延時間（ミリ秒）
export const UI_UPDATE_DELAY = 100;
