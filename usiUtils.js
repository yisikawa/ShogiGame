/**
 * USIプロトコルに関連する変換ユーティリティ
 */
import { BOARD_SIZE } from './constants.js';

/**
 * 盤面をSFEN形式に変換
 * @param {Object} game - ゲーム状態
 * @returns {string} SFEN文字列
 */
export function boardToSFEN(game) {
    let sfen = '';

    // 盤面をSFEN形式に変換
    for (let row = 0; row < BOARD_SIZE; row++) {
        let emptyCount = 0;
        for (let col = 8; col >= 0; col--) {
            const piece = game.board[row][col];
            if (!piece) {
                emptyCount++;
            } else {
                if (emptyCount > 0) {
                    sfen += emptyCount;
                    emptyCount = 0;
                }
                sfen += pieceToUSI(piece);
            }
        }
        if (emptyCount > 0) {
            sfen += emptyCount;
        }
        if (row < BOARD_SIZE - 1) {
            sfen += '/';
        }
    }

    // 手番
    const actualTurn = game.currentTurn;
    sfen += ' ' + (actualTurn === 'sente' ? 'w' : 'b');

    // 持ち駒
    const senteHand = formatHand(game.capturedPieces.sente);
    const goteHand = formatHand(game.capturedPieces.gote);
    sfen += ' ' + (senteHand || '-');
    sfen += ' ' + (goteHand || '-');

    // 手数
    sfen += ' ' + (game.moveHistory.length + 1);

    return sfen;
}

/**
 * 駒をUSI形式に変換
 * @param {string} piece - 内部形式の駒
 * @returns {string} USI形式の駒
 */
export function pieceToUSI(piece) {
    const pieceMap = {
        'K': 'K', 'k': 'k',
        'G': 'G', 'g': 'g',
        'S': 'S', 's': 's',
        'N': 'N', 'n': 'n',
        'L': 'L', 'l': 'l',
        'B': 'B', 'b': 'b',
        'R': 'R', 'r': 'r',
        'P': 'P', 'p': 'p',
        '+B': '+B', '+b': '+b',
        '+R': '+R', '+r': '+r',
        '+S': '+S', '+s': '+s',
        '+N': '+N', '+n': '+n',
        '+L': '+L', '+l': '+l',
        '+P': '+P', '+p': '+p'
    };
    return pieceMap[piece] || piece;
}

/**
 * 持ち駒をUSI形式に変換
 * @param {Array} pieces - 持ち駒の配列
 * @returns {string} USI形式の持ち駒
 */
export function formatHand(pieces) {
    if (!pieces || pieces.length === 0) return '';

    const counts = {};
    pieces.forEach(piece => {
        counts[piece] = (counts[piece] || 0) + 1;
    });

    const handParts = [];
    const order = ['R', 'B', 'G', 'S', 'N', 'L', 'P'];
    order.forEach(piece => {
        if (counts[piece]) {
            const count = counts[piece];
            if (count > 1) {
                handParts.push(count + piece);
            } else {
                handParts.push(piece);
            }
        }
    });

    return handParts.join('');
}

/**
 * USI形式の手を内部形式にパース
 * @param {string} usiMove - USI形式の手
 * @returns {Object|null} 内部形式の手のオブジェクト
 */
export function parseUSIMoveToInternal(usiMove) {
    if (usiMove.includes('*')) {
        // 打ち: "P*5e"
        const match = usiMove.match(/^([A-Z])\*(\d)([a-i])$/);
        if (!match) return null;

        const piece = match[1].toLowerCase();
        const usiCol = parseInt(match[2]);
        const usiRow = match[3].charCodeAt(0) - 'a'.charCodeAt(0);

        const col = 9 - usiCol;
        const row = 8 - usiRow;

        return {
            type: 'drop',
            piece: piece,
            toRow: row,
            toCol: col
        };
    } else {
        // 移動: "7g7f" または "7g7f+"
        const match = usiMove.match(/^(\d)([a-i])(\d)([a-i])(\+?)$/);
        if (!match) return null;

        const fromUsiCol = parseInt(match[1]);
        const fromUsiRow = match[2].charCodeAt(0) - 'a'.charCodeAt(0);
        const toUsiCol = parseInt(match[3]);
        const toUsiRow = match[4].charCodeAt(0) - 'a'.charCodeAt(0);
        const promote = match[5] === '+';

        const fromCol = 9 - fromUsiCol;
        const fromRow = 8 - fromUsiRow;
        const toCol = 9 - toUsiCol;
        const toRow = 8 - toUsiRow;

        return {
            type: 'move',
            fromRow: fromRow,
            fromCol: fromCol,
            toRow: toRow,
            toCol: toCol,
            promoted: promote
        };
    }
}

/**
 * 内部形式の手をUSI形式に変換
 * @param {Object} move - 内部形式の手
 * @returns {string} USI形式の手
 */
export function moveToUSI(move) {
    if (move.type === 'drop') {
        const piece = move.piece.toUpperCase();
        const usiCol = 9 - move.toCol;
        const usiRow = 8 - move.toRow;
        const row = String.fromCharCode('a'.charCodeAt(0) + usiRow);
        return `${piece}*${usiCol}${row}`;
    } else {
        const fromUsiCol = 9 - move.fromCol;
        const fromUsiRow = 8 - move.fromRow;
        const toUsiCol = 9 - move.toCol;
        const toUsiRow = 8 - move.toRow;
        const fromRow = String.fromCharCode('a'.charCodeAt(0) + fromUsiRow);
        const toRow = String.fromCharCode('a'.charCodeAt(0) + toUsiRow);
        const promote = move.promoted ? '+' : '';
        return `${fromUsiCol}${fromRow}${toUsiCol}${toRow}${promote}`;
    }
}
