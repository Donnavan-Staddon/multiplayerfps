const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let players = {};

const obstacles = [
    { x: 0, z: -10, size: 3 },
    { x: 10, z: 5, size: 2 },
    { x: -10, z: 5, size: 2 },
    { x: 5, z: 15, size: 2 },
    { x: -5, z: -15, size: 2 },
    { x: 0, z: 10, size: 3 },
];

// ADDED: Buildings Data
const buildings = [
    { x: -20, z: -10, w: 8, h: 12, d: 10 },
    { x: 20, z: 10, w: 6, h: 20, d: 6 },
    { x: 0, z: 25, w: 15, h: 8, d: 5 }
];

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    const team = Object.keys(players).length % 2 === 0 ? 'green' : 'brown';
    const spawnX = team === 'green' ? -15 : 15;
    
    players[socket.id] = {
        id: socket.id,
        team: team,
        x: spawnX, y: 0, z: 0,
        ry: 0, rx: 0,
        health: 100,
        weapon: 'sniper',
        isWalking: false,
        kills: 0
    };

    // UPDATED: Included buildings in the init data
    socket.emit('init', { id: socket.id, players, obstacles, buildings });
    socket.broadcast.emit('newPlayer', players[socket.id]);
    io.emit('scoreUpdate', players);

    socket.on('move', (data) => {
        if (players[socket.id]) {
            Object.assign(players[socket.id], data);
            socket.broadcast.emit('update', players[socket.id]);
        }
    });

    socket.on('weaponSwitch', (data) => {
        if (players[socket.id]) {
            players[socket.id].weapon = data.weapon;
            socket.broadcast.emit('playerSwitchedWeapon', { id: socket.id, weapon: data.weapon });
        }
    });

    socket.on('shoot', (data) => {
        socket.broadcast.emit('playerShot', { id: socket.id, weapon: data.weapon });
    });

    socket.on('playerHit', (data) => {
        let victim = players[data.targetId];
        let shooter = players[socket.id];
        if (!victim || !shooter) return;
        victim.health -= data.damage;
        if (victim.health <= 0) {
            shooter.kills++;
            io.emit('killMessage', { killer: socket.id, victim: data.targetId, isHeadshot: data.damage >= 100 });
            io.emit('scoreUpdate', players);
            const respawnX = victim.team === 'green' ? -15 : 15;
            victim.health = 100;
            victim.x = respawnX;
            victim.z = 0;
            io.emit('playerRespawned', { id: victim.id, x: victim.x, z: victim.z, isHeadshot: data.damage >= 100 });
        } else {
            io.emit('healthUpdate', { id: victim.id, health: victim.health });
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('removePlayer', socket.id);
        io.emit('scoreUpdate', players);
    });
});

const PORT = 3000;
http.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));