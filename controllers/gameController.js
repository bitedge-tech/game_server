"use strict";
const _ = require('lodash')
const Dezhou = require('../utils/dezhou');
let dezhou=new Dezhou();

class GameController {

    PukePai =
        [
            0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
            10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
            20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
            30, 31, 32, 33, 34, 35, 36, 37, 38, 39,
            40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51
        ]

    index(ctx, next) {
        ctx.body = "hello controller";
    }

    /**
     * 创建房间
     * @param ctx
     * @param next
     */
    async createRoom(ctx, next) {

        // utils.log(ctx.request.body)

        if (!ctx.request.body.userno || !ctx.request.body.userno) {
            ctx.body = JSON.stringify({code: -1, msg: 'error'})
            return;
        }

        let now = moment().unix();
        let rcode = Math.floor(Math.random() * 100000) + 100000;
        let userno = ctx.request.body.userno;
        let seatnum = ctx.request.body.seatnum ? ctx.request.body.seatnum : 3;
        let time_value = ctx.request.body.timevalue ? ctx.request.body.timevalue : 30;
        let limit_coin = ctx.request.body.limit_coin ? ctx.request.body.limit_coin : 200;
        let xiaomang = ctx.request.body.xm_v ? ctx.request.body.xm_v : 10;
        // utils.log(rcode)
        // utils.log(ctx.request.body.userno)

        let users = await db('slg_user').where({user_no: userno}).select('id');

        if (!users || users.length <= 0) {
            ctx.body = JSON.stringify({code: -1, msg: 'user error'})
            return;
        }

        // utils.log(users)
        let userid = users[0].id;

        let room = {
            room_code: rcode,
            owner: userid,
            game_type: 1,
            create_time: now,
            time_value: time_value,
            seat_num: seatnum,
            coin: limit_coin
        }

        try {
            let nrid = 0;
            let rs = await db('slg_room').insert(room);
            // utils.log(rs[0])
            if (rs[0] > 0) {
                nrid = rs[0];
                //utils.log('is that?')
                //添加房间到变量中;
                let room = {};
                room['rid'] = rs[0];
                room['code'] = rcode;
                room['owner'] = userid;
                room['status'] = 1;
                room['seat_num'] = seatnum;
                room['sum_user'] = 0;
                room['time_value'] = time_value;
                room['create_time'] = now;
                room['game_type'] = 1;
                room['xm_v'] = xiaomang;
                room['limit_coin']=limit_coin;
                room['seat_list']='0,0,0,0,0,0,0,0,0'

                let paiju = {
                    id: 10000,
                    rid: rs[0],
                    poker_pub: '',
                    di_chi: 0, //实时的数据
                    bian_chi0: 0,
                    bian_chi1: 0,
                    bian_chi2: 0,
                    bian_chi3: 0,
                };

                await db('m_rooms').insert(room);
                await db('m_cpaiju').insert(paiju);
                ctx.body = {'code': 1, msg: "success", room_code: rcode, rid: nrid};
            }
            else
            {
                ctx.body = {'code': -1, msg: "创建房单失败!"};
            }

        } catch (error) {
            // If we get here, that means that neither the 'Old Books' catalogues insert,
            // nor any of the books inserts will have taken place.
            console.error(error);
            ctx.body = {'code': -1, msg: "创建房单失败!"};
        }


    }

    /**
     * http判断是否可以加入房间
     * @returns {Promise<void>}
     */
    async checkJoinRoom(ctx, next) {
        let room_code = ctx.request.body.roomcode;
        let uid = ctx.request.body.uid;

        if (!room_code) {
            ctx.body = JSON.stringify({code: -1, msg: "房间号有误!"})
            return;
        }

        //console.log('roomcode');
        // console.log(ctx.request.body);

        let room = await db('m_rooms').where({
            code: room_code,
            status: 1
        }).select({rid: 'rid'}, {roomcode: 'code'},'seat_num','sum_user','limit_coin');

        //console.log(room);

        if (!room || room.length <= 0) {
            ctx.body = JSON.stringify({code: -1, msg: "房间号有误!"})
            return;
        }

        room = room[0];

        // utils.log(roomlist[room.rid])
        // utils.log(roomlist[room.rid]['users'].length)
        if (room['seat_num'] <= room['sum_user']) {
            ctx.body = JSON.stringify({code: -1, msg: "房单已满!"})
            return;
        }

        //todo 判断游戏币; 如果不够返回信息;
        let usr = await db('slg_user').where({id: uid}).select('coin');
        let balance=parseInt(usr[0]['coin']);
        if (balance < parseInt(room['limit_coin'])) {
            ctx.body = JSON.stringify({code: -1, msg: "金额不足!最底限额:"+room['limit_coin']})
            return;
        }

        ctx.body = JSON.stringify({code: 1, data: room});

    }

    /**
     * ws进入房间
     * @param req_data
     * @param ws1
     * @returns {Promise<void>}
     */
    async sHandleEnterRoom(req_data, ws1) {

        try{

            let roomid = req_data.rid;
            let coin =0;

            if(!ws_clients[roomid]){
                ws_clients[roomid]={}
            }


            let db_usr = await db('slg_user').where({id: req_data.from}).select();
            // utils.log(db_usr)
            if (!db_usr) {
                broadcastSend(req_data.rid, makeData(roomid,0,"系统出错!"), [req_data.from])
                return;
            }

            db_usr = db_usr[0];

            //断开后, 重新连接;
            let existUser = await db('m_users').where({uid: req_data.from,rid:roomid}).andWhere('status', '<>', -1).select('uid');
            // utils.log(req_data);
            // utils.log(existUser);
            if(existUser && existUser.length>0){
                ws_clients[roomid][req_data.from]=ws1;
                // utils.log(ws_clients);
                broadcastSend(req_data.rid, makeData(roomid,0,"重新连接成功!"), [req_data.from])
                return;
            }

            //获得一个座位,坐下;
            let room=await db('m_rooms').where({rid:roomid}).select('seat_list,limit_coin'.split(','));
            let seat_arr=room[0]['seat_list'].split(',');

            utils.log('free seat:')
            utils.log(seat_arr)

            //随机找到一个空位置
            let index=Math.floor(Math.random()*9);
            let seat_no;

            seat_no=seat_arr.indexOf('0',index);
            if (seat_no == -1) {
                seat_no=seat_arr.indexOf('0',0);
            }

            utils.log('seat_no:');
            utils.log(seat_no)

            //设置金额
            try{
                await db.transaction(async trx=>{
                    let usr= await trx('slg_user').where({id:req_data.from}).forUpdate().select('coin');
                    let usr_balance = parseInt( usr[0]['coin']);
                    if(usr_balance<parseInt(room[0]['limit_coin']))
                    {
                        coin=usr_balance;
                    }
                    else{
                        coin=parseInt(room[0]['limit_coin']);
                    }

                   await trx('slg_user').where({id: req_data.from}).decrement('coin', coin);

                    //记录日志
                    await utils.coinLog({
                        uid:req_data.from,
                        code:'101',
                        comment:'进入房间出账',
                        coin:-coin,
                        game_code:1,
                        room_id:roomid,

                    },trx)

                })
            }catch (e) {
                utils.log(e)
            }


            let user = {
                rid:roomid,
                uid: db_usr.id,
                seat_no: seat_no,
                coin:coin,
                userno: db_usr.user_no,
                nick_name: db_usr.nick_name,
                headimg: db_usr.headimg,
                paijuno: 0,  //当前的牌局号；流水号;
                status: 0,    //0:进入房间未点"开始", 1:开始, -1不可玩;
                sex:db_usr.sex,
            }

            ws_clients[roomid][db_usr.id]=ws1;  //添加客户端连接;

            //保存进入的用户
            await db('m_users').insert(user);

            //房间人数加1,坐位设置使用;
            seat_arr[seat_no]=db_usr.id;
            await db('m_rooms').where({rid:roomid}).update({seat_list:seat_arr.join(',')}).increment('sum_user',1);

            //已经加入到房间的用户列表
            let pre_usr_list = await db('m_users').where({rid:roomid});


            let roomInfo=await db('m_rooms').where({rid:roomid}).select('rid,code,owner,seat_num,sum_user,create_time,time_value,xm_v'.split(','))

            //坐位数, 已有人数, 有效时间;
            let room_base_info = {
                seat_num: roomInfo[0]['seat_num'],
                sum_user: roomInfo[0]['sum_user'],
                valid_time: moment((roomInfo[0]['create_time'] + roomInfo[0]['time_value'] * 60) * 1000).format('HH:mm:ss'),
                xm_v: roomInfo[0]['xm_v'],
            }

            //加入房间数据同步给每个已经加入的用户
            let senddata = makeData(
                roomid,
                11,
                "通知有人进入房间",
                [user, pre_usr_list, room_base_info]
            )

            // utils.log(senddata);
            utils.log('enter room:' + req_data.from)
            await broadcastSend(roomid, senddata);
            utils.log(ws_clients);
        }
        catch (e) {
            console.error(e);
        }


    }

    async sHandleStart(data) {

        let from_uid = data.from;
        let rid = data.rid;

        let roomInfo =await db('m_rooms').where({rid: rid}).select('sum_user,rid,xm_v'.split(','));

        let xm_v=roomInfo[0]['xm_v'];
        //检查用户, 积分如果小于 大盲 , 不能开始;
        let usrs=await db('m_users').where({rid:rid,uid:from_uid}).andWhere('coin','>=',xm_v*2).select('uid,status'.split(','))

        if (usrs && usrs.length>0) {

            //设置用户的status=1;
            await db('m_users').where({uid:from_uid,rid:rid}).update({status: 1});
        }
        else{
            //用户有误,或余额不足；
            utils.log('用户有误或积分不足!')
            await db('m_users').where({uid:from_uid,rid:rid}).update({status: 3});
            return ;
        }


        let this_user=await db('m_users').where({uid:from_uid,rid:rid}).select('uid,seat_no'.split(','))
        let seat_no =this_user[0]['seat_no'];

        //通知所有用户
        let senddata = makeData(rid, 101, "设置开始", {uid: from_uid, seat_no: seat_no})
        broadcastSend(rid, senddata);


        //在场的用户, 符合条件的都点开始了, 就开始游戏;  status=1的人 >=2,  status==0的人为0;  is_started==0

        let pj =await this.getPaiju(rid, 'is_started');
        let us_status_1=await this.getUser(rid,-1,'uid',{status:1},1);
        let us_status_0=await this.getUser(rid,-1,'uid',{status:0},1);

        if (us_status_0.length<=0 && us_status_1.length>=2  && pj['is_started']==0) {
            //开始游戏
            await  this.startGame(rid,0);
            await db('m_cpaiju').where({rid:rid}).update({is_started: 1});
        }

    }



    /**
     * 跟注，过牌, 加注, all in
     * @param data
     * @returns {Promise<void>}
     */
    async sHandleGenzhu(data) {

        let cmd=data.cmd;
        let uid=data.from;
        let jiazhu_seat=data.data.seat_no;
        let jiazhu_amount=data.data.amount;

        if (jiazhu_amount==undefined || jiazhu_amount==null || jiazhu_amount < 0) {
            broadcastSend(data.rid,makeData(data.rid,0,'amount:error!'+cmd),[uid]);
            return ;
        }

        //跟注指令, 金额为0, 判断为非法请求;
        if (cmd==102 && jiazhu_amount == 0) {
            broadcastSend(data.rid,makeData(data.rid,0,'amount:error!'+cmd),[uid]);
            return ;
        }

        //验证uid与seat_no是否配置;
        let room= await this.getRoom(data.rid,'seat_list');
        let arr_seats = room.seat_list.split(',');
        if(arr_seats[jiazhu_seat]!=uid){

            broadcastSend(data.rid,makeData(data.rid,0,'102:error!'),[uid]);
            return ;
        }

        //验证当前的call_seat 是否是此用户
        let paiju=await this.getPaiju(data.rid,'call_seat,count_touzhu');
        if (paiju['call_seat'] != jiazhu_seat) {
            broadcastSend(data.rid,makeData(data.rid,0,'102:error call seat!'),[uid]);
            return ;
        }

        //跟注: 判断金额是否合理, 本轮的投注总金额,必须与当轮目前的投注最高金额相同;
        if (cmd == 102) {
            let user=await  this.getUser(data.rid,uid,'t_xiazhu');
            let gengzhu_sum=user['t_xiazhu']+jiazhu_amount;
            if(gengzhu_sum!=paiju['count_touzhu']){
                broadcastSend(data.rid,makeData(data.rid,0,'amount:error!'),[uid]);
                return ;
            }
        }


        //更新用户数据,用户投注金额+ 当前的金额;
        await this.jiaZhu(data.rid, uid, jiazhu_amount);

        let usr=await this.getUser(data.rid,uid,'coin,t_xiazhu,sex');
        let usercoin=usr.coin; //余额
        utils.log('user coin:'+usercoin)

        //加注, all in ,更新本轮中的 最高投注金额;
        if(cmd==103 || cmd==105){

            //更新paiju中的 count_touzhu
            await db('m_cpaiju')
                .where({rid:data.rid})
                .andWhere('count_touzhu','<',usr['t_xiazhu'])
                .update({count_touzhu:usr['t_xiazhu']});

            //如果是 all in
            if (cmd == 105) {

                let step = await this.getPaiju(data.rid, 'step');

                //设置user 的 all_in_step
                await  db('m_users').where({rid:data.rid,uid:uid}).update({
                    all_in_step: step['step']
                })

                //paiju has_all_in 设置为1
                await  db('m_cpaiju').where({rid:data.rid}).update({has_all_in:1})

            }

        }

        //广播: 跟注,过牌, 加注,all in
        let send_data;
        send_data=makeData(data.rid,cmd,data.msg,{uid:uid,seat_no:jiazhu_seat,jiazhu_amount:jiazhu_amount,sum_amount:usr['t_xiazhu'],coin:usercoin,sex:usr.sex});
        broadcastSend(data.rid,send_data);


        //加注
        if(cmd==103){
            //广播下一位定时指令
            await  this.sendNextCallCmd(data.rid,jiazhu_seat);
            return ;
        }


        //如果本轮每个人都已经收过牌, 并且每个人的注都一样, 则进入下一轮; 否则,继续下一位叫牌
        let is_call_end=await this.allUsersCalled(data.rid);
        utils.log('all called:'+is_call_end)
        if(is_call_end){

            //进入下一轮: 1将各用户的投注放到底池中,发送相应的指令给客户端, 2初始化数据, 3发送开牌指令, 4发送叫牌指令;
            //翻: 开三张公共牌, 初始化"翻"轮的数据:   paiju: start_seat,end_seat, call_seat,step++; user: t_xiazhu=0,called=0;
            //转,河: 开一张牌, 初始化: paiju: start_seat,end_seat, call_seat,step++; user: t_xiazhu=0,called=0;
            await this.enterNextStep(data.rid);

        }
        else
        {
            //广播下一位定时指令
           await  this.sendNextCallCmd(data.rid,jiazhu_seat);

        }
    }


    async sHandleAllin(data) {
        await this.sHandleGenzhu(data);
    }

    async sHandleJiazhu(data) {
        await this.sHandleGenzhu(data);
    }

    /**
     * 退出游戏
     * @param bonesData
     * @returns {Promise<void>}
     */
    async sHandleExitRoom(wsdata) {

        // utils.log(wsdata)
        let data=wsdata.data;

        let uid=data.uid;
        let rid=wsdata.rid;

        //更新数据
        await this.userExitRoom(rid, uid);


        //删除连接;
        delete ws_clients[rid][uid];


    }

    async userExitRoom(rid,uid) {
        //金额提回到用户账户里
        let usr = await this.getUser(rid, uid, 'coin,seat_no');
        let seat_no = usr['seat_no'];
        let coin = usr['coin'];

        if (coin > 0) {
            let room = await this.getRoom(rid, 'seat_list');
            let seat_list = room['seat_list'].split(',');
            seat_list[seat_no]=0;
            await db('slg_user').where({id: uid}).increment('coin', coin);
            await db('m_users').where({rid:rid,uid: uid}).decrement('coin', coin);
            await db('m_rooms').where({rid: rid})
                .decrement('sum_user', 1)
                .update({seat_list:seat_list.join(',')});

            //记录日志
            await utils.coinLog({
                uid:uid,
                code:'102',
                comment:'退出房间入账',
                coin:coin,
                game_code:1,
                room_id:rid
            })
        }

        //广播退出房间
        await broadcastSend(rid,makeData(rid,12,'退出房间',{uid:uid,seat_no:seat_no}));

        //删除用户
        await db('m_users').where({rid:rid,uid: uid}).delete();

    }

    /**
     * 设置下一位, 并发送广播
     * @param rid
     * @param this_seat
     * @returns {Promise<void>}
     */
 async   sendNextCallCmd(rid, this_seat) {

        //获得下一位的座位号,更新牌局的叫牌座位
        let seat= await this.getNextSeatFromUsers(rid,this_seat);
        await db('m_cpaiju').where({rid: rid}).update({call_seat: seat['seat_no']});

        //计算下一位应该跟注多少
        let paiju=await this.getPaiju(rid,'count_touzhu');
        let u_genzhu=await this.getUserBySeat(rid,seat['seat_no'],'t_xiazhu');
        let genzhu_amount = paiju['count_touzhu'] - u_genzhu['t_xiazhu'];

        //发送"叫牌定时"指令;
        await  this.sendCallTimer(rid,seat['uid'],seat['seat_no'],genzhu_amount);
    }


    async shouChouma(rid) {
        let sum_xiazhu=await  db("m_users").where({rid:rid}).sum('t_xiazhu',{as:'sum_xiazhu'})
        sum_xiazhu = sum_xiazhu[0]['sum_xiazhu'];

        if (sum_xiazhu > 0) {
            await db('m_cpaiju').where({rid:rid}).increment('di_chi',sum_xiazhu);

            let paiju=await this.getPaiju(rid,'di_chi,has_all_in,step');

            //如果有人 all in ,则把底池的数据复制一份到对应的边池中;
            if (paiju['has_all_in'] ==1) {
                let dt={};
                let bian_chi_name = 'bian_chi' + paiju['step'];
                dt[bian_chi_name]=sum_xiazhu;
                await db('m_cpaiju').where({rid:rid}).update(dt);
            }

            let sum_chouma=paiju['di_chi'];
            //发送收筹码的指令
            //有投注的用户列表
            let userlist = await db('m_users').where({rid: rid}).andWhere('t_xiazhu', '>', 0).orderBy('seat_no','asc').select('uid,seat_no'.split(','));
            let sd={sum_chouma:sum_chouma,user_list:userlist};
            broadcastSend(rid,makeData(rid,130,'收筹码',sd));
        }
    }

    /**
     * 进入牌局的下一轮, 或者开始新的牌局;
     * @param rid{number}
     * @returns {Promise<void>}
     */
    async enterNextStep(rid) {
        //进入下一轮: 1将各用户的投注放到底池中,发送相应的指令给客户端, 2初始化数据, 3发送开牌指令, 4发送叫牌指令;
        //翻: 开三张公共牌, 初始化"翻"轮的数据:   paiju: start_seat,end_seat, call_seat,step++; user: t_xiazhu=0,called=0;
        //转,河: 开一张牌, 初始化: paiju: start_seat,end_seat, call_seat,step++; user: t_xiazhu=0,called=0;
        //比牌结算

        //收筹码到底池中
        await this.shouChouma(rid);

        //初始化下一轮的数据
        //更新用户数据;
        await db('m_users').where({rid:rid})
            .update({t_xiazhu_benju:db.raw('t_xiazhu_benju+t_xiazhu')});
        await db('m_users').where({rid:rid}).update({t_xiazhu:0, called: 0});


        //设置第一位叫牌的位置;
        let pj = await this.getPaiju(rid, 'd_seat');
        let d_seat = pj['d_seat'];
        let start_seat = await this.getNextSeatFromUsers(rid, d_seat); // d_seat位的下一位;
        utils.log('start_seat:');
        utils.log(start_seat);
        if (start_seat && start_seat['seat_no']>=0) {

            //更新牌局数据
            await db('m_cpaiju').where({rid:rid})
                .update({
                    start_seat:start_seat['seat_no'],
                    call_seat: start_seat['seat_no'],
                    count_touzhu:0,
                    has_all_in:0
                })
                .increment('step',1);
        }
        else {
            //记录日志 todo
            utils.log('设置第一个叫牌位失败！')
            await db('m_cpaiju').where({rid:rid})
                .update({
                    count_touzhu:0,
                    has_all_in:0
                })
                .increment('step',1);
        }


        //进入下一轮
        let step = await this.getPaiju(rid, 'step');
        let pai;
        let sd;
        let uslist;
        switch (step['step']) {
            case 0: //底
                break;
            case 1: //进入 翻
                //发送开三张底牌的指令;
                pai=await this.getPaiju(rid,"poker_pub");
                utils.log(pai);
                pai = pai['poker_pub'].split(',');
                pai = pai.slice(0, 3).join(',');

                 uslist = await this.getUsersStillInExceptAllIn(rid);

                sd = makeData(rid, 111, '翻牌', {pai:pai,uslist:uslist});
                broadcastSend(rid, sd);

                break;
            case 2: //进入 转
                //发送开第四张底牌的指令
                pai=await this.getPaiju(rid,"poker_pub");
                pai = pai['poker_pub'].split(',');
                pai = pai[3];

                 uslist =await this.getUsersStillInExceptAllIn(rid, step['step']);
                sd = makeData(rid, 112, '转牌',{pai:pai,uslist:uslist});
                broadcastSend(rid, sd);

                break;
            case 3: //进入 河
                //发送开第5张底牌的指令
                pai=await this.getPaiju(rid,"poker_pub");
                pai = pai['poker_pub'].split(',');
                pai = pai = pai[4]

                uslist =await this.getUsersStillInExceptAllIn(rid, step['step']);
                sd = makeData(rid, 113, '河牌',{pai:pai,uslist:uslist});
                broadcastSend(rid, sd);

                break;
            case 4:
                //进入比牌
                //发送明牌指令;
                await this.sendMingPaiCmd(rid);
                //在未弃牌的用户中，算出牌最大的用户；
                let winlist= await this.sortUserPoker(rid);
                // utils.log('winlist:');
                // utils.log(JSON.stringify(winlist));

                //处理底池 todo
                //[{ranking:1,uid:u[3]['uid'],seat_no:u[3]['seat_no'],amount:fenpei_amount,pai:u[0]['pai'],pai_name:u[0]['name_cn']},{...},{...}]
                let win_usr_list= await this.settlementOfPaiju(rid,winlist);

                utils.log("最终获胜者：")
                utils.log(win_usr_list);

                let pai_pri=await this.getPaiju(rid,"poker_pri");
                pai_pri=pai_pri['poker_pri'].split('|');


                //用户的最终余额加入进去；
                for (let i = 0; i < win_usr_list.length; i++) {
                    let usr=await this.getUser(rid,win_usr_list[i].uid,'coin');

                    win_usr_list[i]['dipai']=pai_pri[win_usr_list[i]['seat_no']]; //底牌
                    win_usr_list[i]['coin'] = usr['coin'];
                }

                //记录牌局日志 todo
               await this.writePaijuLog(rid,win_usr_list);

                //广播获胜者
               await broadcastSend(rid,makeData(rid,200,'牌局结果',win_usr_list));

                //5秒后进入下一局
                setTimeout(this.startGame.bind(this), 8000, rid,1);
                return ;

                break;
            default:
                utils.log('unkown step:'+step['step'])
                break;
        }


        //如果没弃牌的人中, 没有all in的只有1人或者没有, 那么直接进入下一局; 并且进行明牌
        let us_count=await  this.getUser(rid,-1,'uid',{status:1,all_in_step:-1},1)
        utils.log('us_count:');
        utils.log(us_count);

        if (!us_count || us_count.length < 2) {
            //进入下一轮
            setTimeout(async function () {
                await this.enterNextStep(rid);
            }.bind(this),2000)

            //进行明牌
            await this.sendMingPaiCmd(rid);

            return ;
        }

        //排局在1-3之间, 并且非all in 的用户有2位及以上; 发送定时叫牌指令
        if(step['step']>0 &&　step['step']<4 ){
            //发送新一轮的第一个'开始叫牌'指令;
            await this.sendCallTimer(rid,start_seat['uid'],start_seat['seat_no'],0);
        }
    }

  async  sendMingPaiCmd(rid) {
        let us_l=await this.getUser(rid,-1,'uid,seat_no',{status:1,ming_pai:0},1);
        utils.log('mingpai：');
        utils.log(us_l);
        let paiju = await this.getPaiju(rid, 'poker_pri');
        let poker_pri = paiju['poker_pri'].split('|');
        for (let i = 0; i < us_l.length; i++) {
            us_l[i].dipai=poker_pri[us_l[i]['seat_no']];
        }

        if (us_l && us_l.length > 0) {
            let sd = makeData(rid, 150, '明牌', us_l);
            await broadcastSend(rid, sd);
            //明完牌,更新下明牌状态;
            await db('m_users').where({rid:rid,status:1, ming_pai: 0}).update({ming_pai: 1});
        }
    }

    /**
     * 过牌
     * @param data
     * @returns {Promise<void>}
     */
    async sHandleQipai(data) {

        let rid=data.rid;
        let uid=data.from;

        //设置用户的状态；
        await db('m_users').where({rid: rid, uid: uid}).update({status: 2});

        //广播弃牌
        let usr = await db('m_users').where({rid: rid,uid:uid}).select('uid,sex'.split(','));
        let send_data=makeData(rid,104,'弃牌',{uid:uid,seat_no:data.data.seat_no,sex:usr[0].sex})
        await broadcastSend(rid, send_data);

        //判断是否只剩下一位用户了， 如果是,直接将底牌归剩下的用户所有,  广播派送底池的指令;
        /**
         *
         * @type {Array}
         */
        let usr_list = await db('m_users').where({rid: rid,status:1}).select('uid');
        if (usr_list.length === 1) {
            //将当局的投注归到底池中
            await this.shouChouma(rid);

            //更新用户数据;
            await db('m_users').where({rid:rid})
                .update({t_xiazhu_benju:db.raw('t_xiazhu_benju+t_xiazhu')});
            await db('m_users').where({rid:rid}).update({t_xiazhu:0, called: 0});


            //将底池归剩下的这位用户所有,
            let di_chi = await this.getPaiju(rid, 'di_chi');
            await db('m_users').where({rid:rid,uid:usr_list[0]['uid']}).increment('coin',di_chi['di_chi']);


            // 广播派送底池的指令;
            let usr = await this.getUser(rid, usr_list[0]['uid'],'uid,seat_no,coin');
            let rs_data={uid:usr['uid'],seat_no:usr['seat_no'],amount:di_chi['di_chi'], coin: usr['coin']};
            await broadcastSend(rid,makeData(rid,201,'结束牌局',rs_data));


            //记录牌局日志
            await this.writePaijuLog(rid,[{ranking:1,uid:usr['uid'],seat_no:usr['seat_no'],amount:di_chi['di_chi']}]);

            //进入下一局;
            setTimeout(this.startGame.bind(this), 8000, data.rid,1);

            return ;
        }

        //判断是否是本轮的最后一位叫牌, 如果是,并且本轮每个人的投注是一样的,则进入下一轮;
        let is_call_end=await this.allUsersCalled(rid);
        if(is_call_end){
            //进入下一轮: 1将各用户的投注放到底池中,发送相应的指令给客户端, 2初始化数据, 3发送开牌指令, 4发送叫牌指令;
            //翻: 开三张公共牌, 初始化"翻"轮的数据:   paiju: start_seat,end_seat, call_seat,step++; user: t_xiazhu=0,called=0;
            //转,河: 开一张牌, 初始化: paiju: start_seat,end_seat, call_seat,step++; user: t_xiazhu=0,called=0;
            await this.enterNextStep(data.rid);
        }
        else
        {
            //广播下一位定时指令
            await this.sendNextCallCmd(rid, data.data.seat_no);
        }


    }




    /**
     * 开始游戏： 初始化， 洗牌， 发底牌， 下 大小盲注，开始倒计时叫牌
     * @param rid
     * @returns {Promise<void>}
     */
    async startGame(rid,is_stared=0) {


        //初始化数据；
        await this.initPaiju(rid);

        //判断满足条件的玩家人数是否在2个及以上, 如果没有, 则发送停上游戏指令 todo
        //金额大于等于大盲注, 且状态为1的;
        let dm_v = await this.getRoom(rid, 'xm_v');
        /**
         *
         * @type {Array}
         */
        let valid_usl = await db('m_users').where({rid:rid,status: 1}).andWhere('coin', '>=', dm_v['xm_v']*2).select('uid');
        utils.log('valid_usl:')
        utils.log(valid_usl.length);
        if (!valid_usl || valid_usl.length < 2) {
            //发送停止游戏指令;
            let uslist= await this.getUsersStillIn(rid);
            await db('m_cpaiju').where({rid:rid}).update({is_started: 0}); //设置状态为重新开始;
            await broadcastSend(rid,makeData(rid,999,'停止游戏',{uslist:uslist}))
            return ;
        }

        //余额不足的用户, 发指令通知; todo
        let invalid_usl=await this.getUser(rid,-1,'uid,seat_no',{status:3});
        broadcastSend(rid,makeData(rid,350,'余额不足',{invalid_usl:invalid_usl}))


        //发送新局准备指令
        let uslist= await this.getUsersStillIn(rid);
        if (uslist.length > 0) {
            let sd=makeData(rid,300,'新局准备',{uslist: uslist});
            await broadcastSend(rid, sd);
        }

        //创建牌局
        await this.createPaiju(rid);

        //第一次开局, 0.1秒后发底牌, 过程中的5秒后发底牌;
        let times=100;
        if (is_stared == 1) {
           times=5000;
        }

        //5秒后开始发新局的底牌
        let me=this;
        setTimeout(async ()=>{
            //发底牌,含大小盲的下注；
            await me.SendDipai(rid);

            //开始叫牌；
            let call_seat = await me.getPaiju(rid,'call_seat');
            call_seat=call_seat['call_seat']

            let user=await me.getUserBySeat(rid,call_seat,'uid,t_xiazhu');
            let call_user=user['uid']

            let roomInfo = await me.getRoom(rid, 'xm_v');
            let jiazhu_amount=roomInfo['xm_v']*2-user['t_xiazhu'];

            //发送倒计时指令
            setTimeout(me.sendCallTimer.bind(this),1200,rid,call_user,call_seat,jiazhu_amount);
        },times)

    }

    /**
     * 发送 '叫牌倒计时' 广播指令;
     * @param uid
     * @param seat_no
     * @param jiazhu_amount
     */
    async sendCallTimer(rid,uid, seat_no, jiazhu_amount) {
        let usr =await this.getUser(rid, uid, 'coin');
        let data=makeData(rid,120,'倒计时',{uid:uid,seat_no:seat_no,jiazhu_amount:jiazhu_amount,coin:usr['coin']})
        broadcastSend(rid,data)
    }

    /**
     * 一局完成的结算， 返回：[{ranking:1,uid:u[3]['uid'],seat_no:u[3]['seat_no'],amount:fenpei_amount,pai:u[0]['pai'],pai_name:u[0]['name_cn']},{...},{...}]
     * @param rid
     * @param windowLocalStorage
     * @returns {Promise<[{uid:xx,seat_noxxx,amount:xxx},{...},{...}]>}
     */
    async settlementOfPaiju(rid, winlist) {
        // 注意:并列和边池的情况：　NN, NY,YN,YY; 4种情况；
        let rs = [];
        let tmp_rs={};
        let jiang_chi= await this.getPaiju(rid,'di_chi,bian_chi0,bian_chi1,bian_chi2,bian_chi3');



        //无并列，无边池的情况
        let top1_list=winlist.filter((v,i)=>{
            return v[4]==1; //返回名次是1的；
        });

        utils.log('toplit length:')
        utils.log(top1_list.length)

        if(jiang_chi['bian_chi0']==0 && jiang_chi['bian_chi1']==0 && jiang_chi['bian_chi2']==0 && jiang_chi['bian_chi3']==0 && top1_list.length == 1){
            let usr = await this.getUser(rid, top1_list[0][3]['uid'], 'all_in_step,uid,seat_no');
            await db('m_users').where({rid:rid,uid:usr['uid']}).increment('coin',jiang_chi['di_chi']);
            await db('m_cpaiju').where({rid: rid}).update({
                di_chi:0,
            });
            rs.push({ranking:1,uid:usr['uid'],seat_no:usr['seat_no'],amount:jiang_chi['di_chi'],pai:top1_list[0][0]['pai'],pai_name:top1_list[0][0]['name_cn']});

            return rs;
        }


        //有并列或边池的情况： 分别分配每个边池里面的币
        let endsAmount=jiang_chi['di_chi']-jiang_chi['bian_chi0']-jiang_chi['bian_chi1']-jiang_chi['bian_chi2']-jiang_chi['bian_chi3']; //没在边池中的金额;

        //边池0
        if (jiang_chi['bian_chi0'] > 0) {
           //分配给第1名人员；

            let fenpei_amount=Math.floor(jiang_chi['bian_chi0']/top1_list.length);

            let arr_uid=[];
            for (let u of top1_list) {
                arr_uid.push(u[3]['uid']);
                tmp_rs[u[3]['uid']]={ranking:1,uid:u[3]['uid'],seat_no:u[3]['seat_no'],amount:fenpei_amount,pai:u[0]['pai'],pai_name:u[0]['name_cn']};
            }

            await db('m_users').where({rid:rid}).whereIn('uid',arr_uid).increment('coin',fenpei_amount);
            await db('m_cpaiju').where({rid: rid}).update({bian_chi0:0});

        }

        //边池1
        if (jiang_chi['bian_chi1'] > 0) {
            //从第一名开始找， all_in_step>=1 || all_in_step=-1;
           let ulist=  await this.findRankingUsr(rid, winlist, 1);

            let fenpei_amount=Math.floor(jiang_chi['bian_chi1']/ulist.length);
            let arr_uid=[];
            for (let u of ulist) {
                arr_uid.push(u[3]['uid']);

                if (tmp_rs[u[3]['uid']] == undefined) {
                    tmp_rs[u[3]['uid']]={ranking:1,uid:u[3]['uid'],seat_no:u[3]['seat_no'],amount:fenpei_amount,pai:u[0]['pai'],pai_name:u[0]['name_cn']};
                }
                else
                {
                    tmp_rs[u[3]['uid']]['amount']= tmp_rs[u[3]['uid']]['amount']+fenpei_amount;
                }
            }

            await db('m_users').where({rid:rid}).whereIn('uid',arr_uid).increment('coin',fenpei_amount);
            await db('m_cpaiju').where({rid: rid}).update({bian_chi1:0});

        }

        //边池2
        if (jiang_chi['bian_chi2'] > 0) {
            //从第一名开始找， all_in_step>=2 || all_in_step=-1;
            let ulist=  await this.findRankingUsr(rid, winlist, 2);
            let fenpei_amount=Math.floor(jiang_chi['bian_chi1']/ulist.length);

            let arr_uid=[];
            for (let u of ulist) {
                arr_uid.push(u[3]['uid']);

                if (tmp_rs[u[3]['uid']] == undefined) {
                    tmp_rs[u[3]['uid']]={ranking:1,uid:u[3]['uid'],seat_no:u[3]['seat_no'],amount:fenpei_amount,pai:u[0]['pai'],pai_name:u[0]['name_cn']};
                }
                else
                {
                    tmp_rs[u[3]['uid']]['amount']= tmp_rs[u[3]['uid']]['amount']+fenpei_amount;
                }
            }

            await db('m_users').where({rid:rid}).whereIn('uid',arr_uid).increment('coin',fenpei_amount);
            await db('m_cpaiju').where({rid: rid}).update({bian_chi2:0});
        }

        //边池3
        if (jiang_chi['bian_chi3'] > 0) {
            //从第一名开始找， all_in_step>=3 || all_in_step=-1;
            let ulist=  await this.findRankingUsr(rid, winlist, 3);
            let fenpei_amount=Math.floor(jiang_chi['bian_chi1']/ulist.length);

            let arr_uid=[];
            for (let u of ulist) {
                arr_uid.push(u[3]['uid']);

                if (tmp_rs[u[3]['uid']] == undefined) {
                    tmp_rs[u[3]['uid']]={ranking:1,uid:u[3]['uid'],seat_no:u[3]['seat_no'],amount:fenpei_amount,pai:u[0]['pai'],pai_name:u[0]['name_cn']};
                }
                else
                {
                    tmp_rs[u[3]['uid']]['amount']= tmp_rs[u[3]['uid']]['amount']+fenpei_amount;
                }
            }

            await db('m_users').where({rid:rid}).whereIn('uid',arr_uid).increment('coin',fenpei_amount);
            await db('m_cpaiju').where({rid: rid}).update({bian_chi3:0});
        }

        if (endsAmount > 0) {
            //从第一名开始找， all_in_step>=3 || all_in_step=-1;
            let ulist=  await this.findRankingUsr(rid, winlist, 0);

            utils.log(endsAmount);
            utils.log('ulist:')
            utils.log(ulist);

            let fenpei_amount=Math.floor(endsAmount/ulist.length);

            let arr_uid=[];
            for (let u of ulist) {
                arr_uid.push(u[3]['uid']);

                if (tmp_rs[u[3]['uid']] == undefined) {
                    tmp_rs[u[3]['uid']]={ranking:1,uid:u[3]['uid'],seat_no:u[3]['seat_no'],amount:fenpei_amount,pai:u[0]['pai'],pai_name:u[0]['name_cn']};
                }
                else
                {
                    tmp_rs[u[3]['uid']]['amount']= tmp_rs[u[3]['uid']]['amount']+fenpei_amount;
                }
            }

            await db('m_users').where({rid:rid}).whereIn('uid',arr_uid).increment('coin',fenpei_amount);

        }

        for (let k in tmp_rs) {
            rs.push(tmp_rs[k]);
        }

        return rs;

    }


    /**
     *  * 排名列表中找到分配对象， 从第1名开始找， 且 all_in_step附合要求的；
     * @param rid
     * @param winlist
     * @param all_in_step
     * @returns {Promise<*>}
     */
    async findRankingUsr(rid,winlist,all_in_step) {

        let topn=1; //从第1名开始找；
        let ulist;
        let toplist;
        while (topn<=winlist.length) {
            let topnlist=winlist.filter((v,i)=>{
                return v[4]==topn; //
            });

            let arr_uid=[];
            for (let u of topnlist) {
                arr_uid.push(u[3]['uid']);
            }

            // utils.log('arr_uid');
            // utils.log(arr_uid);

            ulist=  await db('m_users')
                .where({rid: rid})
                .whereIn('uid',arr_uid)
                .where(function () {
                        this.where('all_in_step','>=',all_in_step).orWhere({all_in_step:-1})
                })
                .select('uid');

            // utils.log('ulistulist');
            // utils.log(ulist);

            //找到用户
            if (ulist && ulist.length > 0) {

                //uid二维数组转成1维
                let rs_uid_arr=[];
                for (let item of ulist) {
                    rs_uid_arr.push(item['uid']);
                }

                toplist= topnlist.filter((v,i)=>{
                    return rs_uid_arr.includes(v[3]['uid'])
                })
                break;
            }

            topn++;

        }

        return toplist;
    }

    /**
     * 房间用完后的结算， 把未用户的币退回到客户账户中
     * @param rid
     * @returns {Promise<void>}
     */
    async settlementOfRoom(rid) {

    }


    async getRoom(rid,columns,where=null){

        let cdt={rid:rid};
        if (where != null) {
            cdt = Object.assign(cdt, where);
        }
        let room=await db('m_rooms').where({rid:rid}).select(columns.split(','));
        return room[0];

    }
    async getPaiju(rid,columns,where=null){
        let cdt={rid:rid};
        if (where != null) {
            cdt = Object.assign(cdt, where);
        }
        let paiju=await db('m_cpaiju').where({rid:rid}).select(columns.split(','));
        return paiju[0];
    }

    async getUser(rid,uid,columns,where=null,returnArr=0){

        let cdt ;
        if(uid!=-1)
        {
            cdt={rid:rid,uid:uid};
        }
        else
        {
            cdt={rid:rid};
        }

        if (where != null) {
            cdt = Object.assign(cdt, where);
        }
        /*
         *
         * @type {Array}
         */
        let user=await db('m_users').where(cdt).select(columns.split(','));

        if (returnArr == 1) {
            return  user;
        }
        else{
            return user[0];

        }

    }

    async getUserBySeat(rid,seat,columns){
        let user=await db('m_users').where({rid:rid,seat_no:seat}).select(columns.split(','));
        return user[0];
    }

    /**
     * 更新用户的下注金额，叫牌次数；
     * @param rid
     * @param uid
     * @param amount
     * @returns {Promise<void>}
     */
   async jiaZhu(rid, uid, amount) {
        await db('m_users').where({rid:rid,uid:uid}).increment({t_xiazhu:amount,called:1}).decrement('coin',amount);
    }

    async jiaZhuBySeatno(rid, seat_no, amount) {
        await db('m_users').where({rid:rid,seat_no:seat_no}).increment('t_xiazhu',amount).decrement('coin',amount);
    }

    /**
     *在count_touzhu中， 记录本轮加注的最大金额;  单轮的最高值
     * @param rid
     * @param amount
     * @returns {Promise<void>}
     */
     async  sumJiazhu(rid,amount){
        await db('m_cpaiju').where({rid: rid}).increment('count_touzhu', amount);
    }

    /**
     * 洗牌,生成牌局,
     * @param rid
     * @returns {Promise<void>}
     */
    async createPaiju(rid) {

        //洗牌
        let pai = _.shuffle(this.PukePai);

        //分牌
        let pre_paiju = await db('m_cpaiju').where({rid:rid}).select();

        let p_pub={poker_pub:pai.slice(0, 5).join(',')}
        let p_pri={
            poker_pri: [pai.slice(5, 7).join(','),
           pai.slice(7,9).join(','),
           pai.slice(9,11).join(','),
           pai.slice(11,13).join(','),
           pai.slice(13,15).join(','),
           pai.slice(15,17).join(','),
           pai.slice(17,19).join(','),
           pai.slice(19,21).join(','),
           pai.slice(21,23).join(',')].join('|')
        }

        /**
         * 测试数据 todo 正式的时候记得去掉
         */

        //  p_pub={poker_pub:'51,50,49,48,47'}
        //  p_pri={
        //     poker_pri: '1,2|3,4|5,6|7,8|9,10|11,12|13,14|15,16|17,18'
        // }
        /**
         * 测试数据  正式的时候记得去掉
         */


        // let sum_user = await db('m_rooms').where({rid: rid}).select('sum_user');
        // sum_user=sum_user[0].sum_user;

        let d_seat=pre_paiju[0]['d_seat'];
        let roominfo =await db('m_rooms').where({rid:rid}).select('seat_list,xm_v,sum_user'.split(','));

        let seat_list=roominfo[0]['seat_list'].split(',');

        //设置D位-庄位
        if(d_seat==-1){

            //第一次开始;
            //随机一个位置,
            d_seat=seat_list.findIndex(a=>{return a>0});
        }
        else
        {
           //d位的下一位;
            d_seat=await this.getNextSeatFromUsers(rid,d_seat);
            d_seat = d_seat['seat_no'];
        }

        //小盲位: 取d_seat的后一个座位号;
        let xm_w
        xm_w=await this.getNextSeatFromUsers(rid,d_seat);
        xm_w=xm_w['seat_no']

        //大盲位:小盲位的下一位；
        let dm_w;
        dm_w=await this.getNextSeatFromUsers(rid,xm_w);
        dm_w=dm_w['seat_no']
        //设置为 大盲位的下一位;
        let call_seat;
        call_seat=await this.getNextSeatFromUsers(rid,dm_w);
        call_seat=call_seat['seat_no']

        utils.log(xm_w+","+dm_w+","+call_seat);

        await db('m_cpaiju')
            .where({rid: rid})
            .increment("id", 1)
            .update(
                Object.assign(
                    p_pub,
                    p_pri,
                    {
                        d_seat:d_seat,
                        xm_seat:xm_w,
                        dm_seat:dm_w,
                        call_seat:call_seat,
                    }))

        //小盲注金额
        let xiaomang_v=roominfo[0]['xm_v'];
        //设置小盲,大盲用户下注;
        await this.jiaZhuBySeatno(rid,xm_w,xiaomang_v);
        await this.jiaZhuBySeatno(rid,dm_w,xiaomang_v*2);

        //设置加注金额
        this.sumJiazhu(rid,xiaomang_v*2);


    }

    async calculateScore(paiju) {

    }



    /**
     *发送底牌指令,包含大、小盲的下注；
     * @param rid
     * @returns {Promise<void>}
     * @constructor
     */
    async SendDipai(rid) {

        let users = await db('m_users').where({rid:rid,status:1}).select('uid,seat_no,coin'.split(','));
        let paiju = await db('m_cpaiju').where({rid:rid}).select('rid,poker_pri,d_seat,xm_seat,dm_seat'.split(','));
        let dipai=paiju[0]['poker_pri'].split('|')
        let wss;
        let pai;

        //房间内所有完家的 uid,seat_no 组成的列表
        let ul = [];
        for (let usr of users) {
            ul.push({uid: usr['uid'], seat_no: usr['seat_no'], coin: usr['coin']});
        }

        let dm_v=await db('m_users').where({rid:rid,seat_no:paiju[0]['dm_seat']}).select('t_xiazhu');
        let xm_v=await db('m_users').where({rid:rid,seat_no:paiju[0]['xm_seat']}).select('t_xiazhu');
        //大小盲 下注
        let paijuinfo={
            d_seat:paiju[0]['d_seat'],
            xm_seat:paiju[0]['xm_seat'],
            dm_seat:paiju[0]['dm_seat'],
            call_seat:paiju[0]['call_seat'],
            xm_value:xm_v[0].t_xiazhu,
            dm_value:dm_v[0].t_xiazhu,
        }

        //给每个人发底牌
        for (let usr of users) {
            wss = ws_clients[rid][usr['uid']];
            pai = dipai[usr['seat_no']]; //取出自己的底牌
            let d = {uid: usr['uid'], dipai: pai, userlist: ul,paiju:paijuinfo}
            let sendData = makeData(rid, 110, '发底牌', d)
            wss.send(JSON.stringify(sendData));
        }

    }

    get_real_seatno(seatno) {
        return seatno%9
    }

    /**
     * 获取下一位的座位号
     * @param seatlist  m_rooms表中的 seat_list;
     * @param seat_no
     */
    getNextSeat(seatlist,seat_no){

        let next_seatno=seatlist.findIndex((uid,index)=>{return (uid>0 && index>seat_no)});
        if(next_seatno==-1)
        {
            //如果后面没找到, 从头开始找;
            next_seatno=seatlist.findIndex((uid,index)=>{return (uid>0)});
        }
        return next_seatno;
    }

    /**
     * 基于room表中的seat_list查找
     * @param rid
     * @param seat_no
     * @returns  [坐位号, uid]
     */
    async getNextSeatByRid(rid, seat_no) {
        let room = await this.getRoom(rid, 'seat_list');
        let seatlist = room.seat_list.split(',');
        let next_seatno=seatlist.findIndex((uid,index)=>{return (uid>0 && index>seat_no)});
        if(next_seatno==-1)
        {
            //如果后面没找到, 从头开始找;
            next_seatno=seatlist.findIndex((uid,index)=>{return (uid>0)});
        }
        return [next_seatno,seatlist[next_seatno]] ;
    }

    /**
     * 从m_users表中, 根据当前座位号, 找到下一个座位号
     * @param rid
     * @param start_seat
     * @returns {seat_no:xxx,uid:xxx}
     */
    async getNextSeatFromUsers(rid,start_seat) {

        //找到下一位, all in 的用户除外;
        let seat_list= await db('m_users')
            .where({rid:rid,status:1,all_in_step:-1})
            .orderBy('seat_no','asc')
            .select('seat_no,uid'.split(','));

        //小盲位: 取d_seat的后一个座位号;
        let xm_w=seat_list.find(a=>{return a.seat_no>start_seat});

        if(xm_w==undefined){

            let rs=seat_list.find(a=>{return a.seat_no>=0});
             return  rs;

        }
        else
        {
          return xm_w;
        }
    }

    /**
     * 判断本轮叫牌结束
     * 在未弃牌的所有用户中, 查找投注金额小于"当前轮"最大投注金额的, 如果没找到,返回true, 否则返回false
     *
     * @param rid
     * @returns {Promise<boolean>}
     */
    async  allUsersCalled(rid) {
        let paiju=await  this.getPaiju(rid,'count_touzhu');

        //未弃牌的用户,是否都叫过牌了?
        let users = await db('m_users').where({rid: rid, status: 1,all_in_step:-1}).andWhere('called', '<=', 0).select('uid');
        if(users && users.length>0){
            utils.log('还有人没叫牌！')
            utils.log(users)
            return false;

        }
        //如果都叫过牌, 判断 投注金额是否都一到致了;
         users=await db('m_users').where({rid:rid,status:1,all_in_step:-1}).andWhere('t_xiazhu','<',paiju['count_touzhu']).select('uid')
        if(users && users.length>0){
            utils.log('投注金额不相同')
           return false;
        }

        return true;
    }


    async test(ctx, next) {
        let rs = await db.select().from('slg_user').timeout(2000);

        utils.log(rs[0].user_name);
        utils.log(rs[0].nick_name);
        ctx.body = JSON.stringify(rs[0]);
    }


    /**
     * 将用户的牌从大到小排序；返回排序好的列表；
     * @param rid
     * @returns {Promise<[ { code: 96, name_cn: '同花', name_en: '', pai: [ [1，1，1，1，1], [1，5，9，13，17] ] },  850,  1211100604,{uid:xx,seat_no:xx},ranking]>}
     */
   async sortUserPoker(rid) {

       let  poker=await this.getPaiju(rid,"poker_pub,poker_pri");
       let pai_pub = poker['poker_pub'].split(',');
       let pai_pri=poker['poker_pri'].split('|');

       let pai_rslist=[];

       let usr_list=await db('m_users').where({rid: rid,status:1}).select('uid,seat_no'.split(','));

       //将每个人的底牌和公共牌拼在一起，拼成各自的7张牌； 然后计算牌面的大小；
       usr_list.forEach((v,i)=>{
           let pri=pai_pri[v['seat_no']].split(',');
           let pai=pri.concat(pai_pub);
           utils.log(pai);
           let pai_result=dezhou.getPaiValue7(pai);
           pai_result[3]=v;  //加上用户的uid,seat_no到列表中；
           pai_rslist.push(pai_result);
       })

       //从大到小排序 pai_rslist
        utils.log(JSON.stringify(pai_rslist));

       return  dezhou.sortPaiList(pai_rslist);

    }

    /**
     * 重新初始化牌局数据
     * @param rid{number} roomid
     * @returns {Promise<void>}
     */
  async initPaiju(rid){
        await db('m_cpaiju').where({rid: rid}).update({
            poker_pub: '',
            poker_pri: '',
            di_chi:0,
            bian_chi0:0,
            bian_chi1:0,
            bian_chi2:0,
            bian_chi3:0,
            xm_seat:-1,
            dm_seat:-1,
            call_seat:-1,
            count_touzhu:0,
            start_seat:-1,
            end_seat:-1,
            step:0
        })

        //金额不足的, 把状态设置为3
        let xm_v = await this.getRoom(rid, 'xm_v');
        await db('m_users')
            .where({rid: rid})
            .andWhere('coin','<',xm_v['xm_v'])
            .update({
                status: 3, //金额不足
            })

        //重置满足条件的用户
        await db('m_users').where({rid: rid}).whereIn('status',[1,2]).update({
            status: 1,
            t_xiazhu: 0,
            called:0,
            all_in_step:-1,
            ming_pai:0,
            t_xiazhu_benju:0
        })



    }


    /**
     * 获得当前阶段,还未弃牌的所有用户, 不包含all in的;
     * @param rid
     * @param step
     * @returns {Promise<awaited Knex.QueryBuilder<TRecord, ArrayIfAlready<TResult, DeferredKeySelection<TRecord, string>>>>}
     */
    async getUsersStillInExceptAllIn(rid,step) {
        let uslist = await db('m_users').where({
            rid: rid,
            status: 1,
            all_in_step:-1
        }).select('uid,seat_no'.split(','));
        return uslist;
    }

    /**
     * 获得当前自已牌局,还未弃牌的所有用户
     * @param rid
     * @returns {[{uid:xxx,seat_no},{},{}]}
     */
    async getUsersStillIn(rid) {
        let uslist = await db('m_users').where({
            rid: rid,
            status: 1
        }).select('uid,seat_no'.split(','));
        return uslist;
    }

    /**
     * 写入牌局日志
     * @param rid
     */
    async writePaijuLog(rid,windata) {
        let room=await this.getRoom(rid,'rid,code,seat_list');
        let cpaiju = await this.getPaiju(rid, 'id,poker_pub,poker_pri,di_chi,bian_chi,d_seat,xm_seat,dm_seat,step');
        let log_data={
            rid:rid,
            room_code:room.code,
            paiju_no:cpaiju.id,
            poker_pub:cpaiju.poker_pub,
            poker_pri:cpaiju.poker_pri,
            di_chi:cpaiju.di_chi,
            bian_chi:cpaiju.bian_chi,
            d_seat: cpaiju.d_seat,
            xm_seat: cpaiju.xm_seat,
            dm_seat: cpaiju.dm_seat,
            step:cpaiju.step,
            seat_list:room.seat_list,
            update_time:moment().unix(),
            winner_detail: JSON.stringify(windata),
            seat_xiazhu_log:'',
            seat_balance_log:'',
            seat_coin_log:''
        }

        let seat_list_arr = room.seat_list.split(',');
        let xiazhu_benju = [];
        let user_balance = [];
        for (let i = 0; i < seat_list_arr.length; i++) {
            if (seat_list_arr[i] == 0) {
                xiazhu_benju[i]=0;
                user_balance[i]=0;
                continue;
            }
            let usr=await this.getUser(rid, seat_list_arr[i], 't_xiazhu_benju,coin');
            xiazhu_benju[i] = usr['t_xiazhu_benju'];
            user_balance[i] = usr['coin'];
        }

        //各个的下注金额;
        log_data.seat_xiazhu_log = xiazhu_benju.join(',');
        //各用户的房间积分余额
        log_data.seat_balance_log = user_balance.join(',');

        //各用户的变动积分;
        let seat_coin_log=new Array(seat_list_arr.length).fill(0);

        for (let wd of windata) {
            seat_coin_log[wd['seat_no']] = wd['amount'];
        }
        for (let i=0;i<seat_coin_log.length;i++){
                //本局的获利积分数;
                seat_coin_log[i]=seat_coin_log[i]-xiazhu_benju[i];

        }

        log_data.seat_coin_log=seat_coin_log.join(',');

        await db('slg_paiju_log').insert(log_data);


    }


    async getGamePaijuHistory(ctx,next){
        let rid =ctx.request.body.rid;
        let uid=ctx.request.body.uid;

        utils.log(rid+","+uid)

        let hisList = await db('slg_paiju_log').where({
            rid: rid
        }).orderBy('paiju_no', 'desc').select('poker_pub,winner_detail,seat_list,seat_coin_log,poker_pri'.split(',')).limit(3);

        utils.log('hislist:');
        utils.log(hisList)


        let send_data={
            code:1,
            rid:rid,
            uid:uid,
            data:[]
        };

        if (hisList && hisList.length > 0) {
            for (let i = 0; i < hisList.length; i++) {

                let win_dipai=null;
                let win_detail=JSON.parse(hisList[i].winner_detail)[0];
                if (win_detail.dipai != undefined) {
                    win_dipai = win_detail.dipai.split(',');
                }

                let me_seat_no = hisList[i].seat_list.split(',').indexOf(uid);
                me_seat_no=parseInt(me_seat_no)
                utils.log('me_seat_no');
                utils.log(me_seat_no);
                let me_pai = hisList[i].poker_pri.split('|')[me_seat_no];

                utils.log('me_pai:');
                utils.log(me_pai);
                let coin_log = hisList[i].seat_coin_log.split(',')[me_seat_no];

                let d={
                    poker_pub: hisList[i].poker_pub.split(','),
                    win_pai:win_dipai,
                    me_pai:me_pai.split(','),
                    amount:coin_log,
                    win_uid:win_detail.uid,
                };

                send_data.data[i]=d;
            }
            utils.log( JSON.stringify(send_data));
            ctx.body = JSON.stringify(send_data);
        }
        else
        {
            ctx.body = JSON.stringify({code: -1, msg: '暂无数据'});
        }

    }
}

module.exports = GameController;