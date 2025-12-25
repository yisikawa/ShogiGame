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

/**
 * 将棋ゲームのメインクラス
 */
export class ShogiGame {
    constructor() {
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
        this.pendingPromotion = null;
        this.moveHistory = [];
        this.currentMoveIndex = -1;
        this.isReplaying = false;
        this.positionHistory = []; // 局面履歴（千日手判定用）
        this.checkHistory = []; // 王手履歴（連続王手の千日手判定用）
        this.pendingKifuData = null; // プレビュー中の棋譜データ
        this.aiInProgress = false; // AI思考中フラグ（AI vs AIでの重複思考防止）
        this.aiStopped = false; // USIエンジン停止時の思考停止フラグ
        this.aiMovePromise = null; // 現在進行中のAI思考のPromise（重複防止用）
        this.aiMoveTimeout = null; // AI思考のタイムアウトID（クリーンアップ用）
        this.gameStarted = false; // ゲームが開始されたかどうか（ニューゲームボタンを押すまでfalse）
        
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
        this.renderBoard();
        this.updateTurnIndicator();
        this.updateCapturedPieces();
        this.setupEventListeners();
        this.scheduleAISettingsUpdate();
    }

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
                // それ以外（エンジン名が表示されている場合など）はtitle属性からURLを抽出を試みる
                else if (usiServerUrlElement.title) {
                    const titleMatch = usiServerUrlElement.title.match(/サーバーURL:\s*(https?:\/\/[^\s\n]+)/);
                    if (titleMatch && titleMatch[1]) {
                        usiServerUrl = titleMatch[1];
                        usiServerUrlElement.dataset.originalUrl = titleMatch[1];
                        console.log(`[Game] 先手USI URL取得: title属性から = ${usiServerUrl}`);
                    }
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
                // それ以外（エンジン名が表示されている場合など）はtitle属性からURLを抽出を試みる
                else if (usiServerUrlElement.title) {
                    const titleMatch = usiServerUrlElement.title.match(/サーバーURL:\s*(https?:\/\/[^\s\n]+)/);
                    if (titleMatch && titleMatch[1]) {
                        usiServerUrl = titleMatch[1];
                        usiServerUrlElement.dataset.originalUrl = titleMatch[1];
                        console.log(`[Game] 後手USI URL取得: title属性から = ${usiServerUrl}`);
                    }
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
            // 元のURLを保存（エンジン名表示用、デフォルト値も含む）
            if (!usiServerUrlElement.dataset.originalUrl) {
                usiServerUrlElement.dataset.originalUrl = usiServerUrl || 'http://localhost:8080';
            }
            
            ai.setEngineNameCallback((engineName, engineAuthor) => {
                // URL表示欄をエンジン名に変更（編集可能のまま）
                const displayText = engineAuthor ? `${engineName} (${engineAuthor})` : engineName;
                // 元のURLを確実に保持（編集時に使用）
                // dataset.originalUrlが設定されていない場合は、現在のusiServerUrlを使用
                if (!usiServerUrlElement.dataset.originalUrl) {
                    usiServerUrlElement.dataset.originalUrl = usiServerUrl || 'http://localhost:8080';
                }
                const originalUrl = usiServerUrlElement.dataset.originalUrl;
                // エンジン名を表示（編集可能）
                usiServerUrlElement.value = displayText;
                usiServerUrlElement.title = `エンジン名: ${displayText}\nサーバーURL: ${originalUrl}\n（編集してURLを変更できます）`;
                // 編集可能であることを明示
                usiServerUrlElement.readOnly = false;
            });
        }
        
        return ai;
    }
    
    /**
     * 現在の手番に応じたAIインスタンスを取得
     */
    getCurrentAI() {
        if (this.currentTurn === PLAYER.SENTE) {
            return this.aiSente;
        } else {
            return this.aiGote;
        }
    }
    
    /**
     * 設定要素の表示/非表示を更新するヘルパー関数
     * @param {HTMLElement} element - 更新する要素
     * @param {boolean} shouldShow - 表示するかどうか
     */
    updateElementVisibility(element, shouldShow) {
        if (element) {
            const newDisplay = shouldShow ? 'flex' : 'none';
            // インラインスタイルを直接設定（最も優先度が高い）
            element.style.setProperty('display', newDisplay, 'important');
        }
    }
    
    /**
     * AI設定UIの表示/非表示を更新
     */
    updateAISettingsVisibility() {
        // AI設定コンテナは常に表示
        const aiSettingsContainer = document.getElementById('aiSettingsContainer');
        if (aiSettingsContainer) {
            aiSettingsContainer.style.display = 'flex';
        }
        
        // 先手と後手のAIレベル選択は常に表示
        const aiLevelSenteContainer = document.getElementById('aiLevelSenteContainer');
        const aiLevelGoteContainer = document.getElementById('aiLevelGoteContainer');
        if (aiLevelSenteContainer) aiLevelSenteContainer.style.display = 'flex';
        if (aiLevelGoteContainer) aiLevelGoteContainer.style.display = 'flex';
        
        // DOMから直接値を読み取る（this.aiLevelSente/Goteが更新されていない場合に備える）
        const aiLevelSenteSelect = document.getElementById('aiLevelSente');
        const aiLevelGoteSelect = document.getElementById('aiLevelGote');
        const currentAiLevelSente = aiLevelSenteSelect ? aiLevelSenteSelect.value : this.aiLevelSente;
        const currentAiLevelGote = aiLevelGoteSelect ? aiLevelGoteSelect.value : this.aiLevelGote;
        
        // 先手の設定表示/非表示
        const ollamaConfigSente = document.getElementById('ollamaConfigSente');
        const usiConfigSente = document.getElementById('usiConfigSente');
        const shouldShowOllamaSente = currentAiLevelSente === AI_LEVEL.OLLAMA;
        const shouldShowUsiSente = currentAiLevelSente === AI_LEVEL.USI;
        this.updateElementVisibility(ollamaConfigSente, shouldShowOllamaSente);
        this.updateElementVisibility(usiConfigSente, shouldShowUsiSente);
        
        // 後手の設定表示/非表示
        const ollamaConfigGote = document.getElementById('ollamaConfigGote');
        const usiConfigGote = document.getElementById('usiConfigGote');
        const shouldShowOllamaGote = currentAiLevelGote === AI_LEVEL.OLLAMA;
        const shouldShowUsiGote = currentAiLevelGote === AI_LEVEL.USI;
        this.updateElementVisibility(ollamaConfigGote, shouldShowOllamaGote);
        this.updateElementVisibility(usiConfigGote, shouldShowUsiGote);
    }
    
    /**
     * AI設定UIを遅延更新（確実に反映させるため）
     */
    scheduleAISettingsUpdate() {
        // 即座に更新
        this.updateAISettingsVisibility();
        // 次のフレームでも更新（確実に反映させるため）
        requestAnimationFrame(() => {
            this.updateAISettingsVisibility();
            // さらに次のフレームでも更新（念のため）
            requestAnimationFrame(() => {
                this.updateAISettingsVisibility();
            });
        });
        // setTimeoutでも更新（DOM更新を確実に反映）
        setTimeout(() => {
            this.updateAISettingsVisibility();
        }, 50);
    }

    /**
     * イベントリスナーの設定
     */
    setupEventListeners() {
        const handlers = {
            'resetBtn': () => this.reset(),
            'aiLevelSente': (e) => {
                this.aiLevelSente = e.target.value;
                this.aiSente = this.createAI(PLAYER.SENTE);
                // 対戦モード変更時はゲームを停止
                this.gameStarted = false;
                console.log('[Game] 先手AI強さ変更: ゲームを停止しました', { aiLevel: this.aiLevelSente, gameStarted: this.gameStarted });
                // 進行中のAI思考をクリーンアップ
                this.cleanupAIMove();
                // 即座に更新を試みる
                this.updateAISettingsVisibility();
                // 遅延更新も実行（確実に反映させるため）
                this.scheduleAISettingsUpdate();
            },
            'aiLevelGote': (e) => {
                this.aiLevelGote = e.target.value;
                this.aiGote = this.createAI(PLAYER.GOTE);
                // 対戦モード変更時はゲームを停止
                this.gameStarted = false;
                console.log('[Game] 後手AI強さ変更: ゲームを停止しました', { aiLevel: this.aiLevelGote, gameStarted: this.gameStarted });
                // 進行中のAI思考をクリーンアップ
                this.cleanupAIMove();
                // 即座に更新を試みる
                this.updateAISettingsVisibility();
                // 遅延更新も実行（確実に反映させるため）
                this.scheduleAISettingsUpdate();
            },
            'ollamaModelSente': (e) => {
                // 先手Ollamaモデルが変更された場合、先手がOllamaモードの場合はAIを再作成
                if (this.aiLevelSente === AI_LEVEL.OLLAMA) {
                    this.aiSente = this.createAI(PLAYER.SENTE);
                    // 設定変更時はゲームを停止
                    this.gameStarted = false;
                    // 進行中のAI思考をクリーンアップ
                    this.cleanupAIMove();
                }
            },
            'ollamaModelGote': (e) => {
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

        // 自分の駒を取らないようにフィルタリング
        return moves.filter(([r, c]) => {
            const target = this.board[r][c];
            if (!target) return true;
            return (this.currentTurn === PLAYER.SENTE && this.isGote(target)) ||
                   (this.currentTurn === PLAYER.GOTE && this.isSente(target));
        });
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
     * 盤面を描画
     */
    renderBoard() {
        const boardElement = document.getElementById('board');
        if (!boardElement) return;
        
        boardElement.innerHTML = '';
        
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;
                
                const piece = this.board[row][col];
                if (piece) {
                    const pieceElement = document.createElement('div');
                    pieceElement.className = `piece ${this.isSente(piece) ? 'sente' : 'gote'}`;
                    pieceElement.textContent = this.getPieceName(piece);
                    cell.appendChild(pieceElement);
                }
                
                cell.addEventListener('click', () => this.handleCellClick(row, col));
                boardElement.appendChild(cell);
            }
        }
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
     * 移動可能な位置をハイライト
     */
    highlightMoves() {
        this.renderBoard();
        if (this.selectedCell) {
            const [row, col] = this.selectedCell;
            const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (cell) cell.classList.add('selected');
            
            const possibleMoves = this.getPossibleMoves(row, col);
            possibleMoves.forEach(([r, c]) => {
                const moveCell = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                if (moveCell) moveCell.classList.add('possible-move');
            });
        }
    }

    /**
     * ターン表示を更新
     */
    updateTurnIndicator() {
        const turnElement = document.getElementById('currentTurn');
        if (turnElement) {
            turnElement.textContent = this.currentTurn === PLAYER.SENTE ? '先手の番' : '後手の番';
        }
    }

    /**
     * 持ち駒表示を更新
     */
    updateCapturedPieces() {
        const topList = document.getElementById('capturedTopList');
        const bottomList = document.getElementById('capturedBottomList');
        
        if (!topList || !bottomList) return;
        
        topList.innerHTML = '';
        bottomList.innerHTML = '';
        
        // 持ち駒を集計
        const gotePieces = this.countPieces(this.capturedPieces.gote);
        const sentePieces = this.countPieces(this.capturedPieces.sente);
        
        // 後手の持ち駒を表示
        this.renderCapturedPieces(gotePieces, topList, PLAYER.GOTE);
        
        // 先手の持ち駒を表示
        this.renderCapturedPieces(sentePieces, bottomList, PLAYER.SENTE);
    }

    /**
     * 持ち駒を集計
     */
    countPieces(pieces) {
        const counts = {};
        pieces.forEach(piece => {
            counts[piece] = (counts[piece] || 0) + 1;
        });
        return counts;
    }

    /**
     * 持ち駒を描画
     */
    renderCapturedPieces(pieces, container, player) {
        Object.keys(pieces).forEach(piece => {
            const count = pieces[piece];
            const pieceElement = document.createElement('div');
            pieceElement.className = 'captured-piece';
            pieceElement.textContent = count > 1 
                ? `${this.getPieceName(piece)}×${count}` 
                : this.getPieceName(piece);
            pieceElement.dataset.piece = piece;
            
            if (this.selectedCapturedPiece && 
                this.selectedCapturedPiece.piece === piece && 
                this.selectedCapturedPiece.player === player) {
                pieceElement.classList.add('selected-captured');
            }
            
            pieceElement.addEventListener('click', () => this.handleCapturedPieceClick(piece, player));
            container.appendChild(pieceElement);
        });
    }

    /**
     * 持ち駒クリックを処理
     */
    handleCapturedPieceClick(piece, player) {
        if (!this.gameStarted || player !== this.currentTurn || this.gameOver) return;
        
        if (this.selectedCapturedPiece && 
            this.selectedCapturedPiece.piece === piece && 
            this.selectedCapturedPiece.player === player) {
            this.selectedCapturedPiece = null;
        } else {
            this.selectedCapturedPiece = { piece: piece, player: player };
            this.selectedCell = null;
        }
        
        this.updateCapturedPieces();
        this.highlightDropPositions();
    }
    
    /**
     * 持ち駒を打てるかどうか
     */
    canDropPiece(piece, row, col) {
        if (this.board[row][col]) return false;
        
        const pieceType = piece.toLowerCase();
        
        // 二歩のチェック
        if (pieceType === PIECE_TYPE.PAWN) {
            const droppedPiece = this.currentTurn === PLAYER.SENTE ? 'P' : 'p';
            for (let r = 0; r < BOARD_SIZE; r++) {
                if (this.board[r][col] === droppedPiece) {
                    return false;
                }
            }
            
            // 打ち歩詰めのチェック（簡易版）
            if (this.currentTurn === PLAYER.SENTE && row === 0) return false;
            if (this.currentTurn === PLAYER.GOTE && row === BOARD_SIZE - 1) return false;
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

    /**
     * AIのターンかどうか
     * 
     * 人間対AIモードの場合：
     * - 先手（SENTE）のターン: 人間が先手を担当（AIではない）
     * - 後手（GOTE）のターン: AIが後手を担当
     * 
     * AI対AIモードの場合：
     * - 先手（SENTE）のターン: AIが先手を担当
     * - 後手（GOTE）のターン: AIが後手を担当
     */
    isAITurn() {
        // 現在の手番に応じたAIレベルを取得
        const currentAILevel = this.currentTurn === PLAYER.SENTE ? this.aiLevelSente : this.aiLevelGote;
        // 「人間」でない場合はAIターン
        return currentAILevel !== AI_LEVEL.HUMAN;
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
                                this.movePiece(move.fromRow, move.fromCol, move.toRow, move.toCol);
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
     * 局面を文字列化（千日手判定用）
     */
    getPositionKey() {
        // 盤面を文字列化
        let boardStr = '';
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                boardStr += (this.board[row][col] || '.');
            }
        }
        
        // 持ち駒をソートして文字列化
        const senteCaptured = [...this.capturedPieces.sente].sort().join('');
        const goteCaptured = [...this.capturedPieces.gote].sort().join('');
        
        // 手番を含めた局面キー
        return `${boardStr}|${senteCaptured}|${goteCaptured}|${this.currentTurn}`;
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
     * 局面を記録
     */
    recordPosition() {
        const positionKey = this.getPositionKey();
        // 手を打った側（前の手番）が相手に王手をかけているかチェック
        const previousTurn = this.currentTurn === PLAYER.SENTE ? PLAYER.GOTE : PLAYER.SENTE;
        const isGivingCheck = this.isInCheck(this.currentTurn); // 現在の手番のプレイヤーが王手を受けている = 前の手番のプレイヤーが王手をかけている
        
        this.positionHistory.push({
            key: positionKey,
            turn: this.currentTurn,
            isCheck: isGivingCheck
        });
        
        // 王手の履歴も記録（連続王手の千日手判定用）
        // 手を打った側（previousTurn）が相手に王手をかけていたかどうか
        this.checkHistory.push(isGivingCheck);
    }

    /**
     * 千日手判定
     */
    checkRepetition() {
        if (this.positionHistory.length < 4) return;
        
        // 最後の4局面をチェック
        const recentPositions = this.positionHistory.slice(-4);
        const firstKey = recentPositions[0].key;
        
        // 同じ局面が4回出現しているかチェック
        const allSame = recentPositions.every(pos => pos.key === firstKey);
        
        if (allSame) {
            // 連続王手の千日手かチェック
            const recentChecks = this.checkHistory.slice(-4);
            const isContinuousCheck = recentChecks.every(check => check === true);
            
            if (isContinuousCheck) {
                // 連続王手の千日手：王手をかけている側が負け
                // 最後の手を打った側が王手をかけている
                const lastTurn = this.currentTurn === PLAYER.SENTE ? PLAYER.GOTE : PLAYER.SENTE;
                this.gameOver = true;
                this.winner = this.currentTurn; // 王手をかけられていた側が勝ち
                this.showRepetitionMessage('連続王手の千日手', lastTurn);
                this.showReplayMode();
            } else {
                // 通常の千日手：引き分け
                this.gameOver = true;
                this.winner = null;
                this.showRepetitionMessage('千日手', null);
                this.showReplayMode();
            }
        }
    }

    /**
     * 千日手メッセージを表示
     */
    showRepetitionMessage(type, loser) {
        const controls = document.querySelector('.move-history-controls');
        if (!controls) return;
        
        let message = '';
        if (type === '連続王手の千日手') {
            const loserName = loser === PLAYER.SENTE ? '先手' : '後手';
            message = `⚠️ ${type}：${loserName}の負け`;
        } else {
            message = `⚠️ ${type}：引き分け`;
        }
        
        let messageElement = document.getElementById('gameEndMessage');
        if (!messageElement) {
            messageElement = document.createElement('div');
            messageElement.id = 'gameEndMessage';
            messageElement.className = 'game-end-message';
            controls.insertBefore(messageElement, controls.firstChild);
        }
        messageElement.textContent = message;
        messageElement.style.color = '#e74c3c';
    }

    /**
     * ゲーム終了メッセージを表示
     */
    showGameEndMessage() {
        const controls = document.querySelector('.move-history-controls');
        if (!controls) return;
        
        let message = '';
        if (this.winner === PLAYER.SENTE) {
            message = '🎉 先手の勝ち！';
        } else if (this.winner === PLAYER.GOTE) {
            message = '🎉 後手の勝ち！';
        } else {
            message = 'ゲーム終了（引き分け）';
        }
        
        let messageElement = document.getElementById('gameEndMessage');
        if (!messageElement) {
            messageElement = document.createElement('div');
            messageElement.id = 'gameEndMessage';
            messageElement.className = 'game-end-message';
            controls.insertBefore(messageElement, controls.firstChild);
        }
        messageElement.textContent = message;
    }
    
    /**
     * 再生モードを表示
     */
    showReplayMode() {
        this.showGameEndMessage();
        
        // 盤面と持ち駒の操作を無効化
        document.querySelectorAll('.cell, .captured-piece').forEach(element => {
            element.style.pointerEvents = 'none';
        });
        
        // 棋譜コントロールを強調表示
        const controls = document.querySelector('.move-history-controls');
        const panel = document.querySelector('.move-history-panel');
        if (controls) {
            controls.style.display = 'flex';
            controls.style.background = '#fff3cd';
            controls.style.border = '2px solid #ffc107';
        }
        if (panel) {
            panel.style.display = 'block';
            panel.style.background = '#fff3cd';
            panel.style.border = '2px solid #ffc107';
        }
        
        this.updateMoveControls();
    }
    
    /**
     * 再生モードを終了
     */
    exitReplayMode() {
        const messageElement = document.getElementById('gameEndMessage');
        if (messageElement) {
            messageElement.remove();
        }
        
        document.querySelectorAll('.cell, .captured-piece').forEach(element => {
            element.style.pointerEvents = '';
        });
        
        const controls = document.querySelector('.move-history-controls');
        const panel = document.querySelector('.move-history-panel');
        if (controls) {
            controls.style.background = '';
            controls.style.border = '';
        }
        if (panel) {
            panel.style.background = '';
            panel.style.border = '';
        }
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
     * 棋譜から状態を復元
     */
    restoreFromHistory(targetIndex) {
        this.isReplaying = true;
        
        // 初期状態に戻す
        this.board = this.initializeBoard();
        this.capturedPieces = { sente: [], gote: [] };
        this.currentTurn = PLAYER.SENTE;
        this.gameOver = false;
        this.winner = null;
        // 局面履歴は保持（千日手判定のため）
        
        // 指定された手まで再生
        for (let i = 0; i <= targetIndex && i < this.moveHistory.length; i++) {
            const move = this.moveHistory[i];
            if (move.type === 'move') {
                this.movePiece(move.fromRow, move.fromCol, move.toRow, move.toCol, move.promoted);
            } else if (move.type === 'drop') {
                this.dropPiece(move.piece, move.toRow, move.toCol);
            }
        }
        
        this.isReplaying = false;
        this.currentMoveIndex = targetIndex;
        this.updateMoveHistoryDisplay();
        this.updateMoveControls();
    }
    
    /**
     * 一手戻る
     */
    goToPreviousMove() {
        if (this.currentMoveIndex >= 0) {
            this.restoreFromHistory(this.currentMoveIndex - 1);
        }
    }
    
    /**
     * 一手進む
     */
    goToNextMove() {
        if (this.currentMoveIndex < this.moveHistory.length - 1) {
            this.restoreFromHistory(this.currentMoveIndex + 1);
        }
    }
    
    /**
     * 最初の手へ
     */
    goToFirstMove() {
        this.restoreFromHistory(-1);
    }
    
    /**
     * 最後の手へ
     */
    goToLastMove() {
        this.restoreFromHistory(this.moveHistory.length - 1);
    }
    
    /**
     * 棋譜コントロールを更新
     */
    updateMoveControls() {
        const prevBtn = document.getElementById('prevMoveBtn');
        const nextBtn = document.getElementById('nextMoveBtn');
        const firstBtn = document.getElementById('firstMoveBtn');
        const lastBtn = document.getElementById('lastMoveBtn');
        const counter = document.getElementById('moveCounter');
        
        const totalMoves = this.moveHistory.length;
        const currentMove = this.currentMoveIndex + 1;
        
        if (prevBtn) prevBtn.disabled = this.currentMoveIndex < 0;
        if (nextBtn) nextBtn.disabled = this.currentMoveIndex >= totalMoves - 1;
        if (firstBtn) firstBtn.disabled = this.currentMoveIndex < 0;
        if (lastBtn) lastBtn.disabled = this.currentMoveIndex >= totalMoves - 1;
        if (counter) {
            // 手数が0の場合は0/0と表示、それ以外は現在の手数/総手数を表示
            if (totalMoves === 0) {
                counter.textContent = `手数: 0 / 0`;
            } else {
                counter.textContent = `手数: ${currentMove} / ${totalMoves}`;
            }
        }
    }
    
    /**
     * 棋譜表示を更新
     */
    updateMoveHistoryDisplay() {
        const listElement = document.getElementById('moveHistoryList');
        if (!listElement) return;
        
        listElement.innerHTML = '';
        
        this.moveHistory.forEach((move, index) => {
            const moveElement = document.createElement('div');
            moveElement.className = `move-item ${index === this.currentMoveIndex ? 'current' : ''}`;
            
            let moveText = '';
            if (move.type === 'move') {
                const pieceName = this.getPieceName(move.piece);
                const fromPos = this.positionToNotation(move.fromRow, move.fromCol);
                const toPos = this.positionToNotation(move.toRow, move.toCol);
                const promote = move.promoted ? '成' : '';
                moveText = `${index + 1}. ${move.turn === PLAYER.SENTE ? '先手' : '後手'} ${pieceName}${fromPos}→${toPos}${promote}`;
                if (move.captured) {
                    moveText += ` (${this.getPieceName(move.captured)}を取る)`;
                }
            } else if (move.type === 'drop') {
                const pieceName = this.getPieceName(move.piece);
                const toPos = this.positionToNotation(move.toRow, move.toCol);
                moveText = `${index + 1}. ${move.turn === PLAYER.SENTE ? '先手' : '後手'} ${pieceName}打${toPos}`;
            }
            
            moveElement.textContent = moveText;
            moveElement.addEventListener('click', () => {
                this.restoreFromHistory(index);
            });
            
            listElement.appendChild(moveElement);
        });
    }
    
    /**
     * 位置を表記に変換
     */
    positionToNotation(row, col) {
        const colNames = ['９', '８', '７', '６', '５', '４', '３', '２', '１'];
        const rowNames = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
        return colNames[col] + rowNames[row];
    }

    /**
     * 手を記録
     */
    recordMove(moveData) {
        const moveRecord = Object.assign({}, moveData, {
            turn: this.currentTurn,
            capturedPiecesBefore: {
                sente: this.capturedPieces.sente.slice(),
                gote: this.capturedPieces.gote.slice()
            }
        });
        
        // 現在の位置より後ろの手を削除（分岐を削除）
        this.moveHistory = this.moveHistory.slice(0, this.currentMoveIndex + 1);
        this.moveHistory.push(moveRecord);
        this.currentMoveIndex = this.moveHistory.length - 1;
        this.updateMoveHistoryDisplay();
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
        this.renderBoard();
        this.updateTurnIndicator();
        this.updateCapturedPieces();
        this.updateMoveControls();
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
        
        // PieceMovesを更新
        this.pieceMoves.board = this.board;
        
        this.updateUI();
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
     * 棋譜をJSONデータに変換
     */
    exportKifuToJSON() {
        const kifuData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            winner: this.winner,
            moves: this.moveHistory,
            initialBoard: INITIAL_BOARD.map(row => [...row])
        };
        return JSON.stringify(kifuData, null, 2);
    }

    /**
     * 棋譜をJSONファイルとしてダウンロード
     */
    downloadKifu() {
        if (this.moveHistory.length === 0) {
            alert('棋譜がありません');
            return;
        }

        const jsonData = this.exportKifuToJSON();
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `shogi-kifu-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * アップロードされた棋譜データをプレビュー表示
     */
    async previewKifuData(file) {
        try {
            const text = await file.text();
            const kifuData = JSON.parse(text);

            // バリデーション
            if (!kifuData.moves || !Array.isArray(kifuData.moves)) {
                throw new Error('無効な棋譜ファイルです');
            }

            // データを一時保存
            this.pendingKifuData = kifuData;

            // 情報を表示
            this.showKifuDataInfo(kifuData);
        } catch (error) {
            console.error('棋譜読み込みエラー:', error);
            alert('棋譜ファイルの読み込みに失敗しました: ' + error.message);
        }
    }

    /**
     * 棋譜データの情報を表示
     */
    showKifuDataInfo(kifuData) {
        const infoElement = document.getElementById('kifuDataInfo');
        if (!infoElement) return;

        const winnerNames = {
            'sente': '先手',
            'gote': '後手',
            null: '引き分け'
        };

        const timestamp = kifuData.timestamp 
            ? new Date(kifuData.timestamp).toLocaleString('ja-JP')
            : '不明';

        const winner = winnerNames[kifuData.winner] || '不明';
        const moveCount = kifuData.moves ? kifuData.moves.length : 0;

        // 既存の棋譜があるかチェック
        const hasExistingKifu = this.moveHistory.length > 0;
        const existingKifuWarning = hasExistingKifu 
            ? `<div style="margin-bottom: 15px; padding: 10px; background: #fff3cd; border: 2px solid #ffc107; border-radius: 5px; color: #856404;">
                <strong>⚠️ 注意:</strong> 既存の棋譜（${this.moveHistory.length}手）があります。この棋譜を読み込むと、既存の棋譜は上書きされます。
            </div>`
            : '';

        infoElement.innerHTML = `
            ${existingKifuWarning}
            <div style="margin-bottom: 15px;">
                <strong>手数:</strong> ${moveCount}手
            </div>
            <div style="margin-bottom: 15px;">
                <strong>勝者:</strong> ${winner}
            </div>
            <div style="margin-bottom: 15px;">
                <strong>保存日時:</strong> ${timestamp}
            </div>
            <div style="margin-bottom: 15px;">
                <strong>バージョン:</strong> ${kifuData.version || '不明'}
            </div>
        `;

        // モーダルを表示
        this.showKifuDataModal();
        
        // モーダル表示後に棋譜リストを表示（確実に要素が存在するように）
        setTimeout(() => {
            this.showKifuDataList(kifuData.moves);
        }, 10);
    }

    /**
     * 棋譜リストを表示
     */
    showKifuDataList(moves) {
        const listElement = document.getElementById('kifuDataList');
        if (!listElement) {
            console.error('kifuDataList要素が見つかりません');
            return;
        }

        console.log('棋譜リスト表示開始:', { movesCount: moves ? moves.length : 0, moves: moves });

        if (!moves || moves.length === 0) {
            listElement.innerHTML = '<div style="text-align: center; color: #666;">棋譜がありません</div>';
            return;
        }

        try {
            const formattedList = this.formatFullKifuList(moves);
            if (!formattedList || formattedList.trim() === '') {
                listElement.innerHTML = '<div style="text-align: center; color: #666;">棋譜のフォーマットに失敗しました</div>';
                return;
            }
            
            listElement.innerHTML = `
                <div style="margin-bottom: 10px; font-weight: bold; font-size: 1.1em;">全棋譜リスト（${moves.length}手）</div>
                <div style="font-size: 0.9em; line-height: 1.6;">
                    ${formattedList}
                </div>
            `;
            console.log('棋譜リスト表示完了');
        } catch (error) {
            console.error('棋譜リスト表示エラー:', error);
            listElement.innerHTML = `<div style="text-align: center; color: #e74c3c;">棋譜リストの表示中にエラーが発生しました: ${error.message}</div>`;
        }
    }

    /**
     * 全棋譜リストをフォーマット
     */
    formatFullKifuList(moves) {
        if (!moves || moves.length === 0) return 'なし';

        return moves.map((move, index) => {
            try {
                let moveText = '';
                if (move.type === 'move') {
                    if (move.fromRow === undefined || move.fromCol === undefined || 
                        move.toRow === undefined || move.toCol === undefined) {
                        return `<div style="padding: 3px 0; border-bottom: 1px solid #eee; color: #e74c3c;">${index + 1}. 無効な手データ</div>`;
                    }
                    const fromPos = this.positionToNotation(move.fromRow, move.fromCol);
                    const toPos = this.positionToNotation(move.toRow, move.toCol);
                    const pieceName = this.getPieceName(move.piece || '');
                    const promote = move.promoted ? '成' : '';
                    moveText = `${index + 1}. ${move.turn === PLAYER.SENTE ? '先手' : '後手'} ${pieceName}${fromPos}→${toPos}${promote}`;
                    if (move.captured) {
                        moveText += ` (${this.getPieceName(move.captured)}を取る)`;
                    }
                } else if (move.type === 'drop') {
                    if (move.toRow === undefined || move.toCol === undefined) {
                        return `<div style="padding: 3px 0; border-bottom: 1px solid #eee; color: #e74c3c;">${index + 1}. 無効な打ちデータ</div>`;
                    }
                    const toPos = this.positionToNotation(move.toRow, move.toCol);
                    const pieceName = this.getPieceName(move.piece || '');
                    moveText = `${index + 1}. ${move.turn === PLAYER.SENTE ? '先手' : '後手'} ${pieceName}打${toPos}`;
                } else {
                    moveText = `${index + 1}. 不明な手の種類`;
                }
                return `<div style="padding: 3px 0; border-bottom: 1px solid #eee;">${moveText}</div>`;
            } catch (error) {
                console.error(`棋譜フォーマットエラー (手${index + 1}):`, error, move);
                return `<div style="padding: 3px 0; border-bottom: 1px solid #eee; color: #e74c3c;">${index + 1}. エラー: ${error.message}</div>`;
            }
        }).join('');
    }

    /**
     * 棋譜のプレビューをフォーマット
     */
    formatKifuPreview(moves) {
        if (!moves || moves.length === 0) return 'なし';
        
        return moves.map((move, index) => {
            if (move.type === 'move') {
                const fromPos = this.positionToNotation(move.fromRow, move.fromCol);
                const toPos = this.positionToNotation(move.toRow, move.toCol);
                const pieceName = this.getPieceName(move.piece);
                const promote = move.promoted ? '成' : '';
                return `${index + 1}. ${move.turn === PLAYER.SENTE ? '先手' : '後手'} ${pieceName}${fromPos}→${toPos}${promote}`;
            } else if (move.type === 'drop') {
                const toPos = this.positionToNotation(move.toRow, move.toCol);
                const pieceName = this.getPieceName(move.piece);
                return `${index + 1}. ${move.turn === PLAYER.SENTE ? '先手' : '後手'} ${pieceName}打${toPos}`;
            }
            return '';
        }).join('<br>');
    }

    /**
     * 棋譜データモーダルを表示
     */
    showKifuDataModal() {
        const modal = document.getElementById('kifuDataModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    /**
     * 棋譜データモーダルを非表示
     */
    hideKifuDataModal() {
        const modal = document.getElementById('kifuDataModal');
        if (modal) {
            modal.classList.add('hidden');
        }
        // ファイル入力をリセット
        const input = document.getElementById('uploadKifuInput');
        if (input) {
            input.value = '';
        }
        this.pendingKifuData = null;
    }

    /**
     * プレビューした棋譜データを読み込む
     */
    loadKifuFromPreview() {
        if (!this.pendingKifuData) {
            alert('読み込む棋譜データがありません');
            return;
        }

        const kifuData = this.pendingKifuData;

        // 既存の棋譜がある場合は差し替える（既に警告は表示済み）
        // ゲームをリセットして既存の棋譜をクリア
        this.board = this.initializeBoard();
        this.currentTurn = PLAYER.SENTE;
        this.selectedCell = null;
        this.selectedCapturedPiece = null;
        this.pendingPromotion = null;
        this.capturedPieces = { sente: [], gote: [] };
        this.gameOver = false;
        this.winner = kifuData.winner || null;
        this.moveHistory = []; // 既存の棋譜をクリア
        this.currentMoveIndex = -1;
        this.isReplaying = false;
        this.positionHistory = [];
        this.checkHistory = [];

        // 棋譜を読み込んで再生
        this.isReplaying = true;
        // 棋譜をmoveHistoryに直接追加（isReplaying中はrecordMoveが呼ばれないため）
        this.moveHistory = kifuData.moves.map(move => Object.assign({}, move));
        
        for (let i = 0; i < kifuData.moves.length; i++) {
            // 各手を再生する前にcurrentMoveIndexを更新（updateUI内でupdateMoveControlsが呼ばれるため）
            this.currentMoveIndex = i;
            const move = kifuData.moves[i];
            if (move.type === 'move') {
                this.movePiece(move.fromRow, move.fromCol, move.toRow, move.toCol, move.promoted);
            } else if (move.type === 'drop') {
                this.dropPiece(move.piece, move.toRow, move.toCol);
            }
        }
        // 最後の手の位置に設定
        this.currentMoveIndex = kifuData.moves.length - 1;
        this.isReplaying = false;

        // ゲームモードを復元
        // ゲームモードの復元は不要（先手・後手の設定から自動判定）

        this.updateUI();
        this.updateMoveHistoryDisplay();
        this.updateMoveControls();

        if (this.winner) {
            this.showReplayMode();
        }

        this.hideKifuDataModal();
        alert('棋譜を読み込みました');
    }
}

// ゲーム開始
let game;
window.addEventListener('DOMContentLoaded', () => {
    game = new ShogiGame();
    window.game = game; // デバッグ用にwindowに公開
    
    // ゲーム開始前はAIが自動で手を打たない（ニューゲームボタンを押すまで待機）
    // 初期状態では gameStarted = false のため、AIは動作しない
});
