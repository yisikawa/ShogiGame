import { BOARD_SIZE, INITIAL_BOARD, PLAYER } from './constants.js';

export class ShogiBoard {
    constructor() {
        this.board = this.initializeBoard();
        this.capturedPieces = {
            [PLAYER.SENTE]: [],
            [PLAYER.GOTE]: []
        };
    }

    initializeBoard() {
        // Deep copy of initial board
        return INITIAL_BOARD.map(row => [...row]);
    }

    getPiece(row, col) {
        if (!this.isValidPosition(row, col)) return null;
        return this.board[row][col];
    }

    setPiece(row, col, piece) {
        if (this.isValidPosition(row, col)) {
            this.board[row][col] = piece;
        }
    }

    isValidPosition(row, col) {
        return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
    }

    capturePiece(piece, capturer) {
        if (!piece) return;
        const capturedPiece = piece.replace('+', '').toLowerCase();
        this.capturedPieces[capturer].push(capturedPiece);
    }

    removeCapturedPiece(piece, owner) {
        const index = this.capturedPieces[owner].indexOf(piece);
        if (index > -1) {
            this.capturedPieces[owner].splice(index, 1);
            return true;
        }
        return false;
    }

    getCapturedPieces(player) {
        return this.capturedPieces[player];
    }

    // Generate a unique key for the current board state (for repetition checking)
    toKey() {
        let bStr = '';
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                bStr += this.board[r][c] || '.';
            }
        }
        const sCap = [...this.capturedPieces[PLAYER.SENTE]].sort().join('');
        const gCap = [...this.capturedPieces[PLAYER.GOTE]].sort().join('');
        return `${bStr}|${sCap}|${gCap}`;
    }

    // Clone method for AI/simulation
    clone() {
        const newBoard = new ShogiBoard();
        newBoard.board = this.board.map(row => [...row]);
        newBoard.capturedPieces = {
            [PLAYER.SENTE]: [...this.capturedPieces[PLAYER.SENTE]],
            [PLAYER.GOTE]: [...this.capturedPieces[PLAYER.GOTE]]
        };
        return newBoard;
    }
}
