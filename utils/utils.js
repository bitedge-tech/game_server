const {config}=require('../config')

class Utils {
    static log(msg){
        if(config.debug){
            console.log(msg);
        }
    }

    static  async coinLog(data,trx=null) {
        let coinlog_data={
            comment: config.coinlog_code[data.code],
            coin:0,
            create_time:moment().format('YYYY-MM-DD HH:mm:ss'),
        };
        Object.assign(coinlog_data,data)
        if(trx!=null)
        {
            await trx('slg_coin_log').insert(coinlog_data);
        }
        else {
            await db('slg_coin_log').insert(coinlog_data);
        }

    }


}

module.exports=Utils;