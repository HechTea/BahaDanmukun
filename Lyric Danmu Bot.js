// ==UserScript==
// @name         Lyric Danmu Bot
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       HechTea
// @match        https://ani.gamer.com.tw/animeVideo.php*
// @grant        none
// ==/UserScript==

///////////////
// Srt stuff //
function parse_time(string) {
    var hhmmss = string.split(":");
    var ssmili = hhmmss[2].split(",");
    var accu = parseInt( hhmmss[0] ) * 60;
    accu = (accu + parseInt( hhmmss[1] )) * 60;
    accu = (accu + parseInt( ssmili[0] )) * 1000;
    accu += parseInt( ssmili[1] );
    return accu;
}

function parse_srt(string, mode=0, p1=1) {
    "mode 0 to put multi-line lyrics in same block, mode 1 to put multi-line lyrics in different block with p1 milisec offset of start time.";
    var lines = string.split("\n");

    var current_line_num = 1;
    // lyric block = {
    //	start_time:	(milisecs),
    //	end_time:	(milisecs),
    //	lyrics:		[(lines of lyrics)]
    // }
    var all_lyrics = []; // [(arrya of lyric blocks)]
    var aye, jay, start_linenum = 0, end_linenum = 0;

    for (aye = end_linenum; aye < lines.length; ) {
        if (lines[aye] === "") break;
        for (jay = aye; jay < lines.length; jay++) {
            if (jay >= 1) {
                if (jay == lines.length-1 || (lines[jay-1] === "" && parseInt(lines[jay]) == current_line_num + 1)) {
                    // The previous line is empty, and this line indicates the start of next block.
                    // i.e.  jay stops on the line-number
                    break;
                }
            }
        }
        start_linenum = aye;
        end_linenum = jay - 1;
        aye = jay;

        current_line_num = parseInt(lines[aye]); if (current_line_num === NaN) throw `NaN @ aye,jay = ${aye},${jay}`;
        var times = lines[start_linenum+1].split(" --> ");
        var start_time = parse_time(times[0]);
        var end_time = parse_time(times[1]);
        var blocks_to_push = [];

        var i, j, lyrics, lyric_block;
        if (mode == 0) {
            console.log("    mode 0");
            lyrics = [];
            for (i = start_linenum+2; i < end_linenum; i++) { // Plus two to skip line-number and timestamp
                lyrics.push(lines[i]);
            }
            lyric_block = {start_time: start_time, end_time: end_time, lyrics: lyrics};
            blocks_to_push.push(lyric_block);
        } else {
            console.log("    mode 1");
            for (i = start_linenum+2; i < end_linenum; i++) { // Plus two to skip line-number and timestamp
                lyrics = [lines[i]];
                lyric_block = {start_time: start_time+p1, end_time: end_time, lyrics: lyrics};
                blocks_to_push.push(lyric_block);
            }
        }

        for (i = 0; i < blocks_to_push.length; i++) {
            all_lyrics.push(blocks_to_push[i]);
        }
    }
    return all_lyrics;
}

/////////////////
// danmu stuff //
var danmu_colors = [{color:"#FFFFFF"}, {color:"#FDE53D"}, {color:"#FF0026"}, {color:"#00C3FC"}, {color:"#A7FE39"},
                    {color:"#B538FA"}, {color:"#BEBEBE"}, {color:"#FF9625"}, {color:"#FF9496"}, {color:"#0036FA"},
                    {color:"#00FF91"}, {color:"#FF02D3"}];
var danmu_positions = {rolling: 0, top: 1, bottom: 2};
var danmu_size = {small: 0, regular: 1, big: 2};


// DANMU_RESOLVED stores the wake up function.  Called when online danmu has been successfully inserted.
// INSERT_ONLINE_DANMU proceeds to insert next line when DANMU_RESOLVED is called.
var danmu_resolved = null;
var online_danmu_resolved = null;

function delay(t) {
    return new Promise(function(resolve, reject){
        setTimeout(function(){resolve();}, t);
    });
}

////////////////
// Local test //
function random_danmu() {
    var n = Math.ceil(Math.random()*10000);
    return {text: "text"+n.toString(), color: "#"+Math.ceil(Math.random()*0xFFFFFF).toString(16), size: 1, position: 0, time: 0, sn: Math.ceil(Math.random()*10000), userid: "userid"+n.toString()};
}
function create_danmu(text, time, color=danmu_colors[9].color, size=danmu_size.regular, position=danmu_positions.bottom, userid="_local_user") {
    return {text: text, color: color, size: size, position: position, time: time, sn: Math.ceil(Math.random()*10000), userid: userid};
}
async function insert_local_danmu(blocks) {
    var video_controller = document.getElementById("ani_video_html5_api");
    var initial_time = video_controller.currentTime; // in seconds (decimal number)
    for (var i = 0; i < blocks.length; i++) {
        for (var j = 0; j < blocks[i].lyrics.length; j++) {
            var danmu_time = Math.floor((blocks[i].start_time + initial_time*1000) / 100);
            console.log(`Insert @ ${danmu_time}`);
            if (blocks[i].lyrics[j].trim().length > 0) {
                video_controller.currentTime = blocks[i].start_time / 1000 + initial_time;
                await delay(200);
                animefun.danmuInsert(create_danmu(blocks[i].lyrics[j], danmu_time));
                animefun.refreshdanmu_local();
                await delay(100);
            }
        }
    }
    video_controller.currentTime = initial_time - 0.5;
}

function remove_local_danmu() {
    // TODO
}

/////////////////
// Online test //
function GenDanmuPromise() {
    return new Promise(function(resolve, reject){
        danmu_resolved = resolve;
    });
}
function GenOnlineDanmuPromise() {
    return new Promise(function(resolve, reject){
        online_danmu_resolved = resolve;
    });
}


/*
function danmu_setting(danmucolor=danmu_colors[3], danmuposition = danmu_positions.bottom, danmusize=danmu_size.regular) {
    animefun.danmucolor = danmucolor;
    animefun.danmuposition = danmuposition;
    animefun.danmusize = danmusize;
}
*/

async function insert_ONLINE_danmu(blocks) {
    var video_controller = document.getElementById("ani_video_html5_api");
    var initial_time = video_controller.currentTime; // in seconds (decimal number)
    var duration = video_controller.duration;
    var violation = false;
    var i, j;

    // Check length first
    for (i = 0; i < blocks.length; i++) {
        for (j = 0; j < blocks[i].lyrics.length; j++) {
            if (60 < Util.String.utf8Length(blocks[i].lyrics[j])) {
                console.log(`Block ${i} line ${j} 超過20字\n${blocks[i].lyrics[j]}`);
                violation = true;
            }
            if ('' == blocks[i].lyrics[j].trim()) {
                console.log(`Block ${i} line ${j} 為空，將忽略`);
            }
        }
    }

    if (violation) {
        console.log("請清除錯誤後再試一次");
        return;
    }

    for (i = 0; i < blocks.length; i++) {
        for (j = 0; j < blocks[i].lyrics.length; j++) {
            var danmu_time = Math.floor((blocks[i].start_time + initial_time*1000) / 100);
            if (blocks[i].lyrics[j].trim().length > 0) {
                console.log(`Insert @ ${danmu_time}: "${blocks[i].lyrics[j]}"`);
                var danmu_promise = GenDanmuPromise();
                video_controller.currentTime = blocks[i].start_time / 1000 + initial_time;
                await delay(300);
                animefun.setdanmu(blocks[i].lyrics[j]); // this calls DANMUINSERT, which is modified to call DANMU_RESOLVED.
                await danmu_promise;
                await delay(5500 + Math.random() * 1000); // Wait 5.5 + 0~1 seconds.
            } else {
                console.log("忽略空白");
            }
        }
    }
    video_controller.currentTime = initial_time - 0.5;
    console.log("Done!");
    online_danmu_resolved();
}

////////////
// Add UI //
function add_UI() {
    // 1. Create elements

    //   a. Tab to select
    var tab_top = $(".sub_top");
    var my_tab = $(`<div id="lyric-danmu" class="ani-tabs__item"></div>`);
    var my_tab_link = $(`<a href="#ani-tab-content-N" class="ani-tabs-link is-disabled">自動彈幕君</a>`)
    .click(function(c){
        $('.ani-tabs-link.is-active').removeClass('is-active');
        $(this).addClass('is-active');
        $('.ani-tab-content__item').css('display', 'none');
        $($(this).attr('href')).css('display', 'block');
        c.preventDefault();
    });
    my_tab_link.appendTo(my_tab);
    my_tab.appendTo(tab_top);

    //   b. Content
    var tab_contents = $(".ani-tab-content");
    var content = $(
`<div id='ani-tab-content-N' class='ani-tab-content__item' style='display: block; overflow: auto;'>
    <div id='edit-mode-select' style='text-align: center;'>
        <button id='raw-srt-butt' disabled='true'>Raw</button>
        <button id='block-srt-butt' disabled='true'>Block</button>
    </div>
    <p style='border-top: 3px solid rgb(172, 172, 172);margin-top: 5px;margin-bottom: 5px;'></p>
    <div id='raw-srt-edit' style=''>
        <textarea id='srt-text' placeholder='可拖曳字幕檔案進此文字方塊'
            style='width: 100%;height: 300px;font-size: 16px;margin: 5px;border: 0px;margin-left: 0px;overflow-y: scroll;resize: vertical;'></textarea>
    </div>
    <div id='block-srt-edit' style='display: none;'>
    </div>
    <p style='border-top: 3px solid rgb(172, 172, 172);margin-top: 5px;margin-bottom: 5px;'></p>
    <div>
        <!--div class="vjs-menu" style="display:inline-block">
            <div class="danmusetting_area">
                <div class="danmusetting">
                    <div class="danmutype-send">
                        <p class="title">彈幕顯示類型</p>
                        <div class="danmudisplay-area_btn">
                            <div class="danmu-slide active" data-value="0">
                                <div class="svg"></div><span>滾動</span>
                            </div>
                            <div class="danmu-top" data-value="1">
                                <div class="svg"></div><span>上方</span>
                            </div>
                            <div class="danmu-bottom" data-value="2">
                                <div class="svg"></div><span>下方</span>
                            </div>
                        </div>
                    </div>
                    <div class="danmusize-send">
                        <p class="title">文字大小</p>
                        <div class="danmusize-btn">
                            <div data-value="0">小</div>
                            <div class="active" data-value="1">標準</div>
                            <div data-value="2">大</div>
                        </div>
                    </div>
                </div>
                <div class="line"></div>
                <div class="danmucolor_area">
                    <p class="title">顏色</p>
                    <div class="danmucolors">
                        <div class="danmucolor is-active" data-value="#FFFFFF" style="background: rgb(255, 255, 255);"></div>
                        <div class="danmucolor" data-value="#FDE53D" style="background: rgb(253, 229, 61);"></div>
                        <div class="danmucolor" data-value="#FF0026" style="background: rgb(255, 0, 38);"></div>
                        <div class="danmucolor" data-value="#00C3FC" style="background: rgb(0, 195, 252);"></div>
                        <div class="danmucolor" data-value="#A7FE39" style="background: rgb(167, 254, 57);"></div>
                        <div class="danmucolor" data-value="#B538FA" style="background: rgb(181, 56, 250);"></div>
                        <div class="danmucolor" data-value="#BEBEBE" style="background: rgb(190, 190, 190);"></div>
                        <div class="danmucolor" data-value="#FF9625" style="background: rgb(255, 150, 37);"></div>
                        <div class="danmucolor" data-value="#FF9496" style="background: rgb(255, 148, 150);"></div>
                        <div class="danmucolor" data-value="#0036FA" style="background: rgb(0, 54, 250);"></div>
                        <div class="danmucolor" data-value="#00FF91" style="background: rgb(0, 255, 145);"></div>
                        <div class="danmucolor" data-value="#FF02D3" style="background: rgb(255, 2, 211);"></div>
                    </div>
                </div>
            </div>
        </div-->
        <div id='send-butts' style='text-align: center; display:inline-block'>
            <button id='local-danmu-butt'>彈幕測試</button>
            <button id='clear-local-danmu-butt'>清除測試</button>
            <button id='online-danmu-butt'>送出彈幕</button>
        </div>
    </div>
</div>`
    );
    content.appendTo(tab_contents);

    // 2. Button scripts
    //   a. Local button
    $("#local-danmu-butt").click(function(){
        var str = $("#srt-text").val();
        var blocks = parse_srt(str);
        insert_local_danmu(blocks);
        // TODO: show progress.  (how many lyrics are set) / (all lyrics)
    });

    //   b. Clear local danmu
    $("#clear-local-danmu-butt").click(function(){
        danmu_resolved();
    });

    //   c. Online danmu
    $("#online-danmu-butt").click(async function(){
        var str = $("#srt-text").val();
        var blocks = parse_srt(str);
        var confirm = true;

        // Show confirmation
        // TODO

        if (confirm) {
            $(this).attr("disabled", "true");
            var online_danmu_promise = GenOnlineDanmuPromise();
            insert_ONLINE_danmu(blocks);
            await online_danmu_promise;
            $(this).removeAttr("disabled");
        } else {
            // Remove confirmation
            // TODO
        }
    });
}

/////////
// RUN //
(function() {
    'use strict';
    // Your code here...

    BAHA_ANIME.prototype.refreshdanmu_local = function() {
        var self  = animefun;
        setTimeout(function(){
            try {
                self.updatedanmu();
            } catch(e) { }
        }, 1000);
    }

    // Override danmu setting to sync original and extension //
    // TODO
    BAHA_ANIME.prototype.setdanmusizeNew = function(value,me) {
        jQuery('.danmusize-send div.active').removeClass('active');
        jQuery(me).addClass('active');

        this.danmusize = value;
    }
    BAHA_ANIME.prototype.setdanmucolorNew = function(value,me) {
        jQuery('.danmucolors div.danmucolor.is-active').removeClass('is-active');
        jQuery(me).addClass('is-active');

        this.danmucolor = value;
    }
    BAHA_ANIME.prototype.setdanmupositionNew = function(value,me) {
        jQuery('.danmudisplay-area_btn div.active').removeClass('active');
        jQuery(me).addClass('active');

        this.danmuposition = value;
    }

    console.log("adding");
    // animefun.danmuInsert is set after clicking agree.
    (async function() {
        while(1) {
            if ((tmpdanmuInsert = animefun.danmuInsert) == null) {
                await delay(1000);
                console.log("try again");
            }
            else break;
        }
        // Add stuff to danmuInsert.  See variable "danmu_resolved" and function "insert_ONLINE_danmu"
        var tmpdanmuInsert;

        console.log(tmpdanmuInsert);
        animefun.danmuInsert = null;
        animefun.danmuInsert = function(e) {
            if (danmu_resolved != null) {
                danmu_resolved();
                danmu_resolved = null;
            }
            return tmpdanmuInsert(e);
        }
    })();
    // Add my custom tab.
    add_UI();

})();
