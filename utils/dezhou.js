const {poker}=require('./poker');

class Dezhou {

    /**
     * 传入牌面, 计算出牌面的值
     *
     * @param pai [1,20,30,40,50]
     * 返回结果:　［[牌型名称],[牌型值],[大小值]］
     */
    getPaiValue(pai52) {

        //将牌转成 [[花色(1-4)],[牌值(2-14)]]
        let pai13=this.p52to13(pai52);
        //按排值进行排序;
        pai13 = this.sortPai(pai13);

        //判断牌型,计算牌型值
        let paixing=this.getPaiXingScore(pai13);

        //计算高牌大小值;
        let gaopai_score=0;
        gaopai_score=  this.getGaopaiScore(pai13);
        if( paixing[0].code==93 ){

            //2对, 需要按AABBC的排序计算分数; todo

        }

        //返回 ［[牌型名称],[牌型值],[大小值]］
        paixing[2]=gaopai_score;
        return paixing;

    }

    /**
     * 计算7张牌的牌型分值,返回
     *
     * [
         { code: 96, name_cn: '同花', name_en: '', pai: [ [1，1，1，1，1], [1，5，9，13，17] ] }, //基本信息
          850, //牌型值
          1211100604  //牌大小值
       ]
     * @param pai52 [1,2,3,4,5,6,7]
     */
    getPaiValue7(pai52) {
        //将牌转成 [[花色(1-4)],[牌值(2-14)]]
        let pai13=this.p52to13(pai52);
        //按排值进行排序;
        pai13 = this.sortPai(pai13);

        //判断牌型,计算牌型值 [{code:xx,name_cn:xx,name_en:xx,pai:[[1,1,1,1],[1,2,3,4,5]]},950]
        let paixing=this.getPaiXingScore7(pai13);


        //计算高牌大小值; 同花顺, 顺子不需要计算 ;
        let gaopai_score=0;
        if(paixing[0].code!=100 && paixing[0].code!=99  && paixing[0].code!=95){

            gaopai_score=  this.getGaopaiScore(paixing[0].pai);
        }

        //返回 ［[牌型名称],[牌型值],[大小值]］
        paixing[2]=gaopai_score;
        return paixing;
    }

    /**
     * 对一组 结果牌进行从大到小排序， 并从1到N进行排名次；
     * @param pai_rslist  [[],[],[]]
     * @returns
     */
    sortPaiList(pai_rslist) {
        let pai_sort= pai_rslist.sort((a,b)=>{

            if(a[1]==b[1]){
                return b[2]-a[2];
            }else{
                return b[1] - a[1];
            }

        })

        //名次编号
        let ranking=1;
        for(let i=0; i<pai_sort.length;i++){

            //第一位设置第一名，然后判断第二位
            if(i==0){
                pai_sort[i][4]=ranking;
                continue;
            }

            //如果分数与上一位一样， 则名次也设置一样；
            if((pai_sort[i][1]==pai_sort[i-1][1]) && (pai_sort[i][2]==pai_sort[i-1][2])){
                pai_sort[i][4]=ranking;
                continue;
            }
            else
            {
                ranking++;
                pai_sort[i][4]=ranking;
            }



        }

        console.log(pai_sort)

        return  pai_sort;
    }

    /**
     * 0-51 转成  2-14; 花色: 1-4;
     * @param pai, [10,20,30,40,50]
     * @returns [[花色],[牌面值]]
     */
    p52to13(pai)
    {
        let rs_pai=[];
        let rs_huase=[];
        for(let i=0;i<pai.length;i++){
            let p=pai[i];
            rs_pai[i]=Math.floor(p/4)+2;
           let t= p%4;
           rs_huase[i]=t+1;
        }

        return [rs_huase,rs_pai];
    }

    /**
     * 牌进行排序
     * @param pai [[花色],[牌面值]]
     * @returns [[花色],[牌面值]]
     */
    sortPai(pai){
        let ps=pai[1].slice(0)
        let tp=pai[1].slice(0);
        let th=pai[0].slice(0);

        // console.log(tp);
        // console.log(th)
        ps=ps.sort(function (a,b) {return b-a
        })

        let hs=[]

        for(let j=0;j<ps.length;j++){
            for(let i=0;i<tp.length;i++){
                if(ps[j]==tp[i]){

                    let t=th.splice(i,1);
                    hs[j]=t[0];
                    tp.splice(i,1);
                    break;
                }
            }
        }

        // console.log(th)
        // console.log(tp)
        return [hs,ps]
    }

    /**
     * 计算牌型分数  5张牌
     * @param pai13  [[花色],[牌面值]]
     * @returns ["牌型名称",分数]
     */
    getPaiXingScore(pai13) {
        let hs=pai13[0];
        let pv=pai13[1];

        hs=hs.join(',');
        pv=pv.join(',');

        console.log(hs);
        console.log(pv)

        if(poker.huase.includes(hs) &&  poker.shunzi.includes(pv)) {
            //同花顺
            let tmp= poker.straight_flush[poker.shunzi.indexOf(pv)];
            if(tmp==1000)
            {
                return [poker.paiXingName[0],tmp];
            }
            else {
                return [poker.paiXingName[1],tmp];
            }
        }

        //四条
        let pv1=pai13[1].slice(0,4).join(',');
        let pv2=pai13[1].slice(1,5).join(',');
        if (poker.sitiao.includes(pv1) ) {
            let tmp= poker.four_of_akind[poker.sitiao.indexOf(pv1)];
            return [poker.paiXingName[2],tmp];
        }
        if ( poker.sitiao.includes(pv2)) {
            let tmp= poker.four_of_akind[poker.sitiao.indexOf(pv2)];
            return [poker.paiXingName[2],tmp];
        }

        //葫芦
         pv1=pai13[1].slice(0,3).join(',');
         pv2=pai13[1].slice(3,5).join(',');
        if(poker.santiao.includes(pv1) && poker.duizi.includes(pv2)){
            let tmp= poker.full_house[poker.santiao.indexOf(pv1)];
            return [poker.paiXingName[3],tmp];
        }
        pv1=pai13[1].slice(2,5).join(',');
        pv2=pai13[1].slice(0,2).join(',');
        if(poker.santiao.includes(pv1) && poker.duizi.includes(pv2)){
            let tmp= poker.full_house[poker.santiao.indexOf(pv1)];
            return [poker.paiXingName[3],tmp];
        }

        //同花
        if (poker.huase.includes(hs)) {
            let tmp=  poker.flush[0];
            return [poker.paiXingName[4],tmp];
        }

        //顺子
        if(poker.shunzi.includes(pv)){
            let tmp= poker.straight[poker.shunzi.indexOf(pv)];
            return [poker.paiXingName[5],tmp];
        }

        //三条
        pv1=pai13[1].slice(0,3).join(',');

        if(poker.santiao.includes(pv1)){
            let tmp= poker.three_of_akind[poker.santiao.indexOf(pv1)];
            return [poker.paiXingName[6],tmp];
        }
        pv1=pai13[1].slice(1,4).join(',');
        if(poker.santiao.includes(pv1) ){
            let tmp= poker.three_of_akind[poker.santiao.indexOf(pv1)];
            return [poker.paiXingName[6],tmp];
        }
        pv1=pai13[1].slice(2,5).join(',');
        if(poker.santiao.includes(pv1) ){
            let tmp= poker.three_of_akind[poker.santiao.indexOf(pv1)];
            return [poker.paiXingName[6],tmp];
        }


        //两对, 三种情况: [0,1],[2,3]; [0,1],[3,4];  [1,2],[3,4]
        pv1=pai13[1].slice(0,2).join(',')
        pv2=pai13[1].slice(2,4).join(',');
        let pv3=pai13[1].slice(3,5).join(',');
        if(poker.duizi.includes(pv1) && (poker.duizi.includes(pv2) || poker.duizi.includes(pv3))){
            let tmp= poker.two_pair[poker.duizi.indexOf[pv1]];
            return [poker.paiXingName[7],tmp];
        }
        pv1=pai13[1].slice(1,3).join(',')
        pv2=pai13[1].slice(3,5).join(',');
        if(poker.duizi.includes(pv1) && (poker.duizi.includes(pv2) )){
            let tmp= poker.two_pair[poker.duizi.indexOf[pv1]];
            return [poker.paiXingName[7],tmp];
        }


        //一对  四种: [0,1],[1,2],[2,3],[3,4]

        pv1=pai13[1].slice(0,2).join(',');
        if(poker.duizi.includes(pv1)){
            let tmp=  poker.one_pair[poker.duizi.indexOf(pv1)]
            return [poker.paiXingName[8],tmp];
        }
        pv1=pai13[1].slice(1,3).join(',');
        if(poker.duizi.includes(pv1)){
            let tmp=  poker.one_pair[poker.duizi.indexOf(pv1)]
            return [poker.paiXingName[8],tmp];
        }
        pv1=pai13[1].slice(2,4).join(',');
        if(poker.duizi.includes(pv1)){
            let tmp=  poker.one_pair[poker.duizi.indexOf(pv1)]
            return [poker.paiXingName[8],tmp];
        }
        pv1=pai13[1].slice(3,5).join(',');
        if(poker.duizi.includes(pv1)){
            let tmp=  poker.one_pair[poker.duizi.indexOf(pv1)]
            return [poker.paiXingName[8],tmp];
        }

        //高牌
        return [poker.paiXingName[9],poker.high_card[0]];

    }

/****************************************************************/
    straight_flush(sub_h,sub_p){
        let p1=sub_p.join(',');
        let h1=sub_h.join(',');
        if(poker.huase.includes(h1) &&  poker.shunzi.includes(p1)) {

            let tmp= poker.straight_flush[poker.shunzi.indexOf(p1)];

            if(tmp==1000)
            {
                let poker_pai=JSON.parse(JSON.stringify(poker.paiXingName[0]));
                poker_pai.pai=[sub_h,sub_p];
                return [poker_pai,tmp];
            }
            else {

                let poker_pai=JSON.parse(JSON.stringify(poker.paiXingName[1]));
                poker_pai.pai=[sub_h,sub_p]
                return [poker_pai,tmp];
            }
        }
        else
        {
            return false;
        }
    }

    /**
     *
     * @param sub_h
     * @param sub_p
     * @returns {(any)[牌型名称,牌型值]|boolean}
     */
    four_of_akind(sub_h, sub_p) {
        let p1=sub_p.join(',');
        if (poker.sitiao.includes(p1) ) {
            let tmp= poker.four_of_akind[poker.sitiao.indexOf(p1)];
            let poker_pai=JSON.parse(JSON.stringify(poker.paiXingName[2]));
            poker_pai.pai=[sub_h,sub_p]
            return [poker_pai,tmp];
        }
        else
        {
            return  false;
        }
    }

    //葫芦
    full_house(sub_h, sub_p) {
        let pv1=sub_p.slice(0,3).join(',');
        let pv2=sub_p.slice(3,5).join(',');
        if(poker.santiao.includes(pv1) && poker.duizi.includes(pv2)){
            let tmp= poker.full_house[poker.santiao.indexOf(pv1)];
            let poker_pai=JSON.parse(JSON.stringify(poker.paiXingName[3]));
            poker_pai.pai=[sub_h,sub_p]
            return [poker_pai,tmp];
        }
        pv1=sub_p.slice(2,5).join(',');
        pv2=sub_p.slice(0,2).join(',');
        if(poker.santiao.includes(pv1) && poker.duizi.includes(pv2)){
            let tmp= poker.full_house[poker.santiao.indexOf(pv1)];
            let poker_pai=JSON.parse(JSON.stringify(poker.paiXingName[3]));
            poker_pai.pai=[sub_h,sub_p]
            return [poker_pai,tmp];
        }

        return false;
    }

    flush(sub_h,sub_p){
        let h=sub_h.join(',');
        if(poker.huase.includes(h)){
            let tmp= poker.flush[0];
            let poker_pai=JSON.parse(JSON.stringify(poker.paiXingName[4]));
            poker_pai.pai=[sub_h,sub_p]
            return [poker_pai,tmp];
        }


    }

    //顺子
    straight(sub_h,sub_p){
        let p1=sub_p.join(',');
        if( poker.shunzi.includes(p1)) {

            let tmp= poker.straight[poker.shunzi.indexOf(p1)];

            let poker_pai=JSON.parse(JSON.stringify(poker.paiXingName[5]));
            poker_pai.pai=[sub_h,sub_p]
            return [poker_pai,tmp];
        }
        else
        {
            return false;
        }
    }

    //三条
    three_of_akind(sub_h,sub_p,start,end){
        let pv1=sub_p.slice(start,end).join(',');
        if(poker.santiao.includes(pv1) ){
            let tmp= poker.three_of_akind[poker.santiao.indexOf(pv1)];

            let poker_pai=JSON.parse(JSON.stringify(poker.paiXingName[6]));
            poker_pai.pai=[sub_h,sub_p]
            return [poker_pai,tmp];
        }

        return  false;
    }

    //两对 AABBC
    two_pair(sub_h,sub_p){

        let pv1=sub_p.slice(0,2).join(',');
        let pv2=sub_p.slice(2,4).join(',');
        if(poker.duizi.includes(pv1) && (poker.duizi.includes(pv2) )){
            let tmp= poker.two_pair[poker.duizi.indexOf(pv1)];
            let poker_pai=JSON.parse(JSON.stringify(poker.paiXingName[7]));
            poker_pai.pai=[sub_h,sub_p]
            return [poker_pai,tmp];
        }

    }

    //一对;
    one_pair(sub_h,sub_p,start,end){
        let pv1=sub_p.slice(start,end).join(',');
        if(poker.duizi.includes(pv1) ){
            let tmp= poker.one_pair[poker.duizi.indexOf(pv1)];

            let poker_pai=JSON.parse(JSON.stringify(poker.paiXingName[8]));
            poker_pai.pai=[sub_h,sub_p]
            return [poker_pai,tmp];
        }

        return  false;
    }

 /**********************************************************/
    /**
     * 计算牌型分数 7张牌;
     * @param pai13
     */
    getPaiXingScore7(pai13){
        let hs=pai13[0];
        let pv=pai13[1];

        hs=hs.join(',');
        pv=pv.join(',');
        console.log("原牌:")
        console.log(hs);
        console.log(pv)


        //同花顺 3种;  0,1,2,3,4; 1,2,3,4,5;  2,3,4,5,6;
        let sub_p=pai13[1].slice(0,5);
        let sub_h=pai13[0].slice(0,5);
        let rs=this.straight_flush(sub_h,sub_p);
        if(rs)
        {
            return  rs;
        }

         sub_p=pai13[1].slice(1,6);
         sub_h=pai13[0].slice(1,6);
        rs=this.straight_flush(sub_h,sub_p);
        if(rs)
        {
            return  rs;
        }

        sub_p=pai13[1].slice(2,7);
        sub_h=pai13[0].slice(2,7);
        rs=this.straight_flush(sub_h,sub_p);
        if(rs)
        {
            return  rs;
        }

        /**************************************************/

        //四条 4种; 0-3, 1-4,2-5,3-6;
         sub_p=pai13[1].slice(0,4);
         sub_h=pai13[0].slice(0,4);  //花色
        rs =this.four_of_akind(sub_h, sub_p);
        if (rs) {
            rs[0].pai[0]= sub_h.concat(pai13[0].slice(4,5));
            rs[0].pai[1]=sub_p.concat(pai13[1].slice(4,5));
            return  rs;
        }
        sub_p=pai13[1].slice(1,5);
        sub_h=pai13[0].slice(1,5);
        rs =this.four_of_akind(sub_h, sub_p);
        if (rs) {

            //把最大的牌加进去,放到最前面, 满5张;
            rs[0].pai[0].unshift(pai13[0].slice(0,1)[0]);
            rs[0].pai[1].unshift(pai13[1].slice(0,1)[0]);
            return  rs;
        }
        sub_p=pai13[1].slice(2,6);
        sub_h=pai13[0].slice(2,6);
        rs =this.four_of_akind(sub_h, sub_p);
        if (rs) {
            //把最大的牌加进去,放到最前面, 满5张;
            rs[0].pai[0].unshift(pai13[0].slice(0,1)[0]);
            rs[0].pai[1].unshift(pai13[1].slice(0,1)[0]);
            return  rs;
        }
        sub_p=pai13[1].slice(3,7);
        sub_h=pai13[0].slice(3,7);
        rs =this.four_of_akind(sub_h, sub_p);
        if (rs) {
            //把最大的牌加进去,放到最前面, 满5张;
            rs[0].pai[0].unshift(pai13[0].slice(0,1)[0]);
            rs[0].pai[1].unshift(pai13[1].slice(0,1)[0]);
            return  rs;
        }

        /**************************************************/

        //葫芦 12种  0-2[3-4,4-5,5-6],1-3[4-5,5-6],2-4[0-1,5-6],3-5[0-1,1-2],4-6[0-1,1-2,2-3];
        let tmp_list=[];
        sub_p=pai13[1].slice(0,5);
        sub_h=pai13[0].slice(0,5);
        tmp_list.push([sub_h,sub_p]);
        sub_p=pai13[1].slice(0,3).concat(pai13[1].slice(4,6));
        sub_h=pai13[0].slice(0,3).concat(pai13[0].slice(4,6));
        tmp_list.push([sub_h,sub_p]);
        sub_p=pai13[1].slice(0,3).concat(pai13[1].slice(5,7));
        sub_h=pai13[0].slice(0,3).concat(pai13[0].slice(5,7));
        tmp_list.push([sub_h,sub_p]);

        sub_p=pai13[1].slice(1,4).concat(pai13[1].slice(4,6));
        sub_h=pai13[0].slice(1,4).concat(pai13[0].slice(4,6));
        tmp_list.push([sub_h,sub_p]);
        sub_p=pai13[1].slice(1,4).concat(pai13[1].slice(5,7));
        sub_h=pai13[0].slice(1,4).concat(pai13[0].slice(5,7));
        tmp_list.push([sub_h,sub_p]);

        sub_p=pai13[1].slice(0,2).concat(pai13[1].slice(2,5));
        sub_h=pai13[0].slice(0,2).concat(pai13[0].slice(2,5));
        tmp_list.push([sub_h,sub_p]);
        sub_p=pai13[1].slice(2,5).concat(pai13[1].slice(5,7));
        sub_h=pai13[0].slice(2,5).concat(pai13[0].slice(5,7));
        tmp_list.push([sub_h,sub_p]);

        sub_p=pai13[1].slice(0,2).concat(pai13[1].slice(3,6));
        sub_h=pai13[0].slice(0,2).concat(pai13[0].slice(3,6));
        tmp_list.push([sub_h,sub_p]);
        sub_p=pai13[1].slice(1,3).concat(pai13[1].slice(3,6));
        sub_h=pai13[0].slice(1,3).concat(pai13[0].slice(3,6));
        tmp_list.push([sub_h,sub_p]);

        sub_p=pai13[1].slice(0,2).concat(pai13[1].slice(4,7));
        sub_h=pai13[0].slice(0,2).concat(pai13[0].slice(4,7));
        tmp_list.push([sub_h,sub_p]);
        sub_p=pai13[1].slice(1,3).concat(pai13[1].slice(4,7));
        sub_h=pai13[0].slice(1,3).concat(pai13[0].slice(4,7));
        tmp_list.push([sub_h,sub_p]);
        sub_p=pai13[1].slice(2,4).concat(pai13[1].slice(4,7));
        sub_h=pai13[0].slice(2,4).concat(pai13[0].slice(4,7));
        tmp_list.push([sub_h,sub_p]);

        for(let item of tmp_list){
            rs=this.full_house(item[0],item[1]);
            if(rs){
                return  rs;
                break;
            }
        }
        /**************************************************/

        //同花

        let tmp_hs=pai13[0].slice(0);
        let tmp_pv=pai13[1].slice(0)
        let tmp_pai=this.sortPai([tmp_pv,tmp_hs]); //按第二个参数进行排序;
        let th_pai=[tmp_pai[1],tmp_pai[0]];

        sub_h=th_pai[0].slice(0,5);
        sub_p=th_pai[1].slice(0,5);
        rs=this.flush(sub_h,sub_p);
        if(rs)
        {
            return  rs;
        }

        sub_h=th_pai[0].slice(1,6);
        sub_p=th_pai[1].slice(1,6);
        rs=this.flush(sub_h,sub_p);
        if(rs)
        {
            return  rs;
        }

        sub_h=th_pai[0].slice(2,7);
        sub_p=th_pai[1].slice(2,7);
        rs=this.flush(sub_h,sub_p);
        if(rs)
        {
            return  rs;
        }



        /**************************************************/
        //顺子 3种 [0,1,2,3,4], [1,2,3,4,5], [2,3,4,5,6]
         sub_p=pai13[1].slice(0,5);
         sub_h=pai13[0].slice(0,5);
         rs=this.straight(sub_h,sub_p);
        if(rs)
        {
            return  rs;
        }

        sub_p=pai13[1].slice(1,6);
        sub_h=pai13[0].slice(1,6);
        rs=this.straight(sub_h,sub_p);
        if(rs)
        {
            return  rs;
        }

        sub_p=pai13[1].slice(2,7);
        sub_h=pai13[0].slice(2,7);
        rs=this.straight(sub_h,sub_p);
        if(rs)
        {
            return  rs;
        }
        /**************************************************/


        //三条 5种 [0,1,2]-[3,4],[0]-[1,2,3]-[4],[0,1]-[2,3,4],[0-1]-[3,4,5],[0-1]-[4,5,6]
        tmp_list=[];
        sub_p=pai13[1].slice(0,5);
        sub_h=pai13[0].slice(0,5);
        tmp_list.push([sub_h,sub_p,0,3])

        sub_p=pai13[1].slice(0,5);
        sub_h=pai13[0].slice(0,5);
        tmp_list.push([sub_h,sub_p,1,4])

        sub_p=pai13[1].slice(0,5);
        sub_h=pai13[0].slice(0,5);
        tmp_list.push([sub_h,sub_p,2,5])

        sub_p=pai13[1].slice(0,2).concat(pai13[1].slice(3,6));
        sub_h=pai13[0].slice(0,2).concat(pai13[0].slice(3,6));
        tmp_list.push([sub_h,sub_p,2,5])

        sub_p=pai13[1].slice(0,2).concat(pai13[1].slice(4,7));
        sub_h=pai13[0].slice(0,2).concat(pai13[0].slice(4,7));
        tmp_list.push([sub_h,sub_p,2,5])

        for(let item of tmp_list){
            rs=this.three_of_akind(item[0],item[1],item[2],item[3]);
            if(rs){
                return  rs;
                break;
            }
        }

        /**************************************************/

        //两对, 10种 按此格式:AABBC进行计算, 返回牌的顺序也按此格式, 方便计算大小值 ;
        //[0,1 2,3-4],[0,1 3,4-2],[0,1 4,5-2],[0,1 5,6-2]
        //[1,2 3,4-0],[1,2 4,5-0], [1,2 5,6-0]
        //[2,3 4,5-0],[2,3 5,6-0]
        //[3,4 5,6-0]
        tmp_list=[];
        sub_p=pai13[1].slice(0,5);
        sub_h=pai13[0].slice(0,5);
        tmp_list.push([sub_h,sub_p]);

        sub_p=pai13[1].slice(0,2).concat(pai13[1].slice(3,5),pai13[1].slice(2,3));
        sub_h=pai13[0].slice(0,2).concat(pai13[0].slice(3,5),pai13[0].slice(2,3));
        tmp_list.push([sub_h,sub_p]);

        sub_p=pai13[1].slice(0,2).concat(pai13[1].slice(4,6),pai13[1].slice(2,3));
        sub_h=pai13[0].slice(0,2).concat(pai13[0].slice(4,6),pai13[0].slice(2,3));
        tmp_list.push([sub_h,sub_p]);

        sub_p=pai13[1].slice(0,2).concat(pai13[1].slice(5,7),pai13[1].slice(2,3));
        sub_h=pai13[0].slice(0,2).concat(pai13[0].slice(5,7),pai13[0].slice(2,3));
        tmp_list.push([sub_h,sub_p]);


        sub_p=pai13[1].slice(1,3).concat(pai13[1].slice(3,5),pai13[1].slice(0,1));
        sub_h=pai13[0].slice(1,3).concat(pai13[0].slice(3,5),pai13[0].slice(0,1));
        tmp_list.push([sub_h,sub_p]);

        sub_p=pai13[1].slice(1,3).concat(pai13[1].slice(4,6),pai13[1].slice(0,1));
        sub_h=pai13[0].slice(1,3).concat(pai13[0].slice(4,6),pai13[0].slice(0,1));
        tmp_list.push([sub_h,sub_p]);

        sub_p=pai13[1].slice(1,3).concat(pai13[1].slice(5,7),pai13[1].slice(0,1));
        sub_h=pai13[0].slice(1,3).concat(pai13[0].slice(5,7),pai13[0].slice(0,1));
        tmp_list.push([sub_h,sub_p]);


        sub_p=pai13[1].slice(2,4).concat(pai13[1].slice(4,6),pai13[1].slice(0,1));
        sub_h=pai13[0].slice(2,4).concat(pai13[0].slice(4,6),pai13[0].slice(0,1));
        tmp_list.push([sub_h,sub_p]);

        sub_p=pai13[1].slice(2,4).concat(pai13[1].slice(5,7),pai13[1].slice(0,1));
        sub_h=pai13[0].slice(2,4).concat(pai13[0].slice(5,7),pai13[0].slice(0,1));
        tmp_list.push([sub_h,sub_p]);

        sub_p=pai13[1].slice(3,5).concat(pai13[1].slice(5,7),pai13[1].slice(0,1));
        sub_h=pai13[0].slice(3,5).concat(pai13[0].slice(5,7),pai13[0].slice(0,1));
        tmp_list.push([sub_h,sub_p]);

        for(let item of tmp_list){
            rs=this.two_pair(item[0],item[1]);
            if(rs){
                return  rs;
                break;
            }
        }

        /**************************************************/

        //一对  6种: [0,1],[1,2],[2,3],[3,4], [4,5],[5,6]
        tmp_list=[];
        sub_p=pai13[1].slice(0,5);
        sub_h=pai13[0].slice(0,5);
        tmp_list.push([sub_h,sub_p,0,2]);
        tmp_list.push([sub_h,sub_p,1,3]);
        tmp_list.push([sub_h,sub_p,2,4]);
        tmp_list.push([sub_h,sub_p,3,5]);

        sub_p=pai13[1].slice(0,3).concat(pai13[1].slice(4,6));
        sub_h=pai13[0].slice(0,3).concat(pai13[0].slice(4,6));
        tmp_list.push([sub_h,sub_p,3,5])

        sub_p=pai13[1].slice(0,3).concat(pai13[1].slice(5,7));
        sub_h=pai13[0].slice(0,3).concat(pai13[0].slice(5,7));
        tmp_list.push([sub_h,sub_p,3,5])
        // console.log(tmp_list);
        for(let item of tmp_list){
            rs=this.one_pair(item[0],item[1],item[2],item[3]);
            if(rs){
                return  rs;
                break;
            }
        }
        /**************************************************/

        //高牌
        sub_p=pai13[1].slice(0,5);
        sub_h=pai13[0].slice(0,5);
        let tmp= poker.high_card[0]; //牌型值；
        let poker_pai=JSON.parse(JSON.stringify(poker.paiXingName[9]));
        poker_pai.pai=[sub_h,sub_p]
        return [poker_pai,tmp];

    }

    /**
     * 高牌的分数  5张牌
     * @param pai13
     * @returns {number}
     */
    getGaopaiScore(pai13){
        let pv=pai13[1];
        let score=0;

        // console.log('pv:')
        // console.log(pv)

        for(let p of pv){
            score=score*100+p;
        }

        return score;

    }
}

module.exports=Dezhou;