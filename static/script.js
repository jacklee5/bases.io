/** cool constant corner **/
const socket = io();
//corresponds to the index of each page
const PAGES = {
    START: 0,
    GAME: 1
}
//numbers corresponding to game state
const STATES = {
    MATCHING: 0,
    WAITING: 1,
    PLAYING: 2
}
//colors :))
const COLORS = {
    GREEN: "#429B34",
    BLUE: "#407CBD",
    SKIN: "#ffe0bd"
}
//the size of the player
const PLAYER_SIZE = 25;

//canvas setup
let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d");
let width = canvas.offsetWidth;
let height = canvas.offsetHeight;
canvas.width = width;
canvas.height = height;
window.addEventListener("resize", () => {
    width = canvas.offsetWidth;
    height = canvas.offsetHeight;
    canvas.width = width;
    canvas.height = height;
    GRID_SIZE = Math.floor(Math.min(width / GRID_WIDTH, height / GRID_HEIGHT));
    OFFSET_Y = (height - GRID_SIZE * GRID_HEIGHT) / 2;
    OFFSET_X = (width - GRID_SIZE * GRID_WIDTH) / 2;
});

/** vivaciously vicious variables **/
//equivalent to games[i]
let game;
//equivalent to games[i].players[socket.id]
let player;
//the keys the player currently has down
let keys = {};
//the angle the player is facing
let angle;

/** hopefully helpful helpers **/
//make player join game
const joinGame = () => {
    let name = document.getElementById("name").value;
    if(name.length > 0){
        socket.emit("new player", name);
        setCookie("username", name, 365);
        showPage(PAGES.GAME);
        startGame();
    }
}
//set cookie
function setCookie(cname, cvalue, exdays) {
  var d = new Date();
  d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
  var expires = "expires=" + d.toUTCString();
  document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}
//get cookie
function getCookie(cname) {
  var name = cname + "=";
  var decodedCookie = decodeURIComponent(document.cookie);
  var ca = decodedCookie.split(';');
  for (var i = 0; i < ca.length; i++) {
    var c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}
//change page by index
const showPage = (index) => {
    let pages = document.getElementsByClassName("page");
    for(let i = 0; i < pages.length; i++){
        pages[i].style.display = "none";
    }
    pages[index].style.display = "block";
}
//world to screen coordinate conversion
const w2s = (x, y) => {
    return [x - player.pos.x + width / 2, y - player.pos.y + height / 2];
}

/** artsy drawy functions **/
const drawPlayer = (pos) => {
    let x = pos.x;
    let y = pos.y;
    let rot = pos.rot;
    let leftHand = pos.leftHand;
    let rightHand = pos.rightHand;
    let coords = w2s(x,y);
    if(!(coords[0] + PLAYER_SIZE > 0 && coords[0] - PLAYER_SIZE < width && coords[1] + PLAYER_SIZE > 0 && coords[1] - PLAYER_SIZE < height)) return;
    
    ctx.save();
    ctx.translate(coords[0], coords[1]);
    
    //body
    ctx.fillStyle = COLORS.SKIN;
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER_SIZE, 0, Math.PI * 2);
    ctx.fill();
    
    //hands
    ctx.rotate(rot);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    let armAngle = 15;
    let xOff = PLAYER_SIZE * (Math.sin(armAngle));
    let yOff = PLAYER_SIZE * (Math.cos(armAngle));
    
    //left hand
    ctx.beginPath();
    ctx.arc(xOff + leftHand.x, yOff + leftHand.y, 7, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    //right hand
    ctx.beginPath();
    ctx.arc(-xOff + rightHand.x, yOff + rightHand.y, 7, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    ctx.restore();
}

/** Fun and games **/
//sets up the game
const startGame = () => {
    //setup
    width = canvas.offsetWidth;
    height = canvas.offsetHeight;
    canvas.width = width;
    canvas.height = height;
    
    //socket event listeners
    socket.on("state", (data) => {
        player = data.players[socket.id];
        if(data.state === STATES.MATCHING){
            document.getElementById("matching").style.display = "block";
                document.getElementById("needed-players").innerHTML = 4 - Object.keys(data.players).length;
        }else{
            document.getElementById("matching").style.display = "none";
        }
        game = data;
    });
    
    //input event listeners
    document.addEventListener("keydown", (e) => {
        keys[e.key.toLowerCase()] = true;
        console.log(e.key);
    });
    document.addEventListener("keyup", (e) => {
        keys[e.key.toLowerCase()] = false;
    });
    document.addEventListener("mousemove", (e) => {
      angle = Math.atan2((e.clientX - width / 2), (height / 2 - e.clientY));
    });
    
    //send data to server
    setInterval(() => {
        socket.emit("movement", {
            up: keys["w"] || keys["arrowup"],
            down: keys["s"] || keys["arrowdown"],
            left: keys["a"] || keys["arrowleft"],
            right: keys["d"] || keys["arrowright"],
            angle: angle || 0
        })
    }, 1000 / 60)
    
    //draw game
    setInterval(drawGame, 1000 / 30);
}
//draws game
const drawGame = () => {    
    if(!game || !player) return;
    if(game.state === STATES.MATCHING) return;
    
    //draw background
    ctx.fillStyle = COLORS.BLUE;
    ctx.fillRect(0,0,width,height);
    
    //draw island
    ctx.fillStyle = COLORS.GREEN;
    ctx.fillRect(...w2s(0, 0), game.map.size, game.map.size);
    
    //draw players
    for(let i in game.players){
        drawPlayer(game.players[i].pos)
    }
}

//set username to previously saved one
document.getElementById("name").value = getCookie("username");

//do stuff when player hits play
document.getElementById("play").addEventListener("click", () => {
    joinGame();
});
document.getElementById("name").addEventListener("keydown", (e) => {
    if(e.keyCode === 13){
        joinGame();
    }
})