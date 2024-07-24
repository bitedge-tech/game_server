exports.config= {
    db:{
        client: 'mysql',
        connection: {
            host : '127.0.0.1',
            user : 'root',
            password : 'root',
            database : 'sl_game_db'
        },
        pool: { min: 0, max: 7 }
    },
    db_2:{
        client: 'mysql',
        connection: {
            host : '127.0.0.1',
            user : 'sl_game_db',
            password : 'krfyWsyEzx72fBHs',
            database : 'sl_game_db'
        },
        pool: { min: 0, max: 7 }
    },
    coinlog_code:{
      '101':'出账',
      '102':'入账',
    },


    debug:true,
}
