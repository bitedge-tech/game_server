"use strict";
const _=require('lodash')
const  dezhou=require('../utils/dezhou')

class GameController {

    PukePai =
        [
            0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
            10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
            20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
            30, 31, 32, 33, 34, 35, 36, 37, 38, 39,
            40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51
        ]

     index(ctx,next){
         ctx.body = "hello controller";
    }

    /**
     * 创建房间
     * @param ctx
     * @param next
     */
    async createRoom(ctx,next){

       // utils.log(ctx.request.body)

        if(!ctx.request.body.userno || !ctx.request.body.userno)
        {
            ctx.body=JSON.stringify({code:-1,msg:'error'})
            return ;
        }

        let now=moment().unix();
        let rcode= Math.floor(Math.random()*100000)+100000;
        let userno=ctx.request.body.userno;
        let seatnum=ctx.request.body.seatnum?ctx.request.body.seatnum:3;
        let time_value=ctx.request.body.timevalue?ctx.request.body.timevalue:30;
        let coin_limit=ctx.request.body.coinlimit?ctx.request.body.coinlimit:200;
        // utils.log(rcode)
        // utils.log(ctx.request.body.userno)
        let users=await db('slg_user').where({user_no:userno}).select('id');
        // utils.log(users)
        let userid=users[0].id;

        let room={room_code:rcode,owner:userid,game_type:1,create_time:now,time_value:time_value,seat_num:seatnum,coin:coin_limit}
        let rs=await db('slg_room').insert(room);
        //utils.log(rs[0])
        if(rs[0]>0)
        {
            ctx.body={'code':1,msg:"success",room_code: rcode,rid:rs[0]};
            //utils.log('is that?')
            //添加房间到变量中;
            let room=[];
            room['id']=rs[0];
            room['code']=rcode;
            room['owner']=userid;
            room['status']=1;
            room['users']={};
            room['c_paiju']={
                id:10000,
                poker_pub:[], //公牌
                poker_pri:[], //数组下标表示坐位号;
                xiaomang: 1,
                damang:2, //
                dichi:0, //实时的数据
                bianchi:[0,0,0,0],  //边池分为4个;
                winner:0,
            };
            room['seatnum']=seatnum;
            room['sum_user']=0;
            room['sum_start']=0;
            room['be_seat']=new Array(seatnum).fill(0); //未使用时为0, 被使用设置uid;
            room['timevalue']=time_value;
            room['create_time']=now;

            roomlist[rs[0]]=room;
            // utils.log(roomlist);
        }

    }

    /**
     * http判断是否可以加入房间
     * @returns {Promise<void>}
     */
    async checkJoinRoom(ctx,next){
        let room_code=ctx.request.body.roomcode;
        let uno=ctx.request.body.roomcode.user_no;

        if(!room_code)
        {
            ctx.body=JSON.stringify({code:-1,msg:"房间号有误!"})
            return ;
        }

        //console.log('roomcode');
       // console.log(ctx.request.body);

        let room=await db('slg_room').where({room_code:room_code,status:1}).select({rid:'id'},{roomcode:'room_code'});

        //console.log(room);

        if(!room || room.length<=0){
            ctx.body=JSON.stringify({code:-1,msg:"房间号有误!"})
            return ;
        }

        room=room[0];

        // utils.log(roomlist[room.rid])
        // utils.log(roomlist[room.rid]['users'].length)
        if(roomlist[room.rid]['seatnum']<=Object.keys(roomlist[room.rid]['users']).length){
            ctx.body=JSON.stringify({code:-1,msg:"房单已满!"})
            return ;
        }

        //todo 币不够


        ctx.body=JSON.stringify({code:1,data:room});

    }
    /**
     * ws进入房间
     * @param req_data
     * @param ws1
     * @returns {Promise<void>}
     */
    async enterRoom(req_data,ws1){
        //todo 判断币够不够

        // utils.log(roomlist[req_data.rid])

        let roomid=req_data.rid;
        let db_usr=await db('slg_user').where({id:req_data.from}).select();
        // utils.log(db_usr)
        if(!db_usr)
        {
            broadcastSend(req_data.rid,{cmd:0,msg:"系统出错!"},[req_data.from])
            return ;
        }
        db_usr=db_usr[0];

        // utils.log(roomlist);
       // utils.log(req_data);
        // utils.log(roomlist[req_data.rid]);
        let seat_no=roomlist[req_data.rid]['be_seat'].indexOf(0);//获得一个座位,
        roomlist[req_data.rid]['be_seat'][seat_no]=db_usr.id;  //设置被坐下了
        roomlist[req_data.rid]['sum_user']=roomlist[req_data.rid]['sum_user']+1;

        let user={
            uid:req_data.from,
            ws:ws1,
            seat_no:seat_no,
            coin:db_usr.coin,
            userno:db_usr.user_no,
            nickname:db_usr.nick_name,
            headimg:db_usr.headimg,
            paijuno:0,  //当前的牌局号；流水号;
            status:0    //0:进入房间未点"开始", 1:开始, -1不可玩;
        }

        roomlist[req_data.rid]['users'][req_data.from]=user;

       //已经加入到房间的用户列表
        let pre_usr_list=JSON.parse(JSON.stringify(roomlist[req_data.rid]['users']));


        //去掉不需要的字段
        if(pre_usr_list && Object.keys(pre_usr_list).length>0)
        {

            for (let k in pre_usr_list) {
                let element=pre_usr_list[k]
                if(element)
                {
                    delete element.ws;
                    delete element.paijuno;
                }
            }

        }

        let c_user=JSON.parse(JSON.stringify(user));
        delete c_user.ws;

        //坐位数, 已有人数, 有效时间;
        let room_base_info={
            seat_num:roomlist[req_data.rid]['seatnum'],
            sum_user:roomlist[req_data.rid]['sum_user'],
            valid_time: moment((roomlist[req_data.rid]['create_time']+roomlist[req_data.rid]['timevalue']*60)*1000).format('HH:mm:ss'),
        }

        //加入房间数据同步给每个已经加入的用户
        let senddata=makeData(
            roomid,
            11,
            "通知有人进入房间",
            [c_user,pre_usr_list,room_base_info]
            )

        // utils.log(senddata);
        utils.log('enter room:'+req_data.from)
        utils.log(roomlist[req_data.rid]['users'])
        broadcastSend(roomid,senddata)

    }

    async setStart(data){

        let from_uid=data.from;
        let rid=data.rid;

        //设置用户的status=1;
        roomlist[rid]['users'][from_uid]['status']=1;

        //设置已点"开始"的用户人数;
        roomlist[rid]['sum_start']+=1;

        let seat_no=roomlist[rid]['users'][from_uid]['seat_no'];
        //通知所有用户
        let senddata=makeData(rid,101,"设置开始",{uid:from_uid,seat_no:seat_no})
        broadcastSend(rid,senddata);

        //如果所有人都点"开始",就开始游戏;
        utils.log("sum_start-sum_user");
        utils.log(roomlist[rid]['sum_start']+","+roomlist[rid]['sum_user'])
        if(roomlist[rid]['sum_start']==roomlist[rid]['sum_user']){

            await this.createPaiju(rid);
            //发底牌
            this.SendDipai(rid);


            //todo 保存牌局数据到数据库
        }

    }
    /**
     * 洗牌,生成牌局,
     * @param rootMode
     * @returns {Promise<void>}
     */
    async createPaiju(rid) {

        //洗牌
        let pai=_.shuffle(this.PukePai);

        //分牌

        let paiju= roomlist[rid]['c_paiju'] ;  //{}
        paiju['id']+=1;
        paiju['poker_pub']=pai.slice(0,5);
        paiju['poker_pri']=[pai.slice(5,7),pai.slice(7,9),pai.slice(9,11),pai.slice(11,13),pai.slice(13,15),pai.slice(15,17),pai.slice(17,19),pai.slice(19,21),pai.slice(21,23)];

    }

    async calculateScore(paiju){

    }

    /**
     *发送底牌指令
     * @param rid
     * @returns {Promise<void>}
     * @constructor
     */
    async SendDipai(rid){
        let users=roomlist[rid]['users'];
        let dipai=roomlist[rid]['c_paiju']['poker_pri'];
        let wss;
        let pai;

        //房间玩家uid,坐位号列表:　［{},{}］
        let ul=[];
        for(let k in users){
            ul.push({uid:users[k]['uid'],seat_no:users[k]['seat_no']});
        }

        //给每个人发底牌
        for(let k in users){
            wss=users[k]['ws'];
            pai=dipai[users[k]['seat_no']]; //取出自己的底牌
            let d={uid:k,dipai:pai,userlist:ul}
            let sendData=makeData(rid,110,'发底牌',d)
            wss.send(JSON.stringify(sendData));
        }

    }


    async test(ctx, next) {
        let rs = await db.select().from('slg_user').timeout(2000);

        utils.log(rs[0].user_name);
        utils.log(rs[0].nick_name);
        ctx.body=JSON.stringify(rs[0]);
    }

    /**
     *
     * @param roomid 房间
     * @param data  数据
     * @param tolist 指定发送人
     * @returns {Promise<void>}
     */
    async broadcastSend(roomid,data,tolist=[]) {

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

    }
}

module.exports=GameController;