// AIプレイヤーの実装

import {
    PIECE_VALUES,
    AI_LEVEL,
    MINIMAX_DEPTH,
    MINIMAX_MOVE_LIMIT,
    ENEMY_TERRITORY_SENTE,
    ENEMY_TERRITORY_GOTE,
    OLLAMA_CONFIG
} from './constants.js';

/**
 * 将棋AIプレイヤークラス
 */
export class ShogiAI {
    constructor(level = AI_LEVEL.INTERMEDIATE, ollamaEndpoint = null, ollamaModel = null) {
        this.level = level;
        this.pieceValues = PIECE_VALUES;
        this.configureOllama(ollamaEndpoint, ollamaModel);
    }

    configureOllama(ollamaEndpoint, ollamaModel) {
        const endpoint = ollamaEndpoint ?? OLLAMA_CONFIG.ENDPOINT;
        this.ollamaEndpoint = (endpoint || '').replace(/\/$/, '');
        this.ollamaModel = ollamaModel ?? OLLAMA_CONFIG.MODEL;
        this.timeoutMs = OLLAMA_CONFIG.TIMEOUT ?? 30000;
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
            default:
                return this.getIntermediateMove(allMoves, game, turn);
        }
    }

    /**
     * 初級AI: ランダムまたは簡単な評価
     */
    getBeginnerMove(allMoves, game, turn) {
        // 50%の確率でランダム、50%で簡単な評価
        if (Math.random() < 0.5) {
            const randomIndex = Math.floor(Math.random() * allMoves.length);
            return allMoves[randomIndex];
        }
        
        // 簡単な評価：取れる駒がある場合は優先
        let bestMove = null;
        let bestScore = -Infinity;
        
        for (const move of allMoves) {
            let score = 0;
            if (move.type === 'move') {
                const targetPiece = game.board[move.toRow][move.toCol];
                if (targetPiece) {
                    const pieceType = targetPiece.replace('+', '');
                    score = this.pieceValues[pieceType] || 0;
                }
            }
            
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        
        return bestMove || allMoves[Math.floor(Math.random() * allMoves.length)];
    }

    /**
     * 中級AI: 基本的な評価関数
     */
    getIntermediateMove(allMoves, game, turn) {
        let bestMove = null;
        let bestScore = -Infinity;
        
        for (const move of allMoves) {
            const score = this.evaluateMove(move, game, turn);
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
        let score = 0;
        
        if (move.type === 'move') {
            const targetPiece = game.board[move.toRow][move.toCol];
            // 取れる駒の価値
            if (targetPiece) {
                const pieceType = targetPiece.replace('+', '');
                score += this.pieceValues[pieceType] || 0;
            }
            
            // 自分の駒の位置評価
            const fromPiece = game.board[move.fromRow][move.fromCol];
            if (fromPiece) {
                // 前進を評価（簡易版）
                if (turn === 'sente' && move.toRow < move.fromRow) {
                    score += 10;
                } else if (turn === 'gote' && move.toRow > move.fromRow) {
                    score += 10;
                }
            }
        } else if (move.type === 'drop') {
            // 持ち駒を打つ場合の評価
            const pieceValue = this.pieceValues[move.piece] || 0;
            score += pieceValue * 0.1; // 持ち駒を打つのは少しマイナス評価
            
            // 敵陣に打つ場合はプラス評価
            if (turn === 'sente' && move.toRow < ENEMY_TERRITORY_SENTE) {
                score += 20;
            } else if (turn === 'gote' && move.toRow > ENEMY_TERRITORY_GOTE) {
                score += 20;
            }
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
        let score = 0;
        
        // 盤上の駒の価値
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const piece = game.board[row][col];
                if (piece) {
                    const pieceType = piece.replace('+', '');
                    const value = this.pieceValues[pieceType] || 0;
                    
                    if ((myTurn === 'sente' && game.isSente(piece)) ||
                        (myTurn === 'gote' && game.isGote(piece))) {
                        score += value;
                    } else {
                        score -= value;
                    }
                }
            }
        }
        
        // 持ち駒の価値
        game.capturedPieces[myTurn].forEach(piece => {
            score += (this.pieceValues[piece] || 0) * 0.8;
        });
        
        const opponent = myTurn === 'sente' ? 'gote' : 'sente';
        game.capturedPieces[opponent].forEach(piece => {
            score -= (this.pieceValues[piece] || 0) * 0.8;
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
            const piece = game.board[move.fromRow][move.fromCol];
            const captured = game.board[move.toRow][move.toCol];
            
            if (captured) {
                const capturedPiece = captured.replace('+', '').toLowerCase();
                game.capturedPieces[turn].push(capturedPiece);
            }
            
            game.board[move.toRow][move.toCol] = piece;
            game.board[move.fromRow][move.fromCol] = null;
            
            // 成りの判定（AIは基本的に成る）
            const canPromote = (turn === 'sente' && (move.toRow < ENEMY_TERRITORY_SENTE || move.fromRow < ENEMY_TERRITORY_SENTE)) ||
                              (turn === 'gote' && (move.toRow > ENEMY_TERRITORY_GOTE || move.fromRow > ENEMY_TERRITORY_GOTE));
            if (canPromote && !piece.includes('+') && piece.toLowerCase() !== 'k' && piece.toLowerCase() !== 'g') {
                // AIは基本的に成る（評価関数で最適な選択をしている）
                game.board[move.toRow][move.toCol] = '+' + piece;
            }
        } else if (move.type === 'drop') {
            const pieceType = move.piece.toLowerCase();
            const droppedPiece = turn === 'sente' ? pieceType.toUpperCase() : pieceType;
            game.board[move.toRow][move.toCol] = droppedPiece;
            
            const index = game.capturedPieces[turn].indexOf(pieceType);
            if (index > -1) {
                game.capturedPieces[turn].splice(index, 1);
            }
        }
    }

    /**
     * 非同期で最善手を取得（Ollama用）
     */
    async getBestMoveAsync(game, turn) {
        if (this.level !== AI_LEVEL.OLLAMA) {
            return this.getBestMove(game, turn);
        }
        
        const allMoves = game.getAllPossibleMoves(turn);
        if (allMoves.length === 0) return null;
        
        try {
            console.info('[Ollama] fetch start', {
                endpoint: this.ollamaEndpoint,
                model: this.ollamaModel,
                turn,
                moves: allMoves.length
            });
            const move = await this.getOllamaMove(allMoves, game, turn);
            return move || this.getIntermediateMove(allMoves, game, turn);
        } catch (error) {
            console.error('Ollama呼び出しエラー:', error);
            return this.getIntermediateMove(allMoves, game, turn);
        }
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
        const PIECE_NAMES = {
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
