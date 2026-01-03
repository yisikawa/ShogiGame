// 将棋ゲームのメインロジック

import {
    BOARD_SIZE,
    INITIAL_BOARD,
    PIECE_NAMES,
    PLAYER,
    AI_LEVEL,
    ENEMY_TERRITORY_SENTE,
    ENEMY_TERRITORY_GOTE,
    PIECE_TYPE,
    AI_THINKING_TIME,
    UI_UPDATE_DELAY,
    OLLAMA_CONFIG
} from './constants.js';
import { PieceMoves } from './pieceMoves.js';
import { ShogiAI } from './ai.js';
import { UIManager } from './UIManager.js';
import { AIManager } from './AIManager.js';
import { HistoryManager } from './HistoryManager.js';
import { log, LOG_LEVEL } from './utils.js';

/**
 * 将棋ゲームのメインクラス
 */
export class ShogiGame {
    constructor() {
        this.ShogiAI = ShogiAI; // AIManagerで使用するため

        // 状態の初期化
        this.board = this.initializeBoard();
        this.currentTurn = PLAYER.SENTE;
        this.selectedCell = null;
        this.selectedCapturedPiece = null;
        this.capturedPieces = {
            sente: [],
            gote: []
        };
        this.aiLevelSente = AI_LEVEL.HUMAN;
        this.aiLevelGote = AI_LEVEL.HUMAN;
        this.aiSente = null;
        this.aiGote = null;
        this.gameOver = false;
        this.winner = null;
        this.gameStarted = false;
        this.isReplaying = false;

        // マネージャーの初期化
        this.ui = new UIManager(this);
        this.ai = new AIManager(this);
        this.history = new HistoryManager(this);

        // 駒の移動ロジックを初期化
        this.pieceMoves = new PieceMoves(
            this.board,
            (row, col) => this.isValidPosition(row, col),
            (piece) => this.isSente(piece),
            (piece) => this.isGote(piece)
        );

        this.init();
    }

    /**
     * 盤面を初期化
     */
    initializeBoard() {
        // 初期盤面をコピー
        return INITIAL_BOARD.map(row => [...row]);
    }

    /**
     * 初期化処理
     */
    init() {
        this.ui.updateUI();
        this.setupEventListeners();
        this.ui.scheduleAISettingsUpdate();
        this.reset();
    }

<<<<<<< HEAD

=======
    /**
     * AIインスタンスを作成
     * @param {string} player - PLAYER.SENTE または PLAYER.GOTE
     * @returns {ShogiAI|null} - AIインスタンス、または「人間」の場合はnull
     */
    createAI(player) {
        // 先手または後手のAIを作成
        const isSente = player === PLAYER.SENTE;
        const aiLevel = isSente ? this.aiLevelSente : this.aiLevelGote;
        
        // 「人間」の場合はnullを返す
        if (aiLevel === AI_LEVEL.HUMAN) {
            return null;
        }
        
        // Ollamaモデルを取得
        let ollamaModel = OLLAMA_CONFIG.MODEL;
        if (isSente) {
            const ollamaModelInput = document.getElementById('ollamaModelSente');
            if (ollamaModelInput && ollamaModelInput.value.trim()) {
                ollamaModel = ollamaModelInput.value.trim();
            }
        } else {
            const ollamaModelInput = document.getElementById('ollamaModelGote');
            if (ollamaModelInput && ollamaModelInput.value.trim()) {
                ollamaModel = ollamaModelInput.value.trim();
            }
        }
        
        // USIサーバーURLを取得（デフォルト: http://localhost:8080）
        let usiServerUrl = 'http://localhost:8080'; // デフォルト値
        let usiServerUrlElement = null;
        if (isSente) {
            usiServerUrlElement = document.getElementById('usiServerUrlSente');
            if (usiServerUrlElement) {
                const currentValue = usiServerUrlElement.value.trim();
                // 元のURLが保存されている場合はそれを使用（最優先）
                if (usiServerUrlElement.dataset.originalUrl) {
                    usiServerUrl = usiServerUrlElement.dataset.originalUrl;
                    console.log(`[Game] 先手USI URL取得: dataset.originalUrl = ${usiServerUrl}`);
                } 
                // 現在の値がURL形式の場合はそれを使用
                else if (currentValue && (currentValue.startsWith('http://') || currentValue.startsWith('https://'))) {
                    usiServerUrl = currentValue;
                    // 元のURLとして保存
                    usiServerUrlElement.dataset.originalUrl = currentValue;
                    console.log(`[Game] 先手USI URL取得: 現在の値 = ${usiServerUrl}`);
                }
                // それでも見つからない場合はデフォルト値を使用（既に設定済み）
                if (usiServerUrl === 'http://localhost:8080') {
                    console.warn(`[Game] 先手USI URL: デフォルト値を使用 = ${usiServerUrl}`);
                }
            }
        } else {
            usiServerUrlElement = document.getElementById('usiServerUrlGote');
            if (usiServerUrlElement) {
                const currentValue = usiServerUrlElement.value.trim();
                // 元のURLが保存されている場合はそれを使用（最優先）
                if (usiServerUrlElement.dataset.originalUrl) {
                    usiServerUrl = usiServerUrlElement.dataset.originalUrl;
                    console.log(`[Game] 後手USI URL取得: dataset.originalUrl = ${usiServerUrl}`);
                } 
                // 現在の値がURL形式の場合はそれを使用
                else if (currentValue && (currentValue.startsWith('http://') || currentValue.startsWith('https://'))) {
                    usiServerUrl = currentValue;
                    // 元のURLとして保存
                    usiServerUrlElement.dataset.originalUrl = currentValue;
                    console.log(`[Game] 後手USI URL取得: 現在の値 = ${usiServerUrl}`);
                }
                // それでも見つからない場合はデフォルト値を使用（既に設定済み）
                if (usiServerUrl === 'http://localhost:8080') {
                    console.warn(`[Game] 後手USI URL: デフォルト値を使用 = ${usiServerUrl}`);
                }
            }
        }
        
        console.log(`[Game] createAI: ${isSente ? '先手' : '後手'}, USI URL = ${usiServerUrl}`);
        const ai = new ShogiAI(aiLevel, null, ollamaModel, usiServerUrl);
        
        // USIエンジンの場合、エンジン名取得時のコールバックを設定
        if (aiLevel === AI_LEVEL.USI && usiServerUrlElement) {
            // 元のURLを保存（デフォルト値も含む）
            if (!usiServerUrlElement.dataset.originalUrl) {
                usiServerUrlElement.dataset.originalUrl = usiServerUrl || 'http://localhost:8080';
            }
            
            // エンジン名表示欄の要素を取得
            const engineNameElementId = isSente ? 'usiEngineNameSente' : 'usiEngineNameGote';
            const engineNameElement = document.getElementById(engineNameElementId);
            
            ai.setEngineNameCallback((engineName, engineAuthor) => {
                // エンジン名を表示用テキストに整形
                const displayText = engineAuthor ? `${engineName} (${engineAuthor})` : engineName;
                
                // 元のURLを確実に保持
                if (!usiServerUrlElement.dataset.originalUrl) {
                    usiServerUrlElement.dataset.originalUrl = usiServerUrl || 'http://localhost:8080';
                }
                
                // URL入力欄はURLのまま保持（編集可能）
                // エンジン名は別の要素に表示
                if (engineNameElement) {
                    engineNameElement.value = displayText;
                }
            });
            
            // USIエンジンの初期化は「ニューゲーム」ボタンが押されるまで実行しない
            // （ニューゲームボタンのイベントハンドラで実行される）
        }
        
        return ai;
    }
    
    /**
     * USIエンジンを初期化し、新しいゲームを開始する
     * （ニューゲームボタンが押された時に呼ばれる）
     */
    initializeUSIEngines() {
        const engines = [
            { ai: this.aiSente, name: '先手' },
            { ai: this.aiGote, name: '後手' }
        ];
        
        engines.forEach(({ ai, name }) => {
            if (ai && ai.usiClient) {
                this.initializeSingleUSIEngine(ai.usiClient, name);
            }
        });
    }
    
    /**
     * 単一のUSIエンジンを初期化し、新しいゲームを開始する
     * @param {USIClient} usiClient - USIクライアントインスタンス
     * @param {string} name - エンジン名（先手/後手）
     */
    async initializeSingleUSIEngine(usiClient, name) {
        try {
            // エンジン初期化（接続とエンジン名取得）
            await usiClient.initialize();
            
            // 初期化成功後、ゲーム開始時にusinewgameを送信
            await usiClient.sendNewGame();
        } catch (error) {
            // エラーハンドリング（初期化エラーまたはusinewgameエラー）
            console.warn(`[Game] ${name}USIエンジン処理エラー:`, error.message);
        }
    }
    
    /**
     * Ollamaモデルが利用可能か確認し、必要に応じて起動する
     * @param {string} modelName - 確認するモデル名
     * @param {string} playerName - プレイヤー名（先手/後手）
     */
    async checkOllamaModel(modelName, playerName) {
        if (!modelName || !modelName.trim()) {
            console.warn(`[Game] ${playerName}Ollamaモデル名が空です`);
            return;
        }
        
        const endpoint = OLLAMA_CONFIG.ENDPOINT;
        const timeout = 30000; // 30秒のタイムアウト
        
        try {
            // まずモデル一覧を取得してモデルが存在するか確認
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            const modelsResponse = await fetch(`${endpoint}/api/tags`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!modelsResponse.ok) {
                throw new Error(`Ollamaサーバーに接続できません: ${modelsResponse.status}`);
            }
            
            const modelsData = await modelsResponse.json();
            const availableModels = modelsData.models || [];
            const modelExists = availableModels.some(model => {
                const name = model.name || model.model || '';
                return name === modelName || name.startsWith(`${modelName}:`);
            });
            
            if (!modelExists) {
                console.warn(`[Game] ${playerName}Ollamaモデル "${modelName}" が見つかりません。モデルをプルします...`);
                
                // モデルが存在しない場合、プルを試みる
                const pullController = new AbortController();
                const pullTimeoutId = setTimeout(() => pullController.abort(), timeout * 10); // プルは長めに設定（5分）
                
                const pullResponse = await fetch(`${endpoint}/api/pull`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: modelName }),
                    signal: pullController.signal
                });
                
                if (!pullResponse.ok) {
                    clearTimeout(pullTimeoutId);
                    throw new Error(`モデル "${modelName}" のプルに失敗しました: ${pullResponse.status}`);
                }
                
                // ストリーミングレスポンスを処理
                const reader = pullResponse.body.getReader();
                const decoder = new TextDecoder();
                let pullComplete = false;
                
                try {
                    while (!pullComplete) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        
                        const chunk = decoder.decode(value, { stream: true });
                        const lines = chunk.split('\n').filter(line => line.trim());
                        
                        for (const line of lines) {
                            try {
                                const data = JSON.parse(line);
                                if (data.status) {
                                    console.log(`[Game] ${playerName}Ollamaモデルプル: ${data.status}`);
                                }
                                if (data.status === 'success' || (data.status && data.status.includes('complete'))) {
                                    console.log(`[Game] ${playerName}Ollamaモデル "${modelName}" のプルが完了しました`);
                                    pullComplete = true;
                                    break;
                                }
                            } catch (e) {
                                // JSON解析エラーは無視
                            }
                        }
                    }
                } finally {
                    reader.releaseLock();
                    clearTimeout(pullTimeoutId);
                }
            } else {
                console.log(`[Game] ${playerName}Ollamaモデル "${modelName}" は利用可能です`);
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error(`[Game] ${playerName}Ollamaモデル確認がタイムアウトしました`);
            } else {
                console.error(`[Game] ${playerName}Ollamaモデル確認エラー:`, error.message);
            }
            // エラーが発生しても処理は続行（モデルが既に存在する可能性があるため）
        }
    }
    
>>>>>>> 4653c6a54dde4be9cf81315927a04c71d6127a9e
    /**
     * 現在の手番に応じたAIインスタンスを取得
     */
    getCurrentAI() {
        return this.ai.getCurrentAI();
    }

    // --- UI Delegation ---
    renderBoard() { this.ui.renderBoard(); }
    updateTurnIndicator() { this.ui.updateTurnIndicator(); }
    updateCapturedPieces() { this.ui.updateCapturedPieces(); }
    highlightMoves() { this.ui.highlightMoves(); }
    highlightDropPositions() { this.ui.highlightDropPositions(); }
    showPromoteModal(piece) { this.ui.showPromoteModal(piece); }
    hidePromoteModal() { this.ui.hidePromoteModal(); }
    showAIThinking() { this.ui.showAIThinking(); }
    hideAIThinking() { this.ui.hideAIThinking(); }
    updateAISettingsVisibility() { this.ui.updateAISettingsVisibility(); }
    scheduleAISettingsUpdate() { this.ui.scheduleAISettingsUpdate(); }
    showReplayMode() { this.ui.showReplayMode(); }
    exitReplayMode() { this.ui.exitReplayMode(); }
    showGameEndMessage() { this.ui.showGameEndMessage(); }
    showRepetitionMessage(type, loser) { this.ui.showRepetitionMessage(type, loser); }
    updateMoveControls() { this.ui.updateMoveControls(); }
    updateMoveHistoryDisplay() { this.ui.updateMoveHistoryDisplay(); }

    // --- AI Delegation ---
    createAI(player) { return this.ai.createAI(player); }
    initializeUSIEngines() { return this.ai.initializeUSIEngines(); }
    checkOllamaModel(model, name) { return this.ai.checkOllamaModel(model, name); }
    isAITurn() { return this.ai.isAITurn(); }
    checkAndMakeAIMove() { return this.ai.checkAndMakeAIMove(); }
    cleanupAIMove() { return this.ai.cleanupAIMove(); }

    // --- History Delegation ---
    recordMove(data) { return this.history.recordMove(data); }
    recordPosition() { return this.history.recordPosition(); }
    checkRepetition() { return this.history.checkRepetition(); }
    getPositionKey() { return this.history.getPositionKey(); }
    restoreFromHistory(index) { return this.history.restoreFromHistory(index); }
    exportKifuToJSON() { return this.history.exportKifuToJSON(); }
    downloadKifu() { return this.history.downloadKifu(); }
    previewKifuData(file) { return this.history.previewKifuData(file); }
    loadKifuFromPreview() { return this.history.loadKifuFromPreview(); }

    // --- Compatibility Getters ---
    get moveHistory() { return this.history.moveHistory; }
    set moveHistory(val) { this.history.moveHistory = val; }
    get currentMoveIndex() { return this.history.currentMoveIndex; }
    set currentMoveIndex(val) { this.history.currentMoveIndex = val; }
    get positionHistory() { return this.history.positionHistory; }
    set positionHistory(val) { this.history.positionHistory = val; }
    get checkHistory() { return this.history.checkHistory; }
    set checkHistory(val) { this.history.checkHistory = val; }
    get pendingKifuData() { return this.history.pendingKifuData; }
    set pendingKifuData(val) { this.history.pendingKifuData = val; }

    get aiInProgress() { return this.ai.aiInProgress; }
    set aiInProgress(val) { this.ai.aiInProgress = val; }
    get aiStopped() { return this.ai.aiStopped; }
    set aiStopped(val) { this.ai.aiStopped = val; }
    get aiMovePromise() { return this.ai.aiMovePromise; }
    set aiMovePromise(val) { this.ai.aiMovePromise = val; }
    get aiMoveTimeout() { return this.ai.aiMoveTimeout; }
    set aiMoveTimeout(val) { this.ai.aiMoveTimeout = val; }

    /**
     * イベントリスナーの設定
     */
    setupEventListeners() {
        const handlers = {
            'resetBtn': () => this.reset(),
            'aiLevelSente': (e) => {
                this.aiLevelSente = e.target.value;
<<<<<<< HEAD
                // USIエンジンが選択された場合、入力欄を編集可能に戻す
                if (this.aiLevelSente === AI_LEVEL.USI) {
                    this.ui.resetSingleUSIEngineInput('先手');
                    // 即座に初期化を試みる
                    setTimeout(() => this.aiSente = this.createAI(PLAYER.SENTE), 0);
                    setTimeout(() => this.ai.initializeSingleUSIEngine(this.aiSente.usiClient, '先手'), 100);
                } else {
                    this.aiSente = this.createAI(PLAYER.SENTE);
=======
                // USIエンジンが選択された場合、URL表示欄をURL表示に戻し、エンジン名欄をクリア
                if (this.aiLevelSente === AI_LEVEL.USI) {
                    const usiServerUrlElement = document.getElementById('usiServerUrlSente');
                    const engineNameElement = document.getElementById('usiEngineNameSente');
                    if (usiServerUrlElement) {
                        // 元のURLが保存されている場合はそれを使用
                        if (usiServerUrlElement.dataset.originalUrl) {
                            usiServerUrlElement.value = usiServerUrlElement.dataset.originalUrl;
                            console.log('[Game] 先手USIエンジン選択: URL表示に戻しました', { url: usiServerUrlElement.dataset.originalUrl });
                        }
                        // 現在の値がURL形式の場合はそれを使用
                        else if (usiServerUrlElement.value && (usiServerUrlElement.value.startsWith('http://') || usiServerUrlElement.value.startsWith('https://'))) {
                            usiServerUrlElement.dataset.originalUrl = usiServerUrlElement.value;
                            console.log('[Game] 先手USIエンジン選択: 現在のURLを保持', { url: usiServerUrlElement.value });
                        }
                        // それ以外の場合はデフォルト値を使用
                        else {
                            const defaultUrl = 'http://localhost:8080';
                            usiServerUrlElement.value = defaultUrl;
                            usiServerUrlElement.dataset.originalUrl = defaultUrl;
                            console.log('[Game] 先手USIエンジン選択: デフォルトURLを使用', { url: defaultUrl });
                        }
                    }
                    // エンジン名欄をクリア
                    if (engineNameElement) {
                        engineNameElement.value = '';
                    }
>>>>>>> 4653c6a54dde4be9cf81315927a04c71d6127a9e
                }
                this.gameStarted = false;
                this.cleanupAIMove();
                // 即座に更新を試みる
                this.updateAISettingsVisibility();
                // 遅延更新も実行（確実に反映させるため）
                this.scheduleAISettingsUpdate();
            },
            'aiLevelGote': (e) => {
                this.aiLevelGote = e.target.value;
<<<<<<< HEAD
                // USIエンジンが選択された場合、入力欄を編集可能に戻す
                if (this.aiLevelGote === AI_LEVEL.USI) {
                    this.ui.resetSingleUSIEngineInput('後手');
                    // 即座に初期化を試みる
                    setTimeout(() => this.aiGote = this.createAI(PLAYER.GOTE), 0);
                    setTimeout(() => this.ai.initializeSingleUSIEngine(this.aiGote.usiClient, '後手'), 100);
                } else {
                    this.aiGote = this.createAI(PLAYER.GOTE);
=======
                // USIエンジンが選択された場合、URL表示欄をURL表示に戻し、エンジン名欄をクリア
                if (this.aiLevelGote === AI_LEVEL.USI) {
                    const usiServerUrlElement = document.getElementById('usiServerUrlGote');
                    const engineNameElement = document.getElementById('usiEngineNameGote');
                    if (usiServerUrlElement) {
                        // 元のURLが保存されている場合はそれを使用
                        if (usiServerUrlElement.dataset.originalUrl) {
                            usiServerUrlElement.value = usiServerUrlElement.dataset.originalUrl;
                            console.log('[Game] 後手USIエンジン選択: URL表示に戻しました', { url: usiServerUrlElement.dataset.originalUrl });
                        }
                        // 現在の値がURL形式の場合はそれを使用
                        else if (usiServerUrlElement.value && (usiServerUrlElement.value.startsWith('http://') || usiServerUrlElement.value.startsWith('https://'))) {
                            usiServerUrlElement.dataset.originalUrl = usiServerUrlElement.value;
                            console.log('[Game] 後手USIエンジン選択: 現在のURLを保持', { url: usiServerUrlElement.value });
                        }
                        // それ以外の場合はデフォルト値を使用
                        else {
                            const defaultUrl = 'http://localhost:8080';
                            usiServerUrlElement.value = defaultUrl;
                            usiServerUrlElement.dataset.originalUrl = defaultUrl;
                            console.log('[Game] 後手USIエンジン選択: デフォルトURLを使用', { url: defaultUrl });
                        }
                    }
                    // エンジン名欄をクリア
                    if (engineNameElement) {
                        engineNameElement.value = '';
                    }
>>>>>>> 4653c6a54dde4be9cf81315927a04c71d6127a9e
                }
                this.gameStarted = false;
                this.cleanupAIMove();
                // 即座に更新を試みる
                this.updateAISettingsVisibility();
                // 遅延更新も実行（確実に反映させるため）
                this.scheduleAISettingsUpdate();
            },
            'ollamaModelSente': async (e) => {
                const modelName = e.target.value.trim();
                // モデル名が変更された場合、Ollamaサーバーに接続してモデルを確認
                if (modelName) {
                    await this.checkOllamaModel(modelName, '先手');
                }
                // 先手Ollamaモデルが変更された場合、先手がOllamaモードの場合はAIを再作成
                if (this.aiLevelSente === AI_LEVEL.OLLAMA) {
                    this.aiSente = this.createAI(PLAYER.SENTE);
                    // 設定変更時はゲームを停止
                    this.gameStarted = false;
                    // 進行中のAI思考をクリーンアップ
                    this.cleanupAIMove();
                }
            },
            'ollamaModelGote': async (e) => {
                const modelName = e.target.value.trim();
                // モデル名が変更された場合、Ollamaサーバーに接続してモデルを確認
                if (modelName) {
                    await this.checkOllamaModel(modelName, '後手');
                }
                // 後手Ollamaモデルが変更された場合、後手がOllamaモードの場合はAIを再作成
                if (this.aiLevelGote === AI_LEVEL.OLLAMA) {
                    this.aiGote = this.createAI(PLAYER.GOTE);
                    // 設定変更時はゲームを停止
                    this.gameStarted = false;
                    // 進行中のAI思考をクリーンアップ
                    this.cleanupAIMove();
                }
            },
            'usiServerUrlSente': (e) => {
                // 先手USIサーバーURLが変更された場合
                const input = e.target;
                const newValue = input.value.trim();
                // URL形式の場合は、元のURLを更新
                if (newValue && (newValue.startsWith('http://') || newValue.startsWith('https://'))) {
                    input.dataset.originalUrl = newValue;
                }
                // 先手がUSIモードの場合はAIを再作成
                if (this.aiLevelSente === AI_LEVEL.USI) {
                    this.aiSente = this.createAI(PLAYER.SENTE);
                    // 設定変更時はゲームを停止
                    this.gameStarted = false;
                    // 進行中のAI思考をクリーンアップ
                    this.cleanupAIMove();
                    // 即座に再初期化
                    this.ai.initializeSingleUSIEngine(this.aiSente.usiClient, '先手');
                }
            },
            'usiServerUrlGote': (e) => {
                // 後手USIサーバーURLが変更された場合
                const input = e.target;
                const newValue = input.value.trim();
                // URL形式の場合は、元のURLを更新
                if (newValue && (newValue.startsWith('http://') || newValue.startsWith('https://'))) {
                    input.dataset.originalUrl = newValue;
                }
                // 後手がUSIモードの場合はAIを再作成
                if (this.aiLevelGote === AI_LEVEL.USI) {
                    this.aiGote = this.createAI(PLAYER.GOTE);
                    // 設定変更時はゲームを停止
                    this.gameStarted = false;
                    // 進行中のAI思考をクリーンアップ
                    this.cleanupAIMove();
                    // 即座に再初期化
                    this.ai.initializeSingleUSIEngine(this.aiGote.usiClient, '後手');
                }
            },
            'newGameBtn': () => {
                this.exitReplayMode();
                this.reset();
            },
            'exitGameBtn': () => this.exitGame(),
            'promoteYesBtn': () => this.handlePromotionChoice(true),
            'promoteNoBtn': () => this.handlePromotionChoice(false),
            'prevMoveBtn': () => this.goToPreviousMove(),
            'nextMoveBtn': () => this.goToNextMove(),
            'firstMoveBtn': () => this.goToFirstMove(),
            'lastMoveBtn': () => this.goToLastMove(),
            'downloadKifuBtn': () => this.downloadKifu(),
            'uploadKifuBtn': () => {
                const input = document.getElementById('uploadKifuInput');
                if (input) input.click();
            },
            'uploadKifuInput': (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.previewKifuData(file);
                }
            },
            'loadKifuBtn': () => this.loadKifuFromPreview(),
            'cancelKifuBtn': () => this.hideKifuDataModal()
        };

        Object.entries(handlers).forEach(([id, handler]) => {
            const element = document.getElementById(id);
            if (element) {
                let eventType = 'click';
                // select要素またはInput要素の場合はchangeイベントを使用
                if (id.includes('Input') || id.includes('select') || element.tagName === 'SELECT' || element.tagName === 'INPUT') {
                    eventType = 'change';
                }
                element.addEventListener(eventType, handler);
            }
        });
    }

    /**
     * 駒の表示名を取得
     */
    getPieceName(piece) {
        return PIECE_NAMES[piece] || '';
    }

    /**
     * 先手の駒かどうか
     */
    isSente(piece) {
        return piece && piece === piece.toUpperCase();
    }

    /**
     * 後手の駒かどうか
     */
    isGote(piece) {
        return piece && piece === piece.toLowerCase();
    }

    /**
     * 位置が有効かどうか
     */
    isValidPosition(row, col) {
        return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
    }

    /**
     * 位置を表記に変換 (例: 7g -> ７七)
     */
    positionToNotation(row, col) {
        const colNames = ['９', '８', '７', '６', '５', '４', '３', '２', '１'];
        const rowNames = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
        return colNames[col] + rowNames[row];
    }



    /**
     * 指定位置の駒の移動可能な位置を取得
     */
    getPossibleMoves(row, col) {
        const piece = this.board[row][col];
        if (!piece) return [];

        const isCurrentPlayer = (this.currentTurn === PLAYER.SENTE && this.isSente(piece)) ||
            (this.currentTurn === PLAYER.GOTE && this.isGote(piece));
        if (!isCurrentPlayer) return [];

        // PieceMovesクラスを使用して移動可能な位置を取得
        this.pieceMoves.board = this.board; // 最新の盤面を反映
        const moves = this.pieceMoves.getMovesForPiece(row, col, piece);

        return moves;

    }

    /**
     * 駒を移動
     */
    movePiece(fromRow, fromCol, toRow, toCol, promote = null) {
        const piece = this.board[fromRow][fromCol];
        const captured = this.board[toRow][toCol];



        // 持ち駒に追加
        if (captured) {
            const capturedPiece = captured.replace('+', '').toLowerCase();
            this.capturedPieces[this.currentTurn].push(capturedPiece);
        }

        // 駒を移動
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;

        // 成りの判定
        const canPromote = this.canPromote(piece, fromRow, toRow);
        if (canPromote && !piece.includes('+') && piece.toLowerCase() !== PIECE_TYPE.KING && piece.toLowerCase() !== PIECE_TYPE.GOLD) {
            if (!this.isAITurn() && promote === null) {
                this.pendingPromotion = { fromRow, fromCol, toRow, toCol, piece, captured };
                this.showPromoteModal(piece);
                return;
            }

            if (promote === true || (this.isAITurn() && this.shouldAIPromote(piece, toRow))) {
                this.board[toRow][toCol] = '+' + piece;
            }
        }

        // 王が取られたかチェック
        const capturedPiece = captured ? captured.replace('+', '').toLowerCase() : null;
        if (capturedPiece === PIECE_TYPE.KING) {
            this.gameOver = true;
            this.winner = this.currentTurn;
            this.showReplayMode();
            return;
        }

        // 棋譜に記録
        if (!this.isReplaying) {
            this.recordMove({
                type: 'move',
                fromRow,
                fromCol,
                toRow,
                toCol,
                piece: piece,
                promoted: this.board[toRow][toCol].includes('+'),
                captured: captured ? captured.replace('+', '') : null
            });
        }

        this.switchTurn();
        this.updateUI();

        // 局面を記録（千日手判定用）
        if (!this.isReplaying) {
            this.recordPosition();
        }

        // ゲーム終了チェックとAIの手
        if (!this.gameOver) {
            this.checkRepetition(); // 千日手チェック
            this.checkGameEnd();
            // UI更新を待ってからAI思考を開始（重複呼び出し防止）
            setTimeout(() => {
                this.checkAndMakeAIMove();
            }, UI_UPDATE_DELAY);
        }
    }

    /**
     * 成りが可能かどうか
     */
    canPromote(piece, fromRow, toRow) {
        if (!piece || piece.includes('+')) return false;
        if (piece.toLowerCase() === PIECE_TYPE.KING || piece.toLowerCase() === PIECE_TYPE.GOLD) return false;

        const isSente = this.isSente(piece);
        const inEnemyTerritory = (isSente && toRow < ENEMY_TERRITORY_SENTE) || (!isSente && toRow > ENEMY_TERRITORY_GOTE);
        const fromEnemyTerritory = (isSente && fromRow < ENEMY_TERRITORY_SENTE) || (!isSente && fromRow > ENEMY_TERRITORY_GOTE);

        return inEnemyTerritory || fromEnemyTerritory;
    }

    /**
     * AIが成るべきかどうか
     */
    shouldAIPromote(piece, toRow) {
        const pieceType = piece.toLowerCase();
        return pieceType !== PIECE_TYPE.KING && pieceType !== PIECE_TYPE.GOLD;
    }

    /**
     * 成り選択モーダルを表示
     */
    showPromoteModal(piece) {
        const modal = document.getElementById('promoteModal');
        const pieceName = document.getElementById('promotePieceName');
        if (modal && pieceName) {
            pieceName.textContent = `${this.getPieceName(piece)}を成りますか？`;
            modal.classList.remove('hidden');
        }
    }

    /**
     * 成り選択モーダルを非表示
     */
    hidePromoteModal() {
        const modal = document.getElementById('promoteModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    /**
     * 成り選択を処理
     */
    handlePromotionChoice(promote) {
        if (!this.pendingPromotion) return;

        const { fromRow, fromCol, toRow, toCol, piece, captured } = this.pendingPromotion;
        this.hidePromoteModal();

        // 既に駒の移動と駒取りは完了しているため、成りの処理のみを行う
        if (promote === true) {
            // 成る場合
            const currentPiece = this.board[toRow][toCol];
            if (currentPiece && !currentPiece.includes('+')) {
                this.board[toRow][toCol] = '+' + currentPiece;
            }
        }
        // 成らない場合は何もしない（既に移動済み）

        // 棋譜に記録（成りの選択を含む）
        if (!this.isReplaying) {
            this.recordMove({
                type: 'move',
                fromRow,
                fromCol,
                toRow,
                toCol,
                piece: piece,
                promoted: promote === true,
                captured: captured ? captured.replace('+', '') : null
            });
        }

        // 王が取られたかチェック
        const capturedPiece = captured ? captured.replace('+', '').toLowerCase() : null;
        if (capturedPiece === PIECE_TYPE.KING) {
            this.gameOver = true;
            this.winner = this.currentTurn;
            this.showReplayMode();
            this.pendingPromotion = null;
            return;
        }

        // 成り選択をクリア
        this.pendingPromotion = null;

        // 手番を切り替え
        this.switchTurn();
        this.updateUI();

        // 局面を記録（千日手判定用）
        if (!this.isReplaying) {
            this.recordPosition();
        }

        // ゲーム終了チェックとAIの手
        if (!this.gameOver) {
            this.checkRepetition(); // 千日手チェック
            this.checkGameEnd();
            this.checkAndMakeAIMove();
        }
    }

    /**
     * 持ち駒を打つ
     */
    dropPiece(piece, row, col) {
        if (this.board[row][col]) return false;

        const pieceType = piece.toLowerCase();
        const droppedPiece = this.currentTurn === PLAYER.SENTE ? pieceType.toUpperCase() : pieceType;

        // 二歩のチェック
        if (pieceType === PIECE_TYPE.PAWN) {
            for (let r = 0; r < BOARD_SIZE; r++) {
                if (this.board[r][col] === droppedPiece) {
                    return false;
                }
            }
        }

        // 棋譜に記録
        if (!this.isReplaying) {
            this.recordMove({
                type: 'drop',
                piece: pieceType,
                toRow: row,
                toCol: col
            });
        }

        this.board[row][col] = droppedPiece;

        // 持ち駒から削除
        const index = this.capturedPieces[this.currentTurn].indexOf(pieceType);
        if (index > -1) {
            this.capturedPieces[this.currentTurn].splice(index, 1);
        }

        this.switchTurn();
        this.updateUI();

        // 局面を記録（千日手判定用）
        if (!this.isReplaying) {
            this.recordPosition();
        }

        // ゲーム終了チェックとAIの手
        if (!this.gameOver) {
            this.checkRepetition(); // 千日手チェック
            this.checkGameEnd();
            // UI更新を待ってからAI思考を開始（重複呼び出し防止）
            setTimeout(() => {
                this.checkAndMakeAIMove();
            }, UI_UPDATE_DELAY);
        }

        return true;
    }


    /**
     * セルクリックを処理
     */
    handleCellClick(row, col) {
        if (!this.gameStarted || this.gameOver || this.isAITurn()) return;

        const piece = this.board[row][col];

        // 持ち駒が選択されている場合
        if (this.selectedCapturedPiece) {
            if (!piece) {
                if (this.canDropPiece(this.selectedCapturedPiece.piece, row, col)) {
                    this.dropPiece(this.selectedCapturedPiece.piece, row, col);
                    this.selectedCapturedPiece = null;
                    this.updateCapturedPieces();
                } else {
                    alert('そのマスには打てません（二歩などの禁じ手）');
                }
            } else {
                this.selectedCapturedPiece = null;
                this.updateCapturedPieces();
                if (this.isCurrentPlayerPiece(piece)) {
                    this.selectedCell = [row, col];
                    this.highlightMoves();
                }
            }
            return;
        }

        if (this.selectedCell) {
            const [selectedRow, selectedCol] = this.selectedCell;
            const possibleMoves = this.getPossibleMoves(selectedRow, selectedCol);
            const isValidMove = possibleMoves.some(([r, c]) => r === row && c === col);

            if (isValidMove) {
                this.movePiece(selectedRow, selectedCol, row, col);
            } else {
                if (piece && this.isCurrentPlayerPiece(piece)) {
                    this.selectedCell = [row, col];
                    this.highlightMoves();
                } else {
                    this.selectedCell = null;
                    this.renderBoard();
                }
            }
        } else {
            if (piece && this.isCurrentPlayerPiece(piece)) {
                this.selectedCell = [row, col];
                this.highlightMoves();
            }
        }
    }

    /**
     * 現在のプレイヤーの駒かどうか
     */
    isCurrentPlayerPiece(piece) {
        return (this.currentTurn === PLAYER.SENTE && this.isSente(piece)) ||
            (this.currentTurn === PLAYER.GOTE && this.isGote(piece));
    }







    /**
     * 打ち歩詰めかどうかを判定
     */
    isUchifuzume(row, col) {
        // 仮に駒を置いてみる
        const droppedPiece = this.currentTurn === PLAYER.SENTE ? 'P' : 'p';
        const opponent = this.currentTurn === PLAYER.SENTE ? PLAYER.GOTE : PLAYER.SENTE;

        // 元の状態を保存
        const originalPiece = this.board[row][col];
        this.board[row][col] = droppedPiece;

        // 相手玉が王手か
        const inCheck = this.isInCheck(opponent);

        if (!inCheck) {
            this.board[row][col] = originalPiece;
            return false;
        }

        // 相手に合法手があるか（詰みか）
        const originalTurn = this.currentTurn;
        this.currentTurn = opponent;
        const moves = this.getAllPossibleMoves(opponent);
        this.currentTurn = originalTurn;

        // 復元
        this.board[row][col] = originalPiece;

        // 王手かつ相手に合法手がない場合は打ち歩詰め
        return moves.length === 0;
    }

    /**
     * 持ち駒を打てるかどうか
     */
    canDropPiece(piece, row, col) {
        if (this.board[row][col]) return false;

        const pieceType = piece.toLowerCase();

        // 二歩のチェック
        if (pieceType === PIECE_TYPE.PAWN) {
            // 行き所のない駒のチェック
            if (this.currentTurn === PLAYER.SENTE && row === 0) return false;
            if (this.currentTurn === PLAYER.GOTE && row === BOARD_SIZE - 1) return false;

            const droppedPiece = this.currentTurn === PLAYER.SENTE ? 'P' : 'p';
            for (let r = 0; r < BOARD_SIZE; r++) {
                if (this.board[r][col] === droppedPiece) {
                    return false;
                }
            }

            // 打ち歩詰めのチェック
            if (this.isUchifuzume(row, col)) return false;
        }

        // 桂馬は敵陣の最下段・2段目には打てない
        if (pieceType === PIECE_TYPE.KNIGHT) {
            if (this.currentTurn === PLAYER.SENTE && row <= 1) return false;
            if (this.currentTurn === PLAYER.GOTE && row >= BOARD_SIZE - 2) return false;
        }

        // 香車は敵陣の最下段には打てない
        if (pieceType === PIECE_TYPE.LANCE) {
            if (this.currentTurn === PLAYER.SENTE && row === 0) return false;
            if (this.currentTurn === PLAYER.GOTE && row === BOARD_SIZE - 1) return false;
        }

        return true;
    }

    /**
     * 打てる位置をハイライト
     */
    highlightDropPositions() {
        this.renderBoard();
        if (this.selectedCapturedPiece) {
            for (let row = 0; row < BOARD_SIZE; row++) {
                for (let col = 0; col < BOARD_SIZE; col++) {
                    if (this.canDropPiece(this.selectedCapturedPiece.piece, row, col)) {
                        const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                        if (cell) cell.classList.add('possible-move');
                    }
                }
            }
        }
    }

    isAITurn() {
        return this.ai.isAITurn();
    }

    /**
     * AIの手を打つ
     * 
     * 人間対AIモードの場合：
     * - 後手（GOTE）のターンのみAIが思考（先手は人間）
     * 
     * AI対AIモードの場合：
     * - 先手（SENTE）のターン: AIが先手の手を思考
     * - 後手（GOTE）のターン: AIが後手の手を思考
     */
<<<<<<< HEAD
=======
    checkAndMakeAIMove() {
        // ゲームが開始されていない場合は何もしない
        if (!this.gameStarted) {
            return;
        }
        
        // 既にAI思考中なら待機（AI vs AIでの重複リクエスト防止）
        if (this.aiInProgress || this.aiMovePromise) {
            console.debug('[Game] AI思考が既に進行中のため、新しい思考をスキップ', {
                aiInProgress: this.aiInProgress,
                hasPromise: !!this.aiMovePromise,
                currentTurn: this.currentTurn
            });
            return;
        }
        
        if (!this.isAITurn() || this.gameOver || this.isReplaying) {
            return;
        }
        
        if (this.aiStopped) {
            console.warn('[Game] AIが停止状態のため思考をスキップ（USIエンジン停止）');
            return;
        }
        
        // フラグを設定（重複呼び出し防止）
        this.aiInProgress = true;
        
        // どちらの手番かを明確にログ出力
        const playerName = this.currentTurn === PLAYER.SENTE ? '先手' : '後手';
        const gameModeInfo = `[${playerName}AI思考中]`;
        
        this.showAIThinking();
        
        // 現在の手番に応じたAIを取得
        const currentAI = this.getCurrentAI();
        
        // AIがnull（人間）の場合はスキップ
        if (!currentAI) {
            this.cleanupAIMove();
            return;
        }
        
        // Ollama/USIの場合は非同期処理
        if (currentAI.level === AI_LEVEL.OLLAMA || currentAI.level === AI_LEVEL.USI) {
            const levelName = currentAI.level === AI_LEVEL.OLLAMA ? 'Ollama' : 'USI';
            const logInfo = {
                turn: this.currentTurn,
                player: playerName
            };
            if (currentAI.level === AI_LEVEL.OLLAMA) {
                logInfo.endpoint = currentAI.ollamaEndpoint;
                logInfo.model = currentAI.ollamaModel;
            } else {
                logInfo.serverUrl = currentAI.usiClient && currentAI.usiClient.serverUrl;
            }
            console.info(`[Game] ${gameModeInfo} ${levelName} async move start`, logInfo);
            
            // 非同期処理を開始し、Promiseを保存（重複防止用）
            const currentTurn = this.currentTurn;
            this.aiMovePromise = currentAI.getBestMoveAsync(this, currentTurn)
                    .then(move => {
                        // ゲーム状態が変わっていないか確認
                        if (this.gameOver || this.isReplaying || this.currentTurn !== currentTurn) {
                            console.warn('[Game] ゲーム状態が変更されたため、AIの手をスキップ', {
                                gameOver: this.gameOver,
                                isReplaying: this.isReplaying,
                                expectedTurn: currentTurn,
                                actualTurn: this.currentTurn
                            });
                            this.cleanupAIMove();
                            return;
                        }
                        
                        if (move) {
                            const playerName = currentTurn === PLAYER.SENTE ? '先手' : '後手';
                            console.info(`[Game] [${playerName}AI] の手を適用`, {
                                type: move.type,
                                player: playerName,
                                turn: currentTurn,
                                move: move.type === 'move' 
                                    ? `${move.fromRow},${move.fromCol} → ${move.toRow},${move.toCol}`
                                    : `${move.piece}打 → ${move.toRow},${move.toCol}`
                            });
                            
                            // 手を適用する前にクリーンアップ（次の思考の準備）
                            // 注意: movePiece/dropPiece内で次のAI思考が開始されるため、
                            // ここではクリーンアップのみ実行（aiInProgressフラグをリセット）
                            this.aiInProgress = false;
                            this.hideAIThinking();
                            
                            // 手を適用（movePiece/dropPiece内で次のAI思考が開始される）
                            if (move.type === 'move') {
                                // USIエンジンのbestmoveの成りフラグを反映
                                const promote = move.promoted === true ? true : (move.promoted === false ? false : null);
                                this.movePiece(move.fromRow, move.fromCol, move.toRow, move.toCol, promote);
                            } else if (move.type === 'drop') {
                                this.dropPiece(move.piece, move.toRow, move.toCol);
                            }
                        } else {
                            const playerName = currentTurn === PLAYER.SENTE ? '先手' : '後手';
                            console.warn(`[Game] [${playerName}AI] が手を返しませんでした（投了またはエラー）`, {
                                player: playerName,
                                turn: currentTurn
                            });
                            this.cleanupAIMove();
                        }
                    })
                    .catch(error => {
                        const playerName = currentTurn === PLAYER.SENTE ? '先手' : '後手';
                        console.error(`[Game] [${playerName}AI] 手取得エラー:`, {
                            error: error.message,
                            stack: error.stack,
                            level: currentAI.level,
                            player: playerName,
                            turn: currentTurn
                        });
                        
                        this.cleanupAIMove();
                        
                        if (currentAI.level === AI_LEVEL.USI && error.message && error.message.includes('エンジン')) {
                            this.aiStopped = true;
                            console.error('[Game] USIエンジン停止を検知。AIを停止します。', { error: error.message });
                        }
                    })
                    .finally(() => {
                        // Promiseをクリア
                        this.aiMovePromise = null;
                    });
        } else {
            // 通常のAIは従来通り
            const playerName = this.currentTurn === PLAYER.SENTE ? '先手' : '後手';
            const thinkingTime = AI_THINKING_TIME.MIN + Math.random() * (AI_THINKING_TIME.MAX - AI_THINKING_TIME.MIN);
            
            console.info(`[Game] [${playerName}AI思考中] 通常AI思考開始`, {
                player: playerName,
                turn: this.currentTurn,
                thinkingTime: `${thinkingTime}ms`
            });
            
            const currentTurn = this.currentTurn;
            this.aiMoveTimeout = setTimeout(() => {
                // ゲーム状態が変わっていないか確認
                if (this.gameOver || this.isReplaying || this.currentTurn !== currentTurn) {
                    console.warn('[Game] ゲーム状態が変更されたため、AIの手をスキップ', {
                        gameOver: this.gameOver,
                        isReplaying: this.isReplaying,
                        expectedTurn: currentTurn,
                        actualTurn: this.currentTurn
                    });
                    this.cleanupAIMove();
                    return;
                }
                
                const move = currentAI.getBestMove(this, currentTurn);
                if (move) {
                    const appliedPlayerName = currentTurn === PLAYER.SENTE ? '先手' : '後手';
                    console.info(`[Game] [${appliedPlayerName}AI] の手を適用`, {
                        player: appliedPlayerName,
                        turn: currentTurn,
                        type: move.type
                    });
                    // 手を適用する前にクリーンアップ（次の思考の準備）
                    this.aiInProgress = false;
                    this.hideAIThinking();
                    
                    // 手を適用（movePiece/dropPiece内で次のAI思考が開始される）
                    if (move.type === 'move') {
                        this.movePiece(move.fromRow, move.fromCol, move.toRow, move.toCol);
                    } else if (move.type === 'drop') {
                        this.dropPiece(move.piece, move.toRow, move.toCol);
                    }
                } else {
                    this.cleanupAIMove();
                }
            }, thinkingTime);
        }
    }

    /**
     * AI思考中を表示
     */
    showAIThinking() {
        const thinkingElement = document.getElementById('aiThinking');
        if (thinkingElement) {
            thinkingElement.classList.remove('hidden');
        }
    }

    /**
     * AI思考中を非表示
     */
    hideAIThinking() {
        const thinkingElement = document.getElementById('aiThinking');
        if (thinkingElement) {
            thinkingElement.classList.add('hidden');
        }
    }
    
    /**
     * AI思考のクリーンアップ（フラグとタイムアウトのリセット）
     */
    cleanupAIMove() {
        this.hideAIThinking();
        this.aiInProgress = false;
        
        // タイムアウトをクリア
        if (this.aiMoveTimeout) {
            clearTimeout(this.aiMoveTimeout);
            this.aiMoveTimeout = null;
        }
        
        // Promiseはfinallyブロックでクリアされるが、エラー時や早期リターン時の安全性のため
        // ここでもクリア（ただし、進行中のPromiseをキャンセルしないよう注意）
        // 通常はfinallyブロックで処理されるため、ここではコメントアウト
        // this.aiMovePromise = null;
    }
>>>>>>> 4653c6a54dde4be9cf81315927a04c71d6127a9e

    /**
     * 全ての可能な手を取得
     */
    getAllPossibleMoves(turn) {
        const moves = [];

        // 盤上の駒の移動
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const piece = this.board[row][col];
                if (piece && this.isPlayerPiece(piece, turn)) {
                    const possibleMoves = this.getPossibleMoves(row, col);
                    possibleMoves.forEach(([toRow, toCol]) => {
                        moves.push({
                            type: 'move',
                            fromRow: row,
                            fromCol: col,
                            toRow: toRow,
                            toCol: toCol
                        });
                    });
                }
            }
        }

        // 持ち駒を打つ手
        const capturedPieces = this.capturedPieces[turn];
        const uniquePieces = [...new Set(capturedPieces)];
        uniquePieces.forEach(piece => {
            for (let row = 0; row < BOARD_SIZE; row++) {
                for (let col = 0; col < BOARD_SIZE; col++) {
                    if (!this.board[row][col] && this.canDropPiece(piece, row, col)) {
                        moves.push({
                            type: 'drop',
                            piece: piece,
                            toRow: row,
                            toCol: col
                        });
                    }
                }
            }
        });

        return moves;
    }

    /**
     * 指定プレイヤーの駒かどうか
     */
    isPlayerPiece(piece, turn) {
        return (turn === PLAYER.SENTE && this.isSente(piece)) ||
            (turn === PLAYER.GOTE && this.isGote(piece));
    }

    /**
     * 王が存在するかどうか
     */
    hasKing(player) {
        const kingPiece = player === PLAYER.SENTE ? 'K' : 'k';
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const piece = this.board[row][col];
                if (piece && piece.replace('+', '') === kingPiece) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * ゲーム終了をチェック
     */
    checkGameEnd() {
        if (!this.hasKing(PLAYER.SENTE)) {
            this.gameOver = true;
            this.winner = PLAYER.GOTE;
            this.showReplayMode();
            return;
        }
        if (!this.hasKing(PLAYER.GOTE)) {
            this.gameOver = true;
            this.winner = PLAYER.SENTE;
            this.showReplayMode();
            return;
        }
    }


    /**
     * 王手判定
     */
    isInCheck(player) {
        const kingPiece = player === PLAYER.SENTE ? 'K' : 'k';
        let kingRow = -1;
        let kingCol = -1;

        // 王の位置を探す
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const piece = this.board[row][col];
                if (piece && piece.replace('+', '') === kingPiece) {
                    kingRow = row;
                    kingCol = col;
                    break;
                }
            }
            if (kingRow !== -1) break;
        }

        if (kingRow === -1) return false;

        // 相手の駒が王を攻撃できるかチェック
        const opponent = player === PLAYER.SENTE ? PLAYER.GOTE : PLAYER.SENTE;
        const allOpponentMoves = this.getAllPossibleMoves(opponent);

        return allOpponentMoves.some(move => {
            if (move.type === 'move') {
                return move.toRow === kingRow && move.toCol === kingCol;
            }
            return false;
        });
    }







    /**
     * ゲームを終了
     */
    exitGame() {
        if (confirm('ゲームを終了しますか？')) {
            const container = document.querySelector('.container');
            if (container) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 50px;">
                        <h1>ゲームを終了しました</h1>
                        <p>ご利用ありがとうございました。</p>
                        <button onclick="location.reload()" style="padding: 10px 20px; margin-top: 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">
                            再読み込み
                        </button>
                    </div>
                `;
            }
        }
    }





    /**
     * ターンを切り替え
     */
    switchTurn() {
        this.currentTurn = this.currentTurn === PLAYER.SENTE ? PLAYER.GOTE : PLAYER.SENTE;
        this.selectedCell = null;
        this.selectedCapturedPiece = null;
        this.pendingPromotion = null;
    }

    /**
     * UIを更新
     */
    updateUI() {
        this.ui.updateUI();
    }

    /**
     * リセット
     */
    reset() {
        // ゲーム開始フラグを設定
        this.gameStarted = true;

        // 進行中のAI思考をクリーンアップ
        this.cleanupAIMove();
        this.aiMovePromise = null;

        this.board = this.initializeBoard();
        this.currentTurn = PLAYER.SENTE;
        this.selectedCell = null;
        this.selectedCapturedPiece = null;
        this.pendingPromotion = null;
        this.capturedPieces = { sente: [], gote: [] };
        this.gameOver = false;
        this.winner = null;
        this.moveHistory = [];
        this.currentMoveIndex = -1;
        this.isReplaying = false;
        this.positionHistory = [];
        this.checkHistory = [];

        // AIレベルを更新（先手と後手の設定を読み込む）
        const aiLevelSenteSelect = document.getElementById('aiLevelSente');
        const aiLevelGoteSelect = document.getElementById('aiLevelGote');

        if (aiLevelSenteSelect) {
            this.aiLevelSente = aiLevelSenteSelect.value;
        }
        if (aiLevelGoteSelect) {
            this.aiLevelGote = aiLevelGoteSelect.value;
        }
        this.aiSente = this.createAI(PLAYER.SENTE);
        this.aiGote = this.createAI(PLAYER.GOTE);

        // USIエンジンが選択されている場合、エンジンに接続してエンジン名を取得
        // （ニューゲームボタンが押された時点で接続する）
        this.initializeUSIEngines();

        // PieceMovesを更新
        this.pieceMoves.board = this.board;

        this.updateUI();
        this.ui.resetUSIEngineInputs(); // USI入力表示をリセット
        // updateUI()の後に確実に設定を更新
        this.scheduleAISettingsUpdate();
        this.hideAIThinking();
        this.hidePromoteModal();
        this.exitReplayMode();

        // AIの手番の場合は最初からAIが手を打つ
        if (this.isAITurn()) {
            // クリーンアップを確実に実行してから次の思考を開始
            this.cleanupAIMove();
            setTimeout(() => {
                if (!this.gameOver && !this.isReplaying) {
                    this.checkAndMakeAIMove();
                }
            }, UI_UPDATE_DELAY * 2);
        }
    }


    /**
     * プレビューした棋譜データを読み込む
     */
}

// ゲーム開始
let game;
window.addEventListener('DOMContentLoaded', () => {
    game = new ShogiGame();
    window.game = game; // デバッグ用にwindowに公開

    // ゲーム開始前はAIが自動で手を打たない（ニューゲームボタンを押すまで待機）
    // 初期状態では gameStarted = false のため、AIは動作しない
});
