// 将棋ゲームのメインロジック

class ShogiGame {
    constructor() {
        this.board = this.initializeBoard();
        this.currentTurn = 'sente'; // 'sente' (先手) or 'gote' (後手)
        this.selectedCell = null;
        this.selectedCapturedPiece = null; // 選択された持ち駒 {piece: 'p', player: 'sente'}
        this.capturedPieces = {
            sente: [],
            gote: []
        };
        this.gameMode = 'human-vs-human'; // 'human-vs-human', 'human-vs-ai', 'ai-vs-ai'
        this.aiLevel = 'intermediate'; // 'beginner', 'intermediate', 'advanced'
        this.ai = new ShogiAI(this.aiLevel);
        this.gameOver = false;
        this.winner = null;
        this.pendingPromotion = null; // {fromRow, fromCol, toRow, toCol, piece}
        this.moveHistory = []; // 棋譜（手の履歴）
        this.currentMoveIndex = -1; // 現在の手のインデックス（再生用）
        this.isReplaying = false; // 再生中かどうか
        this.init();
    }

    initializeBoard() {
        // 9x9の将棋盤を初期化
        const board = Array(9).fill(null).map(() => Array(9).fill(null));
        
        // 後手（上側）の初期配置
        board[0] = ['l', 'n', 's', 'g', 'k', 'g', 's', 'n', 'l'];
        board[1][1] = 'r';
        board[1][7] = 'b';
        board[2] = ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'];
        
        // 先手（下側）の初期配置
        board[6] = ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'];
        board[7][1] = 'B';
        board[7][7] = 'R';
        board[8] = ['L', 'N', 'S', 'G', 'K', 'G', 'S', 'N', 'L'];
        
        return board;
    }

    init() {
        this.renderBoard();
        this.updateTurnIndicator();
        this.updateCapturedPieces();
        this.updateInstructionText();
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.reset();
        });
        
        document.getElementById('gameMode').addEventListener('change', (e) => {
            this.gameMode = e.target.value;
            this.reset();
            // AI vs AIモードの場合は開始
            if (this.gameMode === 'ai-vs-ai') {
                // 少し遅延させてから開始（UI更新を待つ）
                setTimeout(() => {
                    this.checkAndMakeAIMove();
                }, 100);
            }
        });
        
        document.getElementById('aiLevel').addEventListener('change', (e) => {
            this.aiLevel = e.target.value;
            this.ai = new ShogiAI(this.aiLevel);
        });
        
        document.getElementById('newGameBtn').addEventListener('click', () => {
            this.exitReplayMode();
            this.reset();
        });
        
        document.getElementById('exitGameBtn').addEventListener('click', () => {
            this.exitGame();
        });
        
        document.getElementById('promoteYesBtn').addEventListener('click', () => {
            this.handlePromotionChoice(true);
        });
        
        document.getElementById('promoteNoBtn').addEventListener('click', () => {
            this.handlePromotionChoice(false);
        });
        
        document.getElementById('prevMoveBtn').addEventListener('click', () => {
            this.goToPreviousMove();
        });
        
        document.getElementById('nextMoveBtn').addEventListener('click', () => {
            this.goToNextMove();
        });
        
        document.getElementById('firstMoveBtn').addEventListener('click', () => {
            this.goToFirstMove();
        });
        
        document.getElementById('lastMoveBtn').addEventListener('click', () => {
            this.goToLastMove();
        });
    }

    getPieceName(piece) {
        const pieceNames = {
            'K': '王', 'k': '王',
            'G': '金', 'g': '金',
            'S': '銀', 's': '銀',
            'N': '桂', 'n': '桂',
            'L': '香', 'l': '香',
            'B': '角', 'b': '角',
            'R': '飛', 'r': '飛',
            'P': '歩', 'p': '歩',
            '+B': '馬', '+b': '馬',
            '+R': '龍', '+r': '龍',
            '+S': '全', '+s': '全',
            '+N': '圭', '+n': '圭',
            '+L': '杏', '+l': '杏',
            '+P': 'と', '+p': 'と'
        };
        return pieceNames[piece] || '';
    }

    isSente(piece) {
        return piece && piece === piece.toUpperCase();
    }

    isGote(piece) {
        return piece && piece === piece.toLowerCase();
    }

    getPossibleMoves(row, col) {
        const piece = this.board[row][col];
        if (!piece) return [];
        
        const isCurrentPlayer = (this.currentTurn === 'sente' && this.isSente(piece)) ||
                               (this.currentTurn === 'gote' && this.isGote(piece));
        if (!isCurrentPlayer) return [];

        const moves = [];
        const pieceType = piece.replace('+', '').toLowerCase();

        switch (pieceType) {
            case 'k': // 王
                moves.push(...this.getKingMoves(row, col, piece));
                break;
            case 'g': // 金
                moves.push(...this.getGoldMoves(row, col, piece));
                break;
            case 's': // 銀
                moves.push(...this.getSilverMoves(row, col, piece));
                break;
            case 'n': // 桂
                moves.push(...this.getKnightMoves(row, col, piece));
                break;
            case 'l': // 香
                moves.push(...this.getLanceMoves(row, col, piece));
                break;
            case 'b': // 角
                moves.push(...this.getBishopMoves(row, col, piece));
                break;
            case 'r': // 飛
                moves.push(...this.getRookMoves(row, col, piece));
                break;
            case 'p': // 歩
                moves.push(...this.getPawnMoves(row, col, piece));
                break;
        }

        return moves.filter(([r, c]) => {
            // 自分の駒を取らない
            const target = this.board[r][c];
            if (!target) return true;
            return (this.currentTurn === 'sente' && this.isGote(target)) ||
                   (this.currentTurn === 'gote' && this.isSente(target));
        });
    }

    getKingMoves(row, col, piece) {
        const moves = [];
        const directions = [[-1,-1], [-1,0], [-1,1], [0,-1], [0,1], [1,-1], [1,0], [1,1]];
        for (const [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;
            if (this.isValidPosition(newRow, newCol)) {
                moves.push([newRow, newCol]);
            }
        }
        return moves;
    }

    getGoldMoves(row, col, piece) {
        const moves = [];
        const isSente = this.isSente(piece);
        const forward = isSente ? -1 : 1;
        const directions = isSente 
            ? [[-1,-1], [-1,0], [-1,1], [0,-1], [0,1], [1,0]]
            : [[1,-1], [1,0], [1,1], [0,-1], [0,1], [-1,0]];
        for (const [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;
            if (this.isValidPosition(newRow, newCol)) {
                moves.push([newRow, newCol]);
            }
        }
        return moves;
    }

    getSilverMoves(row, col, piece) {
        const isSente = this.isSente(piece);
        const isPromoted = piece.includes('+');
        if (isPromoted) {
            return this.getGoldMoves(row, col, piece);
        }
        const moves = [];
        const forward = isSente ? -1 : 1;
        const directions = [[forward,-1], [forward,0], [forward,1], [-forward,-1], [-forward,1]];
        for (const [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;
            if (this.isValidPosition(newRow, newCol)) {
                moves.push([newRow, newCol]);
            }
        }
        return moves;
    }

    getKnightMoves(row, col, piece) {
        const isSente = this.isSente(piece);
        const isPromoted = piece.includes('+');
        if (isPromoted) {
            return this.getGoldMoves(row, col, piece);
        }
        const moves = [];
        const forward = isSente ? -2 : 2;
        const directions = [[forward,-1], [forward,1]];
        for (const [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;
            if (this.isValidPosition(newRow, newCol)) {
                moves.push([newRow, newCol]);
            }
        }
        return moves;
    }

    getLanceMoves(row, col, piece) {
        const isSente = this.isSente(piece);
        const isPromoted = piece.includes('+');
        if (isPromoted) {
            return this.getGoldMoves(row, col, piece);
        }
        const moves = [];
        const forward = isSente ? -1 : 1;
        for (let i = 1; i < 9; i++) {
            const newRow = row + (forward * i);
            if (!this.isValidPosition(newRow, col)) break;
            moves.push([newRow, col]);
            if (this.board[newRow][col]) break; // 駒に当たったら止まる
        }
        return moves;
    }

    getBishopMoves(row, col, piece) {
        const isPromoted = piece.includes('+');
        const moves = [];
        const directions = [[-1,-1], [-1,1], [1,-1], [1,1]];
        for (const [dr, dc] of directions) {
            for (let i = 1; i < 9; i++) {
                const newRow = row + (dr * i);
                const newCol = col + (dc * i);
                if (!this.isValidPosition(newRow, newCol)) break;
                moves.push([newRow, newCol]);
                if (this.board[newRow][newCol]) break;
            }
        }
        // 成り角（馬）は王の動きも追加
        if (isPromoted) {
            const kingMoves = this.getKingMoves(row, col, piece);
            moves.push(...kingMoves);
        }
        return moves;
    }

    getRookMoves(row, col, piece) {
        const isPromoted = piece.includes('+');
        const moves = [];
        const directions = [[-1,0], [1,0], [0,-1], [0,1]];
        for (const [dr, dc] of directions) {
            for (let i = 1; i < 9; i++) {
                const newRow = row + (dr * i);
                const newCol = col + (dc * i);
                if (!this.isValidPosition(newRow, newCol)) break;
                moves.push([newRow, newCol]);
                if (this.board[newRow][newCol]) break;
            }
        }
        // 成り飛（龍）は王の動きも追加
        if (isPromoted) {
            const kingMoves = this.getKingMoves(row, col, piece);
            moves.push(...kingMoves);
        }
        return moves;
    }

    getPawnMoves(row, col, piece) {
        const isSente = this.isSente(piece);
        const isPromoted = piece.includes('+');
        if (isPromoted) {
            return this.getGoldMoves(row, col, piece);
        }
        const moves = [];
        const forward = isSente ? -1 : 1;
        const newRow = row + forward;
        if (this.isValidPosition(newRow, col)) {
            moves.push([newRow, col]);
        }
        return moves;
    }

    isValidPosition(row, col) {
        return row >= 0 && row < 9 && col >= 0 && col < 9;
    }

    movePiece(fromRow, fromCol, toRow, toCol, promote = null) {
        const piece = this.board[fromRow][fromCol];
        const captured = this.board[toRow][toCol];
        
        // 持ち駒に追加
        if (captured) {
            const capturedPiece = captured.replace('+', '').toLowerCase();
            if (this.currentTurn === 'sente') {
                this.capturedPieces.sente.push(capturedPiece);
            } else {
                this.capturedPieces.gote.push(capturedPiece);
            }
        }
        
        // 駒を移動
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;
        
        // 成りの判定
        const canPromote = this.canPromote(piece, fromRow, toRow);
        if (canPromote && !piece.includes('+') && piece.toLowerCase() !== 'k' && piece.toLowerCase() !== 'g') {
            // 人間のターンで、promoteがnullの場合は選択を待つ
            if (!this.isAITurn() && promote === null) {
                this.pendingPromotion = { fromRow, fromCol, toRow, toCol, piece, captured };
                this.showPromoteModal(piece);
                return; // 成り選択を待つ
            }
            
            // AIのターンまたは既に選択済みの場合
            if (promote === true || (this.isAITurn() && this.shouldAIPromote(piece, toRow))) {
                this.board[toRow][toCol] = '+' + piece;
            }
        }
        
        // 王が取られたかチェック
        const capturedPiece = captured ? captured.replace('+', '').toLowerCase() : null;
        if (capturedPiece === 'k') {
            // 王が取られた
            this.gameOver = true;
            this.winner = this.currentTurn; // 王を取った側が勝ち
            this.showReplayMode();
            return;
        }
        
        // 棋譜に記録（再生中でない場合のみ）
        if (!this.isReplaying) {
            const moveRecord = {
                type: 'move',
                fromRow,
                fromCol,
                toRow,
                toCol,
                piece: piece,
                promoted: this.board[toRow][toCol].includes('+'),
                captured: captured ? captured.replace('+', '') : null,
                turn: this.currentTurn,
                capturedPiecesBefore: {
                    sente: [...this.capturedPieces.sente],
                    gote: [...this.capturedPieces.gote]
                }
            };
            // 現在の位置より後ろの手を削除（分岐を削除）
            this.moveHistory = this.moveHistory.slice(0, this.currentMoveIndex + 1);
            this.moveHistory.push(moveRecord);
            this.currentMoveIndex = this.moveHistory.length - 1;
            this.updateMoveHistoryDisplay();
        }
        
        this.currentTurn = this.currentTurn === 'sente' ? 'gote' : 'sente';
        this.selectedCell = null;
        this.selectedCapturedPiece = null;
        this.pendingPromotion = null;
        this.renderBoard();
        this.updateTurnIndicator();
        this.updateCapturedPieces();
        this.updateMoveControls();
        this.updateInstructionText();
        
        // ゲームが終了していない場合のみAIの手を打つ
        if (!this.gameOver) {
            // 王が盤上に存在するかチェック
            if (!this.hasKing('sente')) {
                this.gameOver = true;
                this.winner = 'gote';
                this.showReplayMode();
                return;
            }
            if (!this.hasKing('gote')) {
                this.gameOver = true;
                this.winner = 'sente';
                this.showReplayMode();
                return;
            }
            
            // AIのターンの場合、自動で手を打つ
            this.checkAndMakeAIMove();
        }
    }
    
    canPromote(piece, fromRow, toRow) {
        if (!piece || piece.includes('+')) return false;
        if (piece.toLowerCase() === 'k' || piece.toLowerCase() === 'g') return false;
        
        const isSente = this.isSente(piece);
        // 敵陣（先手は0-2行目、後手は6-8行目）に入った場合、または敵陣から出る場合
        const inEnemyTerritory = (isSente && toRow < 3) || (!isSente && toRow > 5);
        const fromEnemyTerritory = (isSente && fromRow < 3) || (!isSente && fromRow > 5);
        
        return inEnemyTerritory || fromEnemyTerritory;
    }
    
    shouldAIPromote(piece, toRow) {
        // AIの成り判定（基本的には成る）
        const pieceType = piece.toLowerCase();
        // 王や金以外は基本的に成る
        if (pieceType === 'k' || pieceType === 'g') return false;
        return true;
    }
    
    showPromoteModal(piece) {
        const modal = document.getElementById('promoteModal');
        const pieceName = document.getElementById('promotePieceName');
        pieceName.textContent = `${this.getPieceName(piece)}を成りますか？`;
        modal.classList.remove('hidden');
    }
    
    hidePromoteModal() {
        const modal = document.getElementById('promoteModal');
        modal.classList.add('hidden');
    }
    
    handlePromotionChoice(promote) {
        if (!this.pendingPromotion) return;
        
        const { fromRow, fromCol, toRow, toCol, piece } = this.pendingPromotion;
        this.hidePromoteModal();
        
        // 成り選択を反映して移動を完了
        this.movePiece(fromRow, fromCol, toRow, toCol, promote);
    }

    dropPiece(piece, row, col) {
        if (this.board[row][col]) return false; // 既に駒がある
        
        const pieceType = piece.toLowerCase();
        const droppedPiece = this.currentTurn === 'sente' ? pieceType.toUpperCase() : pieceType;
        
        // 二歩のチェック（簡易版）
        if (pieceType === 'p') {
            for (let r = 0; r < 9; r++) {
                if (this.board[r][col] === droppedPiece) {
                    return false; // 同じ列に既に歩がある
                }
            }
        }
        
        // 棋譜に記録（再生中でない場合のみ）
        if (!this.isReplaying) {
            const moveRecord = {
                type: 'drop',
                piece: pieceType,
                toRow: row,
                toCol: col,
                turn: this.currentTurn,
                capturedPiecesBefore: {
                    sente: [...this.capturedPieces.sente],
                    gote: [...this.capturedPieces.gote]
                }
            };
            // 現在の位置より後ろの手を削除（分岐を削除）
            this.moveHistory = this.moveHistory.slice(0, this.currentMoveIndex + 1);
            this.moveHistory.push(moveRecord);
            this.currentMoveIndex = this.moveHistory.length - 1;
            this.updateMoveHistoryDisplay();
        }
        
        this.board[row][col] = droppedPiece;
        
        // 持ち駒から削除
        const index = this.capturedPieces[this.currentTurn].indexOf(pieceType);
        if (index > -1) {
            this.capturedPieces[this.currentTurn].splice(index, 1);
        }
        
        // 王が取られたかチェック（打った駒が王を取った場合）
        // この場合は通常発生しないが、念のためチェック
        
        this.currentTurn = this.currentTurn === 'sente' ? 'gote' : 'sente';
        this.renderBoard();
        this.updateTurnIndicator();
        this.updateCapturedPieces();
        this.updateMoveControls();
        this.updateInstructionText();
        
        // ゲームが終了していない場合のみAIの手を打つ
        if (!this.gameOver) {
            // 王が盤上に存在するかチェック
            if (!this.hasKing('sente')) {
                this.gameOver = true;
                this.winner = 'gote';
                this.showReplayMode();
                return true;
            }
            if (!this.hasKing('gote')) {
                this.gameOver = true;
                this.winner = 'sente';
                this.showReplayMode();
                return true;
            }
            
            // AIのターンの場合、自動で手を打つ
            this.checkAndMakeAIMove();
        }
        
        return true;
    }

    renderBoard() {
        const boardElement = document.getElementById('board');
        boardElement.innerHTML = '';
        
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;
                
                const piece = this.board[row][col];
                if (piece) {
                    const pieceElement = document.createElement('div');
                    pieceElement.className = `piece ${this.isSente(piece) ? 'sente' : 'gote'}`;
                    pieceElement.textContent = this.getPieceName(piece);
                    cell.appendChild(pieceElement);
                }
                
                cell.addEventListener('click', () => this.handleCellClick(row, col));
                boardElement.appendChild(cell);
            }
        }
    }

    handleCellClick(row, col) {
        // ゲームが終了している場合はクリックを無視
        if (this.gameOver) {
            return;
        }
        
        // AIのターンまたはAI対AIモードの場合はクリックを無視
        if (this.isAITurn()) {
            return;
        }
        
        const piece = this.board[row][col];
        
        // 持ち駒が選択されている場合
        if (this.selectedCapturedPiece) {
            // 空いているマスに打つ
            if (!piece) {
                if (this.canDropPiece(this.selectedCapturedPiece.piece, row, col)) {
                    this.dropPiece(this.selectedCapturedPiece.piece, row, col);
                    this.selectedCapturedPiece = null;
                    this.updateCapturedPieces(); // UIを更新
                    this.updateInstructionText(); // インストラクションを更新
                } else {
                    // 打てないマス（二歩など）
                    const pieceName = this.getPieceName(this.selectedCapturedPiece.piece);
                    alert(`そのマスには「${pieceName}」を打てません（二歩などの禁じ手）`);
                }
            } else {
                // 既に駒があるマス - 持ち駒の選択を解除して、その駒を選択
                this.selectedCapturedPiece = null;
                this.updateCapturedPieces();
                this.updateInstructionText();
                // その駒を選択
                if ((this.currentTurn === 'sente' && this.isSente(piece)) ||
                    (this.currentTurn === 'gote' && this.isGote(piece))) {
                    this.selectedCell = [row, col];
                    this.highlightMoves();
                }
            }
            return;
        }
        
        if (this.selectedCell) {
            const [selectedRow, selectedCol] = this.selectedCell;
            const possibleMoves = this.getPossibleMoves(selectedRow, selectedCol);
            const isValidMove = possibleMoves.some(([r, c]) => r === row && c === col);
            
            if (isValidMove) {
                this.movePiece(selectedRow, selectedCol, row, col);
            } else {
                // 新しい駒を選択
                if (piece && 
                    ((this.currentTurn === 'sente' && this.isSente(piece)) ||
                     (this.currentTurn === 'gote' && this.isGote(piece)))) {
                    this.selectedCell = [row, col];
                    this.highlightMoves();
                } else {
                    this.selectedCell = null;
                    this.renderBoard();
                }
            }
        } else {
            // 駒を選択
            if (piece && 
                ((this.currentTurn === 'sente' && this.isSente(piece)) ||
                 (this.currentTurn === 'gote' && this.isGote(piece)))) {
                this.selectedCell = [row, col];
                this.highlightMoves();
            }
        }
    }

    highlightMoves() {
        this.renderBoard();
        if (this.selectedCell) {
            const [row, col] = this.selectedCell;
            const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (cell) cell.classList.add('selected');
            
            const possibleMoves = this.getPossibleMoves(row, col);
            possibleMoves.forEach(([r, c]) => {
                const moveCell = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                if (moveCell) moveCell.classList.add('possible-move');
            });
        }
        this.updateInstructionText();
    }

    updateTurnIndicator() {
        const turnElement = document.getElementById('currentTurn');
        turnElement.textContent = this.currentTurn === 'sente' ? '先手の番' : '後手の番';
        this.updateInstructionText();
    }
    
    updateInstructionText() {
        const instructionElement = document.getElementById('instructionText');
        if (!instructionElement) return;
        
        if (this.gameOver) {
            instructionElement.textContent = 'ゲーム終了';
            return;
        }
        
        if (this.selectedCapturedPiece) {
            const pieceName = this.getPieceName(this.selectedCapturedPiece.piece);
            instructionElement.textContent = `持ち駒「${pieceName}」を選択中。打ちたいマスをクリックしてください`;
            instructionElement.style.color = '#667eea';
            instructionElement.style.fontWeight = 'bold';
        } else if (this.selectedCell) {
            instructionElement.textContent = '移動先をクリックしてください';
            instructionElement.style.color = '#667eea';
            instructionElement.style.fontWeight = 'bold';
        } else {
            instructionElement.textContent = '駒をクリックして選択するか、持ち駒をクリックして打ち込みます';
            instructionElement.style.color = '#666';
            instructionElement.style.fontWeight = 'normal';
        }
    }

    updateCapturedPieces() {
        const topList = document.getElementById('capturedTopList');
        const bottomList = document.getElementById('capturedBottomList');
        const topContainer = document.getElementById('capturedTop');
        const bottomContainer = document.getElementById('capturedBottom');
        
        topList.innerHTML = '';
        bottomList.innerHTML = '';
        
        // 持ち駒を集計（同じ駒が複数ある場合）
        const gotePieces = {};
        this.capturedPieces.gote.forEach(piece => {
            gotePieces[piece] = (gotePieces[piece] || 0) + 1;
        });
        
        const sentePieces = {};
        this.capturedPieces.sente.forEach(piece => {
            sentePieces[piece] = (sentePieces[piece] || 0) + 1;
        });
        
        // 後手の持ち駒を表示
        Object.keys(gotePieces).forEach(piece => {
            const count = gotePieces[piece];
            const pieceElement = document.createElement('div');
            pieceElement.className = 'captured-piece';
            if (count > 1) {
                pieceElement.textContent = `${this.getPieceName(piece)}×${count}`;
            } else {
                pieceElement.textContent = this.getPieceName(piece);
            }
            pieceElement.dataset.piece = piece;
            
            // 選択されている場合はハイライト
            if (this.selectedCapturedPiece && 
                this.selectedCapturedPiece.piece === piece && 
                this.selectedCapturedPiece.player === 'gote') {
                pieceElement.classList.add('selected-captured');
            }
            
            pieceElement.addEventListener('click', () => this.handleCapturedPieceClick(piece, 'gote'));
            topList.appendChild(pieceElement);
        });
        
        // 先手の持ち駒を表示
        Object.keys(sentePieces).forEach(piece => {
            const count = sentePieces[piece];
            const pieceElement = document.createElement('div');
            pieceElement.className = 'captured-piece';
            if (count > 1) {
                pieceElement.textContent = `${this.getPieceName(piece)}×${count}`;
            } else {
                pieceElement.textContent = this.getPieceName(piece);
            }
            pieceElement.dataset.piece = piece;
            
            // 選択されている場合はハイライト
            if (this.selectedCapturedPiece && 
                this.selectedCapturedPiece.piece === piece && 
                this.selectedCapturedPiece.player === 'sente') {
                pieceElement.classList.add('selected-captured');
            }
            
            pieceElement.addEventListener('click', () => this.handleCapturedPieceClick(piece, 'sente'));
            bottomList.appendChild(pieceElement);
        });
        
        // 持ち駒がある場合にコンテナにクラスを追加
        if (topContainer) {
            if (Object.keys(gotePieces).length > 0) {
                topContainer.classList.add('has-pieces');
            } else {
                topContainer.classList.remove('has-pieces');
            }
        }
        
        if (bottomContainer) {
            if (Object.keys(sentePieces).length > 0) {
                bottomContainer.classList.add('has-pieces');
            } else {
                bottomContainer.classList.remove('has-pieces');
            }
        }
    }

    handleCapturedPieceClick(piece, player) {
        if (player !== this.currentTurn) {
            // 自分のターンでない持ち駒をクリックした場合のメッセージ
            return;
        }
        if (this.gameOver) return;
        
        // 持ち駒を選択状態にする
        if (this.selectedCapturedPiece && 
            this.selectedCapturedPiece.piece === piece && 
            this.selectedCapturedPiece.player === player) {
            // 既に選択されている場合は選択解除
            this.selectedCapturedPiece = null;
            this.renderBoard();
        } else {
            // 新しい持ち駒を選択
            this.selectedCapturedPiece = { piece: piece, player: player };
            this.selectedCell = null; // 盤上の選択を解除
            this.highlightDropPositions(); // 打てる位置をハイライト
        }
        
        this.updateCapturedPieces(); // UIを更新
        this.updateInstructionText(); // インストラクションを更新
    }
    
    canDropPiece(piece, row, col) {
        // 既に駒があるマスには打てない
        if (this.board[row][col]) return false;
        
        const pieceType = piece.toLowerCase();
        
        // 二歩のチェック
        if (pieceType === 'p') {
            const droppedPiece = this.currentTurn === 'sente' ? 'P' : 'p';
            for (let r = 0; r < 9; r++) {
                if (this.board[r][col] === droppedPiece) {
                    return false; // 同じ列に既に歩がある
                }
            }
            
            // 打ち歩詰めのチェック（簡易版：敵陣の最下段には打てない）
            if (this.currentTurn === 'sente' && row === 0) return false;
            if (this.currentTurn === 'gote' && row === 8) return false;
        }
        
        // 桂馬は敵陣の最下段・2段目には打てない
        if (pieceType === 'n') {
            if (this.currentTurn === 'sente' && row <= 1) return false;
            if (this.currentTurn === 'gote' && row >= 7) return false;
        }
        
        // 香車は敵陣の最下段には打てない
        if (pieceType === 'l') {
            if (this.currentTurn === 'sente' && row === 0) return false;
            if (this.currentTurn === 'gote' && row === 8) return false;
        }
        
        return true;
    }
    
    highlightDropPositions() {
        this.renderBoard();
        if (this.selectedCapturedPiece) {
            // 打てる位置をハイライト
            for (let row = 0; row < 9; row++) {
                for (let col = 0; col < 9; col++) {
                    if (this.canDropPiece(this.selectedCapturedPiece.piece, row, col)) {
                        const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                        if (cell) cell.classList.add('possible-move');
                    }
                }
            }
        }
    }

    isAITurn() {
        if (this.gameMode === 'human-vs-human') return false;
        if (this.gameMode === 'human-vs-ai' && this.currentTurn === 'sente') return false;
        if (this.gameMode === 'human-vs-ai' && this.currentTurn === 'gote') return true;
        if (this.gameMode === 'ai-vs-ai') return true;
        return false;
    }

    checkAndMakeAIMove() {
        if (this.isAITurn() && !this.gameOver && !this.isReplaying) {
            this.showAIThinking();
            // AIの思考時間をシミュレート（500ms〜1500ms）
            const thinkingTime = 500 + Math.random() * 1000;
            setTimeout(() => {
                if (this.gameOver || this.isReplaying) {
                    this.hideAIThinking();
                    return;
                }
                
                const move = this.ai.getBestMove(this, this.currentTurn);
                if (move) {
                    if (move.type === 'move') {
                        this.movePiece(move.fromRow, move.fromCol, move.toRow, move.toCol);
                    } else if (move.type === 'drop') {
                        this.dropPiece(move.piece, move.toRow, move.toCol);
                    }
                } else {
                    this.hideAIThinking();
                }
            }, thinkingTime);
        }
    }

    showAIThinking() {
        const thinkingElement = document.getElementById('aiThinking');
        if (thinkingElement) {
            thinkingElement.classList.remove('hidden');
        }
    }

    hideAIThinking() {
        const thinkingElement = document.getElementById('aiThinking');
        if (thinkingElement) {
            thinkingElement.classList.add('hidden');
        }
    }

    getAllPossibleMoves(turn) {
        const moves = [];
        
        // 盤上の駒の移動
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const piece = this.board[row][col];
                if (piece && 
                    ((turn === 'sente' && this.isSente(piece)) ||
                     (turn === 'gote' && this.isGote(piece)))) {
                    const possibleMoves = this.getPossibleMoves(row, col);
                    possibleMoves.forEach(([toRow, toCol]) => {
                        moves.push({
                            type: 'move',
                            fromRow: row,
                            fromCol: col,
                            toRow: toRow,
                            toCol: toCol
                        });
                    });
                }
            }
        }
        
        // 持ち駒を打つ手
        const capturedPieces = this.capturedPieces[turn];
        const uniquePieces = [...new Set(capturedPieces)];
        uniquePieces.forEach(piece => {
            for (let row = 0; row < 9; row++) {
                for (let col = 0; col < 9; col++) {
                    if (!this.board[row][col]) {
                        // 二歩チェック
                        if (piece === 'p') {
                            let hasPawn = false;
                            for (let r = 0; r < 9; r++) {
                                const p = this.board[r][col];
                                if (p && ((turn === 'sente' && p === 'P') || (turn === 'gote' && p === 'p'))) {
                                    hasPawn = true;
                                    break;
                                }
                            }
                            if (!hasPawn) {
                                moves.push({
                                    type: 'drop',
                                    piece: piece,
                                    toRow: row,
                                    toCol: col
                                });
                            }
                        } else {
                            moves.push({
                                type: 'drop',
                                piece: piece,
                                toRow: row,
                                toCol: col
                            });
                        }
                    }
                }
            }
        });
        
        return moves;
    }

    hasKing(player) {
        const kingPiece = player === 'sente' ? 'K' : 'k';
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const piece = this.board[row][col];
                if (piece && piece.replace('+', '') === kingPiece) {
                    return true;
                }
            }
        }
        return false;
    }

    showGameEndMessage() {
        // ゲーム終了メッセージを表示（棋譜コントロールの上に表示）
        const controls = document.querySelector('.move-history-controls');
        if (controls) {
            let message = '';
            if (this.winner === 'sente') {
                message = '🎉 先手の勝ち！';
            } else if (this.winner === 'gote') {
                message = '🎉 後手の勝ち！';
            } else {
                message = 'ゲーム終了（引き分け）';
            }
            
            // メッセージ要素が既に存在する場合は更新、なければ作成
            let messageElement = document.getElementById('gameEndMessage');
            if (!messageElement) {
                messageElement = document.createElement('div');
                messageElement.id = 'gameEndMessage';
                messageElement.className = 'game-end-message';
                controls.insertBefore(messageElement, controls.firstChild);
            }
            messageElement.textContent = message;
        }
    }
    
    showReplayMode() {
        // ゲーム終了メッセージを表示
        this.showGameEndMessage();
        
        // ゲーム終了後、棋譜の再実行モードを有効にする
        // 盤面の操作を無効化（棋譜コントロールのみ有効）
        const cells = document.querySelectorAll('.cell');
        cells.forEach(cell => {
            cell.style.pointerEvents = 'none';
        });
        
        // 持ち駒の操作も無効化
        const capturedPieces = document.querySelectorAll('.captured-piece');
        capturedPieces.forEach(piece => {
            piece.style.pointerEvents = 'none';
        });
        
        // 棋譜コントロールを強調表示
        const controls = document.querySelector('.move-history-controls');
        const panel = document.querySelector('.move-history-panel');
        if (controls) {
            controls.style.display = 'flex';
            controls.style.background = '#fff3cd';
            controls.style.border = '2px solid #ffc107';
        }
        if (panel) {
            panel.style.display = 'block';
            panel.style.background = '#fff3cd';
            panel.style.border = '2px solid #ffc107';
        }
        
        // 棋譜コントロールを有効にする
        this.updateMoveControls();
    }
    
    exitReplayMode() {
        // ゲーム終了メッセージを削除
        const messageElement = document.getElementById('gameEndMessage');
        if (messageElement) {
            messageElement.remove();
        }
        
        // 再実行モードを終了して、通常の操作を有効化
        const cells = document.querySelectorAll('.cell');
        cells.forEach(cell => {
            cell.style.pointerEvents = '';
        });
        
        const capturedPieces = document.querySelectorAll('.captured-piece');
        capturedPieces.forEach(piece => {
            piece.style.pointerEvents = '';
        });
        
        const controls = document.querySelector('.move-history-controls');
        const panel = document.querySelector('.move-history-panel');
        if (controls) {
            controls.style.background = '';
            controls.style.border = '';
        }
        if (panel) {
            panel.style.background = '';
            panel.style.border = '';
        }
    }
    
    exitGame() {
        // 終了確認
        if (confirm('ゲームを終了しますか？')) {
            // ゲーム画面を非表示にするか、終了メッセージを表示
            const container = document.querySelector('.container');
            if (container) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 50px;">
                        <h1>ゲームを終了しました</h1>
                        <p>ご利用ありがとうございました。</p>
                        <button onclick="location.reload()" style="padding: 10px 20px; margin-top: 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">
                            再読み込み
                        </button>
                    </div>
                `;
            }
        }
    }

    // 棋譜から状態を復元
    restoreFromHistory(targetIndex) {
        this.isReplaying = true;
        
        // 初期状態に戻す
        this.board = this.initializeBoard();
        this.capturedPieces = { sente: [], gote: [] };
        this.currentTurn = 'sente';
        this.gameOver = false;
        this.winner = null;
        
        // 指定された手まで再生
        for (let i = 0; i <= targetIndex && i < this.moveHistory.length; i++) {
            const move = this.moveHistory[i];
            if (move.type === 'move') {
                this.movePiece(move.fromRow, move.fromCol, move.toRow, move.toCol, move.promoted);
            } else if (move.type === 'drop') {
                this.dropPiece(move.piece, move.toRow, move.toCol);
            }
        }
        
        this.isReplaying = false;
        this.currentMoveIndex = targetIndex;
        this.updateMoveHistoryDisplay();
        this.updateMoveControls();
    }
    
    goToPreviousMove() {
        if (this.currentMoveIndex >= 0) {
            this.restoreFromHistory(this.currentMoveIndex - 1);
        }
    }
    
    goToNextMove() {
        if (this.currentMoveIndex < this.moveHistory.length - 1) {
            this.restoreFromHistory(this.currentMoveIndex + 1);
        }
    }
    
    goToFirstMove() {
        this.restoreFromHistory(-1);
    }
    
    goToLastMove() {
        this.restoreFromHistory(this.moveHistory.length - 1);
    }
    
    updateMoveControls() {
        const prevBtn = document.getElementById('prevMoveBtn');
        const nextBtn = document.getElementById('nextMoveBtn');
        const firstBtn = document.getElementById('firstMoveBtn');
        const lastBtn = document.getElementById('lastMoveBtn');
        const counter = document.getElementById('moveCounter');
        
        if (prevBtn) prevBtn.disabled = this.currentMoveIndex < 0;
        if (nextBtn) nextBtn.disabled = this.currentMoveIndex >= this.moveHistory.length - 1;
        if (firstBtn) firstBtn.disabled = this.currentMoveIndex < 0;
        if (lastBtn) lastBtn.disabled = this.currentMoveIndex >= this.moveHistory.length - 1;
        if (counter) counter.textContent = `手数: ${this.currentMoveIndex + 1} / ${this.moveHistory.length}`;
    }
    
    updateMoveHistoryDisplay() {
        const listElement = document.getElementById('moveHistoryList');
        if (!listElement) return;
        
        listElement.innerHTML = '';
        
        this.moveHistory.forEach((move, index) => {
            const moveElement = document.createElement('div');
            moveElement.className = `move-item ${index === this.currentMoveIndex ? 'current' : ''}`;
            
            let moveText = '';
            if (move.type === 'move') {
                const pieceName = this.getPieceName(move.piece);
                const fromPos = this.positionToNotation(move.fromRow, move.fromCol);
                const toPos = this.positionToNotation(move.toRow, move.toCol);
                const promote = move.promoted ? '成' : '';
                moveText = `${index + 1}. ${move.turn === 'sente' ? '先手' : '後手'} ${pieceName}${fromPos}→${toPos}${promote}`;
                if (move.captured) {
                    moveText += ` (${this.getPieceName(move.captured)}を取る)`;
                }
            } else if (move.type === 'drop') {
                const pieceName = this.getPieceName(move.piece);
                const toPos = this.positionToNotation(move.toRow, move.toCol);
                moveText = `${index + 1}. ${move.turn === 'sente' ? '先手' : '後手'} ${pieceName}打${toPos}`;
            }
            
            moveElement.textContent = moveText;
            moveElement.addEventListener('click', () => {
                this.restoreFromHistory(index);
            });
            
            listElement.appendChild(moveElement);
        });
    }
    
    positionToNotation(row, col) {
        const colNames = ['９', '８', '７', '６', '５', '４', '３', '２', '１'];
        const rowNames = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
        return colNames[col] + rowNames[row];
    }

    reset() {
        this.board = this.initializeBoard();
        this.currentTurn = 'sente';
        this.selectedCell = null;
        this.selectedCapturedPiece = null;
        this.pendingPromotion = null;
        this.capturedPieces = { sente: [], gote: [] };
        this.gameOver = false;
        this.winner = null;
        this.moveHistory = [];
        this.currentMoveIndex = -1;
        this.isReplaying = false;
        // AIレベルを更新
        const aiLevelSelect = document.getElementById('aiLevel');
        if (aiLevelSelect) {
            this.aiLevel = aiLevelSelect.value;
            this.ai = new ShogiAI(this.aiLevel);
        }
        this.renderBoard();
        this.updateTurnIndicator();
        this.updateCapturedPieces();
        this.updateMoveControls();
        this.updateMoveHistoryDisplay();
        this.updateInstructionText();
        this.hideAIThinking();
        this.hidePromoteModal();
        this.exitReplayMode();
        
        // AI対AIモードの場合は最初からAIが手を打つ
        if (this.gameMode === 'ai-vs-ai') {
            // 少し遅延させてから開始（UI更新を待つ）
            setTimeout(() => {
                this.checkAndMakeAIMove();
            }, 100);
        }
    }
}

// AIプレイヤークラス
class ShogiAI {
    constructor(level = 'intermediate') {
        this.level = level;
        this.pieceValues = {
            'k': 10000, 'K': 10000, // 王
            'r': 500, 'R': 500,     // 飛
            'b': 400, 'B': 400,     // 角
            'g': 300, 'G': 300,     // 金
            's': 200, 'S': 200,     // 銀
            'n': 150, 'N': 150,     // 桂
            'l': 150, 'L': 150,     // 香
            'p': 100, 'P': 100,     // 歩
            '+r': 600, '+R': 600,   // 龍
            '+b': 550, '+B': 550,   // 馬
            '+s': 250, '+S': 250,   // 全
            '+n': 200, '+N': 200,   // 圭
            '+l': 200, '+L': 200,   // 杏
            '+p': 150, '+P': 150    // と
        };
    }

    getBestMove(game, turn) {
        const allMoves = game.getAllPossibleMoves(turn);
        if (allMoves.length === 0) return null;
        
        switch (this.level) {
            case 'beginner':
                return this.getBeginnerMove(allMoves, game, turn);
            case 'intermediate':
                return this.getIntermediateMove(allMoves, game, turn);
            case 'advanced':
                return this.getAdvancedMove(allMoves, game, turn);
            default:
                return this.getIntermediateMove(allMoves, game, turn);
        }
    }

    // 初級：ランダムまたは簡単な評価
    getBeginnerMove(allMoves, game, turn) {
        // 50%の確率でランダム、50%で簡単な評価
        if (Math.random() < 0.5) {
            const randomIndex = Math.floor(Math.random() * allMoves.length);
            return allMoves[randomIndex];
        }
        
        // 簡単な評価：取れる駒がある場合は優先
        let bestMove = null;
        let bestScore = -Infinity;
        
        for (const move of allMoves) {
            let score = 0;
            if (move.type === 'move') {
                const targetPiece = game.board[move.toRow][move.toCol];
                if (targetPiece) {
                    const pieceType = targetPiece.replace('+', '');
                    score = this.pieceValues[pieceType] || 0;
                }
            }
            
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        
        return bestMove || allMoves[Math.floor(Math.random() * allMoves.length)];
    }

    // 中級：基本的な評価関数
    getIntermediateMove(allMoves, game, turn) {
        let bestMove = null;
        let bestScore = -Infinity;
        
        for (const move of allMoves) {
            const score = this.evaluateMove(move, game, turn);
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        
        return bestMove || allMoves[0];
    }

    // 上級：ミニマックス法（簡易版）
    getAdvancedMove(allMoves, game, turn) {
        let bestMove = null;
        let bestScore = -Infinity;
        const depth = 2; // 探索深度
        
        for (const move of allMoves) {
            // 仮想的に手を打つ
            const gameCopy = this.cloneGame(game);
            this.makeMove(gameCopy, move, turn);
            
            // ミニマックス評価（簡易版）
            const score = this.minimax(gameCopy, depth - 1, turn === 'sente' ? 'gote' : 'sente', false);
            
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        
        return bestMove || this.getIntermediateMove(allMoves, game, turn);
    }

    // 手の評価
    evaluateMove(move, game, turn) {
        let score = 0;
        
        if (move.type === 'move') {
            const targetPiece = game.board[move.toRow][move.toCol];
            // 取れる駒の価値
            if (targetPiece) {
                const pieceType = targetPiece.replace('+', '');
                score += this.pieceValues[pieceType] || 0;
            }
            
            // 自分の駒の位置評価
            const fromPiece = game.board[move.fromRow][move.fromCol];
            if (fromPiece) {
                const pieceType = fromPiece.replace('+', '').toLowerCase();
                // 前進を評価（簡易版）
                if (turn === 'sente' && move.toRow < move.fromRow) {
                    score += 10;
                } else if (turn === 'gote' && move.toRow > move.fromRow) {
                    score += 10;
                }
            }
        } else if (move.type === 'drop') {
            // 持ち駒を打つ場合の評価
            const pieceValue = this.pieceValues[move.piece] || 0;
            score += pieceValue * 0.1; // 持ち駒を打つのは少しマイナス評価
            
            // 敵陣に打つ場合はプラス評価
            if (turn === 'sente' && move.toRow < 3) {
                score += 20;
            } else if (turn === 'gote' && move.toRow > 5) {
                score += 20;
            }
        }
        
        return score;
    }

    // ミニマックス法（簡易版）
    minimax(game, depth, turn, isMaximizing) {
        if (depth === 0) {
            return this.evaluatePosition(game, turn === 'sente' ? 'gote' : 'sente');
        }
        
        const moves = game.getAllPossibleMoves(turn);
        if (moves.length === 0) {
            return isMaximizing ? -Infinity : Infinity;
        }
        
        if (isMaximizing) {
            let maxScore = -Infinity;
            for (const move of moves.slice(0, 10)) { // 最初の10手のみ評価（パフォーマンス向上）
                const gameCopy = this.cloneGame(game);
                this.makeMove(gameCopy, move, turn);
                const score = this.minimax(gameCopy, depth - 1, turn === 'sente' ? 'gote' : 'sente', false);
                maxScore = Math.max(maxScore, score);
            }
            return maxScore;
        } else {
            let minScore = Infinity;
            for (const move of moves.slice(0, 10)) {
                const gameCopy = this.cloneGame(game);
                this.makeMove(gameCopy, move, turn);
                const score = this.minimax(gameCopy, depth - 1, turn === 'sente' ? 'gote' : 'sente', true);
                minScore = Math.min(minScore, score);
            }
            return minScore;
        }
    }

    // 局面評価
    evaluatePosition(game, myTurn) {
        let score = 0;
        
        // 盤上の駒の価値
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const piece = game.board[row][col];
                if (piece) {
                    const pieceType = piece.replace('+', '');
                    const value = this.pieceValues[pieceType] || 0;
                    
                    if ((myTurn === 'sente' && game.isSente(piece)) ||
                        (myTurn === 'gote' && game.isGote(piece))) {
                        score += value;
                    } else {
                        score -= value;
                    }
                }
            }
        }
        
        // 持ち駒の価値
        game.capturedPieces[myTurn].forEach(piece => {
            score += (this.pieceValues[piece] || 0) * 0.8;
        });
        
        const opponent = myTurn === 'sente' ? 'gote' : 'sente';
        game.capturedPieces[opponent].forEach(piece => {
            score -= (this.pieceValues[piece] || 0) * 0.8;
        });
        
        return score;
    }

    // ゲーム状態のクローン（簡易版）
    cloneGame(game) {
        const cloned = {
            board: game.board.map(row => [...row]),
            capturedPieces: {
                sente: [...game.capturedPieces.sente],
                gote: [...game.capturedPieces.gote]
            },
            currentTurn: game.currentTurn,
            isSente: (piece) => game.isSente(piece),
            isGote: (piece) => game.isGote(piece),
            getPossibleMoves: (row, col) => game.getPossibleMoves(row, col),
            getAllPossibleMoves: (turn) => game.getAllPossibleMoves(turn),
            isValidPosition: (row, col) => game.isValidPosition(row, col)
        };
        return cloned;
    }

    // 仮想的に手を打つ
    makeMove(game, move, turn) {
        if (move.type === 'move') {
            const piece = game.board[move.fromRow][move.fromCol];
            const captured = game.board[move.toRow][move.toCol];
            
            if (captured) {
                const capturedPiece = captured.replace('+', '').toLowerCase();
                game.capturedPieces[turn].push(capturedPiece);
            }
            
            game.board[move.toRow][move.toCol] = piece;
            game.board[move.fromRow][move.fromCol] = null;
            
            // 成りの判定（AIは基本的に成る）
            const canPromote = (turn === 'sente' && (move.toRow < 3 || move.fromRow < 3)) ||
                              (turn === 'gote' && (move.toRow > 5 || move.fromRow > 5));
            if (canPromote && !piece.includes('+') && piece.toLowerCase() !== 'k' && piece.toLowerCase() !== 'g') {
                // AIは基本的に成る（評価関数で最適な選択をしている）
                game.board[move.toRow][move.toCol] = '+' + piece;
            }
        } else if (move.type === 'drop') {
            const pieceType = move.piece.toLowerCase();
            const droppedPiece = turn === 'sente' ? pieceType.toUpperCase() : pieceType;
            game.board[move.toRow][move.toCol] = droppedPiece;
            
            const index = game.capturedPieces[turn].indexOf(pieceType);
            if (index > -1) {
                game.capturedPieces[turn].splice(index, 1);
            }
        }
    }
}

// ゲーム開始
let game;
window.addEventListener('DOMContentLoaded', () => {
    game = new ShogiGame();
    
    // 初期状態のgameModeを確認（HTMLの選択状態から取得）
    const gameModeSelect = document.getElementById('gameMode');
    if (gameModeSelect) {
        game.gameMode = gameModeSelect.value;
    }
    
    // AI対AIモードの場合は最初からAIが手を打つ
    if (game.gameMode === 'ai-vs-ai') {
        // 少し遅延させてから開始（UI更新を待つ）
        setTimeout(() => {
            game.checkAndMakeAIMove();
        }, 200);
    }
});

