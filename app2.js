/**
 * express方式
 */

const {config} = require('./config')
const moment = require('moment')
const ws=require('ws');
const Game=require('./controllers/gameController')
const express=require('express');

process.on('uncaughtException', function (err) {
    //打印出错误
    console.log(err);
    //打印出错误的调用栈方便调试
    console.log(err.stack);
});

global.config=require('./config').config;
global.db=require('knex')(config.db);
global.moment=moment;
global.roomlist=[]; // roomlist[roomid][房间相关的所有数据...]
let game=new Game();


/**
 * 创建个httpServer:  8000端口
 *
 */

const app = new express();
let bodyparser = require('body-parser');
app.use(bodyparser.urlencoded({extended:true}));
app.use(bodyparser.json())
app.

// 处理跨域


app.get('/index',game.index);
app.get('/test',game.test);
app.post('/game/cr',game.createRoom);

app.post('/hi',(req,res)=>{
    console.log(req.params);
    console.log(req.body);
    console.log(req.query);
    res.json({a:'hello'})
})

app.listen(8000)
console.log("http server listen 8000")




/**
 * 创建socket Server, 6000端口
 */
const socketServer = ws.Server;
let wss = new socketServer({port: 6000});    //创建websocketServer实例监听8090端口
console.log("websocket server listen 6000");
var pk1_timer = 0; //计时器
//监听连接
wss.on('connection', function (ws1) {

    console.log('client connected');

    /**
     * 监听消息
     * 消息类型:
     * {
     *     token: 登录凭证,
     *     from:发送人id
     *     cmd:操作指令,
     *     rid:房间号,
     *     time:时间戳，
     *
     *     //data根据不同类型有所不同
     *     data{
     *         paijuno:xx,
     *         msg:"",
     *         content:{},
     *     }
     * }
     */
    ws1.on('message', function (message) {

        let req_data = JSON.parse(message);
        let uid=req_data.from;
        //todo 验证数据
        //todo 验证登录

        /**
         * 1:创建连接
         * -1:连接断开
         * 10:创建房间
         * 11:加入房单
         * 19:退出房单
         *
         * 101: 开始
         * 102: 跟注
         * 103: 加注
         * 104: 弃牌
         * 105：全下
         */
        switch (req_data.cmd) {

            case 10: //创建一个房间
                game.addRoom(uid);
                break;

            case 11:
                //进入房单
                game.enterRoom(req_data, ws1, broadcastSend);

                break;
            case 19:
                //进入房单
                game.exitRoom();
                break;

            default:
                //其他
                console.log(req_data.cmd);
                break
        }
    });

    /*监听断开连接*/
    ws1.on('close', function (e) {
        console.log("closed" + e);
    });


    /**
     * 关闭服务，从客户端监听列表删除
     */
    function closeSocket() {
        for (let i = 0; i < clients.length; i++) {
            if (clients[i].ws.readyState === ws.CLOSED) {
                console.log(clients[i].nickname + " closed!");
            }
        }
    }

})

global.broadcastSend=function(roomid,data) {
    roomlist[roomid]['users'].forEach(function (v,i) {
        if(v.ws.readyState === ws.OPEN) {
            //在线的直接发送；
            v.ws.send(JSON.stringify(data));
        }
        else if(v.ws.readyState==ws.CLOSED)
        {
           //todo 给掉线用户进行结算;
        }
    })

}

/**
 * 发送给客户端的消息体
 * @param cmd
 * @param msg
 * @param content
 * @returns {{msg: *, data: {}, from: T | number, cmd: *, time: number, rid: string, token: string}}
 */
 global.makeData=function(roomid, cmd,msg, content = {}) {
    let d = {
        token: '',
        cmd: cmd,
        rid:roomid,
        time: Date.parse(new Date()) / 1000,
        msg: msg,
        data: content
    }

    return d;
}
