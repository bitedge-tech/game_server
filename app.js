/**
 * http使用 koa实现, websocket使用 ws, 当前游戏数据放在 mysql的 memory引擎表中;
 */
process.on('uncaughtException', function (err) {
    //打印出错误
    console.log("game exception:")
    console.log(err);
    //打印出错误的调用栈方便调试
    console.log(err.stack);
});

const moment = require('moment');
const  ws=require('ws');
const Game=require('./controllers/gameController');
const Login=require('./controllers/loginController');
const Users=require('./controllers/usersController');
const koa=require('koa');
const Router=require('koa-router');
const koabody = require('koa-body');

global.utils=require('./utils/utils');
global.config=require('./config').config;
global.db=require('knex')(config.db);
global.moment=moment;
global.ws_clients={}; //保存所有用户的连接;{rid1{uid1:wsn,uid2:wsn,...},rid2{},}

let game=new Game();
let login=new Login();
let users=new Users();


/**
 * 创建个httpServer:  8000端口
 *
 */

const app = new koa();
const router = new Router();

// 处理跨域
app.use(async (ctx, next) => {
    // ctx.response.set("Access-Control-Allow-Origin", "*")
    ctx.response.set("Access-Control-Allow-Origin", "*")
    await next()
})

router.get('/',(ctx,next)=>{
    ctx.body=JSON.stringify({a:"hello",b:"nodejs"})
})

router.get('/index',game.index);
router.get('/test',game.test);
router.post('/game/cr',game.createRoom);
router.post('/game/jr',game.checkJoinRoom);
router.post('/login/l',login.login);
router.post('/user/gui',users.getUserInfo);
router.post('/game/ghistory',game.getGamePaijuHistory)

router.post('/hi',ctx=>{
    console.log(ctx.request.body)
})

//启用路由
app.use(koabody({multipart:true}));
app.use(router.routes()).use(router.allowedMethods());
app.listen(8000)
console.log("http server listen 8000")




/**
 * 创建socket Server, 6000端口
 */
const socketServer = ws.Server;
let wss = new socketServer({port: 6001});    //创建websocketServer实例监听8090端口
console.log("websocket server listen 6001");
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

        utils.log(message)
        let req_data = JSON.parse(message);
        if(!req_data){
            utils.log('data error!');
            return}
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
                //进入房间
                game.sHandleEnterRoom(req_data, ws1);
                break;

            case 12:
                //退出房间
                game.sHandleExitRoom(req_data);
                break;
            case 101:
                //点开始
                game.sHandleStart(req_data);
                break;

            case 102:  //跟注
            case 109:  //让牌
                game.sHandleGenzhu(req_data);
                break;

            case 103:
                game.sHandleJiazhu(req_data);
                break;

            case 105:
                game.sHandleAllin(req_data);
                break;

            case 104:
                game.sHandleQipai(req_data);
                break;

            default:
                //其他
                utils.log('unhandle cmd')
                console.log(req_data.cmd);
                break
        }
    });

    /*监听断开连接*/
    ws1.on('close', function (e) {
        console.log("closed ws:");
        console.log(e)
    });


})


setInterval(async function () {
    await closeSocket();
}.bind(this), 1000 * 60 * 5);


/**
 * 签查断开的连接，从客户端监听列表删除,并处理用户数据;
 */
async   function closeSocket() {
    for (let k in ws_clients) {
        for (let ku in ws_clients[k]) {
            if (ws_clients[k][ku].readyState === ws.CLOSED) {

                //断线,处理用户数据,
                await game.userExitRoom(k, ku);
            }
        }
    }
}

/**
 *
 * @param roomid 房间
 * @param data  数据
 * @param tolist 指定发送人列表, uid列表
 * @returns {Promise<void>}
 */
global.broadcastSend= async function(roomid,data,tolist=[]) {

    let wsc
    let users;

    if(tolist && tolist.length>0){

        //指定人员
        users=tolist;
    }
    else
    {
        //房间内所有的人
        users=await db('m_users').where({rid:roomid}).select('uid');
    }

    for(let user of users){

        let key;
        if(tolist && tolist.length>0)
        {
            key=user;
        }
        else {
            key=user.uid;
        }

        wsc=ws_clients[roomid][key];

        if (!wsc || wsc == undefined) {
            continue;
        }

       if(wsc.readyState === ws.OPEN){

           wsc.send(JSON.stringify(data));

        } else if(wsc.readyState===ws.CLOSED)
       {
           //删除'掉线'的客户端连接;
           delete ws_clients[roomid][key];
           utils.log(ws_clients);
           //删除数据, 并向其他人员发送广播
           await game.userExitRoom(roomid, key);
       }
    }


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
