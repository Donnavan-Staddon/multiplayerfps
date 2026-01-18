const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

// This line tells Render that all your CSS, JS, and Models are inside the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// This line specifically tells Render to serve your index.html when someone visits the site
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

let players = {};

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    const team = Object.keys(players).length % 2 === 0 ? 'green' : 'brown';
    
    players[socket.id] = {
        id: socket.id,
        team: team,
        x: 0, y: 0, z: 0,
        ry: 0, rx: 0,
        health: 100,
        weapon: 'sniper',
        isWalking: false,
        kills: 0,
        isProtected: false
    };

    socket.emit('init', { id: socket.id, players });
    socket.broadcast.emit('newPlayer', players[socket.id]);
    io.emit('scoreUpdate', players);

    socket.on('move', (data) => {
        if (players[socket.id]) {
            Object.assign(players[socket.id], data);
            socket.broadcast.emit('update', players[socket.id]);
        }
    });

    socket.on('setProtection', (data) => {
        if (players[socket.id]) {
            players[socket.id].isProtected = data.protected;
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
        if (!victim || !shooter || victim.isProtected) return;

        victim.health -= data.damage;
        if (victim.health <= 0) {
            shooter.kills++;
            io.emit('killMessage', { killer: socket.id, victim: data.targetId, isHeadshot: data.damage >= 100 });
            io.emit('scoreUpdate', players);
            victim.health = 100;
            io.emit('playerRespawned', { id: victim.id, team: victim.team, isHeadshot: data.damage >= 100 });
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

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server running on port ${PORT}`));