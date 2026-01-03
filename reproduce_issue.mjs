
// DOM Mocks for Node.js environment
const noop = () => { };
global.window = {
    addEventListener: noop,
    game: null
};
global.document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({
        style: {},
        classList: { add: noop, remove: noop },
        addEventListener: noop
    }),
    body: {
        appendChild: noop,
        removeChild: noop
    }
};
global.alert = console.log;
global.confirm = () => false;
global.URL = {
    createObjectURL: () => 'mock_url',
    revokeObjectURL: noop
};
global.Blob = class { };
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);

async function runTest() {
    const { ShogiGame } = await import('./game.js');
    const { PLAYER } = await import('./constants.js');

    console.log('--- Shogi Logic Reproduction Test ---');

    const game = new ShogiGame();
    // game.init() is not a method, checking constructor
    // Constructor calls initializeBoard.

    // Test 1: Simple Suicide Check (King moves to attacked square)
    console.log('\n[Test 1] Suicide Check: Sente King moves to 7,4 (attacked by Gote Gold at 6,4)');
    // Setup board
    // Sente King at 8,4 (5九)
    // Gote Gold at 6,4 (5七) - attacks 7,4 (5八)
    // Clear board
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) game.board[r][c] = null;

    game.board[8][4] = 'K'; // Sente King
    game.board[6][4] = 'g'; // Gote Gold
    game.pieceMoves.board = game.board;
    game.currentTurn = PLAYER.SENTE;

    // Verify setup
    console.log('Sente King at 8,4');
    console.log('Gote Gold at 6,4');
    const move = {
        type: 'move',
        fromRow: 8, fromCol: 4,
        toRow: 7, toCol: 4,
        piece: 'K'
    };

    const isSafe = game.isMoveSafe(move, PLAYER.SENTE);
    console.log(`isMoveSafe(8,4 -> 7,4): ${isSafe}`);

    if (isSafe) {
        console.error('FAIL: Suicide move was allowed!');
    } else {
        console.log('PASS: Suicide move was prevented.');
    }

    // Test 2: Moving piece leaving King in check (Pin)
    console.log('\n[Test 2] Pin Check: Sente Gold moves, leaving King exposed to Gote Rook');
    // Sente King at 8,4
    // Sente Gold at 7,4
    // Gote Rook at 5,4 (attacks file 4)
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) game.board[r][c] = null;
    game.board[8][4] = 'K';
    game.board[7][4] = 'G';
    game.board[5][4] = 'r';
    game.pieceMoves.board = game.board;
    game.currentTurn = PLAYER.SENTE;

    console.log('Sente King at 8,4');
    console.log('Sente Gold at 7,4');
    console.log('Gote Rook at 5,4');

    // Move Gold away from file 4 (e.g. 7,4 -> 7,5)
    // Rook(5,4) attacks King(8,4) through (6,4), (7,4)!
    // 6,4 is empty. 7,4 is Gold.
    const pinMove = {
        type: 'move',
        fromRow: 7, fromCol: 4,
        toRow: 7, toCol: 5,
        piece: 'G'
    };

    const isSafePin = game.isMoveSafe(pinMove, PLAYER.SENTE);
    console.log(`isMoveSafe(7,4 -> 7,5): ${isSafePin}`);

    if (isSafePin) {
        console.error('FAIL: Pinned piece move was allowed!');
        console.log('Debug: checking why isMoveSafe failed.');

        // Manually simulate state inside isMoveSafe
        const originalBoard = game.board.map(row => [...row]);
        game.board[7][5] = 'G';
        game.board[7][4] = null;
        game.pieceMoves.board = game.board; // Important for pieceMoves to see new state

        const inCheck = game.isInCheck(PLAYER.SENTE);
        console.log(`isInCheck(SENTE) manually check: ${inCheck}`);

        if (!inCheck) {
            // Why is it not in check?
            // Check opponent moves
            const opponent = PLAYER.GOTE;

            // Check directly rook moves!
            // game.getAllPseudoPossibleMoves calls PieceMoves.
            // Let's call PieceMoves directly.
            const rMoves = game.pieceMoves.getMovesForPiece(5, 4, 'r');
            console.log('Rook raw moves:', rMoves);
            const attacksKing = rMoves.some(m => m[0] === 8 && m[1] === 4);
            console.log(`Rook attacks 8,4? ${attacksKing}`);

            // Check getAllPseudoPossibleMoves
            const allMoves = game.getAllPseudoPossibleMoves(opponent);
            const hasMove = allMoves.some(m => m.toRow === 8 && m.toCol === 4);
            console.log(`getAllPseudoPossibleMoves includes attack on 8,4? ${hasMove}`);
        }

        game.board = originalBoard;
        game.pieceMoves.board = originalBoard;

    } else {
        console.log('PASS: Pinned piece move was prevented.');
    }
}

runTest().catch(console.error);
