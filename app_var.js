/**
 * http使用 koa实现, websocket使用 ws, 当前游戏数据直接存入在nodejs变量中 roomlist;
 */
process.on('uncaughtException', function (err) {
    //打印出错误
    utils.log("game exception:")
    console.log(err);
    //打印出错误的调用栈方便调试
    console.log(err.stack);
});

const moment = require('moment')
const ws=require('ws');
const Game=require('./controllers/gamevarController')
const Login=require('./controllers/loginController')
const koa=require('koa');
const Router=require('koa-router');
const koabody = require('koa-body');



global.utils=require('./utils/utils')
global.config=require('./config').config;
global.db=require('knex')(config.db);
global.moment=moment;
global.roomlist={}; // roomlist[roomid][房间相关的所有数据...]
let game=new Game();
let login=new Login();


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

        utils.log(message)
        utils.log(roomlist)
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
                //进入房单
                game.enterRoom(req_data, ws1);


                break;
            case 101:
                //点开始
                game.setStart(req_data);
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

/**
 *
 * @param roomid 房间
 * @param data  数据
 * @param tolist 指定发送人
 * @returns {Promise<void>}
 */
global.broadcastSend= async function(roomid,data,tolist=[]) {

    let users=roomlist[roomid]['users'];
    for(k in users ){
        if(users[k].ws.readyState === ws.OPEN) {

            //发送数据；
            if(tolist && tolist.length>0)
            {
                if(k in tolist)
                {
                    users[k].ws.send(JSON.stringify(data));
                }
            }
            else
            {
                users[k].ws.send(JSON.stringify(data));
            }

        }
        else if(users[k].ws.readyState==ws.CLOSED)
        {
            //todo 给掉线用户进行结算;
        }
    }

    // roomlist[roomid]['users'].forEach(function (v,i) {
    //     if(v.ws.readyState === ws.OPEN) {
    //         //在线的直接发送；
    //         v.ws.send(JSON.stringify(data));
    //     }
    //     else if(v.ws.readyState==ws.CLOSED)
    //     {
    //
    //     }
    // })

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
