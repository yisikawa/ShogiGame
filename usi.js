import { BOARD_SIZE, PIECE_TYPE } from './constants.js';
import { log, LOG_LEVEL } from './utils.js';
import * as usiUtils from './usiUtils.js';

/**
 * USIプロトコルを使用して将棋エンジンと通信するクラス
 */
export class USIClient {
    constructor(serverUrl = 'http://localhost:8080') {
        this.serverUrl = serverUrl.replace(/\/$/, '');
        this.connected = false;
        this.engineReady = false;
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
     * ログ出力
     */
    log(level, message, data = null) {
        log(message, data, level);
    }

    /**
     * サーバーに接続
     */
    async connect() {
        // 既に接続済みの場合は即座に返す
        if (this.connected) {
            this.log('info', '既に接続済みです');
            return { connected: true };
        }

        // 既に進行中の接続リクエストがある場合は待機
        if (this.pendingConnectRequest) {
            this.log('info', '既存の接続リクエストを待機します...');
            try {
                return await this.pendingConnectRequest;
            } catch (error) {
                // 既存のリクエストがエラーでも続行（新しいリクエストを試行）
                this.log('warn', '既存の接続リクエストがエラーでした', { error: error.message });
            }
        }

        const startTime = performance.now();
        this.log('info', 'サーバー接続開始', { serverUrl: this.serverUrl });

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
                    this.log('error', `接続エラー: ${response.status}`, {
                        status: response.status,
                        statusText: response.statusText,
                        body: errorText,
                        elapsed: `${elapsed}ms`
                    });
                    throw new Error(`接続エラー: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                this.connected = true;

                this.log('info', 'サーバー接続成功', {
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
                    this.log('warn', '接続リクエストがキャンセルされました');
                    throw new Error('接続リクエストがキャンセルされました');
                }

                // 接続エラーはエンジン停止の可能性があるため、フラグを設定
                this.engineDown = true;
                this.connected = false;
                this.engineReady = false;

                this.log('error', 'USI接続エラー', {
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
     * エンジンが準備完了か確認
     */
    async isReady() {
        if (this.engineReady) return { ready: true };
        return await this.initialize();
    }

    /**
     * 新しいゲームを開始（usinewgameを送信）
     */
    async newGame() {
        return await this.sendNewGame();
    }

    /**
     * 新しいゲームを開始（usinewgameを送信）
     */
    async sendNewGame() {
        // 既に進行中のリクエストがある場合は待機
        if (this.pendingNewGameRequest) {
            this.log('info', '既存のusinewgameリクエストを待機します...');
            try {
                return await this.pendingNewGameRequest;
            } catch (error) {
                // 既存のリクエストがエラーでも続行
                this.log('warn', '既存のusinewgameリクエストがエラーでした', { error: error.message });
            }
        }

        const startTime = performance.now();
        this.log('info', 'usinewgameリクエスト送信', {
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
                    this.log('error', `usinewgameエラー: ${response.status}`, {
                        status: response.status,
                        statusText: response.statusText,
                        body: errorText,
                        elapsed: `${elapsed}ms`
                    });
                    throw new Error(`usinewgameエラー: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                this.newGameSent = true;

                this.log('success', 'usinewgame成功', {
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
                    this.log('warn', 'usinewgameリクエストがキャンセルされました');
                    throw new Error('usinewgameリクエストがキャンセルされました');
                }

                this.log('error', 'usinewgameリクエストエラー', {
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
            this.log('info', '既にエンジン再起動中です。待機します...');
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
        this.log('info', 'エンジン再起動開始', { serverUrl: this.serverUrl });

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
            this.log('success', 'エンジン再起動成功', {
                elapsed: `${elapsed}ms`,
                connected: this.connected,
                engineReady: this.engineReady
            });

            return { restarted: true, elapsed: `${elapsed}ms` };
        } catch (error) {
            const elapsed = (performance.now() - startTime).toFixed(2);
            this.engineDown = true;
            this.log('error', 'エンジン再起動失敗', {
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
            this.log('info', '既にエンジンが初期化済みです');
            return { ready: true };
        }

        // 既に進行中の初期化リクエストがある場合は待機
        if (this.pendingInitializeRequest) {
            this.log('info', '既存の初期化リクエストを待機します...');
            try {
                return await this.pendingInitializeRequest;
            } catch (error) {
                // 既存のリクエストがエラーでも続行（新しいリクエストを試行）
                this.log('warn', '既存の初期化リクエストがエラーでした', { error: error.message });
            }
        }

        if (!this.connected) {
            this.log('info', '接続されていないため、先に接続します');
            await this.connect();
        }

        // AbortControllerを作成
        const initializeAbortController = new AbortController();
        this.requestAbortController = initializeAbortController;

        // 初期化リクエストを保存
        const initializePromise = (async () => {
            const startTime = performance.now();
            try {
                this.log('info', 'USI初期化コマンド送信', { serverUrl: this.serverUrl });

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

                    this.log('error', `初期化エラー: ${response.status}`, {
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
                        this.log('warn', 'エンジン名コールバックでエラー', { error: error.message });
                    }
                }

                // usiok/readyokを受信したかどうかを確認
                if (!data.ready) {
                    // エンジン名が取得できている場合は、エラーを投げずに警告のみ
                    if (this.engineName) {
                        this.engineDown = true;
                        this.engineReady = false;

                        this.log('warn', 'usiok/readyokが受信されませんでしたが、エンジン名は取得できました', {
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

                        this.log('error', 'usiok/readyokが受信されませんでした', {
                            data: data,
                            elapsed: `${elapsed}ms`
                        });
                        throw new Error('usiok/readyokが受信されませんでした');
                    }
                }

                this.engineReady = data.ready;
                this.engineDown = false; // 再初期化が成功したので停止状態を解除

                this.log('success', 'usiok/readyok受信完了 - エンジン初期化完了', {
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
                    this.log('warn', '初期化リクエストがキャンセルされました');
                    throw new Error('初期化リクエストがキャンセルされました');
                }

                // 初期化エラーはエンジン停止の可能性があるため、フラグを設定
                this.engineDown = true;
                this.engineReady = false;

                this.log('error', 'USI初期化エラー', {
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
            }
        })();

        this.pendingInitializeRequest = initializePromise;

        return await initializePromise;
    }

    boardToSFEN(game) {
        return usiUtils.boardToSFEN(game);
    }

    pieceToUSI(piece) {
        return usiUtils.pieceToUSI(piece);
    }

    formatHand(pieces) {
        return usiUtils.formatHand(pieces);
    }

    parseUSIMove(usiMove, game, turn) {
        const move = usiUtils.parseUSIMoveToInternal(usiMove);
        if (!move) return null;

        // 追加の検証ロジック（オリジナルから移植）
        if (move.type === 'move') {
            const piece = game.board[move.fromRow] && game.board[move.fromRow][move.fromCol];
            if (!piece) {
                this.log(LOG_LEVEL.ERROR, '移動元に駒が存在しません', { usiMove });
                return null;
            }

            const isSente = game.isSente(piece);
            const isGote = game.isGote(piece);

            // 手番の駒であることを確認
            if (turn === 'sente' && !isSente) return null;
            if (turn === 'gote' && !isGote) return null;
        }
        return move;
    }

    moveToUSI(move) {
        return usiUtils.moveToUSI(move);
    }

    /**
     * 最善手を取得
     * 
     * @param {Object} game - ゲーム状態
     * @param {string} turn - 手番 ('sente' または 'gote')
     * @param {number} timeLimit - 思考時間制限（ミリ秒）
     */
    async getBestMove(game, turn, timeLimit = 5000) {
        if (game && game.gameOver) {
            this.log(LOG_LEVEL.INFO, 'ゲーム終了のため、USIリクエストをスキップします', { turn });
            return null;
        }

        if (this.engineDown && this.autoRestartEnabled && !this.restartingEngine) {
            this.log(LOG_LEVEL.INFO, 'エンジン停止を検知。自動再起動を試みます...');
            await this.restartEngine().catch(e => {
                throw new Error(`USIエンジン再起動失敗: ${e.message}`);
            });
        }

        const totalStartTime = performance.now();

        this.cancelPendingRequests();
        if (!this.engineReady) await this.initialize();

        try {
            const sfen = this.boardToSFEN(game);
            await this.sendPosition(sfen);
            const data = await this.performGo(timeLimit);

            if (!data || !data.bestmove || data.bestmove === 'resign' || data.bestmove === 'win') {
                this.log(LOG_LEVEL.WARN, '有効な指し手がありません', { bestmove: data?.bestmove });
                return null;
            }

            const parsedMove = this.parseUSIMove(data.bestmove, game, turn);
            const totalElapsed = (performance.now() - totalStartTime).toFixed(2);
            this.log(LOG_LEVEL.INFO, '最善手取得完了', {
                turn,
                bestmove: data.bestmove,
                elapsed: `${totalElapsed}ms`
            });

            return parsedMove;
        } catch (error) {
            if (error.name === 'AbortError') {
                this.log(LOG_LEVEL.WARN, 'リクエストがキャンセルされました');
                return null;
            }
            this.log(LOG_LEVEL.ERROR, 'USI最善手取得エラー', { error: error.message, turn });
            throw error;
        }
    }

    /**
     * 局面情報をエンジンに送信
     */
    async sendPosition(sfen) {
        const abortController = new AbortController();
        this.requestAbortController = abortController;

        const promise = fetch(`${this.serverUrl}/usi/position`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sfen, moves: [] }),
            signal: abortController.signal
        });

        this.pendingPositionRequest = promise;
        this.lastPositionSfen = sfen;

        try {
            const response = await promise;
            if (!response.ok) {
                this.engineDown = true;
                throw new Error(`positionエラー: ${response.status}`);
            }
            return await response.json();
        } finally {
            if (this.pendingPositionRequest === promise) this.pendingPositionRequest = null;
        }
    }

    /**
     * 思考開始リクエストを送信
     */
    async performGo(timeLimit) {
        const abortController = new AbortController();
        this.requestAbortController = abortController;

        const promise = fetch(`${this.serverUrl}/usi/go`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timeLimit }),
            signal: abortController.signal
        });

        this.pendingGoRequest = promise;

        try {
            const response = await promise;
            if (!response.ok) {
                this.engineDown = true;
                throw new Error(`goエラー: ${response.status}`);
            }
            return await response.json();
        } finally {
            if (this.pendingGoRequest === promise) this.pendingGoRequest = null;
        }
    }

    async retryGoRequest(game, turn, timeLimit) {
        this.log(LOG_LEVEL.INFO, '思考開始コマンド再試行', { timeLimit });
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
            const data = await this.performGo(timeLimit);
            if (!data || !data.bestmove) return null;
            return this.parseUSIMove(data.bestmove, game, turn);
        } catch (error) {
            this.log(LOG_LEVEL.ERROR, 'goリクエスト再試行エラー', { error: error.message });
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
        this.log(LOG_LEVEL.INFO, '進行中のリクエストをキャンセルしました');
    }

    /**
     * 接続を切断
     */
    async disconnect() {
        this.cancelPendingRequests();
        await fetch(`${this.serverUrl}/usi/quit`, { method: 'POST' }).catch(() => null);
        this.connected = false;
        this.engineReady = false;
        this.log(LOG_LEVEL.INFO, '接続を切断しました');
    }
}
