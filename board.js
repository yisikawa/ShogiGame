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

    /**
     * Apply a move to the board (reversible)
     * @param {Object} move 
     * @param {string} player PLAYER.SENTE or PLAYER.GOTE
     * @returns {Object} undoInfo
     */
    applyMove(move, player) {
        const undoInfo = {
            captured: null,
            promoted: false,
            // For drops, we need to know who dropped to restore to hand
            dropOwner: null
        };

        if (move.type === 'drop') {
            // Drop logic
            undoInfo.dropOwner = player;

            // Standardize piece for board (Sente=Upper, Gote=Lower)
            const pieceForBoard = player === PLAYER.SENTE ? move.piece.toUpperCase() : move.piece.toLowerCase();
            this.setPiece(move.toRow, move.toCol, pieceForBoard);

            // Remove from hand
            // NOTE: move.piece from rules/ai is usually the captured identifier (lowercase/unpromoted)
            // But removeCapturedPiece expects the specific string stored in hand.
            // The hand stores lowercase unpromoted strings (from board.js L34).
            // So move.piece should be correct.
            this.removeCapturedPiece(move.piece, player);

        } else {
            // Move logic
            const sourcePiece = this.getPiece(move.fromRow, move.fromCol);
            const targetPiece = this.getPiece(move.toRow, move.toCol);

            // Handle Capture
            if (targetPiece) {
                undoInfo.captured = targetPiece;
                this.capturePiece(targetPiece, player);
            }

            // Handle Promotion
            let newPiece = sourcePiece;
            if (move.promote) {
                undoInfo.promoted = true;
                // Add '+' if not already there
                if (!newPiece.startsWith('+')) {
                    newPiece = '+' + newPiece;
                }
            }

            // Move piece
            this.setPiece(move.toRow, move.toCol, newPiece);
            this.setPiece(move.fromRow, move.fromCol, null);
        }

        return undoInfo;
    }

    /**
     * Revert a move
     * @param {Object} move 
     * @param {Object} undoInfo 
     * @param {string} player 
     */
    undoMove(move, undoInfo, player) {
        if (move.type === 'drop') {
            // Clear board
            this.setPiece(move.toRow, move.toCol, null);
            // Add back to hand
            // We use the same 'move.piece' (generic)
            this.capturedPieces[undoInfo.dropOwner].push(move.piece);
            // Assuming move.piece is the correct identifier for the hand.
            // In rules.js (L118), move.piece comes from iterating uniqueCaptured.
            // So it is the correct hand key.
        } else {
            // Move back
            let movedPiece = this.getPiece(move.toRow, move.toCol);

            // Demote if promoted during this move
            if (undoInfo.promoted) {
                movedPiece = movedPiece.replace('+', '');
            }

            // Return piece to source
            this.setPiece(move.fromRow, move.fromCol, movedPiece);

            // Restore captured piece if any (to target position)
            if (undoInfo.captured) {
                this.setPiece(move.toRow, move.toCol, undoInfo.captured);
                // Remove from capturer's hand (revert capture)
                // Capture adds to hand, so we must remove it.
                // capturePiece(target, player) was called.
                // It converts target to storage format (lowercase unpromoted).
                const storageFormat = undoInfo.captured.replace('+', '').toLowerCase();
                this.removeCapturedPiece(storageFormat, player);
            } else {
                this.setPiece(move.toRow, move.toCol, null);
            }
        }
    }
}
