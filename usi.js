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

<<<<<<< HEAD
    boardToSFEN(game) {
        return usiUtils.boardToSFEN(game);
=======
    /**
     * 盤面をSFEN形式に変換
     * 
     * @param {Object} game - ゲーム状態
     * @param {string} gameMode - ゲームモード（オプション、人間対AIモードの判定用）
     * @param {string} turn - 手番 ('sente' または 'gote') - オプション、指定されない場合はgame.currentTurnを使用
     */
    boardToSFEN(game, gameMode = null, turn = null) {
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
        // turnパラメータが指定されている場合はそれを使用、そうでない場合はgame.currentTurnを使用
        const actualTurn = turn || game.currentTurn;
        // sente → 'b' (先手), gote → 'w' (後手)
        sfen += ' ' + (actualTurn === 'sente' ? 'b' : 'w');

        // 持ち駒（先手、後手の順）
        // USIプロトコルでは、両方の持ち駒を必ず指定する必要がある
        const senteHand = this.formatHand(game.capturedPieces.sente);
        const goteHand = this.formatHand(game.capturedPieces.gote);
        sfen += ' ' + (senteHand || '-');
        sfen += ' ' + (goteHand || '-'); // 後手の持ち駒も必ず指定

        // 手数
        const moveCount = game.moveHistory ? game.moveHistory.length : 0;
        sfen += ' ' + (moveCount + 1);

        return sfen;
>>>>>>> 4653c6a54dde4be9cf81315927a04c71d6127a9e
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
<<<<<<< HEAD
            const sfen = this.boardToSFEN(game);
            await this.sendPosition(sfen);
            const data = await this.performGo(timeLimit);
=======
            // 局面設定
            const positionStartTime = performance.now();
            
            // 現在の局面のSFENを計算（手番を正しく反映）
            // turnパラメータを使用して、現在の手番を正しく設定
            const currentSfen = this.boardToSFEN(game, gameMode, turn);
            
            // 手の履歴をUSI形式に変換（全ての手：対戦相手の移動も含む）
            const usiMoves = [];
            if (game.moveHistory && game.moveHistory.length > 0) {
                for (let i = 0; i < game.moveHistory.length; i++) {
                    const move = game.moveHistory[i];
                    // moveHistoryの各手にはturn情報が含まれている
                    const moveTurn = move.turn || 'sente'; // デフォルトは先手
                    const usiMove = this.moveToUSI(move, moveTurn);
                    if (usiMove) {
                        usiMoves.push(usiMove);
                        // デバッグ: 変換結果を確認
                        this.debugLog('info', `moveHistory[${i}] → USI変換`, {
                            moveIndex: i,
                            move: {
                                type: move.type,
                                fromRow: move.fromRow,
                                fromCol: move.fromCol,
                                toRow: move.toRow,
                                toCol: move.toCol,
                                piece: move.piece,
                                turn: moveTurn,
                                promoted: move.promoted
                            },
                            usiMove: usiMove,
                            // 座標変換の詳細
                            coordinateConversion: {
                                fromUsiCol: 9 - move.fromCol,
                                fromUsiRow: 8 - move.fromRow,
                                toUsiCol: 9 - move.toCol,
                                toUsiRow: 8 - move.toRow,
                                fromRowChar: String.fromCharCode('a'.charCodeAt(0) + (8 - move.fromRow)),
                                toRowChar: String.fromCharCode('a'.charCodeAt(0) + (8 - move.toRow))
                            }
                        });
                    } else {
                        this.debugLog('warn', `moveHistory[${i}]のUSI変換に失敗`, {
                            moveIndex: i,
                            move: move
                        });
                    }
                }
            }
            
            this.debugLog('info', '局面設定リクエスト送信', {
                sfen: currentSfen,
                turn: turn,
                player: playerName,
                gameCurrentTurn: game.currentTurn,
                moveCount: game.moveHistory ? game.moveHistory.length : 0,
                movesCount: usiMoves.length,
                moves: usiMoves,
                moveHistory: game.moveHistory ? game.moveHistory.map((m, i) => ({
                    index: i,
                    type: m.type,
                    fromRow: m.fromRow,
                    fromCol: m.fromCol,
                    toRow: m.toRow,
                    toCol: m.toCol,
                    piece: m.piece,
                    turn: m.turn
                })) : [],
                url: `${this.serverUrl}/usi/position`
            });
            
            // 重複リクエストのチェック（同じSFENの場合はスキップ）
            const positionKey = `${currentSfen}:${usiMoves.length}`;
            if (this.lastPositionSfen === positionKey && this.pendingPositionRequest) {
                this.debugLog('warn', '同じ局面のpositionリクエストが既に送信中です。待機します...');
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
            
            // AbortControllerを作成
            const positionAbortController = new AbortController();
            this.requestAbortController = positionAbortController;
            
            // positionリクエストを保存
            const positionPromise = fetch(`${this.serverUrl}/usi/position`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sfen: currentSfen,
                    moves: usiMoves
                }),
                signal: positionAbortController.signal
            });
            
            this.pendingPositionRequest = positionPromise;
            this.lastPositionSfen = positionKey;
            
            const response = await positionPromise;
>>>>>>> 4653c6a54dde4be9cf81315927a04c71d6127a9e

            if (!data || !data.bestmove || data.bestmove === 'resign' || data.bestmove === 'win') {
                this.log(LOG_LEVEL.WARN, '有効な指し手がありません', { bestmove: data?.bestmove });
                return null;
            }

<<<<<<< HEAD
            const parsedMove = this.parseUSIMove(data.bestmove, game, turn);
            const totalElapsed = (performance.now() - totalStartTime).toFixed(2);
            this.log(LOG_LEVEL.INFO, '最善手取得完了', {
                turn,
                bestmove: data.bestmove,
                elapsed: `${totalElapsed}ms`
=======
            // USI形式の手を内部形式に変換
            const parseStartTime = performance.now();
            const parsedMove = this.parseUSIMove(usiMove, game, turn);
            const parseElapsed = (performance.now() - parseStartTime).toFixed(2);
            
            if (!parsedMove) {
                const errorMsg = `USI形式の手を内部形式に変換できませんでした: ${usiMove}`;
                this.debugLog('error', '手の変換失敗', {
                    usiMove: usiMove,
                    turn: turn,
                    player: playerName
                });
                console.groupEnd();
                throw new Error(errorMsg);
            }
            
            this.debugLog('success', '手の変換完了', {
                usiMove: usiMove,
                parsedMove: parsedMove,
                turn: turn,
                player: playerName,
                elapsed: `${parseElapsed}ms`
            });
            
            const totalElapsed = (performance.now() - totalStartTime).toFixed(2);
            this.debugLog('info', '最善手取得完了', {
                turn: turn,
                player: playerName,
                totalElapsed: `${totalElapsed}ms`,
                breakdown: {
                    position: `${positionElapsed}ms`,
                    go: `${goElapsed}ms`,
                    parse: `${parseElapsed}ms`
                }
>>>>>>> 4653c6a54dde4be9cf81315927a04c71d6127a9e
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
<<<<<<< HEAD
        this.log(LOG_LEVEL.INFO, '進行中のリクエストをキャンセルしました');
=======
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
            const row = usiRow; // 内部行: USI段a(0)→内部行0, USI段i(8)→内部行8

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
            const fromRow = fromUsiRow; // USI段a(0)→内部行0, USI段i(8)→内部行8
            const toCol = 9 - toUsiCol;
            const toRow = toUsiRow; // USI段a(0)→内部行0, USI段i(8)→内部行8

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
     * @param {Object} move - 手の情報
     * @param {string} turn - 手番 ('sente' または 'gote')
     */
    moveToUSI(move, turn = 'sente') {
        if (move.type === 'drop') {
            // 打ち手の場合、先手は大文字、後手は小文字
            const piece = turn === 'sente' ? move.piece.toUpperCase() : move.piece.toLowerCase();
            const usiCol = 9 - move.toCol; // 内部列→USI筋
            // 内部行→USI段の変換: parseUSIMoveで row = 8 - usiRow なので、逆変換は usiRow = 8 - row
            // しかし、実際のテストでは内部行6→USI段gが正しい
            // 内部行6（上から7番目）→ USI段g（下から7番目）
            // USI段g = 'g' = 7番目の文字（a=0, b=1, ..., g=6）
            // つまり、内部行をそのまま使用する必要がある
            const usiRow = move.toRow; // 内部行をそのまま使用
            const row = String.fromCharCode('a'.charCodeAt(0) + usiRow);
            return `${piece}*${usiCol}${row}`;
        } else {
            const fromUsiCol = 9 - move.fromCol;
            const fromUsiRow = move.fromRow; // 内部行をそのまま使用
            const toUsiCol = 9 - move.toCol;
            const toUsiRow = move.toRow; // 内部行をそのまま使用
            const fromRow = String.fromCharCode('a'.charCodeAt(0) + fromUsiRow);
            const toRow = String.fromCharCode('a'.charCodeAt(0) + toUsiRow);
            const promote = move.promoted ? '+' : '';
            return `${fromUsiCol}${fromRow}${toUsiCol}${toRow}${promote}`;
        }
>>>>>>> 4653c6a54dde4be9cf81315927a04c71d6127a9e
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
