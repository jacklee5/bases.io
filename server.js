const express = require('express');
const http = require('http');
const path = require('path');
const socketIO = require('socket.io');
const app = express();
const server = new http.Server(app);
const io = socketIO(server);
const fs = require("fs");
const p2 = require("p2");
app.set('port', 5000);
app.use('/static', express.static(__dirname + '/static'));
// Routing
app.get('/', function(request, response) {
  response.sendFile(path.join(__dirname, 'index.html'));
});
// Starts the server.
const PORT = process.env.PORT || 5000;
server.listen(PORT, function() {
  console.log('Starting server on port 5000');
});

/** cool constant corner **/
//the maximum amount of players per game.
const MAX_PLAYERS = 40;
//numbers corresponding to each team
const TEAMS = {
    RED: 0,
    GREEN: 1,
    BLUE: 2,
    YELLOW: 3
}
//name corresponding to each number
const TEAM_NAMES = ["red", "green", "blue", "yellow"];
//numbers corresponding to game state
const STATES = {
    MATCHING: 0,
    WAITING: 1,
    PLAYING: 2
}
//wait time in seconds
const WAIT_TIME = 5;
//size of the map during waiting
const WAITING_MAP_SIZE = 500;
//the actual size of the map
const MAP_SIZE = 1000;
//the size of the player
const PLAYER_SIZE = 25;
//the movement speed of the players
const MOVEMENT_SPEED = 4;
//base size
const BASE_SIZE = 200;
//starting hp for base
const BASE_HP = 1000;

/** hopefully helpful helpers **/
//get a ramdom alphanumeric ID
const getId = () => {
    return Math.random().toString(36).substr(2, 5);
}

/** viciously vivacious variables **/
//stores all the games
let games = {};
//stores the room each player is in
let playerRooms = {};
io.on("connection", (socket) => {
    socket.on("new player", (name) => {
        if(!name) return;
        if(!(name.length > 0 && name.length <= 20)) return;
        if(playerRooms[socket.id]) return;
        
        //the id of the room to be joined
        let roomId;
        if(Object.keys(games).length === 0){
            roomId = getId();
        }else{
            for(let i in games){
                if(Object.keys(games[i].players).length < MAX_PLAYERS && games[i].state < 2){
                    roomId = i;
                    break;
                }
            }
        }
        
        //initialize game if not already exists
        if(!games[roomId]){
            games[roomId] = {
                players: {},
                circlePos: {},
                state: STATES.MATCHING,
                map: {},
                waitTime: WAIT_TIME * 60,
                bases: [],
                physics: new p2.World({
                    gravity:[0, -9.82]
                })
            }
        }
        
        //add player to room
        playerRooms[socket.id] = roomId;
        socket.join(roomId);
        
        //determine team
        //number of players per team
        let teamCounts = [0, 0, 0, 0];
        for(let i in games[roomId].players){
            teamCounts[games[roomId].players[i].team]++;
        }
        let team = teamCounts.indexOf(Math.min(...teamCounts));
        
        //add player to room
        games[roomId].players[socket.id] = {
            name: name,
            team: team,
            pos: {
                x: Math.floor(Math.random() * WAITING_MAP_SIZE),
                y: Math.floor(Math.random() * WAITING_MAP_SIZE),
                rot:0,
                rightHand: {
                    x: 0,
                    y: 0
                },
                leftHand: {
                    x: 0,
                    y: 0
                }
            },
            movement: {},
        }
        //add player to physics
        let playerBody = new p2.Body({
            mass: 5,
            position: [games[roomId].players[socket.id].pos.x, games[roomId].players[socket.id].pos.y],
            id: `player${socket.id}`
        });
        playerBody.addShape(new p2.Circle({radius: PLAYER_SIZE}));
        games[roomId].physics.addBody(playerBody);

        console.log(`${name} joined room ${roomId} in team ${TEAM_NAMES[team]}`);
    });
    
    //handle movement events
    socket.on("movement", (data) => {
        if(!playerRooms[socket.id]) return;
        games[playerRooms[socket.id]].players[socket.id].movement = data;
        games[playerRooms[socket.id]].players[socket.id].pos.rot = data.angle;
    })
    
    //remove player on disconnection
    socket.on("disconnect", () => {
        if(playerRooms[socket.id]){
            if(games[playerRooms[socket.id]].state === STATES.MATCHING){
                delete games[playerRooms[socket.id]].players[socket.id];
            }
            delete playerRooms[socket.id];
            console.log("removed a player");
        }
    })
});

//game loop
setInterval(() => {
    for(let i in games){
        switch(games[i].state){
            case STATES.MATCHING:
                if(Object.keys(games[i].players).length >= 4){
                    games[i].state = STATES.WAITING;
                    games[i].map.size = WAITING_MAP_SIZE;
                    io.in(i).emit("state change", STATES.WAITING);
                }
                break;
            case STATES.WAITING:
                games[i].waitTime--;
                if(games[i].waitTime === 0){
                    games[i].state = STATES.PLAYING;
                    io.in(i).emit("state change", STATES.PLAYING);
                    games[i].map.size = MAP_SIZE;
                    for(let j in games[i].players){
                        //morph into playing state
                        games[i].players[j].pos.x = Math.floor(Math.random() * MAP_SIZE);
                        games[i].players[j].pos.y = Math.floor(Math.random() * MAP_SIZE);
                        games[i].physics.getBodyById(`player${j}`).position = [games[i].players[j].pos.x, games[i].players[j].pos.y]
                        games[i].bases[TEAMS.RED] = {
                            pos: {
                                x: MAP_SIZE / 2,
                                y: BASE_SIZE / 2 + PLAYER_SIZE * 2,
                                rot: 180
                            },
                            hp: BASE_HP,
                            team: TEAMS.RED
                        }
                        games[i].bases[TEAMS.GREEN] = {
                            pos: {
                                x: MAP_SIZE - BASE_SIZE / 2 - PLAYER_SIZE * 2,
                                y: MAP_SIZE / 2,
                                rot: -90
                            },
                            hp: BASE_HP,
                            team: TEAMS.GREEN
                        }
                        games[i].bases[TEAMS.BLUE] = {
                            pos: {
                                x: MAP_SIZE / 2,
                                y: MAP_SIZE - BASE_SIZE / 2 - PLAYER_SIZE * 2,
                                rot: 0
                            },
                            hp: BASE_HP,
                            team: TEAMS.BLUE
                        }
                        games[i].bases[TEAMS.YELLOW] = {
                            pos: {
                                x: BASE_SIZE / 2 + PLAYER_SIZE * 2,
                                y: MAP_SIZE / 2,
                                rot: 90
                            },
                            hp: BASE_HP,
                            team: TEAMS.YELLOW
                        }
                    }
                }
                
        }
        if(games[i].state > STATES.MATCHING){
            //move each player
            for(let j in games[i].players){
                let player = games[i].players[j];
                let m = player.movement;
                let vx = 0;
                let vy = 0;
                
                if(m.up) vy -= MOVEMENT_SPEED
                if(m.down) vy += MOVEMENT_SPEED;
                if(m.left) vx -= MOVEMENT_SPEED;
                if(m.right) vx += MOVEMENT_SPEED;
                
                if(vx && vy){
                    vx /= Math.sqrt(2);
                    vy /= Math.sqrt(2);
                }
                games[i].physics.getBodyById(`player${j}`).velocity = [vx, vy];
            }  
            games[i].physics.step(1);
            for(let j in games[i].players){
                let pos = games[i].physics.getBodyById(`player${j}`).position;
                games[i].players[j].pos.x = pos[0];
                games[i].players[j].pos.y = pos[1];
            }
        }
        let emit = {
            players: games[i].players,
            state: games[i].state,
            map: games[i].map,
            bases: games[i].bases,
            waitTime: games[i].waitTime
        }
        io.in(i).emit("state", emit);
    }
}, 1000 / 60);