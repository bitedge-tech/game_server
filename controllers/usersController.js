"use strict";


class UsersController {


    /**
     * 获取用户的信息
     * @param ctx
     * @param next
     * @returns {Promise<void>}
     */
    async getUserInfo(ctx,next){
        let uid=ctx.request.body.uid;

        let rs = await db('slg_user')
            .where({id: uid})
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

module.exports=UsersController;