const express = require('express');
const http = require('http');
const path = require('path');
const socketIO = require('socket.io');
const app = express();
const server = new http.Server(app);
const io = socketIO(server);
const fs = require("fs");
global.document = {
  createElement: function(){
    // Canvas
    return {
      getContext: function() {
        return {};
      }
    };
  }
};
global.window = {};
var options = {
  render: {
    element: null,
    controller: {
      create: function() {},
      clear: function() {},
      world: function() {}
    }
  },
  input: {
    mouse: {}
  }
};
const Matter = require('matter-js/build/matter.js');
const Engine = Matter.Engine,
    Render = Matter.Render,
    World = Matter.World,
    Bodies = Matter.Bodies;
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
//collision groups
const COLLISION_GROUPS = {
    PLAYER: Math.pow(2, 0),
    OBJECT: Math.pow(2, 1),
    ITEM: Math.pow(2, 2),
    NONE: 0,
    ALL: -1
}
//the weapon types
const WEAPONS = {
    FISTS: 0
}
//weapon damage
const WEAPON_DAMAGE = [15];
//cooldown for each weapon (in seconds)
const WEAPON_COOLDOWN = [0.3];
//which boolean for each hand
const HAND = {
    LEFT: true,
    RIGHT: false
}

/** hopefully helpful helpers **/
//get a ramdom alphanumeric ID
const getId = () => {
    return Math.random().toString(36).substr(2, 5);
}
//rotate a set of coordinates
function rotate(posX, posY, angle) {
  let x = Math.cos(angle) * posX - Math.sin(angle) * posY;
  let y = Math.sin(angle) * posX + Math.cos(angle) * posY;
  return {
    x: x,
    y: y
  }
}
//get absolute position of hand
const getHandPos = (player, handPos, hand) => {
    let xOff = PLAYER_SIZE * (Math.sin(15));
    let yPos = PLAYER_SIZE * (Math.cos(15));
    let coords = rotate((handPos.x) + xOff * (hand ? 1 : -1), handPos.y + yPos, player.pos.rot);
    return coords;
    
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
                physics: Engine.create()
            }
            games[roomId].physics.world.gravity.y = 0;
            
            let topWall = Bodies.rectangle(WAITING_MAP_SIZE / 2, -5, WAITING_MAP_SIZE, 10, {isStatic: true});
            topWall.collisionFilter.category = COLLISION_GROUPS.OBJECT;
            topWall.collisionFilter.mask = COLLISION_GROUPS.ALL;
            topWall.label = "topWall";
            World.add(games[roomId].physics.world, topWall);
            
            let bottomWall = Bodies.rectangle(WAITING_MAP_SIZE / 2, WAITING_MAP_SIZE + 5, WAITING_MAP_SIZE, 10, {isStatic: true});
            bottomWall.collisionFilter.category = COLLISION_GROUPS.OBJECT;
            bottomWall.collisionFilter.mask = COLLISION_GROUPS.ALL;
            bottomWall.label = "bottomWall";
            World.add(games[roomId].physics.world, bottomWall);
            
            let leftWall = Bodies.rectangle(-5, WAITING_MAP_SIZE / 2, 10, WAITING_MAP_SIZE, {isStatic: true});
            leftWall.collisionFilter.category = COLLISION_GROUPS.OBJECT;
            leftWall.collisionFilter.mask = COLLISION_GROUPS.ALL;
            leftWall.label = "leftWall";
            World.add(games[roomId].physics.world, leftWall);
            
            let rightWall = Bodies.rectangle(WAITING_MAP_SIZE + 5, WAITING_MAP_SIZE / 2, 10, WAITING_MAP_SIZE, {isStatic: true});
            rightWall.collisionFilter.category = COLLISION_GROUPS.OBJECT;
            rightWall.collisionFilter.mask = COLLISION_GROUPS.ALL;
            rightWall.label = "rightWall";
            World.add(games[roomId].physics.world, rightWall);
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
        let x = Math.floor(Math.random() * (WAITING_MAP_SIZE - PLAYER_SIZE * 2)) + PLAYER_SIZE,
            y = Math.floor(Math.random() * (WAITING_MAP_SIZE - PLAYER_SIZE * 2)) + PLAYER_SIZE;
        games[roomId].players[socket.id] = {
            name: name,
            team: team,
            pos: {
                x: x,
                y: y,
                rot:0,
                rightHand: {
                    x: 0,
                    y: 0,
                },
                leftHand: {
                    x: 0,
                    y: 0,
                }
            },
            movement: {},
            weapon: WEAPONS.FISTS,
            isPunching: false,
            hand: undefined,
            cooldown: 0,
            hp: 100,
            body: Bodies.circle(x, y, PLAYER_SIZE)
        }
        let player = games[roomId].players[socket.id];
        player.body.collisionFilter.category = COLLISION_GROUPS.PLAYER;
        player.body.collisionFilter.mask = COLLISION_GROUPS.ITEM + COLLISION_GROUPS.OBJECT;
        
        World.add(games[roomId].physics.world, games[roomId].players[socket.id].body);

        console.log(`${name} joined room ${roomId} in team ${TEAM_NAMES[team]}`);
    });
    
    //handle movement events
    socket.on("movement", (data) => {
        if(!playerRooms[socket.id]) return;
        games[playerRooms[socket.id]].players[socket.id].movement = data;
        games[playerRooms[socket.id]].players[socket.id].pos.rot = data.angle;
    })
    
    //handle attack events
    socket.on("attack", () => {
        if(!playerRooms[socket.id]) return;
        let player = games[playerRooms[socket.id]].players[socket.id];
        if(player.cooldown > 0) return;
        switch(player.weapon){
            case WEAPONS.FISTS:
                player.isPunching = true;
                let hand = Math.floor(Math.random() * 2) == 0;
                let finalX = (hand ? -15 : 15);
                let finalY = -20;
                let xInc = finalX / (30 * WEAPON_COOLDOWN[WEAPONS.FISTS]);
                let yInc = finalY / (30 * WEAPON_COOLDOWN[WEAPONS.FISTS]);
                player.hand = hand;
                let id = setInterval(() => {
                    if(player.pos[hand ? "leftHand" : "rightHand"].y <= finalY) return;
                    player.pos[hand ? "leftHand" : "rightHand"].x += xInc;
                    player.pos[hand ? "leftHand" : "rightHand"].y += yInc;
                }, 1000 / 60);
                setTimeout(() => {
                    clearInterval(id);
                    player.isPunching = false;
                    player.cooldown = WEAPON_COOLDOWN[WEAPONS.FISTS] * 60;
                    let id2 = setInterval(() => {
                        if(player.pos[hand ? "leftHand" : "rightHand"].y >= 0){
                            player.pos[hand ? "leftHand" : "rightHand"].x = 0;
                            player.pos[hand ? "leftHand" : "rightHand"].y = 0;
                            return;
                        }
                        player.pos[hand ? "leftHand" : "rightHand"].x -= xInc;
                        player.pos[hand ? "leftHand" : "rightHand"].y -= yInc;
                    }, 1000 / 60);
                    setTimeout(() => {
                        clearInterval(id2);
                        player.pos[hand ? "leftHand" : "rightHand"].x = 0;
                        player.pos[hand ? "leftHand" : "rightHand"].y = 0;
                    }, WEAPON_COOLDOWN[WEAPONS.FISTS] * 500);
                }, WEAPON_COOLDOWN[WEAPONS.FISTS] * 500);
                break;
        }
    });
    
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
                    
                    //reset boundary locations
                    let bodies = Matter.Composite.allBodies(games[i].physics.world);
                    for(let k = 0; k < bodies.length; k++){
                        switch(bodies[k].label){
                            case "bottomWall":
                                Matter.Body.scale(bodies[k], MAP_SIZE / WAITING_MAP_SIZE, 1);
                                Matter.Body.setPosition(bodies[k], {x:MAP_SIZE / 2, y:MAP_SIZE + 5});
                                break;
                            case "topWall":
                                Matter.Body.scale(bodies[k], MAP_SIZE / WAITING_MAP_SIZE, 1);
                                Matter.Body.setPosition(bodies[k], {x:MAP_SIZE / 2, y:-5});
                                break;
                            case "leftWall":
                                Matter.Body.scale(bodies[k], 1, MAP_SIZE / WAITING_MAP_SIZE);
                                Matter.Body.setPosition(bodies[k], {x:-5, y:MAP_SIZE / 2});
                                break;
                            case "rightWall":
                                Matter.Body.scale(bodies[k], 1, MAP_SIZE / WAITING_MAP_SIZE);
                                Matter.Body.setPosition(bodies[k], {x:MAP_SIZE + 5, y:MAP_SIZE / 2});
                                break;
                        }
                    }
                    let body = Bodies.rectangle(MAP_SIZE / 2, BASE_SIZE / 2 + PLAYER_SIZE * 2, BASE_SIZE, BASE_SIZE, {isStatic: true});
                    body.collisionFilter.category = COLLISION_GROUPS.OBJECT;
                    body.collisionFilter.mask = COLLISION_GROUPS.ALL;
                    World.add(games[i].physics.world, body);
                    games[i].bases[TEAMS.RED] = {
                        pos: {
                            x: MAP_SIZE / 2,
                            y: BASE_SIZE / 2 + PLAYER_SIZE * 2,
                            rot: 180
                        },
                        hp: BASE_HP,
                        team: TEAMS.RED,
                        body: body
                    }
                    body = Bodies.rectangle(MAP_SIZE - BASE_SIZE / 2 - PLAYER_SIZE * 2, MAP_SIZE / 2, BASE_SIZE, BASE_SIZE, {isStatic: true});
                    body.collisionFilter.category = COLLISION_GROUPS.OBJECT;
                    body.collisionFilter.mask = COLLISION_GROUPS.ALL;
                    World.add(games[i].physics.world, body);
                    games[i].bases[TEAMS.GREEN] = {
                        pos: {
                            x: MAP_SIZE - BASE_SIZE / 2 - PLAYER_SIZE * 2,
                            y: MAP_SIZE / 2,
                            rot: -90
                        },
                        hp: BASE_HP,
                        team: TEAMS.GREEN,
                        body: body
                    }
                    body = Bodies.rectangle(MAP_SIZE / 2, MAP_SIZE - BASE_SIZE / 2 - PLAYER_SIZE * 2, BASE_SIZE, BASE_SIZE, {isStatic: true});
                    body.collisionFilter.category = COLLISION_GROUPS.OBJECT;
                    body.collisionFilter.mask = COLLISION_GROUPS.ALL;
                    World.add(games[i].physics.world, body);
                    games[i].bases[TEAMS.BLUE] = {
                        pos: {
                            x: MAP_SIZE / 2,
                            y: MAP_SIZE - BASE_SIZE / 2 - PLAYER_SIZE * 2,
                            rot: 0
                        },
                        hp: BASE_HP,
                        team: TEAMS.BLUE,
                        body: body
                    }
                    body = Bodies.rectangle(BASE_SIZE / 2 + PLAYER_SIZE * 2, MAP_SIZE / 2, BASE_SIZE, BASE_SIZE, {isStatic: true});
                    body.collisionFilter.category = COLLISION_GROUPS.OBJECT;
                    body.collisionFilter.mask = COLLISION_GROUPS.ALL;
                    World.add(games[i].physics.world, body);
                    games[i].bases[TEAMS.YELLOW] = {
                        pos: {
                            x: BASE_SIZE / 2 + PLAYER_SIZE * 2,
                            y: MAP_SIZE / 2,
                            rot: 90
                        },
                        hp: BASE_HP,
                        team: TEAMS.YELLOW,
                        body: body
                    }
                    for(let j in games[i].players){
                        //morph into playing state
                        io.in(i).emit("state change", STATES.PLAYING);
                        
                        //reset player location
                        let pos = games[i].bases[games[i].players[j].team].pos;
                        let x;
                        let y;
                        switch(games[i].players[j].team){
                            case TEAMS.YELLOW:
                                x = pos.x - BASE_SIZE / 2;
                                y = pos.y;
                                break;
                            case TEAMS.RED:
                                x = pos.x;
                                y = pos.y - BASE_SIZE / 2;
                                break;
                            case TEAMS.GREEN:
                                x = pos.x + BASE_SIZE / 2;
                                y = pos.y;
                                break;
                            case TEAMS.BLUE:
                                x = pos.x;
                                y = pos.y + BASE_SIZE / 2;
                        }
                        games[i].players[j].pos.x = x;
                        games[i].players[j].pos.y = y;
                        Matter.Body.setPosition(games[i].players[j].body, {x:x, y:y});
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
                
                Matter.Body.setVelocity(player.body, {x:vx, y:vy});
            }
            
            Engine.update(games[i].physics);
            
            //update each player
            for(let j in games[i].players){
                let player = games[i].players[j];
                player.pos.x = player.body.position.x;
                player.pos.y = player.body.position.y;
                player.cooldown--;
                
                if(player.isPunching){
                    let xOff = PLAYER_SIZE * (Math.sin(15));
                    let yPos = PLAYER_SIZE * (Math.cos(15));
                    let handPos = player.pos[player.hand ? "leftHand" : "rightHand"];
                    let coords = rotate((handPos.x) + xOff * (player.hand ? 1 : -1), handPos.y + yPos, player.pos.rot);
                    
                    //detect hits with bases
                    
                }
            }
        }
        let emit = {
            players: {},
            state: games[i].state,
            map: games[i].map,
            bases: [],
            waitTime: games[i].waitTime
        }
        for(let j in games[i].players){
            let player = games[i].players[j];
            emit.players[j] = {
                team: player.team,
                pos: player.pos
            }
        }
        for(let j = 0; j < games[i].bases.length; j++){
            let base = games[i].bases[j];
            emit.bases[j] = {
                pos: base.pos,
                hp: base.pos,
                team: base.team
            }
        }
        io.in(i).emit("state", emit);
    }
}, 1000 / 60);