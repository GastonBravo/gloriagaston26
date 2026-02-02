import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { Dealer } from './src/logic/Dealer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: "*" }
});

// CAMBIO SPEC 1: Servir archivos de producción
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Ruta explícita para la raíz y fallback para asegurar que index.html se sirva
app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

console.log('Sirviendo estáticos desde:', distPath);

const dealer = new Dealer();
let p1 = null;
let p2 = null;

io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);

    socket.on('join_game', (playerName) => {
        if (!p1) {
            p1 = { id: socket.id, name: playerName, socket };
            socket.emit('waiting_opponent');
        } else if (!p2) {
            p2 = { id: socket.id, name: playerName, socket };
            startGame();
        } else {
            socket.emit('error_message', 'Partida llena');
        }
    });

    socket.on('player_move', (move) => {
        // CAMBIO SPEC 1: Reenviar movimientos entre p1 y p2
        if (socket.id === p1?.id) {
            p2?.socket.emit('game_update', { move, from: 'opponent' });
            p1?.socket.emit('move_confirmed', { move }); // Confirmación para sonido
        } else if (socket.id === p2?.id) {
            p1?.socket.emit('game_update', { move, from: 'opponent' });
            p2?.socket.emit('move_confirmed', { move }); // Confirmación para sonido
        }
    });

    socket.on('disconnect', () => {
        if (socket.id === p1?.id) p1 = null;
        if (socket.id === p2?.id) p2 = null;
        io.emit('player_disconnected');
    });
});

function startGame() {
    const dealt = dealer.dealGame();

    // P1 recibe su estado y el resumen de P2
    p1.socket.emit('game_start', {
        role: 'p1',
        opponentName: p2.name,
        yourState: dealt.human,
        oppCount: { hand: dealt.opponent.hand.length, reserve: dealt.opponent.reserve.length }
    });

    // P2 recibe su estado (el del 'opponent' en el dealer) y el resumen de P1
    p2.socket.emit('game_start', {
        role: 'p2',
        opponentName: p1.name,
        yourState: dealt.opponent,
        oppCount: { hand: dealt.human.hand.length, reserve: dealt.human.reserve.length }
    });
}

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server unificado corriendo en http://localhost:${PORT}`);
});
