// USIプロトコルクライアント

import { BOARD_SIZE, PIECE_TYPE } from './constants.js';

/**
 * USIプロトコルを使用して将棋エンジンと通信するクラス
 */
export class USIClient {
    constructor(serverUrl = 'http://localhost:8080') {
        this.serverUrl = serverUrl.replace(/\/$/, '');
        this.connected = false;
        this.engineReady = false;
    }

    /**
     * サーバーに接続
     */
    async connect() {
        try {
            const response = await fetch(`${this.serverUrl}/usi/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                throw new Error(`接続エラー: ${response.status}`);
            }
            
            const data = await response.json();
            this.connected = true;
            return data;
        } catch (error) {
            console.error('USI接続エラー:', error);
            throw error;
        }
    }

    /**
     * エンジンを初期化
     */
    async initialize() {
        if (!this.connected) {
            await this.connect();
        }

        try {
            const response = await fetch(`${this.serverUrl}/usi/usi`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                throw new Error(`初期化エラー: ${response.status}`);
            }

            const data = await response.json();
            this.engineReady = data.ready || false;
            return data;
        } catch (error) {
            console.error('USI初期化エラー:', error);
            throw error;
        }
    }

    /**
     * 盤面をSFEN形式に変換
     */
    boardToSFEN(game) {
        let sfen = '';
        
        // 盤面をSFEN形式に変換
        // SFEN: 9段目（上段）から1段目（下段）へ、各段は9筋（右端）から1筋（左端）へ
        // 内部: 行0（上段）から行8（下段）へ、列0（左端）から列8（右端）へ
        for (let row = 0; row < BOARD_SIZE; row++) {
            let emptyCount = 0;
            // 右から左へ（列8から列0へ）
            for (let col = 8; col >= 0; col--) {
                const piece = game.board[row][col];
                if (!piece) {
                    emptyCount++;
                } else {
                    if (emptyCount > 0) {
                        sfen += emptyCount;
                        emptyCount = 0;
                    }
                    sfen += this.pieceToUSI(piece);
                }
            }
            if (emptyCount > 0) {
                sfen += emptyCount;
            }
            if (row < BOARD_SIZE - 1) {
                sfen += '/';
            }
        }

        // 手番 (b=先手, w=後手)
        sfen += ' ' + (game.currentTurn === 'sente' ? 'b' : 'w');

        // 持ち駒（先手、後手の順）
        const senteHand = this.formatHand(game.capturedPieces.sente);
        const goteHand = this.formatHand(game.capturedPieces.gote);
        sfen += ' ' + (senteHand || '-');
        if (goteHand) {
            sfen += ' ' + goteHand;
        }

        // 手数
        sfen += ' ' + (game.moveHistory.length + 1);

        return sfen;
    }

    /**
     * 駒をUSI形式に変換
     */
    pieceToUSI(piece) {
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
     */
    formatHand(pieces) {
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
     * 最善手を取得
     */
    async getBestMove(game, turn, timeLimit = 5000) {
        if (!this.engineReady) {
            await this.initialize();
        }

        try {
            const sfen = this.boardToSFEN(game);
            
            const response = await fetch(`${this.serverUrl}/usi/position`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sfen: sfen,
                    moves: [] // 必要に応じて手の履歴を追加
                })
            });

            if (!response.ok) {
                throw new Error(`positionエラー: ${response.status}`);
            }

            // 思考開始
            const goResponse = await fetch(`${this.serverUrl}/usi/go`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    timeLimit: timeLimit
                })
            });

            if (!goResponse.ok) {
                throw new Error(`goエラー: ${goResponse.status}`);
            }

            const data = await goResponse.json();
            const usiMove = data.bestmove;

            if (!usiMove || usiMove === 'resign' || usiMove === 'win') {
                return null;
            }

            // USI形式の手を内部形式に変換
            return this.parseUSIMove(usiMove, game, turn);
        } catch (error) {
            console.error('USI最善手取得エラー:', error);
            throw error;
        }
    }

    /**
     * USI形式の手を内部形式に変換
     */
    parseUSIMove(usiMove, game, turn) {
        // USI形式: "7g7f" (移動) または "P*5e" (打ち)
        // USI座標系: 筋1-9(右→左), 段a-i(下→上)
        // 内部座標系: 列0-8(左→右), 行0-8(上→下)
        
        if (usiMove.includes('*')) {
            // 打ち: "P*5e"
            const match = usiMove.match(/^([A-Z])\*(\d)([a-i])$/);
            if (!match) return null;

            const piece = match[1].toLowerCase();
            const usiCol = parseInt(match[2]); // 1-9
            const usiRow = match[3].charCodeAt(0) - 'a'.charCodeAt(0); // 0-8 (a=0, i=8)
            
            const col = 9 - usiCol; // 内部列: 9-1 = 8-0
            const row = 8 - usiRow; // 内部行: 8-0 = 8-0 (a段=下段=行8, i段=上段=行0)

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
     */
    moveToUSI(move) {
        if (move.type === 'drop') {
            const piece = move.piece.toUpperCase();
            const usiCol = 9 - move.toCol; // 内部列→USI筋
            const usiRow = 8 - move.toRow; // 内部行→USI段
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

    /**
     * 接続を切断
     */
    async disconnect() {
        try {
            await fetch(`${this.serverUrl}/usi/quit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            this.connected = false;
            this.engineReady = false;
        } catch (error) {
            console.error('USI切断エラー:', error);
        }
    }
}
