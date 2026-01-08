import {
    PIECE_VALUES,
    AI_LEVEL,
    MINIMAX_DEPTH,
    MINIMAX_MOVE_LIMIT,
    ENEMY_TERRITORY_SENTE,
    ENEMY_TERRITORY_GOTE,
    PLAYER
} from './constants.js';
import { ShogiBoard } from './board.js';
import { ShogiRules } from './rules.js';

// Reconstruct board from state object
function reconstructGame(state) {
    const board = new ShogiBoard();
    if (state.board) {
        board.board = state.board; // Assuming 2D array is passed
    }
    if (state.capturedPieces) {
        board.capturedPieces = state.capturedPieces;
    }
    const rules = new ShogiRules(board);
    return { board, rules };
}

self.onmessage = async function (e) {
    try {
        const { type, state, config } = e.data;

        if (type === 'think') {
            const { board, rules } = reconstructGame(state);
            const { turn, level } = config;

            const move = getBestMove(board, rules, turn, level);
            self.postMessage({ type: 'success', move });
        }
    } catch (err) {
        console.error('Worker Error:', err);
        self.postMessage({ type: 'error', error: err.toString() + (err.stack ? '\n' + err.stack : '') });
    }
};

function getBestMove(board, rules, turn, level) {
    const allMoves = rules.getAllPossibleMoves(turn);
    if (allMoves.length === 0) return null;

    switch (level) {
        case AI_LEVEL.BEGINNER:
            return getBeginnerMove(allMoves, board, rules);
        case AI_LEVEL.INTERMEDIATE:
            return getIntermediateMove(allMoves, board, rules, turn);
        case AI_LEVEL.ADVANCED:
            return getAdvancedMove(allMoves, board, rules, turn);
        default:
            return getIntermediateMove(allMoves, board, rules, turn);
    }
}

function getRandomMove(allMoves) {
    if (allMoves.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * allMoves.length);
    return allMoves[randomIndex];
}

function getBeginnerMove(allMoves, board, rules) {
    // 50% random
    if (Math.random() < 0.5) {
        return getRandomMove(allMoves);
    }
    return getBestCaptureMove(allMoves, board) || getRandomMove(allMoves);
}

function getBestCaptureMove(allMoves, board) {
    let bestMove = null;
    let bestScore = -Infinity;

    for (const move of allMoves) {
        if (move.type !== 'move') continue;
        const targetPiece = board.getPiece(move.toRow, move.toCol);
        if (!targetPiece) continue;

        // Remove '+' for value lookup
        const pieceType = targetPiece.replace('+', '').toLowerCase();
        const score = PIECE_VALUES[pieceType] || 0;

        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }
    return bestMove;
}

function getIntermediateMove(allMoves, board, rules, turn) {
    let bestMove = null;
    let bestScore = -Infinity;

    for (const move of allMoves) {
        const score = evaluateMove(move, board, rules, turn);
        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }
    return bestMove || allMoves[0];
}

function getAdvancedMove(allMoves, board, rules, turn) {
    let bestMove = null;
    let bestScore = -Infinity;

    // Sort moves to improve pruning (captures first)
    const sortedMoves = sortMoves(allMoves, board);

    for (const move of sortedMoves.slice(0, MINIMAX_MOVE_LIMIT)) {
        // Apply move
        const undoInfo = board.applyMove(move, turn);

        // Minimax
        const score = minimax(board, rules, MINIMAX_DEPTH - 1, turn === PLAYER.SENTE ? PLAYER.GOTE : PLAYER.SENTE, false);

        // Undo move
        board.undoMove(move, undoInfo, turn);

        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }

    return bestMove || getIntermediateMove(allMoves, board, rules, turn);
}

function sortMoves(moves, board) {
    // Simple sort: captures first
    return moves.sort((a, b) => {
        const scoreA = (a.type === 'move' && board.getPiece(a.toRow, a.toCol)) ? 10 : 0;
        const scoreB = (b.type === 'move' && board.getPiece(b.toRow, b.toCol)) ? 10 : 0;
        return scoreB - scoreA;
    });
}

function minimax(board, rules, depth, turn, isMaximizing) {
    if (depth === 0) {
        return evaluatePosition(board, rules, isMaximizing ? turn : (turn === PLAYER.SENTE ? PLAYER.GOTE : PLAYER.SENTE));
    }

    const moves = rules.getAllPossibleMoves(turn);
    if (moves.length === 0) {
        // No moves = Lost (in Shogi, stalemate is loss for the one who cannot move)
        // If isMaximizing (current turn player), and no moves, return -Infinity
        return isMaximizing ? -Infinity : Infinity;
    }

    // Limit moves for performance
    const sortedMoves = sortMoves(moves, board).slice(0, MINIMAX_MOVE_LIMIT);

    if (isMaximizing) {
        let maxScore = -Infinity;
        for (const move of sortedMoves) {
            const undoInfo = board.applyMove(move, turn);
            const score = minimax(board, rules, depth - 1, turn === PLAYER.SENTE ? PLAYER.GOTE : PLAYER.SENTE, false);
            board.undoMove(move, undoInfo, turn);

            maxScore = Math.max(maxScore, score);
        }
        return maxScore;
    } else {
        let minScore = Infinity;
        for (const move of sortedMoves) {
            const undoInfo = board.applyMove(move, turn);
            const score = minimax(board, rules, depth - 1, turn === PLAYER.SENTE ? PLAYER.GOTE : PLAYER.SENTE, true);
            board.undoMove(move, undoInfo, turn);

            minScore = Math.min(minScore, score);
        }
        return minScore;
    }
}

function evaluateMove(move, board, rules, turn) {
    if (move.type === 'move') {
        let score = 0;
        const targetPiece = board.getPiece(move.toRow, move.toCol);
        if (targetPiece) {
            const p = targetPiece.replace('+', '').toLowerCase();
            score += PIECE_VALUES[p] || 0;
        }
        // Advance bonus
        const ADVANCE_BONUS = 10;
        if (turn === PLAYER.SENTE && move.toRow < move.fromRow) score += ADVANCE_BONUS;
        if (turn === PLAYER.GOTE && move.toRow > move.fromRow) score += ADVANCE_BONUS;
        return score;
    } else {
        // Drop
        const DROP_PENALTY = 0.1;
        const pieceValue = PIECE_VALUES[move.piece] || 0;
        let score = pieceValue * DROP_PENALTY;

        // Enemy territory bonus
        if (turn === PLAYER.SENTE && move.toRow < ENEMY_TERRITORY_SENTE) score += 20;
        if (turn === PLAYER.GOTE && move.toRow > ENEMY_TERRITORY_GOTE) score += 20;
        return score;
    }
}

function evaluatePosition(board, rules, myTurn) {
    const CAPTURED_FACTOR = 0.8;
    let score = 0;

    // Board pieces
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const p = board.getPiece(r, c);
            if (!p) continue;

            const rawP = p.replace('+', '').toLowerCase();
            const val = PIECE_VALUES[rawP] || 0;
            const isMine = (myTurn === PLAYER.SENTE) ? (p === p.toUpperCase()) : (p === p.toLowerCase());

            score += isMine ? val : -val;
        }
    }

    // Captured pieces
    const opponent = myTurn === PLAYER.SENTE ? PLAYER.GOTE : PLAYER.SENTE;
    const myHand = board.capturedPieces[myTurn];
    const opHand = board.capturedPieces[opponent];

    myHand.forEach(p => { score += (PIECE_VALUES[p] || 0) * CAPTURED_FACTOR; });
    opHand.forEach(p => { score -= (PIECE_VALUES[p] || 0) * CAPTURED_FACTOR; });

    return score;
}
