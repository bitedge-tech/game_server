"use strict";


class LoginController {

    /**
     * 登录,debug
     * @param ctx
     * @param next
     * @returns {Promise<void>}
     */
    async login(ctx,next){
        let username=ctx.request.body.username;
        let pwd=ctx.request.body.pwd;
        // let pwd=parseInt(ctx.request.body.pwd);
        let rs = await db('slg_user')
            .where({user_name: username})
            .select({uid: 'id'}, {userno: 'user_no'}, {nickname: 'nick_name'}, 'coin', 'headimg', 'sex','diamond_amount')
            .timeout(2000);

        let rs_data={}
        if(rs && rs.length>0)
        {
            rs_data.code=1;
            rs_data.data=rs[0];
        }


        ctx.body=JSON.stringify(rs_data);
    }



}

module.exports=LoginController;