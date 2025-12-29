// 移動の検証ロジック

import { BOARD_SIZE, ENEMY_TERRITORY_SENTE, ENEMY_TERRITORY_GOTE, PLAYER } from './constants.js';
import { PieceMoves } from './pieceMoves.js';

/**
 * 移動の検証を行うクラス
 */
export class MoveValidator {
    constructor(gameState) {
        this.gameState = gameState;
        this.pieceMoves = new PieceMoves(
            gameState.board,
            (row, col) => gameState.isValidPosition(row, col),
            (piece) => gameState.isSente(piece),
            (piece) => gameState.isGote(piece)
        );
    }

    /**
     * 指定位置の駒の移動可能な位置を取得
     * @param {number} row - 行
     * @param {number} col - 列
     * @returns {Array} 移動可能な位置の配列
     */
    getPossibleMoves(row, col) {
        const piece = this.gameState.getPiece(row, col);
        if (!piece) return [];

        const moves = this.pieceMoves.getMovesForPiece(row, col, piece);

        // 自分の駒がある位置は除外、相手の駒がある位置は含める
        return moves.filter(([newRow, newCol]) => {
            const targetPiece = this.gameState.getPiece(newRow, newCol);
            if (!targetPiece) return true;

            // 自分の駒がある場所には移動できない
            if (this.gameState.isSente(piece) && this.gameState.isSente(targetPiece)) return false;
            if (this.gameState.isGote(piece) && this.gameState.isGote(targetPiece)) return false;

            return true;
        });
    }

    /**
     * 成りが可能かどうか
     * @param {string} piece - 駒
     * @param {number} fromRow - 移動元の行
     * @param {number} toRow - 移動先の行
     * @returns {boolean} 成りが可能な場合true
     */
    canPromote(piece, fromRow, toRow) {
        // 既に成っている駒、王、金は成れない
        if (piece.includes('+') || piece.toLowerCase() === 'k' || piece.toLowerCase() === 'g') {
            return false;
        }

        const isSente = this.gameState.isSente(piece);

        // 敵陣に入る、または敵陣から出る場合に成れる
        if (isSente) {
            return fromRow < ENEMY_TERRITORY_SENTE || toRow < ENEMY_TERRITORY_SENTE;
        } else {
            return fromRow >= BOARD_SIZE - ENEMY_TERRITORY_GOTE || toRow >= BOARD_SIZE - ENEMY_TERRITORY_GOTE;
        }
    }

    /**
     * 持ち駒を打つ位置が有効かどうか
     * @param {string} piece - 駒
     * @param {number} row - 行
     * @param {number} col - 列
     * @returns {Object} {valid: boolean, reason: string}
     */
    isValidDrop(piece, row, col) {
        // 既に駒がある場所には打てない
        if (this.gameState.getPiece(row, col)) {
            return { valid: false, reason: '既に駒があります' };
        }

        const pieceType = piece.toLowerCase().replace('+', '');
        const isSente = this.gameState.isSente(piece);

        // 歩、香、桂は行き場のない場所に打てない
        if (pieceType === 'p') {
            // 歩は最奥行に打てない
            if ((isSente && row === 0) || (!isSente && row === BOARD_SIZE - 1)) {
                return { valid: false, reason: '歩は行き場のない場所に打てません' };
            }
            // 二歩チェック
            if (this.hasDoublePawn(piece, col)) {
                return { valid: false, reason: '二歩です' };
            }
        } else if (pieceType === 'l') {
            // 香は最奥行に打てない
            if ((isSente && row === 0) || (!isSente && row === BOARD_SIZE - 1)) {
                return { valid: false, reason: '香は行き場のない場所に打てません' };
            }
        } else if (pieceType === 'n') {
            // 桂は最奥2行に打てない
            if ((isSente && row <= 1) || (!isSente && row >= BOARD_SIZE - 2)) {
                return { valid: false, reason: '桂は行き場のない場所に打てません' };
            }
        }

        return { valid: true, reason: '' };
    }

    /**
     * 二歩チェック
     * @param {string} piece - 歩の駒
     * @param {number} col - 列
     * @returns {boolean} 二歩の場合true
     */
    hasDoublePawn(piece, col) {
        const isSente = this.gameState.isSente(piece);
        const pawnChar = isSente ? 'P' : 'p';

        for (let row = 0; row < BOARD_SIZE; row++) {
            const existingPiece = this.gameState.getPiece(row, col);
            if (existingPiece === pawnChar) {
                return true;
            }
        }
        return false;
    }

    /**
     * すべての合法手を取得
     * @param {string} turn - 手番
     * @returns {Array} 合法手の配列
     */
    getAllPossibleMoves(turn) {
        const moves = [];

        // 盤上の駒の移動
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const piece = this.gameState.getPiece(row, col);
                if (!piece) continue;

                const isMyPiece = (turn === PLAYER.SENTE && this.gameState.isSente(piece)) ||
                    (turn === PLAYER.GOTE && this.gameState.isGote(piece));

                if (!isMyPiece) continue;

                const possibleMoves = this.getPossibleMoves(row, col);
                for (const [toRow, toCol] of possibleMoves) {
                    moves.push({
                        type: 'move',
                        from: { row, col },
                        to: { row: toRow, col: toCol },
                        piece
                    });
                }
            }
        }

        // 持ち駒の打ち
        const capturedPieces = this.gameState.capturedPieces[turn];
        const uniquePieces = [...new Set(capturedPieces)];

        for (const piece of uniquePieces) {
            for (let row = 0; row < BOARD_SIZE; row++) {
                for (let col = 0; col < BOARD_SIZE; col++) {
                    const dropResult = this.isValidDrop(piece, row, col);
                    if (dropResult.valid) {
                        moves.push({
                            type: 'drop',
                            piece,
                            to: { row, col }
                        });
                    }
                }
            }
        }

        return moves;
    }
}
