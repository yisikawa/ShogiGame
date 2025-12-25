// USIプロトコルクライアント

import { BOARD_SIZE, PIECE_TYPE } from './constants.js';

/**
 * USIプロトコルを使用して将棋エンジンと通信するクラス
 */
export class USIClient {
    constructor(serverUrl = 'http://localhost:8080') {
        this.serverUrl = serverUrl.replace(/\/$/, '');
        this.connected = false;
        this.engineReady = false;
        this.debugMode = true; // デバッグモードを有効化
        this.engineDown = false; // エンジン停止状態かどうか
        this.restartingEngine = false; // エンジン再起動中かどうか
        this.autoRestartEnabled = true; // 自動再起動を有効にするかどうか
        this.engineName = null; // エンジン名
        this.engineAuthor = null; // エンジン作者
        this.onEngineNameReceived = null; // エンジン名取得時のコールバック
        
        // 重複リクエスト防止用
        this.pendingConnectRequest = null; // 進行中のconnectリクエスト
        this.pendingInitializeRequest = null; // 進行中のinitializeリクエスト
        this.pendingNewGameRequest = null; // 進行中のusinewgameリクエスト
        this.pendingPositionRequest = null; // 進行中のpositionリクエスト
        this.pendingGoRequest = null; // 進行中のgoリクエスト
        this.lastPositionSfen = null; // 最後に送信したSFEN
        this.requestAbortController = null; // リクエストキャンセル用
        this.newGameSent = false; // 新しいゲームを開始したかどうか
    }

    /**
     * デバッグログを出力（Chrome DevToolsで見やすく）
     */
    debugLog(level, message, data = null) {
        if (!this.debugMode) return;
        
        const timestamp = new Date().toISOString();
        const logPrefix = `[USI ${timestamp}]`;
        
        switch (level) {
            case 'info':
                console.info(`%c${logPrefix} ${message}`, 'color: #2196F3; font-weight: bold', data || '');
                break;
            case 'warn':
                console.warn(`%c${logPrefix} ${message}`, 'color: #FF9800; font-weight: bold', data || '');
                break;
            case 'error':
                console.error(`%c${logPrefix} ${message}`, 'color: #F44336; font-weight: bold', data || '');
                break;
            case 'success':
                console.log(`%c${logPrefix} ${message}`, 'color: #4CAF50; font-weight: bold', data || '');
                break;
            default:
                console.log(`${logPrefix} ${message}`, data || '');
        }
    }

    /**
     * サーバーに接続
     */
    async connect() {
        // 既に接続済みの場合は即座に返す
        if (this.connected) {
            this.debugLog('info', '既に接続済みです');
            return { connected: true };
        }
        
        // 既に進行中の接続リクエストがある場合は待機
        if (this.pendingConnectRequest) {
            this.debugLog('info', '既存の接続リクエストを待機します...');
            try {
                return await this.pendingConnectRequest;
            } catch (error) {
                // 既存のリクエストがエラーでも続行（新しいリクエストを試行）
                this.debugLog('warn', '既存の接続リクエストがエラーでした', { error: error.message });
            }
        }
        
        const startTime = performance.now();
        this.debugLog('info', 'サーバー接続開始', { serverUrl: this.serverUrl });
        
        // AbortControllerを作成
        const connectAbortController = new AbortController();
        this.requestAbortController = connectAbortController;
        
        // 接続リクエストを保存
        const connectPromise = (async () => {
            try {
                const response = await fetch(`${this.serverUrl}/usi/connect`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: connectAbortController.signal
                });
                
                const elapsed = (performance.now() - startTime).toFixed(2);
                
                if (!response.ok) {
                    const errorText = await response.text().catch(() => '');
                    this.debugLog('error', `接続エラー: ${response.status}`, {
                        status: response.status,
                        statusText: response.statusText,
                        body: errorText,
                        elapsed: `${elapsed}ms`
                    });
                    throw new Error(`接続エラー: ${response.status} ${response.statusText}`);
                }
                
                const data = await response.json();
                this.connected = true;
                
                this.debugLog('success', 'サーバー接続成功', {
                    ...data,
                    elapsed: `${elapsed}ms`
                });
                
                return data;
            } catch (error) {
                const elapsed = (performance.now() - startTime).toFixed(2);
                
                // リクエスト状態をクリア
                if (this.pendingConnectRequest === connectPromise) {
                    this.pendingConnectRequest = null;
                }
                this.requestAbortController = null;
                
                if (error.name === 'AbortError') {
                    this.debugLog('warn', '接続リクエストがキャンセルされました');
                    throw new Error('接続リクエストがキャンセルされました');
                }
                
                // 接続エラーはエンジン停止の可能性があるため、フラグを設定
                this.engineDown = true;
                this.connected = false;
                this.engineReady = false;
                
                this.debugLog('error', 'USI接続エラー', {
                    error: error.message,
                    stack: error.stack,
                    elapsed: `${elapsed}ms`
                });
                throw error;
            } finally {
                // リクエスト完了時にクリア（成功時もエラー時も）
                if (this.pendingConnectRequest === connectPromise) {
                    this.pendingConnectRequest = null;
                }
            }
        })();
        
        this.pendingConnectRequest = connectPromise;
        
        return await connectPromise;
    }

    /**
     * 新しいゲームを開始（usinewgameを送信）
     */
    async sendNewGame() {
        // 既に進行中のリクエストがある場合は待機
        if (this.pendingNewGameRequest) {
            this.debugLog('info', '既存のusinewgameリクエストを待機します...');
            try {
                return await this.pendingNewGameRequest;
            } catch (error) {
                // 既存のリクエストがエラーでも続行
                this.debugLog('warn', '既存のusinewgameリクエストがエラーでした', { error: error.message });
            }
        }
        
        const startTime = performance.now();
        this.debugLog('info', 'usinewgameリクエスト送信', {
            url: `${this.serverUrl}/usi/usinewgame`
        });
        
        // AbortControllerを作成
        const newGameAbortController = new AbortController();
        this.requestAbortController = newGameAbortController;
        
        // リクエストを保存
        const newGamePromise = (async () => {
            try {
                const response = await fetch(`${this.serverUrl}/usi/usinewgame`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: newGameAbortController.signal
                });
                
                const elapsed = (performance.now() - startTime).toFixed(2);
                
                if (!response.ok) {
                    const errorText = await response.text().catch(() => '');
                    this.debugLog('error', `usinewgameエラー: ${response.status}`, {
                        status: response.status,
                        statusText: response.statusText,
                        body: errorText,
                        elapsed: `${elapsed}ms`
                    });
                    throw new Error(`usinewgameエラー: ${response.status} ${response.statusText}`);
                }
                
                const data = await response.json();
                this.newGameSent = true;
                
                this.debugLog('success', 'usinewgame成功', {
                    ...data,
                    elapsed: `${elapsed}ms`
                });
                
                return data;
            } catch (error) {
                const elapsed = (performance.now() - startTime).toFixed(2);
                
                // リクエスト状態をクリア
                if (this.pendingNewGameRequest === newGamePromise) {
                    this.pendingNewGameRequest = null;
                }
                this.requestAbortController = null;
                
                if (error.name === 'AbortError') {
                    this.debugLog('warn', 'usinewgameリクエストがキャンセルされました');
                    throw new Error('usinewgameリクエストがキャンセルされました');
                }
                
                this.debugLog('error', 'usinewgameリクエストエラー', {
                    error: error.message,
                    elapsed: `${elapsed}ms`
                });
                throw error;
            } finally {
                // リクエスト完了時にクリア
                if (this.pendingNewGameRequest === newGamePromise) {
                    this.pendingNewGameRequest = null;
                }
            }
        })();
        
        this.pendingNewGameRequest = newGamePromise;
        
        return await newGamePromise;
    }

    /**
     * エンジンを再起動
     */
    async restartEngine() {
        // 既に再起動中の場合は待機
        if (this.restartingEngine) {
            this.debugLog('info', '既にエンジン再起動中です。待機します...');
            // 再起動が完了するまで待機（最大10秒）
            const maxWait = 10000;
            const startWait = performance.now();
            while (this.restartingEngine && (performance.now() - startWait) < maxWait) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            if (this.restartingEngine) {
                throw new Error('エンジン再起動がタイムアウトしました');
            }
            return { restarted: true };
        }
        
        this.restartingEngine = true;
        const startTime = performance.now();
        this.debugLog('info', 'エンジン再起動開始', { serverUrl: this.serverUrl });
        
        try {
            // 状態をリセット
            this.engineDown = false;
            this.connected = false;
            this.engineReady = false;
            this.lastPositionSfen = null;
            this.newGameSent = false; // 再起動時はnewGameSentをリセット（次回ゲーム開始時に送信される）
            
            // 進行中のリクエストをキャンセル
            this.cancelPendingRequests();
            
            // エンジンを接続（再起動）
            await this.connect();
            
            // エンジンを初期化
            await this.initialize();
            
            const elapsed = (performance.now() - startTime).toFixed(2);
            this.debugLog('success', 'エンジン再起動成功', {
                elapsed: `${elapsed}ms`,
                connected: this.connected,
                engineReady: this.engineReady
            });
            
            return { restarted: true, elapsed: `${elapsed}ms` };
        } catch (error) {
            const elapsed = (performance.now() - startTime).toFixed(2);
            this.engineDown = true;
            this.debugLog('error', 'エンジン再起動失敗', {
                error: error.message,
                elapsed: `${elapsed}ms`
            });
            throw error;
        } finally {
            this.restartingEngine = false;
        }
    }

    /**
     * エンジンを初期化
     */
    async initialize() {
        // 既に初期化済みの場合は即座に返す
        if (this.engineReady) {
            this.debugLog('info', '既にエンジンが初期化済みです');
            return { ready: true };
        }
        
        // 既に進行中の初期化リクエストがある場合は待機
        if (this.pendingInitializeRequest) {
            this.debugLog('info', '既存の初期化リクエストを待機します...');
            try {
                return await this.pendingInitializeRequest;
            } catch (error) {
                // 既存のリクエストがエラーでも続行（新しいリクエストを試行）
                this.debugLog('warn', '既存の初期化リクエストがエラーでした', { error: error.message });
            }
        }
        
        const startTime = performance.now();
        console.group(`%c[USI] エンジン初期化`, 'color: #2196F3; font-weight: bold');
        
        if (!this.connected) {
            this.debugLog('info', '接続されていないため、先に接続します');
            await this.connect();
        }

        // AbortControllerを作成
        const initializeAbortController = new AbortController();
        this.requestAbortController = initializeAbortController;
        
        // 初期化リクエストを保存
        const initializePromise = (async () => {
            try {
                this.debugLog('info', 'USI初期化コマンド送信', { serverUrl: this.serverUrl });
                
                const response = await fetch(`${this.serverUrl}/usi/usi`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: initializeAbortController.signal
                });

                const elapsed = (performance.now() - startTime).toFixed(2);

                if (!response.ok) {
                    const errorText = await response.text().catch(() => '');
                    // 初期化エラーはエンジン停止の可能性があるため、フラグを設定
                    this.engineDown = true;
                    this.engineReady = false;
                    
                    this.debugLog('error', `初期化エラー: ${response.status}`, {
                        status: response.status,
                        statusText: response.statusText,
                        body: errorText,
                        elapsed: `${elapsed}ms`
                    });
                    throw new Error(`初期化エラー: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                
                // エンジン名と作者を保存（readyでなくても取得できる場合がある）
                if (data.name) {
                    this.engineName = data.name;
                }
                if (data.author) {
                    this.engineAuthor = data.author;
                }
                
                // エンジン名取得時のコールバックを呼び出し（readyでなくてもエンジン名が取得されていれば表示）
                if (this.onEngineNameReceived && this.engineName) {
                    try {
                        this.onEngineNameReceived(this.engineName, this.engineAuthor);
                    } catch (error) {
                        this.debugLog('warn', 'エンジン名コールバックでエラー', { error: error.message });
                    }
                }
                
                // usiok/readyokを受信したかどうかを確認
                if (!data.ready) {
                    // エンジン名が取得できている場合は、エラーを投げずに警告のみ
                    if (this.engineName) {
                        this.engineDown = true;
                        this.engineReady = false;
                        
                        this.debugLog('warn', 'usiok/readyokが受信されませんでしたが、エンジン名は取得できました', {
                            engineName: this.engineName,
                            engineAuthor: this.engineAuthor,
                            data: data,
                            elapsed: `${elapsed}ms`
                        });
                        
                        // エンジン名は取得できているが、readyでないため対局には使用できない
                        // エラーを投げずに、ready: falseの状態で返す
                        return {
                            ready: false,
                            name: this.engineName,
                            author: this.engineAuthor
                        };
                    } else {
                        // エンジン名も取得できていない場合はエラー
                        this.engineDown = true;
                        this.engineReady = false;
                        
                        this.debugLog('error', 'usiok/readyokが受信されませんでした', {
                            data: data,
                            elapsed: `${elapsed}ms`
                        });
                        throw new Error('usiok/readyokが受信されませんでした');
                    }
                }
                
                this.engineReady = data.ready;
                this.engineDown = false; // 再初期化が成功したので停止状態を解除
                
                this.debugLog('success', 'usiok/readyok受信完了 - エンジン初期化完了', {
                    ready: this.engineReady,
                    engineName: data.name,
                    engineAuthor: data.author,
                    elapsed: `${elapsed}ms`
                });
                
                return data;
            } catch (error) {
                const elapsed = (performance.now() - startTime).toFixed(2);
                
                // リクエスト状態をクリア
                if (this.pendingInitializeRequest === initializePromise) {
                    this.pendingInitializeRequest = null;
                }
                this.requestAbortController = null;
                
                if (error.name === 'AbortError') {
                    this.debugLog('warn', '初期化リクエストがキャンセルされました');
                    throw new Error('初期化リクエストがキャンセルされました');
                }
                
                // 初期化エラーはエンジン停止の可能性があるため、フラグを設定
                this.engineDown = true;
                this.engineReady = false;
                
                this.debugLog('error', 'USI初期化エラー', {
                    error: error.message,
                    stack: error.stack,
                    elapsed: `${elapsed}ms`
                });
                throw error;
            } finally {
                // リクエスト完了時にクリア（成功時もエラー時も）
                if (this.pendingInitializeRequest === initializePromise) {
                    this.pendingInitializeRequest = null;
                }
                console.groupEnd();
            }
        })();
        
        this.pendingInitializeRequest = initializePromise;
        
        return await initializePromise;
    }

    /**
     * 盤面をSFEN形式に変換
     * 
     * @param {Object} game - ゲーム状態
     * @param {string} gameMode - ゲームモード（オプション、人間対AIモードの判定用）
     */
    boardToSFEN(game, gameMode = null) {
        let sfen = '';
        
        // 盤面をSFEN形式に変換
        // SFEN: 9段目（上段）から1段目（下段）へ、各段は9筋（右端）から1筋（左端）へ
        // 内部: 行0（上段）から行8（下段）へ、列0（左端）から列8（右端）へ
        for (let row = 0; row < BOARD_SIZE; row++) {
            let emptyCount = 0;
            // 右から左へ（列8から列0へ）
            for (let col = 8; col >= 0; col--) {
                const piece = game.board[row][col];
                if (!piece) {
                    emptyCount++;
                } else {
                    if (emptyCount > 0) {
                        sfen += emptyCount;
                        emptyCount = 0;
                    }
                    sfen += this.pieceToUSI(piece);
                }
            }
            if (emptyCount > 0) {
                sfen += emptyCount;
            }
            if (row < BOARD_SIZE - 1) {
                sfen += '/';
            }
        }

        // 手番をSFEN形式に変換
        // USIプロトコル: b = 先手(sente/black), w = 後手(gote/white)
        // SFEN形式では、実際のゲームの現在の手番を正しく反映する必要がある
        // 人間対AIモードでは、AIが呼ばれるのは後手のターンの時のみ（game.currentTurn === 'gote'）
        // そのため、game.currentTurnをそのまま使用する
        const actualTurn = game.currentTurn;
        // sente → 'w' (先手), gote → 'b' (後手) - bとwを入れ替え
        sfen += ' ' + (actualTurn === 'sente' ? 'w' : 'b');

        // 持ち駒（先手、後手の順）
        // USIプロトコルでは、両方の持ち駒を必ず指定する必要がある
        const senteHand = this.formatHand(game.capturedPieces.sente);
        const goteHand = this.formatHand(game.capturedPieces.gote);
        sfen += ' ' + (senteHand || '-');
        sfen += ' ' + (goteHand || '-'); // 後手の持ち駒も必ず指定

        // 手数
        sfen += ' ' + (game.moveHistory.length + 1);

        return sfen;
    }

    /**
     * 駒をUSI形式に変換
     */
    pieceToUSI(piece) {
        const pieceMap = {
            'K': 'K', 'k': 'k',
            'G': 'G', 'g': 'g',
            'S': 'S', 's': 's',
            'N': 'N', 'n': 'n',
            'L': 'L', 'l': 'l',
            'B': 'B', 'b': 'b',
            'R': 'R', 'r': 'r',
            'P': 'P', 'p': 'p',
            '+B': '+B', '+b': '+b',
            '+R': '+R', '+r': '+r',
            '+S': '+S', '+s': '+s',
            '+N': '+N', '+n': '+n',
            '+L': '+L', '+l': '+l',
            '+P': '+P', '+p': '+p'
        };
        return pieceMap[piece] || piece;
    }

    /**
     * 持ち駒をUSI形式に変換
     */
    formatHand(pieces) {
        if (!pieces || pieces.length === 0) return '';
        
        const counts = {};
        pieces.forEach(piece => {
            counts[piece] = (counts[piece] || 0) + 1;
        });

        const handParts = [];
        const order = ['R', 'B', 'G', 'S', 'N', 'L', 'P'];
        order.forEach(piece => {
            if (counts[piece]) {
                const count = counts[piece];
                if (count > 1) {
                    handParts.push(count + piece);
                } else {
                    handParts.push(piece);
                }
            }
        });

        return handParts.join('');
    }

    /**
     * 最善手を取得
     * 
     * @param {Object} game - ゲーム状態
     * @param {string} turn - 手番 ('sente' または 'gote')
     * @param {number} timeLimit - 思考時間制限（ミリ秒）
     * @param {string} gameMode - ゲームモード（オプション、人間対AIモードの判定用）
     */
    async getBestMove(game, turn, timeLimit = 5000, gameMode = null) {
        // ゲーム終了状態をチェック
        if (game && game.gameOver) {
            const playerName = turn === 'sente' ? '先手' : '後手';
            this.debugLog('info', 'ゲーム終了のため、USIリクエストをスキップします', {
                gameOver: game.gameOver,
                winner: game.winner,
                turn: turn,
                player: playerName
            });
            return null;
        }
        
        // エンジンが停止している場合、自動再起動を試みる
        if (this.engineDown) {
            if (this.autoRestartEnabled && !this.restartingEngine) {
                this.debugLog('info', 'エンジン停止を検知。自動再起動を試みます...', { turn, gameMode });
                try {
                    await this.restartEngine();
                    this.debugLog('success', 'エンジン再起動成功。思考を続行します', { turn, gameMode });
                } catch (restartError) {
                    const errMsg = 'USIエンジンが停止しており、再起動にも失敗しました。';
                    this.debugLog('error', errMsg, { 
                        turn, 
                        gameMode,
                        restartError: restartError.message 
                    });
                    throw new Error(errMsg);
                }
            } else {
                const errMsg = 'USIエンジンが停止しています。再接続してください。';
                this.debugLog('error', errMsg, { turn, gameMode });
                throw new Error(errMsg);
            }
        }
        const totalStartTime = performance.now();
        const playerName = turn === 'sente' ? '先手' : '後手';
        console.group(`%c[USI] 最善手取得 (${playerName})`, 'color: #9C27B0; font-weight: bold');
        
        // 既に進行中のリクエストがある場合はキャンセル
        if (this.pendingPositionRequest || this.pendingGoRequest) {
            this.debugLog('warn', '既存のリクエストをキャンセルします', {
                player: playerName,
                turn: turn
            });
            this.cancelPendingRequests();
        }
        
        if (!this.engineReady) {
            this.debugLog('info', 'エンジンが準備できていないため、初期化します', {
                player: playerName,
                turn: turn
            });
            await this.initialize();
        }

        try {
            // SFEN変換
            const sfenStartTime = performance.now();
            // 人間対AIモードの場合、USIエンジンは後手として思考するため、gameModeを渡す
            const sfen = this.boardToSFEN(game, gameMode);
            const sfenElapsed = (performance.now() - sfenStartTime).toFixed(2);
            
            // SFEN形式の手番を確認（デバッグ用）
            const sfenParts = sfen.trim().split(/\s+/);
            const sfenTurn = sfenParts.length >= 2 ? sfenParts[1] : 'unknown';
            // bとwを入れ替え: sente → 'w', gote → 'b'
            const expectedTurn = game.currentTurn === 'sente' ? 'w' : 'b';
            
            this.debugLog('info', 'SFEN変換完了', {
                sfen: sfen,
                turn: turn,
                player: playerName,
                gameMode: gameMode,
                gameCurrentTurn: game.currentTurn,
                sfenTurn: sfenTurn,
                expectedTurn: expectedTurn,
                turnMatch: sfenTurn === expectedTurn,
                elapsed: `${sfenElapsed}ms`
            });
            
            // 手番が一致しているか確認
            if (sfenTurn !== expectedTurn) {
                this.debugLog('error', 'SFEN形式の手番が実際のゲームの手番と一致しません', {
                    sfenTurn: sfenTurn,
                    expectedTurn: expectedTurn,
                    gameCurrentTurn: game.currentTurn,
                    gameMode: gameMode
                });
            }
            
            // 重複リクエストのチェック（同じSFENの場合はスキップ）
            if (this.lastPositionSfen === sfen && this.pendingPositionRequest) {
                this.debugLog('warn', '同じSFENのpositionリクエストが既に送信中です。待機します...');
                // 既存のリクエストが完了するまで待機
                try {
                    await this.pendingPositionRequest;
                } catch (error) {
                    // 既存のリクエストがエラーでも続行
                    this.debugLog('warn', '既存のpositionリクエストがエラーでした', { error: error.message });
                }
            }
            
            // usinewgameはゲーム開始時（reset()）にのみ送信される
            // ここでは送信しない
            
            // 局面設定
            const positionStartTime = performance.now();
            this.debugLog('info', '局面設定リクエスト送信', {
                sfen: sfen,
                turn: turn,
                player: playerName,
                url: `${this.serverUrl}/usi/position`
            });
            
            // AbortControllerを作成
            const positionAbortController = new AbortController();
            this.requestAbortController = positionAbortController;
            
            // positionリクエストを保存
            const positionPromise = fetch(`${this.serverUrl}/usi/position`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sfen: sfen,
                    moves: [] // 必要に応じて手の履歴を追加
                }),
                signal: positionAbortController.signal
            });
            
            this.pendingPositionRequest = positionPromise;
            this.lastPositionSfen = sfen;
            
            const response = await positionPromise;

            const positionElapsed = (performance.now() - positionStartTime).toFixed(2);

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                this.debugLog('error', `positionエラー: ${response.status}`, {
                    status: response.status,
                    statusText: response.statusText,
                    body: errorText,
                    elapsed: `${positionElapsed}ms`
                });
                // エンジンが落ちた可能性があるため停止フラグを立てる
                this.engineDown = true;
                this.engineReady = false;
                console.groupEnd();
                
                // 自動再起動を試みる
                if (this.autoRestartEnabled && !this.restartingEngine) {
                    this.debugLog('info', 'positionエラー検知。エンジン再起動を試みます...');
                    try {
                        await this.restartEngine();
                        // 再起動成功したら、positionリクエストを再送する
                        // ただし、無限ループを防ぐため、ここではエラーを投げる
                        throw new Error(`positionエラー: ${response.status} ${response.statusText}（再起動後もエラー）`);
                    } catch (restartError) {
                        throw new Error(`positionエラー: ${response.status} ${response.statusText}`);
                    }
                } else {
                    throw new Error(`positionエラー: ${response.status} ${response.statusText}`);
                }
            }

            const positionData = await response.json();
            this.debugLog('success', '局面設定成功', {
                ...positionData,
                turn: turn,
                player: playerName,
                elapsed: `${positionElapsed}ms`
            });
            
            // positionリクエスト完了
            if (this.pendingPositionRequest === positionPromise) {
                this.pendingPositionRequest = null;
            }

            // 思考開始（エンジン停止が疑われる場合は再送を行わない）
            const goStartTime = performance.now();
            this.debugLog('info', '思考開始リクエスト送信', {
                turn: turn,
                player: playerName,
                timeLimit: timeLimit,
                url: `${this.serverUrl}/usi/go`
            });
            
            // goリクエスト用のAbortController
            const goAbortController = new AbortController();
            this.requestAbortController = goAbortController;
            
            // goリクエストを保存
            const goPromise = fetch(`${this.serverUrl}/usi/go`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    timeLimit: timeLimit
                }),
                signal: goAbortController.signal
            });
            
            this.pendingGoRequest = goPromise;
            
            let goResponse;
            try {
                goResponse = await goPromise;
            } catch (fetchError) {
                const goElapsed = (performance.now() - goStartTime).toFixed(2);
                if (this.pendingGoRequest === goPromise) {
                    this.pendingGoRequest = null;
                }
                this.requestAbortController = null;
                
                this.debugLog('error', 'goリクエスト送信エラー（エンジン停止の可能性）', {
                    error: fetchError.message,
                    name: fetchError.name,
                    type: fetchError.constructor.name,
                    elapsed: `${goElapsed}ms`,
                    isAbort: fetchError.name === 'AbortError'
                });
                
                // エンジン停止とみなしフラグを立てる
                this.engineDown = true;
                this.engineReady = false;
                
                console.groupEnd();
                
                if (fetchError.name === 'AbortError') {
                    throw new Error('goリクエストがキャンセルされました');
                }
                
                // 自動再起動を試みる
                if (this.autoRestartEnabled && !this.restartingEngine) {
                    this.debugLog('info', 'goリクエスト送信エラー検知。エンジン再起動を試みます...');
                    try {
                        await this.restartEngine();
                        throw new Error(`goリクエスト送信エラー: ${fetchError.message}（再起動後もエラー）`);
                    } catch (restartError) {
                        throw new Error(`goリクエスト送信エラー: ${fetchError.message}`);
                    }
                } else {
                    throw new Error(`goリクエスト送信エラー: ${fetchError.message}`);
                }
            }

            const goElapsed = (performance.now() - goStartTime).toFixed(2);

            // HTTPステータスエラーのチェック
            if (!goResponse.ok) {
                if (this.pendingGoRequest === goPromise) {
                    this.pendingGoRequest = null;
                }
                this.requestAbortController = null;
                
                let errorText = '';
                let errorData = null;
                
                try {
                    errorText = await goResponse.text();
                    try {
                        errorData = JSON.parse(errorText);
                    } catch (e) {
                        // JSONでない場合はそのままテキストとして使用
                    }
                } catch (textError) {
                    this.debugLog('warn', 'エラーレスポンスの読み取りに失敗', {
                        error: textError.message
                    });
                }
                
                const errorDetails = {
                    status: goResponse.status,
                    statusText: goResponse.statusText,
                    elapsed: `${goElapsed}ms`,
                    url: `${this.serverUrl}/usi/go`
                };
                
                if (errorData) {
                    errorDetails.errorData = errorData;
                } else if (errorText) {
                    errorDetails.errorText = errorText;
                }
                
                this.debugLog('error', `goエラー（エンジン停止の可能性）: ${goResponse.status} ${goResponse.statusText}`, errorDetails);
                
                // エンジン停止とみなしフラグを立てる
                this.engineDown = true;
                this.engineReady = false;
                
                console.groupEnd();
                
                // 自動再起動を試みる
                if (this.autoRestartEnabled && !this.restartingEngine) {
                    this.debugLog('info', 'goエラー検知。エンジン再起動を試みます...');
                    try {
                        await this.restartEngine();
                        throw new Error(`goエラー: ${goResponse.status} ${goResponse.statusText}（再起動後もエラー）`);
                    } catch (restartError) {
                        throw new Error(`goエラー: ${goResponse.status} ${goResponse.statusText}`);
                    }
                } else {
                    throw new Error(`goエラー: ${goResponse.status} ${goResponse.statusText}`);
                }
            }

            // レスポンスのJSONパース
            let data;
            let usiMove;
            
            try {
                data = await goResponse.json();
                usiMove = data.bestmove;
            } catch (parseError) {
                if (this.pendingGoRequest === goPromise) {
                    this.pendingGoRequest = null;
                }
                this.requestAbortController = null;
                
                this.debugLog('error', 'goレスポンスのJSONパースエラー（エンジン停止の可能性）', {
                    error: parseError.message,
                    status: goResponse.status,
                    statusText: goResponse.statusText,
                    elapsed: `${goElapsed}ms`
                });
                
                // エンジン停止とみなしフラグを立てる
                this.engineDown = true;
                this.engineReady = false;
                
                console.groupEnd();
                
                // 自動再起動を試みる
                if (this.autoRestartEnabled && !this.restartingEngine) {
                    this.debugLog('info', 'goレスポンスパースエラー検知。エンジン再起動を試みます...');
                    try {
                        await this.restartEngine();
                        throw new Error(`goレスポンスのパースエラー: ${parseError.message}（再起動後もエラー）`);
                    } catch (restartError) {
                        throw new Error(`goレスポンスのパースエラー: ${parseError.message}`);
                    }
                } else {
                    throw new Error(`goレスポンスのパースエラー: ${parseError.message}`);
                }
            }
            
            // goリクエスト完了
            if (this.pendingGoRequest === goPromise) {
                this.pendingGoRequest = null;
            }
            this.requestAbortController = null;
            
            this.debugLog('success', '思考完了', {
                bestmove: usiMove,
                position: data.position,
                turn: turn,
                player: playerName,
                elapsed: `${goElapsed}ms`
            });

            if (!usiMove || usiMove === 'resign' || usiMove === 'win') {
                this.debugLog('warn', 'エンジンが投了または勝ちを宣言', {
                    bestmove: usiMove
                });
                console.groupEnd();
                return null;
            }

            // USI形式の手を内部形式に変換
            const parseStartTime = performance.now();
            const parsedMove = this.parseUSIMove(usiMove, game, turn);
            const parseElapsed = (performance.now() - parseStartTime).toFixed(2);
            
            if (parsedMove) {
                this.debugLog('success', '手の変換完了', {
                    usiMove: usiMove,
                    parsedMove: parsedMove,
                    turn: turn,
                    player: playerName,
                    elapsed: `${parseElapsed}ms`
                });
            } else {
                this.debugLog('error', '手の変換失敗', {
                    usiMove: usiMove,
                    turn: turn,
                    player: playerName
                });
            }
            
            const totalElapsed = (performance.now() - totalStartTime).toFixed(2);
            this.debugLog('info', '最善手取得完了', {
                turn: turn,
                player: playerName,
                totalElapsed: `${totalElapsed}ms`,
                breakdown: {
                    sfen: `${sfenElapsed}ms`,
                    position: `${positionElapsed}ms`,
                    go: `${goElapsed}ms`,
                    parse: `${parseElapsed}ms`
                }
            });
            
            console.groupEnd();
            return parsedMove;
        } catch (error) {
            const playerName = turn === 'sente' ? '先手' : '後手';
            
            // リクエストがキャンセルされた場合は特別に処理
            if (error.name === 'AbortError' || error.message.includes('キャンセル')) {
                this.debugLog('warn', 'リクエストがキャンセルされました', {
                    error: error.message,
                    turn: turn,
                    player: playerName
                });
                // リクエスト状態をクリア
                if (this.pendingPositionRequest) {
                    this.pendingPositionRequest = null;
                }
                if (this.pendingGoRequest) {
                    this.pendingGoRequest = null;
                }
                this.requestAbortController = null;
                console.groupEnd();
                throw new Error('リクエストがキャンセルされました');
            }
            
            // リクエスト状態をクリア
            if (this.pendingPositionRequest) {
                this.pendingPositionRequest = null;
            }
            if (this.pendingGoRequest) {
                this.pendingGoRequest = null;
            }
            this.requestAbortController = null;
            
            const totalElapsed = (performance.now() - totalStartTime).toFixed(2);
            
            // エラーの種類を識別
            const errorInfo = {
                error: error.message,
                name: error.name,
                type: error.constructor.name,
                turn: turn,
                player: playerName,
                totalElapsed: `${totalElapsed}ms`
            };
            
            // goリクエスト関連のエラーかどうかを判定
            if (error.message.includes('go') || error.message.includes('思考')) {
                errorInfo.isGoError = true;
                errorInfo.suggestion = 'エンジンが応答していない可能性があります。エンジンの状態を確認してください。';
            }
            
            // ネットワークエラーの場合
            if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed to fetch')) {
                errorInfo.isNetworkError = true;
                errorInfo.suggestion = 'サーバーに接続できません。サーバーが起動しているか確認してください。';
            }
            
            // スタックトレースがある場合は追加
            if (error.stack) {
                errorInfo.stack = error.stack;
            }
            
            this.debugLog('error', 'USI最善手取得エラー', errorInfo);
            console.groupEnd();
            throw error;
        }
    }

    /**
     * 思考開始コマンドを再試行
     */
    async retryGoRequest(game, turn, timeLimit, originalStartTime) {
        const retryStartTime = performance.now();
        const retryDelay = 500; // 再試行前の待機時間（ミリ秒）
        
        this.debugLog('info', '思考開始コマンド再試行', {
            delay: `${retryDelay}ms`,
            timeLimit: timeLimit
        });
        
        // 少し待機してから再試行
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        
        try {
            // goリクエスト用のAbortController
            const goAbortController = new AbortController();
            this.requestAbortController = goAbortController;
            
            // goリクエストを保存
            const goPromise = fetch(`${this.serverUrl}/usi/go`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    timeLimit: timeLimit
                }),
                signal: goAbortController.signal
            });
            
            this.pendingGoRequest = goPromise;
            
            let goResponse;
            try {
                goResponse = await goPromise;
            } catch (fetchError) {
                // ネットワークエラーやタイムアウトなどのfetchエラー
                const retryElapsed = (performance.now() - retryStartTime).toFixed(2);
                
                // リクエスト状態をクリア
                if (this.pendingGoRequest === goPromise) {
                    this.pendingGoRequest = null;
                }
                this.requestAbortController = null;
                
                this.debugLog('error', 'goリクエスト再試行送信エラー', {
                    error: fetchError.message,
                    name: fetchError.name,
                    elapsed: `${retryElapsed}ms`,
                    isAbort: fetchError.name === 'AbortError'
                });
                
                console.groupEnd();
                
                if (fetchError.name === 'AbortError') {
                    throw new Error('goリクエストがキャンセルされました');
                } else {
                    throw new Error(`goリクエスト再試行送信エラー: ${fetchError.message}`);
                }
            }

            const retryElapsed = (performance.now() - retryStartTime).toFixed(2);

            // HTTPステータスエラーのチェック
            if (!goResponse.ok) {
                // リクエスト状態をクリア
                if (this.pendingGoRequest === goPromise) {
                    this.pendingGoRequest = null;
                }
                this.requestAbortController = null;
                
                this.debugLog('error', `goリクエスト再試行も失敗: ${goResponse.status}`, {
                    status: goResponse.status,
                    statusText: goResponse.statusText,
                    elapsed: `${retryElapsed}ms`
                });
                
                console.groupEnd();
                throw new Error(`goリクエスト再試行エラー: ${goResponse.status} ${goResponse.statusText}`);
            }

            // レスポンスのJSONパース
            let data;
            let usiMove;
            
            try {
                data = await goResponse.json();
                usiMove = data.bestmove;
            } catch (parseError) {
                // リクエスト状態をクリア
                if (this.pendingGoRequest === goPromise) {
                    this.pendingGoRequest = null;
                }
                this.requestAbortController = null;
                
                this.debugLog('error', 'goレスポンス再試行のJSONパースエラー', {
                    error: parseError.message,
                    elapsed: `${retryElapsed}ms`
                });
                
                console.groupEnd();
                throw new Error(`goレスポンス再試行のパースエラー: ${parseError.message}`);
            }
            
            // goリクエスト完了
            if (this.pendingGoRequest === goPromise) {
                this.pendingGoRequest = null;
            }
            this.requestAbortController = null;
            
            const totalElapsed = (performance.now() - originalStartTime).toFixed(2);
            this.debugLog('success', '思考完了（再試行成功）', {
                bestmove: usiMove,
                position: data.position,
                turn: turn,
                player: playerName,
                retryElapsed: `${retryElapsed}ms`,
                totalElapsed: `${totalElapsed}ms`
            });

            if (!usiMove || usiMove === 'resign' || usiMove === 'win') {
                this.debugLog('warn', 'エンジンが投了または勝ちを宣言', {
                    bestmove: usiMove,
                    turn: turn,
                    player: playerName
                });
                console.groupEnd();
                return null;
            }

            // USI形式の手を内部形式に変換
            const parseStartTime = performance.now();
            const parsedMove = this.parseUSIMove(usiMove, game, turn);
            const parseElapsed = (performance.now() - parseStartTime).toFixed(2);
            
            if (parsedMove) {
                this.debugLog('success', '手の変換完了（再試行）', {
                    usiMove: usiMove,
                    parsedMove: parsedMove,
                    turn: turn,
                    player: playerName,
                    elapsed: `${parseElapsed}ms`
                });
            } else {
                this.debugLog('error', '手の変換失敗（再試行）', {
                    usiMove: usiMove,
                    turn: turn,
                    player: playerName
                });
            }
            
            console.groupEnd();
            return parsedMove;
        } catch (error) {
            // リクエスト状態をクリア
            if (this.pendingGoRequest) {
                this.pendingGoRequest = null;
            }
            this.requestAbortController = null;
            
            const retryElapsed = (performance.now() - retryStartTime).toFixed(2);
            this.debugLog('error', 'goリクエスト再試行エラー', {
                error: error.message,
                turn: turn,
                player: playerName,
                elapsed: `${retryElapsed}ms`
            });
            
            console.groupEnd();
            throw error;
        }
    }

    /**
     * 進行中のリクエストをキャンセル
     */
    cancelPendingRequests() {
        if (this.requestAbortController) {
            this.requestAbortController.abort();
            this.requestAbortController = null;
        }
        this.pendingConnectRequest = null;
        this.pendingInitializeRequest = null;
        this.pendingNewGameRequest = null;
        this.pendingPositionRequest = null;
        this.pendingGoRequest = null;
        this.debugLog('info', '進行中のリクエストをキャンセルしました');
    }

    /**
     * USI形式の手を内部形式に変換
     * 
     * @param {string} usiMove - USI形式の手（例: "7g7f" または "P*5e"）
     * @param {Object} game - ゲーム状態
     * @param {string} turn - 手番 ('sente' または 'gote')
     */
    parseUSIMove(usiMove, game, turn) {
        // USI形式: "7g7f" (移動) または "P*5e" (打ち)
        // USI座標系: 筋1-9(右→左), 段a-i(下→上)
        // 内部座標系: 列0-8(左→右), 行0-8(上→下)
        
        if (usiMove.includes('*')) {
            // 打ち: "P*5e"
            const match = usiMove.match(/^([A-Z])\*(\d)([a-i])$/);
            if (!match) return null;

            const piece = match[1].toLowerCase();
            const usiCol = parseInt(match[2]); // 1-9
            const usiRow = match[3].charCodeAt(0) - 'a'.charCodeAt(0); // 0-8 (a=0, i=8)
            
            const col = 9 - usiCol; // 内部列: 9-1 = 8-0
            const row = 8 - usiRow; // 内部行: 8-0 = 8-0 (a段=下段=行8, i段=上段=行0)

            return {
                type: 'drop',
                piece: piece,
                toRow: row,
                toCol: col
            };
        } else {
            // 移動: "7g7f" または "7g7f+"
            const match = usiMove.match(/^(\d)([a-i])(\d)([a-i])(\+?)$/);
            if (!match) return null;

            const fromUsiCol = parseInt(match[1]);
            const fromUsiRow = match[2].charCodeAt(0) - 'a'.charCodeAt(0);
            const toUsiCol = parseInt(match[3]);
            const toUsiRow = match[4].charCodeAt(0) - 'a'.charCodeAt(0);
            const promote = match[5] === '+';

            const fromCol = 9 - fromUsiCol;
            const fromRow = 8 - fromUsiRow;
            const toCol = 9 - toUsiCol;
            const toRow = 8 - toUsiRow;

            // 移動元の駒が存在し、正しい手番の駒かどうかを検証
            const piece = game.board[fromRow] && game.board[fromRow][fromCol];
            if (!piece) {
                this.debugLog('error', '移動元に駒が存在しません', {
                    usiMove: usiMove,
                    fromRow: fromRow,
                    fromCol: fromCol,
                    turn: turn
                });
                return null;
            }

            // 人間対AIモードの場合、USIエンジンは後手として思考しているため、
            // 後手の駒のみを動かす手を許可
            const effectiveGameMode = game.gameMode;
            if (effectiveGameMode === 'human-vs-ai') {
                // 後手の駒かどうかを検証（game.isGoteメソッドを使用）
                if (!game.isGote(piece)) {
                    this.debugLog('error', '人間対AIモード: 先手の駒を動かそうとしています（後手の駒のみ許可）', {
                        usiMove: usiMove,
                        piece: piece,
                        fromRow: fromRow,
                        fromCol: fromCol,
                        turn: turn,
                        isGotePiece: game.isGote(piece),
                        isSentePiece: game.isSente(piece)
                    });
                    return null;
                }
            } else {
                // 通常モード: 手番に応じた駒かどうかを検証
                if (turn === 'sente' && !game.isSente(piece)) {
                    this.debugLog('error', '先手のターンですが、後手の駒を動かそうとしています', {
                        usiMove: usiMove,
                        piece: piece,
                        fromRow: fromRow,
                        fromCol: fromCol,
                        turn: turn
                    });
                    return null;
                }
                
                if (turn === 'gote' && !game.isGote(piece)) {
                    this.debugLog('error', '後手のターンですが、先手の駒を動かそうとしています', {
                        usiMove: usiMove,
                        piece: piece,
                        fromRow: fromRow,
                        fromCol: fromCol,
                        turn: turn
                    });
                    return null;
                }
            }

            return {
                type: 'move',
                fromRow: fromRow,
                fromCol: fromCol,
                toRow: toRow,
                toCol: toCol,
                promoted: promote
            };
        }
    }

    /**
     * 内部形式の手をUSI形式に変換
     */
    moveToUSI(move) {
        if (move.type === 'drop') {
            const piece = move.piece.toUpperCase();
            const usiCol = 9 - move.toCol; // 内部列→USI筋
            const usiRow = 8 - move.toRow; // 内部行→USI段
            const row = String.fromCharCode('a'.charCodeAt(0) + usiRow);
            return `${piece}*${usiCol}${row}`;
        } else {
            const fromUsiCol = 9 - move.fromCol;
            const fromUsiRow = 8 - move.fromRow;
            const toUsiCol = 9 - move.toCol;
            const toUsiRow = 8 - move.toRow;
            const fromRow = String.fromCharCode('a'.charCodeAt(0) + fromUsiRow);
            const toRow = String.fromCharCode('a'.charCodeAt(0) + toUsiRow);
            const promote = move.promoted ? '+' : '';
            return `${fromUsiCol}${fromRow}${toUsiCol}${toRow}${promote}`;
        }
    }

    /**
     * 接続を切断
     */
    async disconnect() {
        const startTime = performance.now();
        this.debugLog('info', '接続切断開始', { serverUrl: this.serverUrl });
        
        // 進行中のリクエストをキャンセル
        this.cancelPendingRequests();
        
        try {
            const response = await fetch(`${this.serverUrl}/usi/quit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const elapsed = (performance.now() - startTime).toFixed(2);
            
            if (!response.ok) {
                this.debugLog('warn', `切断エラー: ${response.status}`, {
                    status: response.status,
                    elapsed: `${elapsed}ms`
                });
            } else {
                this.debugLog('success', '接続切断成功', {
                    elapsed: `${elapsed}ms`
                });
            }
            
            this.connected = false;
            this.engineReady = false;
            this.lastPositionSfen = null;
            this.newGameSent = false;
            this.pendingConnectRequest = null;
            this.pendingInitializeRequest = null;
        } catch (error) {
            const elapsed = (performance.now() - startTime).toFixed(2);
            this.debugLog('error', 'USI切断エラー', {
                error: error.message,
                elapsed: `${elapsed}ms`
            });
        }
    }
}
