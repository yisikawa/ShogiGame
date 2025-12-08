// 駒の移動ロジック

import { BOARD_SIZE } from './constants.js';

/**
 * 駒の移動ロジックを提供するクラス
 */
export class PieceMoves {
    constructor(board, isValidPosition, isSente, isGote) {
        this.board = board;
        this.isValidPosition = isValidPosition;
        this.isSente = isSente;
        this.isGote = isGote;
    }

    /**
     * 王の移動可能な位置を取得
     */
    getKingMoves(row, col) {
        const moves = [];
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];
        
        for (const [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;
            if (this.isValidPosition(newRow, newCol)) {
                moves.push([newRow, newCol]);
            }
        }
        return moves;
    }

    /**
     * 金の移動可能な位置を取得
     */
    getGoldMoves(row, col, piece) {
        const moves = [];
        const isSente = this.isSente(piece);
        const directions = isSente 
            ? [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0]]
            : [[1, -1], [1, 0], [1, 1], [0, -1], [0, 1], [-1, 0]];
        
        for (const [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;
            if (this.isValidPosition(newRow, newCol)) {
                moves.push([newRow, newCol]);
            }
        }
        return moves;
    }

    /**
     * 銀の移動可能な位置を取得
     */
    getSilverMoves(row, col, piece) {
        const isPromoted = piece.includes('+');
        if (isPromoted) {
            return this.getGoldMoves(row, col, piece);
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
            if (this.isValidPosition(newRow, newCol)) {
                moves.push([newRow, newCol]);
            }
        }
        return moves;
    }

    /**
     * 桂馬の移動可能な位置を取得
     */
    getKnightMoves(row, col, piece) {
        const isPromoted = piece.includes('+');
        if (isPromoted) {
            return this.getGoldMoves(row, col, piece);
        }
        
        const moves = [];
        const isSente = this.isSente(piece);
        const forward = isSente ? -2 : 2;
        const directions = [[forward, -1], [forward, 1]];
        
        for (const [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;
            if (this.isValidPosition(newRow, newCol)) {
                moves.push([newRow, newCol]);
            }
        }
        return moves;
    }

    /**
     * 香車の移動可能な位置を取得
     */
    getLanceMoves(row, col, piece) {
        const isPromoted = piece.includes('+');
        if (isPromoted) {
            return this.getGoldMoves(row, col, piece);
        }
        
        const moves = [];
        const isSente = this.isSente(piece);
        const forward = isSente ? -1 : 1;
        
        for (let i = 1; i < BOARD_SIZE; i++) {
            const newRow = row + (forward * i);
            if (!this.isValidPosition(newRow, col)) break;
            
            const target = this.board[newRow][col];
            if (target) {
                // 自駒ならそこは進めずブロック
                const isSameSide = (this.isSente(piece) && this.isSente(target)) ||
                                   (this.isGote(piece) && this.isGote(target));
                if (!isSameSide) {
                    // 相手駒なら取れるマスとして追加してブロック
                    moves.push([newRow, col]);
                }
                break;
            }
            
            moves.push([newRow, col]);
        }
        return moves;
    }

    /**
     * 角の移動可能な位置を取得
     */
    getBishopMoves(row, col, piece) {
        const isPromoted = piece.includes('+');
        const moves = [];
        const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        
        for (const [dr, dc] of directions) {
            for (let i = 1; i < BOARD_SIZE; i++) {
                const newRow = row + (dr * i);
                const newCol = col + (dc * i);
                if (!this.isValidPosition(newRow, newCol)) break;
                moves.push([newRow, newCol]);
                if (this.board[newRow][newCol]) break;
            }
        }
        
        // 成り角（馬）は王の動きも追加
        if (isPromoted) {
            const kingMoves = this.getKingMoves(row, col);
            moves.push(...kingMoves);
        }
        return moves;
    }

    /**
     * 飛車の移動可能な位置を取得
     */
    getRookMoves(row, col, piece) {
        const isPromoted = piece.includes('+');
        const moves = [];
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        
        for (const [dr, dc] of directions) {
            for (let i = 1; i < BOARD_SIZE; i++) {
                const newRow = row + (dr * i);
                const newCol = col + (dc * i);
                if (!this.isValidPosition(newRow, newCol)) break;
                moves.push([newRow, newCol]);
                if (this.board[newRow][newCol]) break;
            }
        }
        
        // 成り飛（龍）は王の動きも追加
        if (isPromoted) {
            const kingMoves = this.getKingMoves(row, col);
            moves.push(...kingMoves);
        }
        return moves;
    }

    /**
     * 歩の移動可能な位置を取得
     */
    getPawnMoves(row, col, piece) {
        const isPromoted = piece.includes('+');
        if (isPromoted) {
            return this.getGoldMoves(row, col, piece);
        }
        
        const moves = [];
        const isSente = this.isSente(piece);
        const forward = isSente ? -1 : 1;
        const newRow = row + forward;
        
        if (this.isValidPosition(newRow, col)) {
            moves.push([newRow, col]);
        }
        return moves;
    }

    /**
     * 指定された駒の移動可能な位置を取得
     */
    getMovesForPiece(row, col, piece) {
        const pieceType = piece.replace('+', '').toLowerCase();
        
        switch (pieceType) {
            case 'k': return this.getKingMoves(row, col);
            case 'g': return this.getGoldMoves(row, col, piece);
            case 's': return this.getSilverMoves(row, col, piece);
            case 'n': return this.getKnightMoves(row, col, piece);
            case 'l': return this.getLanceMoves(row, col, piece);
            case 'b': return this.getBishopMoves(row, col, piece);
            case 'r': return this.getRookMoves(row, col, piece);
            case 'p': return this.getPawnMoves(row, col, piece);
            default: return [];
        }
    }
}
