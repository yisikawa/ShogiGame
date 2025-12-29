// AI評価ロジック

import { PIECE_VALUES, ENEMY_TERRITORY_SENTE, ENEMY_TERRITORY_GOTE, PLAYER } from './constants.js';

/**
 * AI評価関数を提供するクラス
 */
export class AIEvaluator {
    constructor(pieceValues = PIECE_VALUES) {
        this.pieceValues = pieceValues;
    }

    /**
     * 局面評価
     * @param {Object} game - ゲーム状態
     * @param {string} myTurn - 自分の手番
     * @returns {number} 評価値
     */
    evaluatePosition(game, myTurn) {
        let score = 0;

        // 盤上の駒の評価
        score += this.evaluateBoardPieces(game, myTurn);

        // 持ち駒の評価（盤上の駒より価値が高い）
        score += this.evaluateCapturedPieces(game, myTurn, 1.2);

        return score;
    }

    /**
     * 盤上の駒を評価
     * @param {Object} game - ゲーム状態
     * @param {string} myTurn - 自分の手番
     * @returns {number} 評価値
     */
    evaluateBoardPieces(game, myTurn) {
        let score = 0;

        for (let row = 0; row < game.board.length; row++) {
            for (let col = 0; col < game.board[row].length; col++) {
                const piece = game.board[row][col];
                if (!piece) continue;

                const value = this.pieceValues[piece] || 0;

                if ((myTurn === PLAYER.SENTE && game.isSente(piece)) ||
                    (myTurn === PLAYER.GOTE && game.isGote(piece))) {
                    score += value;
                } else {
                    score -= value;
                }
            }
        }

        return score;
    }

    /**
     * 持ち駒を評価
     * @param {Object} game - ゲーム状態
     * @param {string} myTurn - 自分の手番
     * @param {number} factor - 評価係数
     * @returns {number} 評価値
     */
    evaluateCapturedPieces(game, myTurn, factor = 1.0) {
        let score = 0;

        const myPieces = game.capturedPieces[myTurn] || [];
        const opponentTurn = myTurn === PLAYER.SENTE ? PLAYER.GOTE : PLAYER.SENTE;
        const opponentPieces = game.capturedPieces[opponentTurn] || [];

        for (const piece of myPieces) {
            const value = this.pieceValues[piece] || 0;
            score += value * factor;
        }

        for (const piece of opponentPieces) {
            const value = this.pieceValues[piece] || 0;
            score -= value * factor;
        }

        return score;
    }

    /**
     * 手の評価
     * @param {Object} move - 手
     * @param {Object} game - ゲーム状態
     * @param {string} turn - 手番
     * @returns {number} 評価値
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
     * @param {Object} move - 移動手
     * @param {Object} game - ゲーム状態
     * @param {string} turn - 手番
     * @returns {number} 評価値
     */
    evaluateMoveMove(move, game, turn) {
        let score = 0;
        const { from, to, piece } = move;
        const targetPiece = game.board[to.row][to.col];

        // 駒を取る手は高評価
        if (targetPiece) {
            score += this.pieceValues[targetPiece] || 0;
        }

        // 成る手は評価を上げる
        const canPromote = this.canPromote(piece, from.row, to.row, turn);
        if (canPromote) {
            const promotedValue = this.pieceValues['+' + piece.toLowerCase()] || 0;
            const currentValue = this.pieceValues[piece] || 0;
            score += (promotedValue - currentValue) * 0.5;
        }

        return score;
    }

    /**
     * 打ち手の評価
     * @param {Object} move - 打ち手
     * @param {Object} game - ゲーム状態
     * @param {string} turn - 手番
     * @returns {number} 評価値
     */
    evaluateMoveDrop(move, game, turn) {
        const { piece, to } = move;
        let score = 0;

        // 中央付近への打ち込みは評価を上げる
        const centerDistance = Math.abs(to.col - 4);
        score += (4 - centerDistance) * 10;

        // 敵陣への打ち込みは評価を上げる
        if (turn === PLAYER.SENTE && to.row < ENEMY_TERRITORY_SENTE) {
            score += 20;
        } else if (turn === PLAYER.GOTE && to.row >= 9 - ENEMY_TERRITORY_GOTE) {
            score += 20;
        }

        return score;
    }

    /**
     * 成りが可能かどうか
     * @param {string} piece - 駒
     * @param {number} fromRow - 移動元の行
     * @param {number} toRow - 移動先の行
     * @param {string} turn - 手番
     * @returns {boolean} 成りが可能な場合true
     */
    canPromote(piece, fromRow, toRow, turn) {
        if (piece.includes('+') || piece.toLowerCase() === 'k' || piece.toLowerCase() === 'g') {
            return false;
        }

        if (turn === PLAYER.SENTE) {
            return fromRow < ENEMY_TERRITORY_SENTE || toRow < ENEMY_TERRITORY_SENTE;
        } else {
            return fromRow >= 9 - ENEMY_TERRITORY_GOTE || toRow >= 9 - ENEMY_TERRITORY_GOTE;
        }
    }
}
