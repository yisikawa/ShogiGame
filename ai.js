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
    USI_CONFIG
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
    }

    configureOllama(ollamaEndpoint, ollamaModel) {
        const endpoint = ollamaEndpoint ?? OLLAMA_CONFIG.ENDPOINT;
        this.ollamaEndpoint = (endpoint || '').replace(/\/$/, '');
        this.ollamaModel = ollamaModel ?? OLLAMA_CONFIG.MODEL;
        this.timeoutMs = OLLAMA_CONFIG.TIMEOUT ?? 30000;
    }

    configureUSI(usiServerUrl) {
        const serverUrl = usiServerUrl ?? USI_CONFIG.SERVER_URL;
        this.usiClient = this.level === AI_LEVEL.USI ? new USIClient(serverUrl) : null;
        this.usiTimeout = USI_CONFIG.TIMEOUT ?? 30000;
    }

    /**
     * 最善手を取得
     */
    getBestMove(game, turn) {
        const allMoves = game.getAllPossibleMoves(turn);
        if (allMoves.length === 0) return null;
        
        switch (this.level) {
            case AI_LEVEL.BEGINNER:
                return this.getBeginnerMove(allMoves, game, turn);
            case AI_LEVEL.INTERMEDIATE:
                return this.getIntermediateMove(allMoves, game, turn);
            case AI_LEVEL.ADVANCED:
                return this.getAdvancedMove(allMoves, game, turn);
            case AI_LEVEL.OLLAMA:
                // Ollamaは非同期なので、ここではフォールバック
                // 実際の呼び出しはgetBestMoveAsync()を使用
                return this.getIntermediateMove(allMoves, game, turn);
            case AI_LEVEL.USI:
                // USIは非同期なので、ここではフォールバック
                // 実際の呼び出しはgetBestMoveAsync()を使用
                return this.getIntermediateMove(allMoves, game, turn);
            default:
                return this.getIntermediateMove(allMoves, game, turn);
        }
    }

    /**
     * 初級AI: ランダムまたは簡単な評価
     */
    getBeginnerMove(allMoves, game, turn) {
        const RANDOM_THRESHOLD = 0.5;
        
        // 50%の確率でランダム、50%で簡単な評価
        if (Math.random() < RANDOM_THRESHOLD) {
            return this.getRandomMove(allMoves);
        }
        
        // 簡単な評価：取れる駒がある場合は優先
        return this.getBestCaptureMove(allMoves, game) || this.getRandomMove(allMoves);
    }

    /**
     * ランダムな手を取得
     */
    getRandomMove(allMoves) {
        if (allMoves.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * allMoves.length);
        return allMoves[randomIndex];
    }

    /**
     * 取れる駒がある手を優先的に取得
     */
    getBestCaptureMove(allMoves, game) {
        let bestMove = null;
        let bestScore = -Infinity;
        
        for (const move of allMoves) {
            if (move.type !== 'move') continue;
            
            const targetPiece = game.board[move.toRow][move.toCol];
            if (!targetPiece) continue;
            
            const pieceType = targetPiece.replace('+', '').toLowerCase();
            const score = this.pieceValues[pieceType] || 0;
            
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        
        return bestMove;
    }

    /**
     * 中級AI: 基本的な評価関数
     */
    getIntermediateMove(allMoves, game, turn) {
        if (allMoves.length === 0) return null;
        
        return this.selectBestMove(allMoves, (move) => this.evaluateMove(move, game, turn));
    }

    /**
     * 評価関数に基づいて最善手を選択
     */
    selectBestMove(allMoves, evaluateFn) {
        let bestMove = null;
        let bestScore = -Infinity;
        
        for (const move of allMoves) {
            const score = evaluateFn(move);
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        
        return bestMove || allMoves[0];
    }

    /**
     * 上級AI: ミニマックス法（簡易版）
     */
    getAdvancedMove(allMoves, game, turn) {
        let bestMove = null;
        let bestScore = -Infinity;
        
        for (const move of allMoves) {
            // 仮想的に手を打つ
            const gameCopy = this.cloneGame(game);
            this.makeMove(gameCopy, move, turn);
            
            // ミニマックス評価（簡易版）
            const score = this.minimax(
                gameCopy,
                MINIMAX_DEPTH - 1,
                turn === 'sente' ? 'gote' : 'sente',
                false
            );
            
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        
        return bestMove || this.getIntermediateMove(allMoves, game, turn);
    }

    /**
     * 手の評価
     */
    evaluateMove(move, game, turn) {
        if (move.type === 'move') {
            return this.evaluateMoveMove(move, game, turn);
        } else if (move.type === 'drop') {
            return this.evaluateMoveDrop(move, game, turn);
        }
        return 0;
    }

    /**
     * 移動手の評価
     */
    evaluateMoveMove(move, game, turn) {
        let score = 0;
        const targetPiece = game.board[move.toRow][move.toCol];
        
        // 取れる駒の価値
        if (targetPiece) {
            const pieceType = targetPiece.replace('+', '').toLowerCase();
            score += this.pieceValues[pieceType] || 0;
        }
        
        // 前進を評価
        const fromPiece = game.board[move.fromRow][move.fromCol];
        if (fromPiece) {
            const ADVANCE_BONUS = 10;
            if (turn === 'sente' && move.toRow < move.fromRow) {
                score += ADVANCE_BONUS;
            } else if (turn === 'gote' && move.toRow > move.fromRow) {
                score += ADVANCE_BONUS;
            }
        }
        
        return score;
    }

    /**
     * 打ち手の評価
     */
    evaluateMoveDrop(move, game, turn) {
        const DROP_PENALTY_FACTOR = 0.1;
        const ENEMY_TERRITORY_BONUS = 20;
        
        let score = 0;
        const pieceValue = this.pieceValues[move.piece] || 0;
        score += pieceValue * DROP_PENALTY_FACTOR; // 持ち駒を打つのは少しマイナス評価
        
        // 敵陣に打つ場合はプラス評価
        if (turn === 'sente' && move.toRow < ENEMY_TERRITORY_SENTE) {
            score += ENEMY_TERRITORY_BONUS;
        } else if (turn === 'gote' && move.toRow > ENEMY_TERRITORY_GOTE) {
            score += ENEMY_TERRITORY_BONUS;
        }
        
        return score;
    }

    /**
     * ミニマックス法（簡易版）
     */
    minimax(game, depth, turn, isMaximizing) {
        if (depth === 0) {
            return this.evaluatePosition(game, turn === 'sente' ? 'gote' : 'sente');
        }
        
        const moves = game.getAllPossibleMoves(turn);
        if (moves.length === 0) {
            return isMaximizing ? -Infinity : Infinity;
        }
        
        if (isMaximizing) {
            let maxScore = -Infinity;
            for (const move of moves.slice(0, MINIMAX_MOVE_LIMIT)) {
                const gameCopy = this.cloneGame(game);
                this.makeMove(gameCopy, move, turn);
                const score = this.minimax(
                    gameCopy,
                    depth - 1,
                    turn === 'sente' ? 'gote' : 'sente',
                    false
                );
                maxScore = Math.max(maxScore, score);
            }
            return maxScore;
        } else {
            let minScore = Infinity;
            for (const move of moves.slice(0, MINIMAX_MOVE_LIMIT)) {
                const gameCopy = this.cloneGame(game);
                this.makeMove(gameCopy, move, turn);
                const score = this.minimax(
                    gameCopy,
                    depth - 1,
                    turn === 'sente' ? 'gote' : 'sente',
                    true
                );
                minScore = Math.min(minScore, score);
            }
            return minScore;
        }
    }

    /**
     * 局面評価
     */
    evaluatePosition(game, myTurn) {
        const CAPTURED_PIECE_FACTOR = 0.8;
        
        let score = this.evaluateBoardPieces(game, myTurn);
        score += this.evaluateCapturedPieces(game, myTurn, CAPTURED_PIECE_FACTOR);
        
        return score;
    }

    /**
     * 盤上の駒を評価
     */
    evaluateBoardPieces(game, myTurn) {
        let score = 0;
        
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const piece = game.board[row][col];
                if (!piece) continue;
                
                const pieceType = piece.replace('+', '').toLowerCase();
                const value = this.pieceValues[pieceType] || 0;
                
                const isMyPiece = (myTurn === 'sente' && game.isSente(piece)) ||
                                  (myTurn === 'gote' && game.isGote(piece));
                
                score += isMyPiece ? value : -value;
            }
        }
        
        return score;
    }

    /**
     * 持ち駒を評価
     */
    evaluateCapturedPieces(game, myTurn, factor) {
        let score = 0;
        const opponent = myTurn === 'sente' ? 'gote' : 'sente';
        
        // 自分の持ち駒
        game.capturedPieces[myTurn].forEach(piece => {
            score += (this.pieceValues[piece] || 0) * factor;
        });
        
        // 相手の持ち駒（マイナス評価）
        game.capturedPieces[opponent].forEach(piece => {
            score -= (this.pieceValues[piece] || 0) * factor;
        });
        
        return score;
    }

    /**
     * ゲーム状態のクローン（簡易版）
     */
    cloneGame(game) {
        const cloned = {
            board: game.board.map(row => [...row]),
            capturedPieces: {
                sente: [...game.capturedPieces.sente],
                gote: [...game.capturedPieces.gote]
            },
            currentTurn: game.currentTurn,
            isSente: (piece) => game.isSente(piece),
            isGote: (piece) => game.isGote(piece),
            getPossibleMoves: (row, col) => game.getPossibleMoves(row, col),
            getAllPossibleMoves: (turn) => game.getAllPossibleMoves(turn),
            isValidPosition: (row, col) => game.isValidPosition(row, col)
        };
        return cloned;
    }

    /**
     * 仮想的に手を打つ
     */
    makeMove(game, move, turn) {
        if (move.type === 'move') {
            this.makeMoveMove(game, move, turn);
        } else if (move.type === 'drop') {
            this.makeMoveDrop(game, move, turn);
        }
    }

    /**
     * 移動手を実行
     */
    makeMoveMove(game, move, turn) {
        const piece = game.board[move.fromRow][move.fromCol];
        const captured = game.board[move.toRow][move.toCol];
        
        // 取った駒を持ち駒に追加
        if (captured) {
            const capturedPiece = captured.replace('+', '').toLowerCase();
            game.capturedPieces[turn].push(capturedPiece);
        }
        
        // 駒を移動
        game.board[move.toRow][move.toCol] = piece;
        game.board[move.fromRow][move.fromCol] = null;
        
        // 成りの判定（AIは基本的に成る）
        if (this.shouldPromote(piece, move, turn)) {
            game.board[move.toRow][move.toCol] = '+' + piece;
        }
    }

    /**
     * 打ち手を実行
     */
    makeMoveDrop(game, move, turn) {
        const pieceType = move.piece.toLowerCase();
        const droppedPiece = turn === 'sente' ? pieceType.toUpperCase() : pieceType;
        game.board[move.toRow][move.toCol] = droppedPiece;
        
        // 持ち駒から削除
        const index = game.capturedPieces[turn].indexOf(pieceType);
        if (index > -1) {
            game.capturedPieces[turn].splice(index, 1);
        }
    }

    /**
     * 成るべきかどうかを判定
     */
    shouldPromote(piece, move, turn) {
        if (piece.includes('+')) return false; // 既に成っている
        if (piece.toLowerCase() === 'k' || piece.toLowerCase() === 'g') return false; // 王と金は成れない
        
        const canPromote = (turn === 'sente' && (move.toRow < ENEMY_TERRITORY_SENTE || move.fromRow < ENEMY_TERRITORY_SENTE)) ||
                          (turn === 'gote' && (move.toRow > ENEMY_TERRITORY_GOTE || move.fromRow > ENEMY_TERRITORY_GOTE));
        
        return canPromote;
    }

    /**
     * 非同期で最善手を取得（Ollama/USI用）
     */
    async getBestMoveAsync(game, turn) {
        const allMoves = game.getAllPossibleMoves(turn);
        if (allMoves.length === 0) return null;
        
        if (this.level === AI_LEVEL.OLLAMA) {
            return this.getOllamaMoveWithFallback(allMoves, game, turn);
        } else if (this.level === AI_LEVEL.USI) {
            return this.getUSIMoveWithFallback(allMoves, game, turn);
        } else {
            return this.getBestMove(game, turn);
        }
    }

    /**
     * Ollamaを使用して手を取得（フォールバック付き）
     */
    async getOllamaMoveWithFallback(allMoves, game, turn) {
        try {
            this.logMoveStart('Ollama', { endpoint: this.ollamaEndpoint, model: this.ollamaModel, turn, moves: allMoves.length });
            const move = await this.getOllamaMove(allMoves, game, turn);
            return move || this.getIntermediateMove(allMoves, game, turn);
        } catch (error) {
            console.error('[AI] Ollama呼び出しエラー:', error);
            return this.getIntermediateMove(allMoves, game, turn);
        }
    }

    /**
     * USIを使用して手を取得（フォールバック付き）
     */
    async getUSIMoveWithFallback(allMoves, game, turn) {
        try {
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
                console.warn('[AI] USIが手を返しませんでした（フォールバック）', { elapsed: `${moveElapsed}ms` });
            }
            
            return move || this.getIntermediateMove(allMoves, game, turn);
        } catch (error) {
            console.error('[AI] USI呼び出しエラー（フォールバック）', {
                error: error.message,
                stack: error.stack,
                serverUrl: this.usiClient?.serverUrl,
                turn
            });
            
            const fallbackMove = this.getIntermediateMove(allMoves, game, turn);
            this.logFallbackMove(fallbackMove);
            return fallbackMove;
        }
    }

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
     * フォールバック手をログに記録
     */
    logFallbackMove(move) {
        const moveDescription = move.type === 'move' 
            ? `${move.fromRow},${move.fromCol} → ${move.toRow},${move.toCol}`
            : `${move.piece}打 → ${move.toRow},${move.toCol}`;
        
        console.info('[AI] 中級AIにフォールバック', { fallbackMove: moveDescription });
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

        const prompt = `あなたは将棋のAIです。以下の局面で最善手を選んでください。

${positionText}

合法手:
${movesText}

上記の合法手の中から、最善と思われる手の番号（1, 2, 3...）だけを回答してください。番号以外は書かないでください。`;

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
                    return allMoves[moveIndex];
                }
            }

            console.warn('[Ollama] invalid response format', { answer });
            return null;
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
                const piece = game.board[row][col];
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
        const senteCaptured = this.countPieces(game.capturedPieces.sente);
        text += Object.keys(senteCaptured).map(p => {
            const name = this.getPieceName(p);
            return senteCaptured[p] > 1 ? `${name}×${senteCaptured[p]}` : name;
        }).join(' ') || 'なし';
        
        text += '\n後手の持ち駒: ';
        const goteCaptured = this.countPieces(game.capturedPieces.gote);
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
