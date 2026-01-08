// AIプレイヤーの実装

import {
    PIECE_VALUES,
    PIECE_NAMES,
    AI_LEVEL,
    MINIMAX_DEPTH,
    MINIMAX_MOVE_LIMIT,
    ENEMY_TERRITORY_SENTE,
    ENEMY_TERRITORY_GOTE,
    OLLAMA_CONFIG,
    USI_CONFIG,
    getOllamaConfig,
    getUSIConfig
} from './constants.js';
import { USIClient } from './usi.js';

/**
 * 将棋AIプレイヤークラス
 */
export class ShogiAI {
    constructor(level = AI_LEVEL.INTERMEDIATE, ollamaEndpoint = null, ollamaModel = null, usiServerUrl = null) {
        this.level = level;
        this.pieceValues = PIECE_VALUES;
        this.configureOllama(ollamaEndpoint, ollamaModel);
        this.configureUSI(usiServerUrl);

        // Initialize Worker
        try {
            this.worker = new Worker('ai-worker.js', { type: 'module' });
            this.worker.onmessage = this.handleWorkerMessage.bind(this);
            this.pendingRequest = null;
        } catch (e) {
            console.error('Failed to initialize AI Worker:', e);
        }
    }

    handleWorkerMessage(e) {
        if (!this.pendingRequest) return;

        const { type, move, error } = e.data;
        if (type === 'success') {
            this.pendingRequest.resolve(move);
        } else {
            console.error('AI Worker Error:', error);
            this.pendingRequest.reject(new Error(error));
        }
        this.pendingRequest = null;
    }

    configureOllama(ollamaEndpoint, ollamaModel) {
        // コンフィグから値を取得（動的に読み込まれた値を使用）
        const config = getOllamaConfig();
        const endpoint = ollamaEndpoint ?? config.ENDPOINT;
        this.ollamaEndpoint = (endpoint || '').replace(/\/$/, '');
        this.ollamaModel = ollamaModel ?? config.MODEL;
        this.timeoutMs = config.TIMEOUT ?? 30000;
    }

    configureUSI(usiServerUrl) {
        // コンフィグから値を取得（動的に読み込まれた値を使用）
        const config = getUSIConfig();
        const serverUrl = usiServerUrl ?? config.SERVER_URL;
        this.usiClient = this.level === AI_LEVEL.USI ? new USIClient(serverUrl) : null;
        this.usiTimeout = config.TIMEOUT ?? 30000;
        this.usiServerUrl = serverUrl; // サーバーURLを保存（UI更新用）
        this.onEngineNameReceived = null; // エンジン名取得時のコールバック
    }

    /**
     * エンジン名取得時のコールバックを設定
     */
    setEngineNameCallback(callback) {
        this.onEngineNameReceived = callback;
        if (this.usiClient) {
            this.usiClient.onEngineNameReceived = callback;
        }
    }

    /**
     * 非同期で最善手を取得（共通インターフェース）
     */
    async getBestMoveAsync(game, turn) {
        const allMoves = game.getAllPossibleMoves(turn);
        if (allMoves.length === 0) return null;

        if (this.level === AI_LEVEL.OLLAMA) {
            return this.getOllamaMove(allMoves, game, turn);
        } else if (this.level === AI_LEVEL.USI) {
            return this.getUSIMove(allMoves, game, turn);
        } else {
            return this.getLocalAIMove(game, turn);
        }
    }

    /**
     * ローカルAI（Worker）を使用して手を取得
     */
    async getLocalAIMove(game, turn) {
        if (!this.worker) {
            console.warn('AI Worker not available, falling back to synchronous logic (not implemented)');
            return null;
        }

        return new Promise((resolve, reject) => {
            if (this.pendingRequest) {
                this.pendingRequest.reject(new Error('New request started'));
            }

            this.pendingRequest = { resolve, reject };

            const state = {
                board: game.board.board,
                capturedPieces: game.board.capturedPieces
            };

            this.worker.postMessage({
                type: 'think',
                state: state,
                config: {
                    turn: turn,
                    level: this.level
                }
            });
        });
    }

    // Legacy synchronous getBestMove intentionally removed/deprecated.
    // getBestMove(game, turn) {
    //     throw new Error('Use getBestMoveAsync');
    // }

    // ... (Remote AI methods: getUSIMove, getOllamaMove, logMoveStart, logMoveSuccess, etc can remain)

    /**
     * 手取得開始をログに記録
     */
    logMoveStart(type, context) {
        const playerInfo = context.player ? ` (${context.player})` : '';
        console.info(`[AI] ${type}最善手取得開始${playerInfo}`, context);
    }

    /**
     * 手取得成功をログに記録
     */
    logMoveSuccess(type, move, elapsed) {
        const moveDescription = move.type === 'move'
            ? `${move.fromRow},${move.fromCol} → ${move.toRow},${move.toCol}`
            : `${move.piece}打 → ${move.toRow},${move.toCol}`;

        console.info(`[AI] ${type}最善手取得成功`, {
            move: moveDescription,
            elapsed: `${elapsed}ms`
        });
    }



    /**
     * USIを使用して手を取得
     */
    async getUSIMove(allMoves, game, turn) {
        // ゲーム終了状態をチェック
        if (game.gameOver) {
            console.info('[AI] ゲーム終了のため、USIリクエストをスキップします', {
                gameOver: game.gameOver,
                winner: game.winner
            });
            return null;
        }

        if (!this.usiClient) {
            throw new Error('USIクライアントが初期化されていません');
        }

        const playerName = turn === 'sente' ? '先手' : '後手';
        // 人間対AIモードの場合、USIエンジンは後手として思考する
        const usiTurn = game.gameMode === 'human-vs-ai' ? 'gote' : turn;
        const usiPlayerName = usiTurn === 'sente' ? '先手' : '後手';

        this.logMoveStart('USI', {
            serverUrl: this.usiClient.serverUrl,
            turn: turn,
            player: playerName,
            usiTurn: usiTurn,
            usiPlayer: usiPlayerName,
            gameMode: game.gameMode,
            timeout: this.usiTimeout,
            possibleMoves: allMoves.length
        });

        const moveStartTime = performance.now();
        const move = await this.usiClient.getBestMove(game, usiTurn, this.usiTimeout, game.gameMode);
        const moveElapsed = (performance.now() - moveStartTime).toFixed(2);

        if (move) {
            this.logMoveSuccess('USI', move, moveElapsed);
        } else {
            throw new Error('USIが手を返しませんでした');
        }

        return move;
    }



    /**
     * Ollamaを使用して手を取得
     */
    async getOllamaMove(allMoves, game, turn) {
        // 局面をテキスト形式に変換
        const positionText = this.boardToText(game, turn);

        // 合法手のリストをテキスト形式に変換
        const movesText = allMoves.map((move, index) => {
            if (move.type === 'move') {
                const fromPos = this.positionToNotation(move.fromRow, move.fromCol);
                const toPos = this.positionToNotation(move.toRow, move.toCol);
                return `${index + 1}. ${fromPos}→${toPos}`;
            } else {
                const toPos = this.positionToNotation(move.toRow, move.toCol);
                const pieceName = this.getPieceName(move.piece);
                return `${index + 1}. ${pieceName}打${toPos}`;
            }
        }).join('\n');

        const playerName = turn === 'sente' ? '先手' : '後手';
        const prompt = `あなたは将棋のAIです。現在は${playerName}の番です。以下の局面で最善手を選んでください。

${positionText}

合法手:
${movesText}

上記の合法手の中から、最善と思われる手の番号（1, 2, 3...）だけを回答してください。番号以外は書かないでください。`;

        this.logMoveStart('Ollama', { endpoint: this.ollamaEndpoint, model: this.ollamaModel, turn, moves: allMoves.length });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            const response = await fetch(`${this.ollamaEndpoint}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.ollamaModel,
                    prompt: prompt,
                    stream: false,
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status}`);
            }

            const data = await response.json();
            const answer = (data?.response || '').trim();

            const match = answer.match(/\d+/);
            if (match) {
                const moveIndex = parseInt(match[0]) - 1;
                if (moveIndex >= 0 && moveIndex < allMoves.length) {
                    const move = allMoves[moveIndex];
                    this.logMoveSuccess('Ollama', move, '');
                    return move;
                }
            }

            throw new Error(`Ollamaの応答が無効です: ${answer}`);
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Ollama API呼び出しがタイムアウトしました');
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * 盤面をテキスト形式に変換
     */
    boardToText(game, turn) {
        const playerName = turn === 'sente' ? '先手' : '後手';
        let text = `${playerName}の番\n\n`;
        text += '  ９ ８ ７ ６ ５ ４ ３ ２ １\n';

        for (let row = 0; row < 9; row++) {
            text += `${9 - row} `;
            for (let col = 8; col >= 0; col--) {
                const piece = game.board.getPiece(row, col);
                if (piece) {
                    const pieceName = this.getPieceName(piece);
                    text += pieceName;
                } else {
                    text += '・';
                }
            }
            text += ` ${row + 1}\n`;
        }

        text += '\n先手の持ち駒: ';
        const senteCaptured = this.countPieces(game.board.capturedPieces.sente);
        text += Object.keys(senteCaptured).map(p => {
            const name = this.getPieceName(p);
            return senteCaptured[p] > 1 ? `${name}×${senteCaptured[p]}` : name;
        }).join(' ') || 'なし';

        text += '\n後手の持ち駒: ';
        const goteCaptured = this.countPieces(game.board.capturedPieces.gote);
        text += Object.keys(goteCaptured).map(p => {
            const name = this.getPieceName(p);
            return goteCaptured[p] > 1 ? `${name}×${goteCaptured[p]}` : name;
        }).join(' ') || 'なし';

        return text;
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
     * 駒の表示名を取得
     */
    getPieceName(piece) {
        return PIECE_NAMES[piece] || piece;
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
}
