const blessed = require("blessed");
const { spawn } = require("child_process");
const execFile = require("child_process").execFile;
const fs = require("fs");
const path = require("path");

const rytsPath = ".\\ryts";
const mpvPath = ".\\mpv\\mpv"
const videoQuality = 720;

var screen = blessed.screen({
    smartCSR: true
});

screen.title = 'Youtube Search';

var status = blessed.box({
  parent: screen,
  top: 0,
  left: 'center',
  height: 1,
  width: 'shrink',
  style: {
    bg: 'black'
  },
  content: 'Select Option\n'
});

var mainMenu = blessed.list({
    parent: screen,
    top: 2,
    left: 'center',
    width: '15%',
    height: 'shrink',
    tags: true,
    keys:true,
    align: "center",
    style: {
        fg: '#004D0D',
        bg: 'black',
        border: {
            fg: '#f0f0f0'
        },
        selected:{
            fg:'black',
            bg:'#004D0D'
        }
    },
    items: ['search']
});

var searchList = blessed.list({
    parent: screen,
    hidden: true,
    top: 2,
    left: 'center',
    width: '70%',
    height: 'shrink',
    tags: true,
    keys:true,
    border: {
        type: 'line'
    },
    style: {
        fg: '#004D0D',
        bg: 'black',
        border: {
            fg: '#f0f0f0'
        },
        selected:{
            fg:'black',
            bg:'#004D0D'
        }
    },
    items: []
});

var queryPrompt = blessed.textbox({
    parent: screen,
    hidden:true,
    top: 2,
    left:"center",
    height:'shrink',
    width:"50%",
    border: {
        type:'line'
    },
    style: {
        item: {
            hover: {
                bg: 'blue'
            }
        }, 
        selected: {
            bg:'blue',
            bold:true
        }
    }
});

var searchOpts = blessed.list({
    parent: screen,
    top: 2,
    left: 'center',
    width: '15%',
    height: '30%',
    padding: 1,
    tags: true,
    keys:true,
    hidden:true,
    align: "center",
    border: {
        type: 'line'
    },
    style: {
        fg: '#004D0D',
        bg: 'black',
        border: {
            fg: '#f0f0f0'
        },
        selected:{
            fg:'black',
            bg:'#004D0D'
        }
    },
    items: ["general", "video", "channel", "playlist"]
});

var errorMsg = blessed.message({
    parent: screen,
    hidden:true,
    top:'center',
    left:'center',
    width:'80%',
    height:'80%',
    border: {
        type:'line'
    },
    style: {
        fg:'#004D0D',
        bg: 'black'
    }
});
 
var loadingBox = blessed.loading({
    parent: screen,
    hidden:true,
    left:'center',
    height:'shrink',
    width:'10%',
    align:'center',
    top:0,
    style: {
        fg:'#004D0D',
        bg: 'black'
    }
})

let searchResult = [];
mainMenu.on('select',async (item,index)=>{
    var name = item.getText();
    status.setContent(name);
    listToggle();
    switch(name){
        case 'search':
            searchOpts.show();
            searchOpts.focus();
            screen.render();
            break;
        case 'play by id':
            playById();
            break;
    }

});

async function playById() {
    listToggle();
    let linkInput;
    try {
        linkInput = await getInput();
    } catch(err){
        errorMsg.error(err,() => listToggle());
        return;
    }
    if (linkInput.match(/^https:\/\/(www\.)?youtu(\.be|be\.com)\/(watch\?v=[^\\\/=\s]*?|[^\\\/=\s\?]*?)$)/) || linkInput.match()) {
        try {
            await spawnCmd(mpvPath, ["-vo", "gpu","-quiet", link, `ytdl-format=bestvideo[height<=?${videoQuality}]+bestaudio/best`]);
        } catch(err) {    
            return;
        }
    }
    
}

searchOpts.on('select', (item) => {
    let opt;
    switch(item.getText()) {
        case "general":
            opt='s';
            break;
        case "video":
            opt='v';
            break;
        case "channel":
            opt='c';
            break;
        case "playlist":
            opt='p';
            break;        
    }
    searchOpts.hide();
    doSearch(opt);
});

async function doSearch(opt) {  
    let query;
    try {
        query = await getInput("Enter Search Query: ");
    } catch(err) {
        return;
    }
    if(query === null || query === "") { 
        listToggle();
        return;
    } 
    queryPrompt.hide(); 
    status.hide();  
    loadingBox.load("loading results");
    screen.render();
    try {
        searchResult = await spawnCmd(rytsPath, ["se", `-${opt}`, query]);
    } catch(err) {
        return;
    }
    searchResult = searchResult.split("\n");
    displaySearchResult();
    status.show();
    loadingBox.stop();
    return;
}

async function getInput(statusText) {
    status.setText(statusText);
    queryPrompt.setValue('');
    queryPrompt.show();
    screen.render();
    var input = new Promise((resolve, reject) => {
        queryPrompt.readInput((err, value) => {
            queryPrompt.hide();
            if(err) {
                reject(err);
                return;
            }
            resolve(value);
            return;
        });
        queryPrompt.on("cancel", () => {
            queryPrompt.hide();
            resolve(null);
        }); 
    });
    return input;
}

function displaySearchResult() {   
    let searchNames = [];
    searchResult.forEach(element=>{
        let name = element.substring(0, element.indexOf('\t'));
        if(name !== "") searchNames.push(name);
    });
    status.setText("results");
    searchList.setItems(searchNames);
    searchList.show();
    searchList.focus();
    screen.render();
    return;
}

mainMenu.on('cancel', () => {
    process.exit(0);
});

searchList.on('cancel', () => {
    searchList.hide();
    listToggle();
    screen.render();
    return;
});

searchOpts.on('cancel', () => {
    searchOpts.hide();
    searchList.hide();
    listToggle();
    screen.render();
    return;
});

searchList.on("select",async (item) => {
    let type = item.getText().slice(item.getText().indexOf("(")+1, item.getText().indexOf(")")).trim();
    let name = item.getText().slice(item.getText().indexOf(')')+2).trim();
    let id = "";
    searchResult.forEach((element) => {
        let eName = element.substring(element.indexOf(')')+2, element.indexOf('\t')).trim();
        if(eName === name) {
            id = element.slice(element.indexOf('\t')).trim().toString();
        }
    }); 
    searchList.hide();
    let link;
    switch(type){
        case "video":
            status.setText(`Playing video ${name}`);
            screen.render();
            link = `http://youtu.be/${id}`;
            try {
                await spawnCmd(mpvPath, ["-vo", "gpu", "-quiet", link, `ytdl-format=bestvideo[height<=?${videoQuality}]+bestaudio/best`]);
                displaySearchResult();
            } catch(err) {
                return;
            }    
        break;
        case "channel":
            getVideoList("channel", id);    
            return;
        case "playlist":
            getVideoList("playlist", id);
            return;
    }

});

async function getVideoList(type, id) {
    status.hide();
    loadingBox.load("loading results");
    screen.render();
    switch (type) {
        case "channel":
            try {
                searchResult = await spawnCmd(rytsPath, ["ch", "-v", id]);
            } catch(err) {
                return;
            }
            break;
        case "playlist":
            try {
                searchResult = await spawnCmd(rytsPath, ["pl", id]);
            } catch(err) {
                return;
            }
            break;
    }
    searchResult = searchResult.split("\n");
    displaySearchResult();
    loadingBox.stop();
    status.show();
    return;
}

async function spawnCmd(cmdPath, args) {
    var cmd = spawn(cmdPath, args);
    var output = {data:"", err:""};
    cmd.stdout.on("data", (data)=>{
        output.data += data.toString();
    });
    cmd.stderr.on("data", (data)=>{
        output.err += data.toString();
    });
    return new Promise((resolve, reject) => {
        cmd.on('close', (code) => {
            if(output.err || code !== 0) { 
                errorMsg.display(output.err,() => listToggle());
                reject(output.err);
                return; 
            }
            resolve(output.data);                
        });
    });
}

function listToggle() {
    if(!mainMenu.visible) {
        mainMenu.show();
        status.setText("Select Option");
        mainMenu.focus();
        screen.render();
        return;
    }
    mainMenu.hide();
}

screen.key(['C-c'], (ch, key) => {
    return process.exit(0);
});

mainMenu.focus();
screen.render();