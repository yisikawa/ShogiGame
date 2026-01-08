// 駒の移動ロジック

import { BOARD_SIZE } from './constants.js';

/**
 * 駒の移動ロジックを提供するクラス (Stateless)
 */
export class PieceMoves {

    static isSente(piece) {
        return piece && piece === piece.toUpperCase();
    }

    static isGote(piece) {
        return piece && piece === piece.toLowerCase();
    }

    /**
     * 指定された位置に移動可能か判定（盤面内かつ味方の駒がない）
     */
    static canMoveTo(board, row, col, piece) {
        if (!board.isValidPosition(row, col)) return false;
        const target = board.getPiece(row, col);
        if (!target) return true;

        // 味方の駒なら移動不可
        const isSente = this.isSente(piece);
        const isTargetSente = this.isSente(target);
        return isSente !== isTargetSente;
    }

    /**
     * 王の移動可能な位置を取得
     */
    static getKingMoves(board, row, col) {
        const moves = [];
        const piece = board.getPiece(row, col); // Need piece to check side
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1], [0, 1],
            [1, -1], [1, 0], [1, 1]
        ];

        for (const [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;
            if (this.canMoveTo(board, newRow, newCol, piece)) {
                moves.push([newRow, newCol]);
            }
        }
        return moves;
    }

    /**
     * 金の移動可能な位置を取得
     */
    static getGoldMoves(board, row, col, piece) {
        const moves = [];
        const isSente = this.isSente(piece);
        const directions = isSente
            ? [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0]]
            : [[1, -1], [1, 0], [1, 1], [0, -1], [0, 1], [-1, 0]];

        for (const [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;
            if (this.canMoveTo(board, newRow, newCol, piece)) {
                moves.push([newRow, newCol]);
            }
        }
        return moves;
    }

    /**
     * 銀の移動可能な位置を取得
     */
    static getSilverMoves(board, row, col, piece) {
        const isPromoted = piece.includes('+');
        if (isPromoted) {
            return this.getGoldMoves(board, row, col, piece);
        }

        const moves = [];
        const isSente = this.isSente(piece);
        const forward = isSente ? -1 : 1;
        const directions = [
            [forward, -1], [forward, 0], [forward, 1],
            [-forward, -1], [-forward, 1]
        ];

        for (const [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;
            if (this.canMoveTo(board, newRow, newCol, piece)) {
                moves.push([newRow, newCol]);
            }
        }
        return moves;
    }

    /**
     * 桂馬の移動可能な位置を取得
     */
    static getKnightMoves(board, row, col, piece) {
        const isPromoted = piece.includes('+');
        if (isPromoted) {
            return this.getGoldMoves(board, row, col, piece);
        }

        const moves = [];
        const isSente = this.isSente(piece);
        const forward = isSente ? -2 : 2;
        const directions = [[forward, -1], [forward, 1]];

        for (const [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;
            if (this.canMoveTo(board, newRow, newCol, piece)) {
                moves.push([newRow, newCol]);
            }
        }
        return moves;
    }

    /**
     * 香車の移動可能な位置を取得
     */
    static getLanceMoves(board, row, col, piece) {
        const isPromoted = piece.includes('+');
        if (isPromoted) {
            return this.getGoldMoves(board, row, col, piece);
        }

        const moves = [];
        const isSente = this.isSente(piece);
        const forward = isSente ? -1 : 1;

        for (let i = 1; i < BOARD_SIZE; i++) {
            const newRow = row + (forward * i);
            if (!board.isValidPosition(newRow, col)) break;

            if (this.canMoveTo(board, newRow, col, piece)) {
                moves.push([newRow, col]);
            }
            if (board.getPiece(newRow, col)) break;
        }
        return moves;
    }

    /**
     * 角の移動可能な位置を取得
     */
    static getBishopMoves(board, row, col, piece) {
        const isPromoted = piece.includes('+');
        const moves = [];
        const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

        for (const [dr, dc] of directions) {
            for (let i = 1; i < BOARD_SIZE; i++) {
                const newRow = row + (dr * i);
                const newCol = col + (dc * i);
                if (!board.isValidPosition(newRow, newCol)) break;

                if (this.canMoveTo(board, newRow, newCol, piece)) {
                    moves.push([newRow, newCol]);
                }
                if (board.getPiece(newRow, newCol)) break;
            }
        }

        if (isPromoted) {
            const kingMoves = this.getKingMoves(board, row, col);
            moves.push(...kingMoves);
        }
        return moves;
    }

    /**
     * 飛車の移動可能な位置を取得
     */
    static getRookMoves(board, row, col, piece) {
        const isPromoted = piece.includes('+');
        const moves = [];
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

        for (const [dr, dc] of directions) {
            for (let i = 1; i < BOARD_SIZE; i++) {
                const newRow = row + (dr * i);
                const newCol = col + (dc * i);
                if (!board.isValidPosition(newRow, newCol)) break;

                if (this.canMoveTo(board, newRow, newCol, piece)) {
                    moves.push([newRow, newCol]);
                }
                if (board.getPiece(newRow, newCol)) break;
            }
        }

        if (isPromoted) {
            const kingMoves = this.getKingMoves(board, row, col);
            moves.push(...kingMoves);
        }
        return moves;
    }

    /**
     * 歩の移動可能な位置を取得
     */
    static getPawnMoves(board, row, col, piece) {
        const isPromoted = piece.includes('+');
        if (isPromoted) {
            return this.getGoldMoves(board, row, col, piece);
        }

        const moves = [];
        const isSente = this.isSente(piece);
        const forward = isSente ? -1 : 1;
        const newRow = row + forward;

        if (this.canMoveTo(board, newRow, col, piece)) {
            moves.push([newRow, col]);
        }
        return moves;
    }

    /**
     * 指定された駒の移動可能な位置を取得
     */
    static getMovesForPiece(board, row, col, piece) {
        const pieceType = piece.replace('+', '').toLowerCase();

        switch (pieceType) {
            case 'k': return this.getKingMoves(board, row, col);
            case 'g': return this.getGoldMoves(board, row, col, piece);
            case 's': return this.getSilverMoves(board, row, col, piece);
            case 'n': return this.getKnightMoves(board, row, col, piece);
            case 'l': return this.getLanceMoves(board, row, col, piece);
            case 'b': return this.getBishopMoves(board, row, col, piece);
            case 'r': return this.getRookMoves(board, row, col, piece);
            case 'p': return this.getPawnMoves(board, row, col, piece);
            default: return [];
        }
    }
}
