const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const { Game } = require('./common/game-logic');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.use('/common', express.static(path.join(__dirname, 'common')));

const game = new Game();

io.on('connection', (socket) => {
    console.log('a user connected', socket.id);

    socket.on('join', (data) => {
        const name = data ? data.name : null;
        if (game.addPlayer(socket.id, name)) {
            socket.emit('joined', { playerId: socket.id });
            io.emit('player_update', { count: Object.keys(game.players).length });

            if (Object.keys(game.players).length === 2 && game.status === 'waiting') {
                game.startGame();
                io.emit('game_start', { newState: getPublicGameState() });
            }
        } else {
            socket.emit('error', 'Game full');
        }
    });

    socket.on('play_card', (data) => {
        // data: { source, sourceIndex, target, targetIndex }
        const result = game.playCard(socket.id, data.source, data.sourceIndex, data.target, data.targetIndex);
        if (result.success) {
            io.emit('game_update', { newState: getPublicGameState() });
        } else {
            socket.emit('error', result.message);
        }
    });

    socket.on('discard', (data) => {
        // data: { cardIndex, discardPileIndex }
        const result = game.discard(socket.id, data.cardIndex, data.discardPileIndex);
        if (result) {
            io.emit('game_update', { newState: getPublicGameState() });
        } else {
            socket.emit('error', 'Invalid discard');
        }
    });

    socket.on('disconnect', () => {
        console.log('user disconnected', socket.id);
        // Handle disconnect (reset game?)
        if (game.players[socket.id]) {
            delete game.players[socket.id];
            game.status = 'waiting';
            game.turn = null;
            // Reset logic or pause? For simplicity, reset.
            io.emit('player_update', { count: Object.keys(game.players).length });
            io.emit('game_reset', 'Player disconnected');
        }
    });
});

function getPublicGameState() {
    // Mask hands of other players? For now send distinct state per player?
    // Or just send everything and let client hide it (insecure but faster for dev).
    // Let's send a sanitized version if possible, but for 2 players, client.js can filter.
    // Actually, to show "opponent has 6 cards", we need that data.
    // Let's send full state to everyone for "1 hour" simplicity.
    return {
        players: game.players,
        centralScales: game.centralScales,
        turn: game.turn,
        status: game.status,
        drawPileCount: game.drawPile.length
    };
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`listening on *:${PORT}`);
});
