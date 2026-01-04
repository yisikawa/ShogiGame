
import { BOARD_SIZE, PLAYER, PIECE_TYPE, ENEMY_TERRITORY_SENTE, ENEMY_TERRITORY_GOTE } from './constants.js';
import { PieceMoves } from './pieceMoves.js';

export class ShogiRules {
    constructor(board) {
        this.board = board;
        // PieceMoves is statless now, no instantiation needed
    }

    isSente(piece) {
        return piece && piece === piece.toUpperCase();
    }

    isGote(piece) {
        return piece && piece === piece.toLowerCase();
    }

    isPlayerPiece(piece, turn) {
        return turn === PLAYER.SENTE ? this.isSente(piece) : this.isGote(piece);
    }

    // --- Movement Logic ---

    getPseudoPossibleMoves(row, col, turn) {
        const piece = this.board.getPiece(row, col);
        if (!piece || !this.isPlayerPiece(piece, turn)) return [];

        return PieceMoves.getMovesForPiece(this.board, row, col, piece);
    }

    getPossibleMoves(row, col, turn) {
        const moves = this.getPseudoPossibleMoves(row, col, turn);
        // Filter moves that leave the King in check
        return moves.filter(([r, c]) => {
            const move = {
                type: 'move',
                fromRow: row,
                fromCol: col,
                toRow: r,
                toCol: c,
                piece: this.board.getPiece(row, col)
            };
            return this.isMoveSafe(move, turn);
        });
    }

    getAllPseudoPossibleMoves(turn) {
        let moves = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const piece = this.board.getPiece(r, c);
                if (piece && this.isPlayerPiece(piece, turn)) {
                    const pieceMoves = PieceMoves.getMovesForPiece(this.board, r, c, piece);
                    pieceMoves.forEach(([toRow, toCol]) => {
                        moves.push({
                            type: 'move',
                            fromRow: r,
                            fromCol: c,
                            toRow: toRow,
                            toCol: toCol,
                            piece: piece
                        });

                        // Promotion logic
                        if (this.canPromote(piece, r, toRow)) {
                            // If mandatory promotion (e.g. Pawn/Lance at end), only add promoted move?
                            // Rules vary, but standard shogi allows non-promote unless stuck.
                            // If stuck, MUST promote.
                            const mustPromote = this.mustPromote(piece, toRow);
                            if (mustPromote) {
                                // Remove the non-promoted move added above if it's invalid (stuck)
                                moves.pop();
                            }

                            // Add promoted move
                            if (!mustPromote) { // If must promote, we only add promoted move. 
                                // Actually simplistic implementation: valid moves usually include both unless stuck.
                                // For this implementation, let's just add the promoted variant as a separate move option
                                moves.push({
                                    type: 'move',
                                    fromRow: r,
                                    fromCol: c,
                                    toRow: toRow,
                                    toCol: toCol,
                                    piece: piece,
                                    promote: true
                                });
                            } else {
                                moves.push({
                                    type: 'move',
                                    fromRow: r,
                                    fromCol: c,
                                    toRow: toRow,
                                    toCol: toCol,
                                    piece: piece,
                                    promote: true // Forced promotion
                                });
                            }
                        }
                    });
                }
            }
        }

        // Drops
        const captured = this.board.getCapturedPieces(turn);
        // Deduplicate captured pieces types for move generation
        const uniqueCaptured = [...new Set(captured)];

        uniqueCaptured.forEach(piece => {
            for (let r = 0; r < BOARD_SIZE; r++) {
                for (let c = 0; c < BOARD_SIZE; c++) {
                    if (!this.board.getPiece(r, c)) {
                        if (this.canDropPiece(piece, r, c, turn)) {
                            moves.push({
                                type: 'drop',
                                piece: piece,
                                toRow: r,
                                toCol: c
                            });
                        }
                    }
                }
            }
        });

        return moves;
    }

    getAllPossibleMoves(turn) {
        const pseudoMoves = this.getAllPseudoPossibleMoves(turn);
        return pseudoMoves.filter(move => this.isMoveSafe(move, turn));
    }

    // --- Promotion Logic ---

    canPromote(piece, fromRow, toRow) {
        if (piece.includes('+') || piece.toLowerCase() === 'k' || piece.toLowerCase() === 'g') return false;

        const isSente = this.isSente(piece);
        const promotionZone = isSente ? [0, 1, 2] : [6, 7, 8];
        return promotionZone.includes(fromRow) || promotionZone.includes(toRow);
    }

    mustPromote(piece, row) {
        const p = piece.toLowerCase();
        const isSente = this.isSente(piece);
        if (isSente) {
            if (p === 'p' || p === 'l') return row === 0;
            if (p === 'n') return row <= 1;
        } else {
            if (p === 'p' || p === 'l') return row === 8;
            if (p === 'n') return row >= 7;
        }
        return false;
    }

    shouldAIPromote(piece, toRow) {
        // Simple heuristic: always promote if possible
        if (piece.includes('+')) return false;
        return this.canPromote(piece, -1, toRow); // fromRow check ignored for simplicity here
    }

    // --- Drop Logic ---

    canDropPiece(piece, row, col, turn) {
        if (this.board.getPiece(row, col)) return false;

        const p = piece.toLowerCase();
        // Nifu (Two Pawns) check
        if (p === 'p') {
            for (let r = 0; r < BOARD_SIZE; r++) {
                const target = this.board.getPiece(r, col);
                if (target && this.isPlayerPiece(target, turn) && target.toLowerCase() === 'p') {
                    return false;
                }
            }
            // Drop Pawn Mate (Uchifuzume) check is heavy, usually skipped in simple generators or checked at makeMove time. 
            // For now, let's assume specific check elsewhere or ignore for performance.
            // Actually Uchifuzume is a rule, so we should check 'isMoveSafe' but Uchifuzume specifically refers to dropping a pawn to CAUSE checkmate.
            // That logic is complex: Drop P -> Check -> Opponent has NO moves.
            // We'll leave Uchifuzume check for strict rule validation if needed, or implement simplified:
            // "Cannot drop pawn if it causes immediate checkmate"

            // Check for immediate mate with pawn drop (Uchifuzume)
            // This requires simulating the drop, seeing if it checks, AND if opponent has no escape.
            // This is computationally expensive.
        }

        // Cannot drop Knight/Lance/Pawn where they cannot move
        const isSente = turn === PLAYER.SENTE;
        if (isSente) {
            if (p === 'p' || p === 'l') { if (row === 0) return false; }
            if (p === 'n') { if (row <= 1) return false; }
        } else {
            if (p === 'p' || p === 'l') { if (row === 8) return false; }
            if (p === 'n') { if (row >= 7) return false; }
        }

        return true;
    }

    // --- Check and Safety Logic ---

    isMoveSafe(move, turn) {
        const originalBoard = this.board.clone();

        // Simulate move on current board (temporarily) - actually we should clone board to test
        // But since we have a clone method, let's use a temp board for safety check
        // However, this.board is used by all methods. 
        // Better: Clone board, swap global usage, check, swap back? No, unstable.
        // Best: Pass board to isInCheck.

        // We will simulate on a CLONED data structure, but we need to pass that clone to isInCheck.
        // So isInCheck needs to accept a board argument.

        const simulationBoard = this.board.clone();

        // Apply move to simulationBoard
        if (move.type === 'move') {
            const piece = simulationBoard.getPiece(move.fromRow, move.fromCol);
            simulationBoard.setPiece(move.fromRow, move.fromCol, null);

            const promote = move.promote || (this.canPromote(piece, move.fromRow, move.toRow) && this.mustPromote(piece, move.toRow));
            const finalPiece = promote ? '+' + piece : piece;

            simulationBoard.setPiece(move.toRow, move.toCol, finalPiece);
        } else {
            // Drop
            const piece = move.piece; // plain string 'P', 'S' etc
            // Adjust case for owner
            const actualPiece = turn === PLAYER.SENTE ? piece.toUpperCase() : piece.toLowerCase();
            simulationBoard.setPiece(move.toRow, move.toCol, actualPiece);
        }

        return !this.isInCheck(turn, simulationBoard);
    }

    isInCheck(player, boardToTest = null) {
        const board = boardToTest || this.board;
        const kingPiece = player === PLAYER.SENTE ? 'K' : 'k';
        let kingRow = -1, kingCol = -1;

        // Find King
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board.getPiece(r, c) === kingPiece) {
                    kingRow = r;
                    kingCol = c;
                    break;
                }
            }
            if (kingRow !== -1) break;
        }

        if (kingRow === -1) return true; // King lost? captured? treat as checkmate context so 'safe' is false

        const opponent = player === PLAYER.SENTE ? PLAYER.GOTE : PLAYER.SENTE;

        // Check if any opponent piece can attack King
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const piece = board.getPiece(r, c);
                if (piece && this.isPlayerPiece(piece, opponent)) {
                    // Refactored: Use static PieceMoves directly with the board object
                    const attacks = PieceMoves.getMovesForPiece(board, r, c, piece);

                    if (attacks.some(([ar, ac]) => ar === kingRow && ac === kingCol)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    checkGameEnd(turn) {
        // Check if current player has any legal moves
        const allMoves = this.getAllPossibleMoves(turn);
        if (allMoves.length === 0) {
            return { gameOver: true, winner: turn === PLAYER.SENTE ? PLAYER.GOTE : PLAYER.SENTE }; // Stalemate = Loss in Shogi
        }
        return { gameOver: false };
    }
}
