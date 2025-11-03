// jokenpo-backend/server.js
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';

// --- Configurações de Ambiente ---
const PORT = process.env.PORT || 4000; // Use uma porta diferente do padrão 3000 do Next.js
                                        // O Render usará a variável de ambiente PORT.

// O Render fornecerá a URL do seu frontend.
// Se você está desenvolvendo localmente, use o localhost do Next.js:
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000"; 


// --- Estrutura de Gerenciamento de Partidas ---
let rooms = {}; 

// --- Lógica do Jogo (Função auxiliar) ---
const determineWinner = (p1Choice, p2Choice, p1Id, p2Id) => {
    const rules = {
        'rock': 'scissors',
        'scissors': 'paper',
        'paper': 'rock',
    };

    if (p1Choice === p2Choice) {
        return { message: 'Empate!', winnerId: null, player1Choice: p1Choice, player2Choice: p2Choice };
    } else if (rules[p1Choice] === p2Choice) {
        return { message: 'Você venceu!', winnerId: p1Id, player1Choice: p1Choice, player2Choice: p2Choice };
    } else {
        return { message: 'Seu oponente venceu!', winnerId: p2Id, player1Choice: p1Choice, player2Choice: p2Choice };
    }
};


const app = express();
const httpServer = createServer(app);

// --- Configuração do Socket.IO com CORS ---
// O Render fará o deploy do backend em uma URL e do frontend em outra.
// É VITAL permitir a conexão do Frontend (FRONTEND_URL)
const io = new Server(httpServer, {
    cors: {
        origin: FRONTEND_URL, // Permite APENAS o seu frontend se conectar
        methods: ["GET", "POST"]
    }
});


// --- Rota Simples de Status do Express ---
app.get('/status', (req, res) => {
    res.json({ 
        status: 'ok', 
        server: 'express-socketio-pure',
        port: PORT,
        frontend_allowed: FRONTEND_URL
    });
});


// --- Lógica do Socket.IO (A mesma de antes) ---
io.on('connection', (socket) => {
    console.log(`[Socket] Usuário conectado: ${socket.id}`);

    socket.on('findMatch', () => {
        let roomToJoin = null;

        for (const room in rooms) {
            if (rooms[room].players.length === 1) {
                roomToJoin = room;
                break;
            }
        }

        if (roomToJoin) {
            socket.join(roomToJoin);
            rooms[roomToJoin].players.push({ id: socket.id, choice: null, score: 0 });
            console.log(`[Partida] Partida fechada na sala: ${roomToJoin}`);
            io.to(roomToJoin).emit('matchStart', { 
                roomId: roomToJoin, 
                players: rooms[roomToJoin].players.map(p => p.id) 
            });
        } else {
            const newRoomId = socket.id; 
            socket.join(newRoomId);
            rooms[newRoomId] = {
                players: [{ id: socket.id, choice: null, score: 0 }], 
                roomId: newRoomId
            };
            console.log(`[Partida] Aguardando na sala: ${newRoomId}`);
            socket.emit('waitingForOpponent', { roomId: newRoomId });
        }
    });

    socket.on('makeChoice', ({ roomId, choice }) => {
        const room = rooms[roomId];
        if (!room || room.players.length < 2) return;

        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
            room.players[playerIndex].choice = choice;
            
            const p1 = room.players[0]; 
            const p2 = room.players[1]; 

            if (p1.choice && p2.choice) {
                const result = determineWinner(p1.choice, p2.choice, p1.id, p2.id);
                
                const winner = room.players.find(p => p.id === result.winnerId);
                if (winner) winner.score += 1;
                
                p1.choice = null;
                p2.choice = null; 

                io.to(roomId).emit('roundResult', { 
                    result: result.message, 
                    scores: room.players.map(p => ({ id: p.id, score: p.score })),
                });
            } else {
                socket.emit('waitingForOpponentChoice');
                socket.to(roomId).emit('opponentMadeChoice'); 
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`[Socket] Usuário desconectado: ${socket.id}`);
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            
            if (playerIndex !== -1) {
                delete rooms[roomId]; 
                console.log(`[Partida] Sala ${roomId} removida por desconexão.`);
                io.to(roomId).emit('opponentDisconnected');
                break;
            }
        }
    });
});


// --- Inicia o Servidor ---
httpServer
    .once('error', (err) => {
        console.error(err);
        process.exit(1);
    })
    .listen(PORT, () => {
        console.log(`> Servidor Express/Socket.IO puro pronto na porta ${PORT}`);
        console.log(`> Frontend permitido: ${FRONTEND_URL}`);
    });