var generalConfig = {
    refreshRate: 300,
    imageOrigin: 'https://raw.githubusercontent.com/sidewinderk/gbfTransKor/master/images/', //DB에 이미지 파일을 등록시킬때 사용.
    origin: 'https://sidewinderk.github.io/gbfTransKor',
    // online DB: 'https://sidewinderk.github.io/gbfTransKor'
    // local DB: 'chrome-extension://'  + chrome.runtime.id
    // defaultNameMale_jp: "[グラン]", // Default original user name
    // defaultNameFemale_jp: "[ジータ]",
    // defaultNameMale_en: "[Gran]",
    // defaultNameFemale_en: "[Djeeta]",
    defaultName: "[플레이어]", // Default original user name
    // defaultTransNameMale: "[그랑]", // Default translated user name
    // defaultTransNameFemale: "[지타]",
    defaultFont: "src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_20-04@2.1/InfinitySans-RegularA1.woff') format('woff'); font-weight: normal; font-style: normal;",
    defaultFontName: "NanumSquare"
};
var doc = document;
var isVerboseMode = false;
var doImageSwap = false;
var doBattleTrans = false;
var transMode = false;
var exMode = false;
var skipTranslatedText = false;
var initialize = false;
var tempSceneCode = "";
var extractedSceneCode = '';
var cachedSceneData = [];
var ObserverList = [];

var sceneFullInfo = [];
var battleFullInfo = [];
var cNames = [];
var miscs = [];
var questJson = false;
var nameJson = false;
var archiveJson = false;
var imageJson = false;
var imageBlobs = [];
var imageBlobsUrl = [];
var battleJson = false;
var kCheck = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/; // regeexp for finding Korean (source: http://blog.daum.net/osban/14691815)
var kCheckSpecial = /[\{\}\[\]\/?.,;:～：|\)*~`!^\-_+<>@\#$%&\\\=\(\'\"]/gi; // regex for removing special characters
var jCheck = /[一-龠]+|[ぁ-ゔ]+|[ァ-ヴー]/;

var dbDef = {
    dbCon: null,
    dbName: 'gbfTransKorDB',
    dbStoreName: 'gbfTransKorStore',
    dbUpgradeNeeded: false,
    //dbVer 값은 소수점 불가. 정수값만 가능. 
    //이 값은 개발자가 임의로 사용자의 DB를 강제로 삭제하고 새로운 DB로 업그레이드하게 하고싶을때 값을 올림.
    dbVer: 3 //만약 이 값을 올렸다면 반드시 script() 함수 내에도 있는 dbDef 객체도 맞춰서 수정해주기바람!!!
}
var dbNextUpdateTime_text = null;
var dbNextUpdateTime_image = null;
var dbReUpdate = false;
var userName = '';
var skipSceneCode = '';

// Coversation with popup window
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.data == 'updateDBTexts') {
        updateDBTexts();
    }
    if (request.data == 'updateDBImages') {
        updateDBImages();
    }
    if (request.data == 'resetDB') {
        resetDB();
    }
    if (request.data == 'clearScenes') {
        sceneFullInfo = [];
        chrome.storage.local.set({
            sceneFullInfo: sceneFullInfo
        });
        window.location.reload();
    }
    if (request.data == 'clearBattle') {
        battleFullInfo = [];
        chrome.storage.local.set({
            battleFullInfo: battleFullInfo
        });
        window.location.reload();
    }
    if (request.data == 'update') {
        if (skipTranslatedText)
            RemoveTranslatedText();
        chrome.storage.local.set({
            sceneFullInfo: sceneFullInfo,
            battleFullInfo: battleFullInfo,
            nTEXT: cNames,
            mTEXT: miscs
        });
        if (!doc.URL.includes('play_view')) {
            chrome.storage.local.set({
                sceneCodeFull: 0,
                sceneCodeStatus: 0
            });
        }
    }
    if (request.data == 'clearName') {
        cNames = [];
        chrome.storage.local.set({
            nTEXT: cNames
        });
    }
    if (request.data == 'clearMisc') {
        miscs = [];
        chrome.storage.local.set({
            mTEXT: miscs
        });
    }
    if (request.data == 'refresh') {
        sceneFullInfo = [];
        battleFullInfo = [];
        cNames = [];
        miscs = [];
        chrome.storage.local.set({
            sceneFullInfo: sceneFullInfo,
            battleFullInfo: battleFullInfo,
            nTEXT: cNames,
            mTEXT: miscs
        });
        window.location.reload();
    }
});

//The options object must set at least one of 'attributes', 'characterData', or 'childList' to true.
var config = {
    //attributes: true,
    childList: true,
    subtree: true,
    characterData: true
};
var config_full = {
    attributes: true,
    childList: true,
    subtree: true,
    characterData: true
};
var config_image = {
    attributes: true,
    //childList: true,
    subtree: true,
    //characterData: true
};
var config_simple = {
    attributes: true,
};

// Common modules
function PrintLog(text) {
    if (isVerboseMode) console.log(text);
}

//archiveObserver 에서 계속 업데이트함.
//sceneObserver 에서는 튜토리얼 페이지 상황에 맞게 하드코딩하여 userName 셋팅함.
function getUserName() {
    var curLanugage = doc.title == 'Granblue Fantasy' ? 'English' : 'Japanese';
    var sex = null;
    var resultUserName = userName;

    var questSceneNode = doc.getElementsByClassName('cnt-quest-scene')[0];
    var mypageUserNameNode = doc.getElementsByClassName('btn-user-name')[0];
    if (questSceneNode) {
        sex = questSceneNode.attributes[2].value;

        resultUserName = doc.getElementsByClassName('cnt-quest-scene')[0];
        if (resultUserName) {
            resultUserName = resultUserName.attributes[3].value;
        }
    }

    if (mypageUserNameNode) {
        if (mypageUserNameNode.innerText.length > 0) {
            resultUserName = mypageUserNameNode.innerText;
        }
    }

    if (doc.URL.includes('tutorial')) {
        if (userName.length > 0) {
            resultUserName = userName;
        } else {
            if (sex == 0) {
                if (curLanugage == 'Japanese')
                    resultUserName = 'グラン';
                else
                    resultUserName = 'Gran';
            } else if (sex == 1) {
                if (curLanugage == 'Japanese')
                    resultUserName = 'ジータ';
                else
                    resultUserName = 'Djeeta';
            }
        }
    }
    return resultUserName;
}

//스토리 재생 페이지에서만 작동됨.
//계정 처음 생성하고 유저 네임이 없을때 적용하기위한 함수.
function getDefaultUserName() {
    var questSceneNode = doc.getElementsByClassName('cnt-quest-scene')[0];
    var curLanugage = doc.title == 'Granblue Fantasy' ? 'English' : 'Japanese';
    var sex = null;
    var resultUserName = null;

    if (questSceneNode) {
        sex = questSceneNode.attributes[2].value;

        if (sex == 0) {
            if (curLanugage == 'Japanese')
                resultUserName = 'グラン';
            else
                resultUserName = 'Gran';
        } else if (sex == 1) {
            if (curLanugage == 'Japanese')
                resultUserName = 'ジータ';
            else
                resultUserName = 'Djeeta';
        }
    }
    return resultUserName;
}


function getTransDefaultUserName(text) {
    var transDefaultUserName = '';

    if (text && text.includes('グラン') || text.includes('Gran')) {
        transDefaultUserName = '그랑';
    } else if (text && text.includes('ジータ') || text.includes('Djeeta')) {
        transDefaultUserName = '지타';
    } else {
        transDefaultUserName = text;
    }

    return transDefaultUserName;
}

function walkDownTree(node, command, variable = null) {
    if (node.innerHTML || node.className.includes('btn-')) command(node, variable);
    if (!node.className) {
        // in case of list of nodes
        if (node.id) {
            if (node.length) {
                if (node.length > 0) {
                    for (var i = 0; i < node.length; i++) walkDownTree(node[i], command, variable);
                }
            }
            if (node.hasChildNodes()) {
                for (var i = 0; i < node.childElementCount; i++)
                    walkDownTree(node.children[i], command, variable);
            }
        }
        if (node.length) {
            if (node.length > 0) {
                for (var i = 0; i < node.length; i++) walkDownTree(node[i], command, variable);
            }
        }
        //id, class 둘 다 가지고있지 않은 <div> 태그 밑에 자식 노드가 있는 경우.
        if (!node.id && !node.className && node.hasChildNodes()) {
            for (var i = 0; i < node.childElementCount; i++)
                walkDownTree(node.children[i], command, variable);
        }
    } else {
        if (node.hasChildNodes()) {
            for (var i = 0; i < node.childElementCount; i++)
                walkDownTree(node.children[i], command, variable);
        }
    }
}

function walkDownTreeSrc(node, command, variable = null) {
    if (node && node.className) {
        if (
            !node.length &&
            !node.className.includes('item') && // it's too much.
            node.currentSrc
        ) {
            command(node, variable);
        }
    }
    if (node && !node.className) {
        // in case of list of nodes
        if (node.id) {
            if (node.length) {
                if (node.length > 0) {
                    for (var i = 0; i < node.length; i++)
                        walkDownTreeSrc(node[i], command, variable);
                }
            }
            if (node.hasChildNodes()) {
                for (var i = 0; i < node.childElementCount; i++)
                    walkDownTreeSrc(node.children[i], command, variable);
            }
        }
        if (node.length) {
            if (node.length > 0) {
                for (var i = 0; i < node.length; i++) walkDownTreeSrc(node[i], command, variable);
            }
        }
    } else {
        if (node && node.hasChildNodes()) {
            for (var i = 0; i < node.childElementCount; i++)
                walkDownTreeSrc(node.children[i], command, variable);
        }
    }
}

function walkDownTreeStyle(node, command, variable = null) {
    if (node && !node.childElementCount) {
        command(node, variable);
    }
    if (node && !node.length) {
        command(node, variable);
    }
    if (node && !node.className) {
        // in case of list of nodes
        if (node.id) {
            if (node.length) {
                if (node.length > 0) {
                    for (var i = 0; i < node.length; i++)
                        walkDownTreeStyle(node[i], command, variable);
                }
            }
            if (node.hasChildNodes()) {
                for (var i = 0; i < node.childElementCount; i++)
                    walkDownTreeStyle(node.children[i], command, variable);
            }
        }
        if (node.length) {
            if (node.length > 0) {
                for (var i = 0; i < node.length; i++) walkDownTreeStyle(node[i], command, variable);
            }
        }
    } else {
        if (node && node.hasChildNodes()) {
            for (var i = 0; i < node.childElementCount; i++)
                walkDownTreeStyle(node.children[i], command, variable);
        }
    }
}

function walkDownObserver(node, obs, variable = null) {
    if ((node.className) &&
        (!node.length)) {
        obs.observe(node, variable);
    }
    if (!node.className) {
        // in case of list of nodes	
        if (node.id) {
            if (node.length) {
                if (node.length > 0) {
                    for (var i = 0; i < node.length; i++)
                        walkDownObserver(node[i], obs, variable);
                }
            }
            if (node.hasChildNodes()) {
                for (var i = 0; i < node.childElementCount; i++)
                    walkDownObserver(node.children[i], obs, variable);
            }
        }
        if (node.length) {
            if (node.length > 0) {
                for (var i = 0; i < node.length; i++) walkDownObserver(node[i], obs, variable);
            }
        }
    } else {
        if (node.hasChildNodes()) {
            for (var i = 0; i < node.childElementCount; i++)
                walkDownObserver(node.children[i], obs, variable);
        }
    }
}

function PushCSV(text, array) {
    if (kCheck.test(text)) return;

    if (CheckDuplicate(text, array)) {
        if (text.includes(','))
            array.push('"' + text + '"');
        else
            array.push(text);
    }
}

function CheckDuplicate(text, array) {
    var result = true;
    array.some(function (itemTemp) {
        if (text.length == itemTemp.length) {
            if (text == itemTemp) {
                result = false;
                return;
            }
        } else if (text.includes(',')) {
            if (text.length + 2 == itemTemp.length) {
                if ('"' + text + '"' == itemTemp) {
                    result = false;
                    return;
                }
            }
        }
    });
    return result;
}

function PushCSV_BattleText(battleText) {
    var skip = false;

    /*
        튜토리얼 페이지에서만 message 라는 이름으로 바꿔서 사용함.
        혹시라도 튜토리얼 이외의 페이지에서 message 이름으로 사용할 경우 모두 적용 되도록 navi_information에 대입함.
    */
    if (battleText.message)
        battleText.navi_information = battleText.message;

    battleFullInfo.some(function (item) {
        var copyText = item.Origin.split('"').join('');

        if (battleText.battle_condition) {
            if (battleText.battle_condition.body) {

                if ((battleText.battle_condition.body == copyText)) {
                    skip = true;
                }
            }
            if (battleText.battle_condition.title) {
                if ((battleText.battle_condition.title == copyText)) {
                    skip = true;
                }
            }
        }
        if (battleText.lose_type) {
            if (battleText.lose_type.lose_escape_text == copyText)
                skip = true;
        }
        if (battleText.navi_information && Array.isArray(battleText.navi_information)) {
            battleText.navi_information.some(function (info) {
                if (info.text) {
                    if (info.text == copyText) {
                        skip = true;
                        return true;
                    }
                }
            })
        }
        if (skip) return true;
    });

    if (skip) return;

    if (battleText.battle_condition) {
        if (battleText.battle_condition.title) {
            battleFullInfo.push({
                Type: 'condition_win',
                Name: '',
                Origin: '"' + battleText.battle_condition.title + '"'
            });
        }
        if (battleText.battle_condition.body) {
            battleFullInfo.push({
                Type: 'condition_win',
                Name: '',
                Origin: '"' + battleText.battle_condition.body + '"'
            });
        }
    }

    if (battleText.lose_type) {
        if (battleText.lose_type.lose_escape_text) {
            battleFullInfo.push({
                Type: 'condition_lose',
                Name: '',
                Origin: '"' + battleText.lose_type.lose_escape_text + '"'
            });
        }
    }


    if (battleText.navi_information && Array.isArray(battleText.navi_information)) {
        for (var i = 0; i < battleText.navi_information.length; i++) {
            let obj = battleText.navi_information[i];
            if (obj.text != undefined && obj.text.length > 0) {
                obj.text = replaceUserName(obj.text);
                obj.text_en = replaceUserName(obj.text_en);

                battleFullInfo.push({
                    Type: 'text_jp',
                    Name: '=IMAGE("http://game-a1.granbluefantasy.jp/assets/img/sp/raid/navi_face/' + obj.navi + '.png")',
                    Origin: '"' + obj.text + '"'
                });
                if (obj.text_en) {
                    battleFullInfo.push({
                        Type: 'text_en',
                        Name: '=IMAGE("http://game-a1.granbluefantasy.jp/assets_en/img/sp/raid/navi_face/' + obj.navi + '.png")',
                        Origin: '"' + obj.text_en + '"'
                    });
                }
            }
        }
    }

    chrome.storage.local.set({
        battleFullInfo: battleFullInfo
    });
}

function PushCSV_StoryText(sceneText) {
    var skip = false;
    var sceneLanguage = doc.title == 'Granblue Fantasy' ? 'English' : 'Japanese';

    // For pop-up status icon
    if (extractedSceneCode != tempSceneCode) {
        tempSceneCode = extractedSceneCode;
        chrome.storage.local.set({
            sceneCodeFull: extractedSceneCode,
            sceneCodeStatus: IsSceneCodeInDB(extractedSceneCode)
        });
    }

    sceneFullInfo.some(function (scene) {
        if (scene.SceneCode.includes(extractedSceneCode)) {
            if (sceneLanguage == scene.Language) {
                skip = true;
                return true;
            }
        }
    });
    if (skip) {
        PrintLog('PushCSV_StoryText : 스토리 텍스트 이미 존재. 추출 종료.');
        return;
    }


    sceneText.forEach(function (item) {
        if (item.synopsis && item.synopsis != '') {
            var sceneJson = {};
            sceneJson.Language = sceneLanguage;
            sceneJson.SceneCode = extractedSceneCode;
            sceneJson.Type = 'synopsis';
            sceneJson.Name = '';

            item.synopsis = item.synopsis.replace(/(\r\n|\n|\r)/gm, '').trim();
            item.synopsis = item.synopsis.split('"').join("'");
            item.synopsis = item.synopsis.replace(/&nbsp;/g, ' ');
            item.synopsis = item.synopsis.replace(/\s+/g, " ");

            sceneJson.Origin = '"' + item.synopsis + '"';
            sceneFullInfo.push(sceneJson);
        }
        if (item.detail && item.detail != '') {
            var sceneJson = {};
            sceneJson.Language = sceneLanguage;
            sceneJson.SceneCode = extractedSceneCode;
            sceneJson.Type = 'detail';
            //item.charcter1_name 에는 플레이어 이름이 아니고, 화자의 이름이 들어있었음. 예를들어 루리아, 라캄, 카타리나...
            //그러므로, userName 을 후처리 해주기 위한 작업은 이 함수 바깥에서 처리하기.
            sceneJson.Name = (item.charcter1_name != 'null' && item.charcter1_name != null) ? item.charcter1_name : '';

            item.detail = item.detail.replace(/(\r\n|\n|\r)/gm, '').trim();
            item.detail = item.detail.split('"').join("'");
            item.detail = item.detail.replace(/&nbsp;/g, ' ');
            item.detail = item.detail.replace(/\s+/g, " ");

            sceneJson.Origin = '"' + item.detail + '"';
            if (sceneJson.Name.length > 0) {
                PushCSV(sceneJson.Name, cNames);
            }
            sceneFullInfo.push(sceneJson);
        }

        for (key in item) {
            if (key.match(/sel[\d+]_txt/) != null) {
                if (item[key] && item[key] != '') {
                    var sceneJson = {};
                    sceneJson.Language = sceneLanguage;
                    sceneJson.SceneCode = extractedSceneCode;
                    sceneJson.Type = key;
                    sceneJson.Name = '';

                    item[key] = item[key].replace(/(\r\n|\n|\r)/gm, '').trim();
                    item[key] = item[key].split('"').join("'");
                    item[key] = item[key].replace(/&nbsp;/g, ' ');
                    item[key] = item[key].replace(/\s+/g, " ");

                    sceneJson.Origin = item[key];
                    sceneFullInfo.push(sceneJson);
                }
            }
        }

    });

    //텍스트 안에 플레이어 이름이 포함된 경우, 전부 replace.
    sceneFullInfo.some(function (scene) {
        scene.Origin = replaceUserName(scene.Origin);
    });


    chrome.storage.local.set({
        sceneFullInfo: sceneFullInfo
    });

    PrintLog('PushCSV_StoryText : 추출 완료. 추출 정보 출력.');
    PrintLog(sceneFullInfo);
}

function replaceUserName(text) {
    if (text && userName.length > 0 && text.length > 0 && text.includes(userName)) {
        text = text.split(userName).join(generalConfig.defaultName);
    }
    return text;
}

// Imported modules
/* @license
   biuuu/ShinyColors
   https://github.com/biuuu/ShinyColors
   License: MIT
*/
var commonjsGlobal =
    typeof globalThis !== 'undefined' ?
    globalThis :
    typeof window !== 'undefined' ?
    window :
    typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function createCommonjsModule(fn, module) {
    return (module = {
        exports: {}
    }), fn(module, module.exports), module.exports;
}
var papaparse_min = createCommonjsModule(function (module, exports) {
    /* @license
    Papa Parse
    v4.6.3
    https://github.com/mholt/PapaParse
    License: MIT
    */
    Array.isArray ||
        (Array.isArray = function (e) {
            return '[object Array]' === Object.prototype.toString.call(e);
        }),
        (function (e, t) {
            module.exports = t();
        })(commonjsGlobal, function () {
            var s,
                e,
                f =
                'undefined' != typeof self ?
                self :
                'undefined' != typeof window ? window : void 0 !== f ? f : {},
                n = !f.doc && !!f.postMessage,
                o = n && /(\?|&)papaworker(=|&|$)/.test(f.location.search),
                a = !1,
                h = {},
                u = 0,
                k = {
                    parse: function (e, t) {
                        var r = (t = t || {}).dynamicTyping || !1;
                        z(r) && ((t.dynamicTypingFunction = r), (r = {}));
                        if (
                            ((t.dynamicTyping = r),
                                (t.transform = !!z(t.transform) && t.transform),
                                t.worker && k.WORKERS_SUPPORTED)
                        ) {
                            var i = (function () {
                                if (!k.WORKERS_SUPPORTED) return !1;
                                if (!a && null === k.SCRIPT_PATH)
                                    throw new Error(
                                        'Script path cannot be determined automatically when Papa Parse is loaded asynchronously. You need to set Papa.SCRIPT_PATH manually.'
                                    );
                                var e = k.SCRIPT_PATH || s;
                                e += (-1 !== e.indexOf('?') ? '&' : '?') + 'papaworker';
                                var t = new f.Worker(e);
                                return (t.onmessage = m), (t.id = u++), (h[t.id] = t);
                            })();
                            return (
                                (i.userStep = t.step),
                                (i.userChunk = t.chunk),
                                (i.userComplete = t.complete),
                                (i.userError = t.error),
                                (t.step = z(t.step)),
                                (t.chunk = z(t.chunk)),
                                (t.complete = z(t.complete)),
                                (t.error = z(t.error)),
                                delete t.worker,
                                void i.postMessage({
                                    input: e,
                                    config: t,
                                    workerId: i.id
                                })
                            );
                        }
                        var n = null;
                        'string' == typeof e
                            ?
                            (n = t.download ? new c(t) : new _(t)) :
                            !0 === e.readable && z(e.read) && z(e.on) ?
                            (n = new g(t)) :
                            ((f.File && e instanceof File) || e instanceof Object) &&
                            (n = new p(t));
                        return n.stream(e);
                    },
                    unparse: function (e, t) {
                        var i = !1,
                            g = !0,
                            m = ',',
                            y = '\r\n',
                            n = '"',
                            r = !1;
                        !(function () {
                            if ('object' != typeof t) return;
                            'string' != typeof t.delimiter ||
                                k.BAD_DELIMITERS.filter(function (e) {
                                    return -1 !== t.delimiter.indexOf(e);
                                }).length ||
                                (m = t.delimiter);
                            ('boolean' == typeof t.quotes || Array.isArray(t.quotes)) &&
                            (i = t.quotes);
                            ('boolean' != typeof t.skipEmptyLines &&
                                'string' != typeof t.skipEmptyLines) ||
                            (r = t.skipEmptyLines);
                            'string' == typeof t.newline && (y = t.newline);
                            'string' == typeof t.quoteChar && (n = t.quoteChar);
                            'boolean' == typeof t.header && (g = t.header);
                        })();
                        var s = new RegExp(M(n), 'g');
                        'string' == typeof e && (e = JSON.parse(e));
                        if (Array.isArray(e)) {
                            if (!e.length || Array.isArray(e[0])) return o(null, e, r);
                            if ('object' == typeof e[0]) return o(a(e[0]), e, r);
                        } else if ('object' == typeof e)
                            return (
                                'string' == typeof e.data && (e.data = JSON.parse(e.data)),
                                Array.isArray(e.data) &&
                                (e.fields || (e.fields = e.meta && e.meta.fields),
                                    e.fields ||
                                    (e.fields = Array.isArray(e.data[0]) ?
                                        e.fields :
                                        a(e.data[0])),
                                    Array.isArray(e.data[0]) ||
                                    'object' == typeof e.data[0] ||
                                    (e.data = [e.data])),
                                o(e.fields || [], e.data || [], r)
                            );
                        throw 'exception: Unable to serialize unrecognized input';

                        function a(e) {
                            if ('object' != typeof e) return [];
                            var t = [];
                            for (var r in e) t.push(r);
                            return t;
                        }

                        function o(e, t, r) {
                            var i = '';
                            'string' == typeof e && (e = JSON.parse(e)),
                                'string' == typeof t && (t = JSON.parse(t));
                            var n = Array.isArray(e) && 0 < e.length,
                                s = !Array.isArray(t[0]);
                            if (n && g) {
                                for (var a = 0; a < e.length; a++)
                                    0 < a && (i += m), (i += v(e[a], a));
                                0 < t.length && (i += y);
                            }
                            for (var o = 0; o < t.length; o++) {
                                var h = n ? e.length : t[o].length,
                                    u = !1,
                                    f = n ? 0 === Object.keys(t[o]).length : 0 === t[o].length;
                                if (
                                    (r &&
                                        !n &&
                                        (u =
                                            'greedy' === r ?
                                            '' === t[o].join('').trim() :
                                            1 === t[o].length && 0 === t[o][0].length),
                                        'greedy' === r && n)
                                ) {
                                    for (var d = [], l = 0; l < h; l++) {
                                        var c = s ? e[l] : l;
                                        d.push(t[o][c]);
                                    }
                                    u = '' === d.join('').trim();
                                }
                                if (!u) {
                                    for (var p = 0; p < h; p++) {
                                        0 < p && !f && (i += m);
                                        var _ = n && s ? e[p] : p;
                                        i += v(t[o][_], p);
                                    }
                                    o < t.length - 1 && (!r || (0 < h && !f)) && (i += y);
                                }
                            }
                            return i;
                        }

                        function v(e, t) {
                            if (null == e) return '';
                            if (e.constructor === Date) return JSON.stringify(e).slice(1, 25);
                            e = e.toString().replace(s, n + n);
                            var r =
                                ('boolean' == typeof i && i) ||
                                (Array.isArray(i) && i[t]) ||
                                (function (e, t) {
                                    for (var r = 0; r < t.length; r++)
                                        if (-1 < e.indexOf(t[r])) return !0;
                                    return !1;
                                })(e, k.BAD_DELIMITERS) ||
                                -1 < e.indexOf(m) ||
                                ' ' === e.charAt(0) ||
                                ' ' === e.charAt(e.length - 1);
                            return r ? n + e + n : e;
                        }
                    }
                };
            if (
                ((k.RECORD_SEP = String.fromCharCode(30)),
                    (k.UNIT_SEP = String.fromCharCode(31)),
                    (k.BYTE_ORDER_MARK = '\ufeff'),
                    (k.BAD_DELIMITERS = ['\r', '\n', '"', k.BYTE_ORDER_MARK]),
                    (k.WORKERS_SUPPORTED = !n && !!f.Worker),
                    (k.SCRIPT_PATH = null),
                    (k.NODE_STREAM_INPUT = 1),
                    (k.LocalChunkSize = 10485760),
                    (k.RemoteChunkSize = 5242880),
                    (k.DefaultDelimiter = ','),
                    (k.Parser = v),
                    (k.ParserHandle = r),
                    (k.NetworkStreamer = c),
                    (k.FileStreamer = p),
                    (k.StringStreamer = _),
                    (k.ReadableStreamStreamer = g),
                    f.jQuery)
            ) {
                var d = f.jQuery;
                d.fn.parse = function (o) {
                    var r = o.config || {},
                        h = [];
                    return (
                        this.each(function (e) {
                            if (
                                !(
                                    'INPUT' ===
                                    d(this)
                                    .prop('tagName')
                                    .toUpperCase() &&
                                    'file' ===
                                    d(this)
                                    .attr('type')
                                    .toLowerCase() &&
                                    f.FileReader
                                ) ||
                                !this.files ||
                                0 === this.files.length
                            )
                                return !0;
                            for (var t = 0; t < this.files.length; t++)
                                h.push({
                                    file: this.files[t],
                                    inputElem: this,
                                    instanceConfig: d.extend({}, r)
                                });
                        }),
                        e(),
                        this
                    );

                    function e() {
                        if (0 !== h.length) {
                            var e,
                                t,
                                r,
                                i,
                                n = h[0];
                            if (z(o.before)) {
                                var s = o.before(n.file, n.inputElem);
                                if ('object' == typeof s) {
                                    if ('abort' === s.action)
                                        return (
                                            (e = 'AbortError'),
                                            (t = n.file),
                                            (r = n.inputElem),
                                            (i = s.reason),
                                            void(z(o.error) && o.error({
                                                name: e
                                            }, t, r, i))
                                        );
                                    if ('skip' === s.action) return void u();
                                    'object' == typeof s.config &&
                                        (n.instanceConfig = d.extend(n.instanceConfig, s.config));
                                } else if ('skip' === s) return void u();
                            }
                            var a = n.instanceConfig.complete;
                            (n.instanceConfig.complete = function (e) {
                                z(a) && a(e, n.file, n.inputElem), u();
                            }),
                            k.parse(n.file, n.instanceConfig);
                        } else z(o.complete) && o.complete();
                    }

                    function u() {
                        h.splice(0, 1), e();
                    }
                };
            }

            function l(e) {
                (this._handle = null),
                (this._finished = !1),
                (this._completed = !1),
                (this._input = null),
                (this._baseIndex = 0),
                (this._partialLine = ''),
                (this._rowCount = 0),
                (this._start = 0),
                (this._nextChunk = null),
                (this.isFirstChunk = !0),
                (this._completeResults = {
                    data: [],
                    errors: [],
                    meta: {}
                }),
                function (e) {
                    var t = E(e);
                    (t.chunkSize = parseInt(t.chunkSize)),
                    e.step || e.chunk || (t.chunkSize = null);
                    (this._handle = new r(t)), ((this._handle.streamer = this)._config = t);
                }.call(this, e),
                    (this.parseChunk = function (e, t) {
                        if (this.isFirstChunk && z(this._config.beforeFirstChunk)) {
                            var r = this._config.beforeFirstChunk(e);
                            void 0 !== r && (e = r);
                        }
                        this.isFirstChunk = !1;
                        var i = this._partialLine + e;
                        this._partialLine = '';
                        var n = this._handle.parse(i, this._baseIndex, !this._finished);
                        if (!this._handle.paused() && !this._handle.aborted()) {
                            var s = n.meta.cursor;
                            this._finished ||
                                ((this._partialLine = i.substring(s - this._baseIndex)),
                                    (this._baseIndex = s)),
                                n && n.data && (this._rowCount += n.data.length);
                            var a =
                                this._finished ||
                                (this._config.preview && this._rowCount >= this._config.preview);
                            if (o)
                                f.postMessage({
                                    results: n,
                                    workerId: k.WORKER_ID,
                                    finished: a
                                });
                            else if (z(this._config.chunk) && !t) {
                                if (
                                    (this._config.chunk(n, this._handle),
                                        this._handle.paused() || this._handle.aborted())
                                )
                                    return;
                                (n = void 0), (this._completeResults = void 0);
                            }
                            return (
                                this._config.step ||
                                this._config.chunk ||
                                ((this._completeResults.data = this._completeResults.data.concat(
                                        n.data
                                    )),
                                    (this._completeResults.errors = this._completeResults.errors.concat(
                                        n.errors
                                    )),
                                    (this._completeResults.meta = n.meta)),
                                this._completed ||
                                !a ||
                                !z(this._config.complete) ||
                                (n && n.meta.aborted) ||
                                (this._config.complete(this._completeResults, this._input),
                                    (this._completed = !0)),
                                a || (n && n.meta.paused) || this._nextChunk(),
                                n
                            );
                        }
                    }),
                    (this._sendError = function (e) {
                        z(this._config.error) ?
                            this._config.error(e) :
                            o &&
                            this._config.error &&
                            f.postMessage({
                                workerId: k.WORKER_ID,
                                error: e,
                                finished: !1
                            });
                    });
            }

            function c(e) {
                var i;
                (e = e || {}).chunkSize || (e.chunkSize = k.RemoteChunkSize),
                    l.call(this, e),
                    (this._nextChunk = n ?
                        function () {
                            this._readChunk(), this._chunkLoaded();
                        } :
                        function () {
                            this._readChunk();
                        }),
                    (this.stream = function (e) {
                        (this._input = e), this._nextChunk();
                    }),
                    (this._readChunk = function () {
                        if (this._finished) this._chunkLoaded();
                        else {
                            if (
                                ((i = new XMLHttpRequest()),
                                    this._config.withCredentials &&
                                    (i.withCredentials = this._config.withCredentials),
                                    n ||
                                    ((i.onload = w(this._chunkLoaded, this)),
                                        (i.onerror = w(this._chunkError, this))),
                                    i.open('GET', this._input, !n),
                                    this._config.downloadRequestHeaders)
                            ) {
                                var e = this._config.downloadRequestHeaders;
                                for (var t in e) i.setRequestHeader(t, e[t]);
                            }
                            if (this._config.chunkSize) {
                                var r = this._start + this._config.chunkSize - 1;
                                i.setRequestHeader('Range', 'bytes=' + this._start + '-' + r),
                                    i.setRequestHeader('If-None-Match', 'webkit-no-cache');
                            }
                            try {
                                i.send();
                            } catch (e) {
                                this._chunkError(e.message);
                            }
                            n && 0 === i.status ?
                                this._chunkError() :
                                (this._start += this._config.chunkSize);
                        }
                    }),
                    (this._chunkLoaded = function () {
                        4 === i.readyState &&
                            (i.status < 200 || 400 <= i.status ?
                                this._chunkError() :
                                ((this._finished = !this._config.chunkSize ||
                                        this._start >
                                        (function (e) {
                                            var t = e.getResponseHeader('Content-Range');
                                            if (null === t) return -1;
                                            return parseInt(t.substr(t.lastIndexOf('/') + 1));
                                        })(i)),
                                    this.parseChunk(i.responseText)));
                    }),
                    (this._chunkError = function (e) {
                        var t = i.statusText || e;
                        this._sendError(new Error(t));
                    });
            }

            function p(e) {
                var i, n;
                (e = e || {}).chunkSize || (e.chunkSize = k.LocalChunkSize), l.call(this, e);
                var s = 'undefined' != typeof FileReader;
                (this.stream = function (e) {
                    (this._input = e),
                    (n = e.slice || e.webkitSlice || e.mozSlice),
                    s
                        ?
                        (((i = new FileReader()).onload = w(this._chunkLoaded, this)),
                            (i.onerror = w(this._chunkError, this))) :
                        (i = new FileReaderSync()),
                        this._nextChunk();
                }),
                (this._nextChunk = function () {
                    this._finished ||
                        (this._config.preview && !(this._rowCount < this._config.preview)) ||
                        this._readChunk();
                }),
                (this._readChunk = function () {
                    var e = this._input;
                    if (this._config.chunkSize) {
                        var t = Math.min(
                            this._start + this._config.chunkSize,
                            this._input.size
                        );
                        e = n.call(e, this._start, t);
                    }
                    var r = i.readAsText(e, this._config.encoding);
                    s || this._chunkLoaded({
                        target: {
                            result: r
                        }
                    });
                }),
                (this._chunkLoaded = function (e) {
                    (this._start += this._config.chunkSize),
                    (this._finished = !this._config.chunkSize || this._start >= this._input.size),
                    this.parseChunk(e.target.result);
                }),
                (this._chunkError = function () {
                    this._sendError(i.error);
                });
            }

            function _(e) {
                var r;
                l.call(this, (e = e || {})),
                    (this.stream = function (e) {
                        return (r = e), this._nextChunk();
                    }),
                    (this._nextChunk = function () {
                        if (!this._finished) {
                            var e = this._config.chunkSize,
                                t = e ? r.substr(0, e) : r;
                            return (
                                (r = e ? r.substr(e) : ''),
                                (this._finished = !r),
                                this.parseChunk(t)
                            );
                        }
                    });
            }

            function g(e) {
                l.call(this, (e = e || {}));
                var t = [],
                    r = !0,
                    i = !1;
                (this.pause = function () {
                    l.prototype.pause.apply(this, arguments), this._input.pause();
                }),
                (this.resume = function () {
                    l.prototype.resume.apply(this, arguments), this._input.resume();
                }),
                (this.stream = function (e) {
                    (this._input = e),
                    this._input.on('data', this._streamData),
                        this._input.on('end', this._streamEnd),
                        this._input.on('error', this._streamError);
                }),
                (this._checkIsFinished = function () {
                    i && 1 === t.length && (this._finished = !0);
                }),
                (this._nextChunk = function () {
                    this._checkIsFinished(), t.length ? this.parseChunk(t.shift()) : (r = !0);
                }),
                (this._streamData = w(function (e) {
                    try {
                        t.push('string' == typeof e ? e : e.toString(this._config.encoding)),
                            r &&
                            ((r = !1), this._checkIsFinished(), this.parseChunk(t.shift()));
                    } catch (e) {
                        this._streamError(e);
                    }
                }, this)),
                (this._streamError = w(function (e) {
                    this._streamCleanUp(), this._sendError(e);
                }, this)),
                (this._streamEnd = w(function () {
                    this._streamCleanUp(), (i = !0), this._streamData('');
                }, this)),
                (this._streamCleanUp = w(function () {
                    this._input.removeListener('data', this._streamData),
                        this._input.removeListener('end', this._streamEnd),
                        this._input.removeListener('error', this._streamError);
                }, this));
            }

            function r(g) {
                var a,
                    o,
                    h,
                    i = /^\s*-?(\d*\.?\d+|\d+\.?\d*)(e[-+]?\d+)?\s*$/i,
                    n = /(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))/,
                    t = this,
                    r = 0,
                    s = 0,
                    u = !1,
                    e = !1,
                    f = [],
                    d = {
                        data: [],
                        errors: [],
                        meta: {}
                    };
                if (z(g.step)) {
                    var l = g.step;
                    g.step = function (e) {
                        if (((d = e), p())) c();
                        else {
                            if ((c(), 0 === d.data.length)) return;
                            (r += e.data.length), g.preview && r > g.preview ? o.abort() : l(d, t);
                        }
                    };
                }

                function m(e) {
                    return 'greedy' === g.skipEmptyLines ?
                        '' === e.join('').trim() :
                        1 === e.length && 0 === e[0].length;
                }

                function c() {
                    if (
                        (d &&
                            h &&
                            (y(
                                    'Delimiter',
                                    'UndetectableDelimiter',
                                    "Unable to auto-detect delimiting character; defaulted to '" +
                                    k.DefaultDelimiter +
                                    "'"
                                ),
                                (h = !1)),
                            g.skipEmptyLines)
                    )
                        for (var e = 0; e < d.data.length; e++)
                            m(d.data[e]) && d.data.splice(e--, 1);
                    return (
                        p() &&
                        (function () {
                            if (!d) return;
                            for (var e = 0; p() && e < d.data.length; e++)
                                for (var t = 0; t < d.data[e].length; t++) {
                                    var r = d.data[e][t];
                                    g.trimHeaders && (r = r.trim()), f.push(r);
                                }
                            d.data.splice(0, 1);
                        })(),
                        (function () {
                            if (!d || (!g.header && !g.dynamicTyping && !g.transform)) return d;
                            for (var e = 0; e < d.data.length; e++) {
                                var t,
                                    r = g.header ? {} : [];
                                for (t = 0; t < d.data[e].length; t++) {
                                    var i = t,
                                        n = d.data[e][t];
                                    g.header && (i = t >= f.length ? '__parsed_extra' : f[t]),
                                        g.transform && (n = g.transform(n, i)),
                                        (n = _(i, n)),
                                        '__parsed_extra' === i ?
                                        ((r[i] = r[i] || []), r[i].push(n)) :
                                        (r[i] = n);
                                }
                                (d.data[e] = r),
                                g.header &&
                                    (t > f.length ?
                                        y(
                                            'FieldMismatch',
                                            'TooManyFields',
                                            'Too many fields: expected ' +
                                            f.length +
                                            ' fields but parsed ' +
                                            t,
                                            s + e
                                        ) :
                                        t < f.length &&
                                        y(
                                            'FieldMismatch',
                                            'TooFewFields',
                                            'Too few fields: expected ' +
                                            f.length +
                                            ' fields but parsed ' +
                                            t,
                                            s + e
                                        ));
                            }
                            g.header && d.meta && (d.meta.fields = f);
                            return (s += d.data.length), d;
                        })()
                    );
                }

                function p() {
                    return g.header && 0 === f.length;
                }

                function _(e, t) {
                    return (
                        (r = e),
                        g.dynamicTypingFunction &&
                        void 0 === g.dynamicTyping[r] &&
                        (g.dynamicTyping[r] = g.dynamicTypingFunction(r)),
                        !0 === (g.dynamicTyping[r] || g.dynamicTyping) ?
                        'true' === t ||
                        'TRUE' === t ||
                        ('false' !== t &&
                            'FALSE' !== t &&
                            (i.test(t) ?
                                parseFloat(t) :
                                n.test(t) ? new Date(t) : '' === t ? null : t)) :
                        t
                    );
                    var r;
                }

                function y(e, t, r, i) {
                    d.errors.push({
                        type: e,
                        code: t,
                        message: r,
                        row: i
                    });
                }
                (this.parse = function (e, t, r) {
                    var i = g.quoteChar || '"';
                    if (
                        (g.newline ||
                            (g.newline = (function (e, t) {
                                e = e.substr(0, 1048576);
                                var r = new RegExp(M(t) + '([^]*?)' + M(t), 'gm'),
                                    i = (e = e.replace(r, '')).split('\r'),
                                    n = e.split('\n'),
                                    s = 1 < n.length && n[0].length < i[0].length;
                                if (1 === i.length || s) return '\n';
                                for (var a = 0, o = 0; o < i.length; o++) '\n' === i[o][0] && a++;
                                return a >= i.length / 2 ? '\r\n' : '\r';
                            })(e, i)),
                            (h = !1),
                            g.delimiter)
                    )
                        z(g.delimiter) &&
                        ((g.delimiter = g.delimiter(e)), (d.meta.delimiter = g.delimiter));
                    else {
                        var n = (function (e, t, r, i) {
                            for (
                                var n,
                                    s,
                                    a,
                                    o = [',', '\t', '|', ';', k.RECORD_SEP, k.UNIT_SEP],
                                    h = 0; h < o.length; h++
                            ) {
                                var u = o[h],
                                    f = 0,
                                    d = 0,
                                    l = 0;
                                a = void 0;
                                for (
                                    var c = new v({
                                            comments: i,
                                            delimiter: u,
                                            newline: t,
                                            preview: 10
                                        }).parse(e),
                                        p = 0; p < c.data.length; p++
                                )
                                    if (r && m(c.data[p])) l++;
                                    else {
                                        var _ = c.data[p].length;
                                        (d += _),
                                        void 0 !== a ?
                                            1 < _ && ((f += Math.abs(_ - a)), (a = _)) :
                                            (a = 0);
                                    }
                                0 < c.data.length && (d /= c.data.length - l),
                                    (void 0 === s || s < f) && 1.99 < d && ((s = f), (n = u));
                            }
                            return {
                                successful: !!(g.delimiter = n),
                                bestDelimiter: n
                            };
                        })(e, g.newline, g.skipEmptyLines, g.comments);
                        n.successful ?
                            (g.delimiter = n.bestDelimiter) :
                            ((h = !0), (g.delimiter = k.DefaultDelimiter)),
                            (d.meta.delimiter = g.delimiter);
                    }
                    var s = E(g);
                    return (
                        g.preview && g.header && s.preview++,
                        (a = e),
                        (o = new v(s)),
                        (d = o.parse(a, t, r)),
                        c(),
                        u ? {
                            meta: {
                                paused: !0
                            }
                        } : d || {
                            meta: {
                                paused: !1
                            }
                        }
                    );
                }),
                (this.paused = function () {
                    return u;
                }),
                (this.pause = function () {
                    (u = !0), o.abort(), (a = a.substr(o.getCharIndex()));
                }),
                (this.resume = function () {
                    (u = !1), t.streamer.parseChunk(a, !0);
                }),
                (this.aborted = function () {
                    return e;
                }),
                (this.abort = function () {
                    (e = !0),
                    o.abort(),
                        (d.meta.aborted = !0),
                        z(g.complete) && g.complete(d),
                        (a = '');
                });
            }

            function M(e) {
                return e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            }

            function v(e) {
                var S,
                    O = (e = e || {}).delimiter,
                    x = e.newline,
                    T = e.comments,
                    I = e.step,
                    A = e.preview,
                    D = e.fastMode,
                    L = (S = void 0 === e.quoteChar ? '"' : e.quoteChar);
                if (
                    (void 0 !== e.escapeChar && (L = e.escapeChar),
                        ('string' != typeof O || -1 < k.BAD_DELIMITERS.indexOf(O)) && (O = ','),
                        T === O)
                )
                    throw 'Comment character same as delimiter';
                !0 === T ?
                    (T = '#') :
                    ('string' != typeof T || -1 < k.BAD_DELIMITERS.indexOf(T)) && (T = !1),
                    '\n' !== x && '\r' !== x && '\r\n' !== x && (x = '\n');
                var P = 0,
                    F = !1;
                (this.parse = function (i, t, r) {
                    if ('string' != typeof i) throw 'Input must be a string';
                    var n = i.length,
                        e = O.length,
                        s = x.length,
                        a = T.length,
                        o = z(I),
                        h = [],
                        u = [],
                        f = [],
                        d = (P = 0);
                    if (!i) return C();
                    if (D || (!1 !== D && -1 === i.indexOf(S))) {
                        for (var l = i.split(x), c = 0; c < l.length; c++) {
                            if (((f = l[c]), (P += f.length), c !== l.length - 1)) P += x.length;
                            else if (r) return C();
                            if (!T || f.substr(0, a) !== T) {
                                if (o) {
                                    if (((h = []), k(f.split(O)), R(), F)) return C();
                                } else k(f.split(O));
                                if (A && A <= c) return (h = h.slice(0, A)), C(!0);
                            }
                        }
                        return C();
                    }
                    for (
                        var p,
                            _ = i.indexOf(O, P),
                            g = i.indexOf(x, P),
                            m = new RegExp(M(L) + M(S), 'g');;

                    )
                        if (i[P] !== S)
                            if (T && 0 === f.length && i.substr(P, a) === T) {
                                if (-1 === g) return C();
                                (P = g + s), (g = i.indexOf(x, P)), (_ = i.indexOf(O, P));
                            } else if (-1 !== _ && (_ < g || -1 === g))
                        f.push(i.substring(P, _)), (P = _ + e), (_ = i.indexOf(O, P));
                    else {
                        if (-1 === g) break;
                        if ((f.push(i.substring(P, g)), w(g + s), o && (R(), F)))
                            return C();
                        if (A && h.length >= A) return C(!0);
                    } else
                        for (p = P, P++;;) {
                            if (-1 === (p = i.indexOf(S, p + 1)))
                                return (
                                    r ||
                                    u.push({
                                        type: 'Quotes',
                                        code: 'MissingQuotes',
                                        message: 'Quoted field unterminated',
                                        row: h.length,
                                        index: P
                                    }),
                                    E()
                                );
                            if (p === n - 1) return E(i.substring(P, p).replace(m, S));
                            if (S !== L || i[p + 1] !== L) {
                                if (S === L || 0 === p || i[p - 1] !== L) {
                                    var y = b(-1 === g ? _ : Math.min(_, g));
                                    if (i[p + 1 + y] === O) {
                                        f.push(i.substring(P, p).replace(m, S)),
                                            (P = p + 1 + y + e),
                                            (_ = i.indexOf(O, P)),
                                            (g = i.indexOf(x, P));
                                        break;
                                    }
                                    var v = b(g);
                                    if (i.substr(p + 1 + v, s) === x) {
                                        if (
                                            (f.push(i.substring(P, p).replace(m, S)),
                                                w(p + 1 + v + s),
                                                (_ = i.indexOf(O, P)),
                                                o && (R(), F))
                                        )
                                            return C();
                                        if (A && h.length >= A) return C(!0);
                                        break;
                                    }
                                    u.push({
                                            type: 'Quotes',
                                            code: 'InvalidQuotes',
                                            message: 'Trailing quote on quoted field is malformed',
                                            row: h.length,
                                            index: P
                                        }),
                                        p++;
                                }
                            } else p++;
                        }
                    return E();

                    function k(e) {
                        h.push(e), (d = P);
                    }

                    function b(e) {
                        var t = 0;
                        if (-1 !== e) {
                            var r = i.substring(p + 1, e);
                            r && '' === r.trim() && (t = r.length);
                        }
                        return t;
                    }

                    function E(e) {
                        return (
                            r ||
                            (void 0 === e && (e = i.substr(P)),
                                f.push(e),
                                (P = n),
                                k(f),
                                o && R()),
                            C()
                        );
                    }

                    function w(e) {
                        (P = e), k(f), (f = []), (g = i.indexOf(x, P));
                    }

                    function C(e) {
                        return {
                            data: h,
                            errors: u,
                            meta: {
                                delimiter: O,
                                linebreak: x,
                                aborted: F,
                                truncated: !!e,
                                cursor: d + (t || 0)
                            }
                        };
                    }

                    function R() {
                        I(C()), (h = []), (u = []);
                    }
                }),
                (this.abort = function () {
                    F = !0;
                }),
                (this.getCharIndex = function () {
                    return P;
                });
            }

            function m(e) {
                var t = e.data,
                    r = h[t.workerId],
                    i = !1;
                if (t.error) r.userError(t.error, t.file);
                else if (t.results && t.results.data) {
                    var n = {
                        abort: function () {
                            (i = !0),
                            y(t.workerId, {
                                data: [],
                                errors: [],
                                meta: {
                                    aborted: !0
                                }
                            });
                        },
                        pause: b,
                        resume: b
                    };
                    if (z(r.userStep)) {
                        for (
                            var s = 0; s < t.results.data.length &&
                            (r.userStep({
                                        data: [t.results.data[s]],
                                        errors: t.results.errors,
                                        meta: t.results.meta
                                    },
                                    n
                                ),
                                !i); s++
                        );
                        delete t.results;
                    } else z(r.userChunk) && (r.userChunk(t.results, n, t.file), delete t.results);
                }
                t.finished && !i && y(t.workerId, t.results);
            }

            function y(e, t) {
                var r = h[e];
                z(r.userComplete) && r.userComplete(t), r.terminate(), delete h[e];
            }

            function b() {
                throw 'Not implemented.';
            }

            function E(e) {
                if ('object' != typeof e || null === e) return e;
                var t = Array.isArray(e) ? [] : {};
                for (var r in e) t[r] = E(e[r]);
                return t;
            }

            function w(e, t) {
                return function () {
                    e.apply(t, arguments);
                };
            }

            function z(e) {
                return 'function' == typeof e;
            }
            return (
                o ?
                (f.onmessage = function (e) {
                    var t = e.data;
                    void 0 === k.WORKER_ID && t && (k.WORKER_ID = t.workerId);
                    if ('string' == typeof t.input)
                        f.postMessage({
                            workerId: k.WORKER_ID,
                            results: k.parse(t.input, t.config),
                            finished: !0
                        });
                    else if (
                        (f.File && t.input instanceof File) ||
                        t.input instanceof Object
                    ) {
                        var r = k.parse(t.input, t.config);
                        r &&
                            f.postMessage({
                                workerId: k.WORKER_ID,
                                results: r,
                                finished: !0
                            });
                    }
                }) :
                k.WORKERS_SUPPORTED &&
                ((e = doc.getElementsByTagName('script')),
                    (s = e.length ? e[e.length - 1].src : ''),
                    doc.body ?
                    doc.addEventListener(
                        'DOMContentLoaded',
                        function () {
                            a = !0;
                        },
                        !0
                    ) :
                    (a = !0)),
                ((c.prototype = Object.create(l.prototype)).constructor = c),
                ((p.prototype = Object.create(l.prototype)).constructor = p),
                ((_.prototype = Object.create(_.prototype)).constructor = _),
                ((g.prototype = Object.create(l.prototype)).constructor = g),
                k
            );
        });
});
const request = async pathname => {
    /* @license
       biuuu/ShinyColors
       https://github.com/biuuu/ShinyColors
       License: MIT
    */
    return new Promise((rev, rej) => {
        let timer = setTimeout(() => {
            rej(`불러오기${pathname}시간초과`);
        }, 30 * 1000);
        fetch(`${pathname}`)
            .then(res => {
                clearTimeout(timer);
                const type = res.headers.get('content-type');

                if (type && type.includes('json')) {
                    return res.json();
                }
                if (type && type.includes('image')) {
                    return res.blob();
                }

                return res.text();
            })
            .then(rev)
            .catch(rej);
    });
};
const parseCsv = str => {
    /* @license
       biuuu/ShinyColors
       https://github.com/biuuu/ShinyColors
       License: MIT
    */
    try {
        return papaparse_min.parse(str.replace(/^\ufeff/, ''), {
            header: true,
            delimiter: ','
        }).data;
    } catch (err) {
        PrintLog(err);
        return {};
    }
};

var connectDB = async function () {
    return new Promise(function (resolve, reject) {
        var requestDB = window.indexedDB.open(dbDef.dbName, dbDef.dbVer);

        requestDB.onerror = function (event) {
            PrintLog("DB error: ");
            PrintLog(event);
            reject(event);
        };

        requestDB.onsuccess = function (event) {
            dbDef.dbCon = event.target.result;
            PrintLog("DB success: ");
            resolve();
        };

        requestDB.onupgradeneeded = function (event) {
            dbDef.dbCon = event.target.result;
            dbDef.dbUpgradeNeeded = true;

            try {
                PrintLog('DB 테이블 조회중');
                requestDB.transaction.objectStore(dbDef.dbStoreName);
                PrintLog('DB 테이블 조회 완료');
                PrintLog('DB 테이블 재생성 중');
                dbDef.dbCon.deleteObjectStore(dbDef.dbStoreName);
                dbDef.dbCon.createObjectStore(dbDef.dbStoreName, {
                    keyPath: 'type'
                });
                PrintLog('DB 테이블 재생성 완료');
            } catch (e) {
                PrintLog('DB 테이블 없음');
                PrintLog(e);
                dbDef.dbCon.createObjectStore(dbDef.dbStoreName, {
                    keyPath: 'type'
                });
                PrintLog('DB 테이블 생성 완료');
            }

            PrintLog('DB upgrade Needed');
        }
    });
};

var createDB = async function () {
    return new Promise(function (resolve, reject) {
        var trx = dbDef.dbCon.transaction(dbDef.dbStoreName, "readwrite").objectStore(dbDef.dbStoreName);
        // Add all data objects from dbInit array to our object store

        trx.add({
            type: 'data',
            questJson,
            nameJson,
            archiveJson,
            imageJson,
            battleJson,
            imageBlobs,
            dbNextUpdateTime_text,
            dbNextUpdateTime_image
        });
        trx.add({
            type: 'options',
            doImageSwap,
            doBattleTrans,
            isVerboseMode,
            transMode,
            exMode,
            skipTranslatedText
        });
        trx.add({
            type: 'userName',
            userName
        });
        resolve();
    });
};

var getDB = async function () {
    return new Promise(function (resolve, reject) {
        var trx = dbDef.dbCon.transaction(dbDef.dbStoreName, "readonly").objectStore(dbDef.dbStoreName);
        var requestGet = trx.get('data');
        requestGet.onsuccess = function (event) {
            var requestResult = event.target.result;
            if (!requestResult) {
                //사용자가 업데이트 중 새로고침을 계속 눌러도 업데이트가 진행되게끔 작성함.
                PrintLog('DB 레코드 없음. 재 업데이트 필요.');
                dbReUpdate = true;
                resolve();
                return;
            }
            questJson = requestResult.questJson;
            nameJson = requestResult.nameJson;
            archiveJson = requestResult.archiveJson;
            imageJson = requestResult.imageJson;
            battleJson = requestResult.battleJson;
            imageBlobs = requestResult.imageBlobs;
            imageBlobsUrl = [];
            dbNextUpdateTime_text = requestResult.dbNextUpdateTime_text;
            dbNextUpdateTime_image = requestResult.dbNextUpdateTime_image;
            imageBlobs.some(function (item) {
                try {
                    var blobURL = URL.createObjectURL(item.kr);
                    imageBlobsUrl.push({
                        orig: item.orig,
                        kr: blobURL
                    });
                } catch (e) {
                    PrintLog(e);
                    imageBlobsUrl.pop();
                }
            });
            resolve();
        }
    });
};

var getDBUserName = async function () {
    return new Promise(function (resolve, reject) {
        var trx = dbDef.dbCon.transaction(dbDef.dbStoreName, "readonly").objectStore(dbDef.dbStoreName);
        var requestGet = trx.get('userName');
        requestGet.onsuccess = function (event) {
            var requestResult = event.target.result;
            if (!requestResult) {
                var trx = dbDef.dbCon.transaction(dbDef.dbStoreName, "readwrite").objectStore(dbDef.dbStoreName);

                trx.add({
                    type: 'userName',
                    userName: ''
                });
                resolve();
            } else {
                PrintLog('received user name');
                PrintLog(requestResult.userName);
                if (!requestResult.userName) {
                    userName = '';
                } else {
                    userName = requestResult.userName;
                }
                resolve();
            }
        }
    });
};

var updateDBUserName = async function (newUserName) {
    return new Promise(function (resolve, reject) {
        var trx = dbDef.dbCon.transaction(dbDef.dbStoreName, "readwrite").objectStore(dbDef.dbStoreName);
        var requestGet = trx.get('userName');
        requestGet.onsuccess = function (event) {
            var requestUpdate = trx.put({
                type: 'userName',
                userName: newUserName
            });
            PrintLog('received new tutorial user name');
            PrintLog(newUserName);
            requestUpdate.onsuccess = function (event) {
                resolve();
            };
        }
    });
};

var updateDBOptions = async function () {
    return new Promise(function (resolve, reject) {
        var trx = dbDef.dbCon.transaction(dbDef.dbStoreName, "readwrite").objectStore(dbDef.dbStoreName);
        var requestGet = trx.get('options');
        requestGet.onsuccess = function (event) {
            var requestUpdate = trx.put({
                type: 'options',
                doImageSwap,
                doBattleTrans,
                isVerboseMode,
                transMode,
                exMode,
                skipTranslatedText
            });
            requestUpdate.onsuccess = function (event) {
                resolve();
            };
        }
    });
};

var updateDBTexts = async function () {
    questJson = parseCsv(await request(generalConfig.origin + '/data/quest.csv'));
    nameJson = parseCsv(await request(generalConfig.origin + '/data/name.csv'));
    archiveJson = parseCsv(await request(generalConfig.origin + '/data/archive.csv'));
    imageJson = parseCsv(await request(generalConfig.origin + '/data/image.csv'));
    battleJson = parseCsv(await request(generalConfig.origin + '/data/battle.csv'));
    dbNextUpdateTime_text = new Date();
    dbNextUpdateTime_text.setHours(dbNextUpdateTime_text.getHours() + 1, 0, 0, 0);
    dbNextUpdateTime_image = new Date();
    dbNextUpdateTime_image.setHours(24 + 5, 0, 0, 0);

    return new Promise(function (resolve, reject) {
        var trx = dbDef.dbCon.transaction(dbDef.dbStoreName, "readwrite").objectStore(dbDef.dbStoreName);
        var requestGet = trx.get('data');
        requestGet.onsuccess = function (event) {
            var requestUpdate = trx.put({
                type: 'data',
                questJson,
                nameJson,
                archiveJson,
                imageJson,
                battleJson,
                imageBlobs,
                dbNextUpdateTime_text,
                dbNextUpdateTime_image
            });
            requestUpdate.onsuccess = function (event) {
                PrintLog('업데이트 완료');
                chrome.runtime.sendMessage({
                    data: "updateCompleted"
                });
                resolve();
            };
        }
    });
};

var updateDBImages = async function () {
    dbNextUpdateTime_text = new Date();
    dbNextUpdateTime_text.setHours(dbNextUpdateTime_text.getHours() + 1, 0, 0, 0);
    dbNextUpdateTime_image = new Date();
    dbNextUpdateTime_image.setHours(24 + 5, 0, 0, 0);
    imageJson = parseCsv(await request(generalConfig.origin + '/data/image.csv'));
    imageBlobs = [];
    imageBlobsUrl = [];
    //image blob 읽어들이기. 대략 10초 내로 전부 불러들이는듯.
    await Promise.all(imageJson.map(async (item) => {
        if (item.kr) {
            try {
                PrintLog('image downloading');
                PrintLog(generalConfig.imageOrigin + item.kr);
                var imgBlob = await request(generalConfig.imageOrigin + item.kr);

                imageBlobs.push({
                    orig: item.orig,
                    kr: imgBlob
                });
                var blobURL = URL.createObjectURL(imgBlob);
                imageBlobsUrl.push({
                    orig: item.orig,
                    kr: blobURL
                });
            } catch (e) {
                PrintLog(e);
                imageBlobs.pop();
                imageBlobsUrl.pop();
            }

        }
    }));
    return new Promise(function (resolve, reject) {
        var trx = dbDef.dbCon.transaction(dbDef.dbStoreName, "readwrite").objectStore(dbDef.dbStoreName);
        var requestGet = trx.get('data');
        requestGet.onsuccess = function (event) {
            var requestUpdate = trx.put({
                type: 'data',
                questJson,
                nameJson,
                archiveJson,
                imageJson,
                battleJson,
                imageBlobs,
                dbNextUpdateTime_text,
                dbNextUpdateTime_image
            });
            requestUpdate.onsuccess = function (event) {
                PrintLog('업데이트 완료');
                chrome.runtime.sendMessage({
                    data: "updateCompleted"
                });
                resolve();
            };
        }
    });
};

///
function readChromeOption(key) {
    return new Promise((resolve, reject) => {
        if (key != null) {
            chrome.storage.local.get(key, function (obj) {
                resolve(obj);
            });
        } else {
            reject(null);
        }
    });
}
async function InitList() {
    var chromeOptions = await readChromeOption([
        'battleFullInfo',
        'sceneFullInfo',
        'nTEXT',
        'mTEXT',
        'verboseMode',
        'origin',
        'imageswap',
        'battleobserver',
        'extractMode',
        'translateMode',
        'userFont',
        'userFontName',
        'nonTransText'
    ]);
    if (chromeOptions.sceneFullInfo)
        sceneFullInfo = chromeOptions.sceneFullInfo;
    if (chromeOptions.battleFullInfo)
        battleFullInfo = chromeOptions.battleFullInfo;
    if (chromeOptions.nTEXT)
        cNames = chromeOptions.nTEXT;
    if (chromeOptions.mTEXT)
        miscs = chromeOptions.mTEXT;
    doImageSwap = chromeOptions.imageswap;
    doBattleTrans = chromeOptions.battleobserver;
    isVerboseMode = chromeOptions.verboseMode;
    transMode = chromeOptions.translateMode;
    exMode = chromeOptions.extractMode;
    skipTranslatedText = chromeOptions.nonTransText;
    if (chromeOptions.origin) {
        generalConfig.origin = chromeOptions.origin;
        if (chromeOptions.origin.includes('chrome-extension://')) {
            generalConfig.imageOrigin = chromeOptions.origin + '/images/';
        } else {
            generalConfig.imageOrigin = 'https://raw.githubusercontent.com/sidewinderk/gbfTransKor/master/images/';
        }
    } else {
        generalConfig.origin = 'chrome-extension://' + chrome.runtime.id;
        generalConfig.imageOrigin = 'chrome-extension://' + chrome.runtime.id + '/images/';;
    }
    if (chromeOptions.userFont)
        generalConfig.defaultFont = chromeOptions.userFont;


    // Use custom font
    var styles = `@font-face {font-family: 'CustomFont';src: url('http://game-a.granbluefantasy.jp/assets/font/basic_alphabet.woff') format('woff');}
    @font-face {font-family: 'CustomFont';${generalConfig.defaultFont}; unicode-range: U+AC00-D7AF;}`;
    if (!initialize) {
        PrintLog("Initialized");
        var styleSheet = doc.createElement('style');
        styleSheet.type = 'text/css';
        styleSheet.innerText = styles;
        doc.head.appendChild(styleSheet);
        doc.body.style.fontFamily = `CustomFont`;
        initialize = true;
    }

    // window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB ||
    //     window.msIndexedDB;
    // window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction ||
    //     window.msIDBTransaction;
    // window.IDBKeyRange = window.IDBKeyRange ||
    //     window.webkitIDBKeyRange || window.msIDBKeyRange

    if (!window.indexedDB) {
        window.alert("이 브라우저는 indexedDB 기능을 지원하지 않습니다.\n\n최신 크롬 브라우저를 이용해주세요.");
        return;
    }

    await connectDB();

    if (dbDef.dbUpgradeNeeded) {
        //DB 데이터 초기화
        questJson = parseCsv(await request(generalConfig.origin + '/data/quest.csv'));
        nameJson = parseCsv(await request(generalConfig.origin + '/data/name.csv'));
        archiveJson = parseCsv(await request(generalConfig.origin + '/data/archive.csv'));
        imageJson = parseCsv(await request(generalConfig.origin + '/data/image.csv'));
        battleJson = parseCsv(await request(generalConfig.origin + '/data/battle.csv'));
        imageBlobs = [];
        imageBlobsUrl = [];
        dbNextUpdateTime_text = new Date();
        dbNextUpdateTime_text.setHours(dbNextUpdateTime_text.getHours() + 1, 0, 0, 0);
        dbNextUpdateTime_image = new Date();
        dbNextUpdateTime_image.setHours(24 + 5, 0, 0, 0);
        userName = '';
        //image blob 읽어들이기. 대략 10초 내로 전부 불러들이는듯.
        await Promise.all(imageJson.map(async (item) => {
            if (item.kr) {
                try {
                    PrintLog('image downloading');
                    PrintLog(generalConfig.imageOrigin + item.kr);
                    var imgBlob = await request(generalConfig.imageOrigin + item.kr);

                    imageBlobs.push({
                        orig: item.orig,
                        kr: imgBlob
                    });
                    var blobURL = URL.createObjectURL(imgBlob);
                    imageBlobsUrl.push({
                        orig: item.orig,
                        kr: blobURL
                    });
                } catch (e) {
                    PrintLog(e);
                    imageBlobs.pop();
                    imageBlobsUrl.pop();
                }
            }
        }));

        await createDB();
        PrintLog('업데이트 완료');
    } else {
        PrintLog('DB 존재. DB에 존재하는 데이터를 읽어들이는중.');
        await getDB();
        if (dbReUpdate) {
            //사용자가 업데이트 중 새로고침을 계속 눌러도 업데이트가 진행되게끔 작성함.
            PrintLog('재 업데이트 중.');
            updateDBTexts();
            updateDBImages();
            updateDBUserName(userName);
            PrintLog('재 업데이트 완료.');
        }
        getDBUserName();

    }
    /*
        번역문 업데이트는 1시간 간격으로.
        이미지 업데이트는 다음 날 새벽 5시에.
    */
    var currentTime = new Date();
    PrintLog(`dbNextUpdateTime_text : ${dbNextUpdateTime_text}`);
    PrintLog(`dbNextUpdateTime_image : ${dbNextUpdateTime_image}`);
    PrintLog(`currentTime : ${currentTime}`);
    PrintLog(`currentTime >= dbNextUpdateTime : ${currentTime >= dbNextUpdateTime_text }`);
    PrintLog(`currentTime >= dbNextUpdateTime : ${currentTime >= dbNextUpdateTime_image }`);
    if (dbNextUpdateTime_text <= currentTime) {
        updateDBTexts();
        updateDBUserName(userName);
    } else if (dbNextUpdateTime_image <= currentTime) {
        if (doImageSwap) {
            updateDBImages();
        }
    }

    //새로고침을 업데이트 도중에해서 이미지 업데이트가 끊겼다면,
    //imageBlobs 배열 길이를 imageJson 배열 길이로 계산하여 다시 다운로드 시작.
    if (doImageSwap) {
        var imageLength = 0;
        imageJson.some(function (item) {
            if (item.orig.length != 0 && item.orig[0] != '!') {
                imageLength++;
            }
        });

        PrintLog(`ImageJson Pure Length : ${imageLength}`);
        PrintLog(`ImageBlobs Length : ${imageBlobs.length}`);
        if (doImageSwap && imageBlobs && imageBlobs.length < imageLength) {
            PrintLog("imageBlobs Length dosen't match with imagejson length");
            updateDBImages();
        }
    }


    //크롬 옵션들은 매번 업데이트 해주기.
    await updateDBOptions();

    async function script() {
        var imageBlobs = [];
        var imageBlobsUrl = [];
        var archiveJson = [];

        var doImageSwap = null;
        var transMode = null;
        var exMode = null;
        var isVerboseMode = null;

        var userName = '';

        function window_PrintLog(text) {
            if (isVerboseMode) {
                window.dispatchEvent(new CustomEvent('console_log', {
                    detail: text
                }));
            }
        }

        function window_extractStoryText(text) {
            window.dispatchEvent(new CustomEvent('extract_storyText', {
                detail: text
            }));
        }

        function window_extractArchiveText(text) {
            window.dispatchEvent(new CustomEvent('extract_archiveText', {
                detail: text
            }));
        }

        function window_extractBattleText(text) {
            window.dispatchEvent(new CustomEvent('extract_battleText', {
                detail: text
            }));
        }

        // window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB ||
        //     window.msIndexedDB;
        // window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction ||
        //     window.msIDBTransaction;
        // window.IDBKeyRange = window.IDBKeyRange ||
        //     window.webkitIDBKeyRange || window.msIDBKeyRange

        if (!window.indexedDB) {
            window.alert("이 브라우저는 indexedDB 기능을 지원하지 않습니다.\n\n최신 크롬 브라우저를 이용해주세요.");
            return;
        }

        var dbDef = {
            dbCon: null,
            dbName: 'gbfTransKorDB',
            dbStoreName: 'gbfTransKorStore',
            dbUpgradeNeeded: false,
            dbVer: 3
        }

        var connectDB = async function () {
            return new Promise(function (resolve, reject) {
                var requestDB = window.indexedDB.open(dbDef.dbName, dbDef.dbVer);

                requestDB.onerror = function (event) {
                    reject(event);
                };

                requestDB.onsuccess = function (event) {
                    dbDef.dbCon = event.target.result;
                    resolve();
                };
            });
        }
        var getDB = async function () {
            return new Promise(function (resolve, reject) {
                var trx = dbDef.dbCon.transaction(dbDef.dbStoreName, "readonly").objectStore(dbDef.dbStoreName);
                var allRecords = trx.getAll();
                allRecords.onsuccess = function (event) {
                    var datas = event.target.result[0];
                    var options = event.target.result[1];
                    var dbUserName = event.target.result[2];
                    window_PrintLog('DB GET ALL RESULT');
                    window_PrintLog(event.target.result);

                    // //DATAs
                    imageBlobs = datas.imageBlobs;
                    // // imageBlobs.some(function (item) {
                    // //     imageBlobsUrl.push({
                    // //         orig: item.orig,
                    // //         kr: URL.createObjectURL(item.kr)
                    // //     });
                    // // });

                    archiveJson = datas.archiveJson;

                    // //OPTIONs
                    doImageSwap = options.doImageSwap;
                    doBattleTrans = options.doBattleTrans;
                    transMode = options.transMode;
                    exMode = options.exMode;
                    isVerboseMode = options.isVerboseMode;

                    //USER NAME
                    userName = dbUserName.userName;
                    window_PrintLog(userName);
                    resolve();
                };
            });
        }

        await connectDB();
        await getDB();

        // 캔버스 이미지 번역
        // 캔버스에서 불러오는 이미지는 확인 가능. 그러나 모든 이미지 url 을 볼 수 는없었음. 
        // 예를들어, 메인 페이지에서는 어떠한 이미지도 밑의 함수들을 거치지 않음.
        if (transMode && doImageSwap) {
            Object.defineProperty(Image.prototype, 'src', {
                get: function (url) {
                    return this.getAttribute('src')
                },

                set: function (url) {
                    if (url == '') {
                        this.setAttribute('src', url);
                        return;
                    }
                    //이미지 깨짐 현상 일어나는 페이지들에 대한 예외목록
                    if (document.URL.includes('/#gacha') ||
                        document.URL.includes('/#mypage')) {
                        this.setAttribute('src', url);
                        return;
                    }
                    //공격 버튼 이미지 번역이 안되는 현상 발견됨. 전투 페이지에서도 이미지 번역 수행하도록 변경함.
                    // if (document.URL.includes('/#raid')) {
                    //     this.setAttribute('src', url);
                    //     return;
                    // }
                    window_PrintLog(`IMAGE URL LOG : ${url}`);

                    //이 코드로 변경한 이유 : 이 함수로 번역되는 이미지가 정말 몇 없음.
                    //그러므로, getDB에서 URL.createObjectURL(item.kr)을 수행하지않고
                    //여기서 필요할때마다 수행함. getDB에서 URL.createObjectURL(item.kr)을 수행하면
                    //0.3초 정도 퍼포먼스 손실이 있었음.
                    imageBlobs.some(function (item) {
                        if (item.orig) {
                            window_PrintLog(`item.orig: ${item.orig}`);
                            if (url.includes(item.orig) && url.includes('assets')) {
                                window_PrintLog(`TRNASLATED IMAGE URL LOG: ${String(item.kr)}`);

                                url = URL.createObjectURL(item.kr);
                                return true;
                            }
                        }
                    });

                    // imageBlobsUrl.some(function (item) {
                    //     if (item.orig) {
                    //         window_PrintLog(`item.orig: ${item.orig}`);
                    //         if (url.includes(item.orig) && url.includes('assets')) {
                    //             window_PrintLog(`TRNASLATED IMAGE URL LOG: ${String(item.kr)}`);

                    //             url = item.kr;
                    //             return true;
                    //         }
                    //     }
                    // });

                    this.setAttribute('src', url);
                }
            });
        }

        //캔버스 텍스트 번역 & 추출
        if (transMode || exMode) {
            var origCanvasRenderingContext = CanvasRenderingContext2D.prototype.fillText;
            CanvasRenderingContext2D.prototype.fillText = function () {
                if (arguments.length <= 1) {
                    return;
                }
                window_PrintLog('canvas text');

                var stext = arguments[0];
                window_PrintLog(arguments);

                // If the text contains any number, save the number and replace it to "*"
                var number = stext.replace(/[^0-9]/g, '');
                if (number.length > 0) {
                    stext = stext.replace(/[0-9]/g, '*');
                }

                if (exMode) {
                    window_extractArchiveText(stext);
                }
                if (transMode) {
                    var transText = '';

                    archiveJson.some(function (item) {
                        if (item.kr) {
                            if (stext.length == item.orig.length) {
                                if (stext == item.orig) {
                                    transText = item.kr;
                                    return true;
                                }
                            }
                        }
                    });
                    if (transText) {
                        if (transText.length > 0) {
                            if (number.length > 0) {
                                // If it contains number("*"), recover it from the saved number
                                for (var i = 0; i < number.length; i++) {
                                    transText = transText.slice(0, transText.indexOf('*')) + number[i] + transText.slice(transText.indexOf('*') + 1);
                                }
                            }

                            arguments[0] = transText;
                        }
                    }
                }

                origCanvasRenderingContext.apply(this, arguments);
            }
        }

        //스토리 텍스트 & 신코드 추출
        //전투 텍스트 추출
        if (transMode || exMode) {
            var origOpen = window.XMLHttpRequest.prototype.open;
            window.XMLHttpRequest.prototype.open = function () {
                window_PrintLog('XHR OPEN');
                window_PrintLog(arguments[1]);

                //신코드 추출
                //url에 scene_list가 들어간건 신코드가 아님.
                if (arguments[1] &&
                    !arguments[1].includes('scene_list') &&
                    (arguments[1].includes('/quest/cleared_quest_scenario/') ||
                        arguments[1].includes('/quest/scenario/scene_') ||
                        arguments[1].includes('/quest/scenario_archive/'))) {
                    //eg) http://game.granbluefantasy.jp/quest/scenario/scene_evt201208_cp1_q1_s10?
                    var scenecode = arguments[1].slice(arguments[1].indexOf('scene_'));
                    scenecode = scenecode.split('?')[0];

                    // eg) scene_evt201208_cp1_q1_s10/null 
                    // 이벤트 스토리에서 종종 발생.
                    if (scenecode.includes('/')) {
                        scenecode = scenecode.split('/')[0];
                    }

                    window_PrintLog('SceneCode : ');
                    window_PrintLog(scenecode);
                    window_extractStoryText({
                        type: 'scenecode',
                        data: scenecode
                    });
                }
                return origOpen.apply(this, [].slice.call(arguments));
            };
            var origSend = window.XMLHttpRequest.prototype.send;
            window.XMLHttpRequest.prototype.send = function (data) {
                this.addEventListener('load', function () {
                    try {
                        var obj = JSON.parse(this.response);

                        if (exMode && obj.scene_list && obj.scene_list[0].id) {
                            window_extractStoryText({
                                type: 'texts',
                                data: obj.scene_list
                            });
                        } else if (exMode && obj.serifs) {
                            for (var i in obj.serifs) {
                                for (var j of obj.serifs[i]) {
                                    window_PrintLog('Got serifs');
                                    window_PrintLog(j);

                                    window_extractArchiveText(j);
                                }
                            }
                        } else if (exMode && (obj.message || obj.navi_information)) {
                            window_PrintLog('GOT BATTLE TEXT');
                            window_PrintLog(obj);
                            window_extractBattleText(obj);
                        } else {
                            window_PrintLog('XHR RESPONSE BODY');
                            window_PrintLog(obj);
                        }
                    } catch (e) {
                        // window_PrintLog(this.response);
                    }
                }, {
                    once: true
                });

                window_PrintLog('XHR SEND');
                window_PrintLog(data);
                origSend.call(this, data);
            };
        }
    }

    function inject(fn) {
        const script = document.createElement('script');
        script.text = `(${fn.toString()})();`;
        document.head.appendChild(script);
        // document.documentElement.appendChild(script);
    }

    //이미지 번역 또는 전투 화면 번역이 켜져있다면 수행. 또는 추출모드만 켜져있어도 수행.
    // if ((transMode && (doImageSwap || doBattleTrans)) || exMode) {
    if (transMode || exMode) {
        inject(script);
    }


    // Main Observers
    if (ObserverList.length < 1) {
        ObserverList = [
            ObserveSceneText(),
            ObserverArchive()
        ];
        if (doImageSwap) ObserverList.push(ObserverImageDIV(), ObserverImage());
        if (doBattleTrans) ObserverList.push(ObserverBattle());
    }
}

function RemoveTranslatedText() {
    //이름 텍스트
    var tempNamesArray = [];
    cNames.some(function (itemTemp) {
        var pass = true;
        nameJson.some(function (item) {
            if (itemTemp == item.orig)
                pass = false;
        });
        if (pass)
            tempNamesArray.push(itemTemp);
    });
    cNames = tempNamesArray;

    //전체 텍스트
    var tempMiscsArray = [];
    miscs.some(function (itemTemp) {
        var pass = true;
        archiveJson.some(function (item) {
            if (itemTemp == item.orig)
                pass = false;
        });
        if (pass)
            tempMiscsArray.push(itemTemp);
    });
    miscs = tempMiscsArray;


}

// Observe the textbox
function translate(stext, jsonFile) {
    // Translation part for story text
    var transText = '';
    PrintLog(`traslate taken: ${stext}`);

    jsonFile.some(function (item) {
        if (item.kr) {
            if (stext.length == item.orig.length) {
                if ((stext == item.orig)) {
                    PrintLog(`GET:${item.kr}`);
                    transText = item.kr;

                    if (transText.includes(generalConfig.defaultName)) {
                        var resultUserName = getTransDefaultUserName(userName);
                        transText = transText.split(generalConfig.defaultName).join(resultUserName);
                    }

                    return true;
                }
            }
        }
    });

    if (transText) {
        if (transText.length > 0) {
            PrintLog(`Send:${transText}`);
            return transText;
        } else {
            PrintLog('no translation');
            return '';
        }
    }
}

function translate_StoryText(stext, jsonFile) {
    var node = doc.getElementsByClassName('prt-log-display')[0].children;
    //check if Log Exists.
    if (!node) return '';
    PrintLog(`translate_StoryText taken: ${stext}`);

    // Translation part for story text
    var transText = '';
    var sc = extractedSceneCode;
    var defaultUserName = getDefaultUserName();

    if (stext.includes(defaultUserName)) {
        userName = defaultUserName;
        updateDBUserName(userName);

        PrintLog(`default user name in stext ${stext}`);
        PrintLog(`default user name set ${userName}`);
    }

    if (skipSceneCode == sc)
        return '';

    if (sc.length > 0) {
        if (cachedSceneData.length == 0 || !cachedSceneData[0].SceneCode.includes(sc)) {
            cachedSceneData = [];
            jsonFile.some(function (item) {
                if (item.SceneCode) {
                    var sceneCodes = item.SceneCode.split('"').join('');
                    sceneCodes = sceneCodes.split(',');

                    for (var i = 0; i < sceneCodes.length; i++) {
                        if (sc == sceneCodes[i]) {
                            cachedSceneData.push(item);
                        }
                    }
                }
            });
        }
    }

    PrintLog('cachedSceneData');
    PrintLog(cachedSceneData);

    if (cachedSceneData.length == 0) {
        PrintLog('스토리 텍스트 탐색 실패. 현재 페이지에 대한 번역 시도는 하지 않음.');
        skipSceneCode = sc;
        return '';
    }

    stext = stext.replace(/(\r\n|\n|\r)/gm, '').trim();
    stext = stext.split('"').join("'");
    stext = stext.replace(/&nbsp;/g, ' ');
    stext = stext.replace(/\s+/g, " ");

    // questJson : [ジータ]
    // stext : [グラン]
    // DB의 이름과 stext의 이름이 달라서 문제 발생. 
    // 이를 해결하기위해 DB의 이름을 stext의 이름으로 맞춰줌.
    if (userName.length > 0) {
        if (stext.includes(userName) || stext.includes("<span class='nickname'></span>")) {
            stext = stext.split(userName).join(generalConfig.defaultName);
            stext = stext.split("<span class='nickname'></span>").join(generalConfig.defaultName);
        }
    }

    for (var i = 0; i < cachedSceneData.length; i++) {
        if (!cachedSceneData[i].Origin)
            continue;
        if (stext.length == cachedSceneData[i].Origin.length) {
            if (stext == cachedSceneData[i].Origin) {
                if (cachedSceneData[i].Korean) {
                    transText = cachedSceneData[i].Korean;

                    if (transText.includes(generalConfig.defaultName)) {
                        var resultUserName = getTransDefaultUserName(userName);
                        transText = transText.split(generalConfig.defaultName).join(resultUserName);
                    }
                    break;
                }
            }
        }
    }

    if (transText) {
        if (transText.length > 0) {
            PrintLog(`Send:${transText}`);
            return transText;
        } else {
            PrintLog('no translation');
            return '';
        }
    } else {
        PrintLog('no text');
        return '';
    }
}

function translate_BattleText(stext, jsonFile) {
    var transText = '';
    stext = stext.replace(/(\r\n|\n|\r)/gm, '').trim();
    stext = stext.split('"').join("'");
    stext = stext.replace(/&nbsp;/g, ' ');
    stext = stext.replace(/\s+/g, " ");

    jsonFile.some(function (item) {
        if (item.Origin) {
            item.Origin = item.Origin.replace(/(\r\n|\n|\r)/gm, '').trim();
            item.Origin = item.Origin.split('"').join("'");
            item.Origin = item.Origin.replace(/&nbsp;/g, ' ');
            item.Origin = item.Origin.replace(/\s+/g, " ");

            if (item.Korean) {
                if (item.Origin.length == stext.length) {
                    if (item.Origin == stext) {
                        transText = item.Korean;
                        return true;
                    }
                }
            }
        }
    });

    if (transText) {
        if (transText.length > 0) {
            PrintLog(`Send:${transText}`);
            return transText;
        } else {
            PrintLog('no translation');
            return '';
        }
    }

}

function GetTranslatedImageURL(stext, jsonFile) {
    if (stext.includes(generalConfig.origin)) return '';
    var transImg = '';
    PrintLog(`Input IMG SRC: ${stext}`);
    jsonFile.some(function (item) {
        if (item.orig) {
            if (stext.includes(item.orig) && stext.includes('assets')) {
                PrintLog(`GET URL:${item.kr}`);
                // transImg = generalConfig.origin + '/images/' + String(item.kr);
                transImg = item.kr;
                return true;
            }
        }
    });
    // if (!transImg.includes('png') && !transImg.includes('jpg')) return '';
    if (transImg.length > 0) {
        PrintLog(`Send URL:${transImg}`);
        return transImg;
    } else {
        return '';
    }
}

function GetTranslatedImageStyle(stext, jsonFile) {
    PrintLog(`GetTranslatedImageStyle: ${stext}`);
    if (!stext) return;

    if (stext.includes(generalConfig.origin)) return '';
    var transImg = '';
    jsonFile.some(function (item) {
        if (item.orig) {
            if (stext.includes(item.orig) && stext.includes('assets')) {
                PrintLog(`GET URL:${item.kr}`);
                // transImg = "url('" + generalConfig.origin + '/images/' + String(item.kr) + "')";
                transImg = "url('" + item.kr + "')";
                PrintLog(`Check URL: ${transImg}`);
                return true;
            }
        }
    });
    // if (!transImg.includes('png')) return '';
    if (transImg.length > 0) {
        PrintLog(`Send URL:${transImg}`);
        return transImg;
    } else {
        return '';
    }
}

function GetTranslatedText(node, csv) {
    if (node) {
        var passOrNot = true;
        var textInput = node.innerHTML.replace(/(\r\n|\n|\r)/gm, '').trim();

        // supporter 페이지에서 소환석 창 클릭할 때 뜨는 화면에서
        // "このパーティでクエストに挑戦します" 이 문구가 번역 안되는 현상에 대응하기 위해 코드 수정.
        // prt-confirm-inner 클래스의 innerHTML 는 자식 노드들까지 포함한 텍스트를 반환함.
        // prt-confirm-inner 클래스의 바로 아래의 첫번째 자식 노드에 텍스트가 담겨져있으므로 textContent 로 수정.
        // 게다가 첫번째 자식 노드의 타입은 #text임. 해당 노드에 className이 없음. 
        // 그러므로, 밑에서 node를 검사할때 className이 있는지 검사하도록 코드 수정.
        if (node.className && node.className.includes('prt-confirm-inner')) {
            textInput = node.childNodes[0].textContent.replace(/(\r\n|\n|\r)/gm, '').trim();

        }

        var translatedText = '';
        var computedStyleCheck = window
            .getComputedStyle(node, ':after')
            .content.replace(/['"]+/g, '');
        if (computedStyleCheck && computedStyleCheck != 'none') textInput = computedStyleCheck;

        if (!jCheck.test(textInput)) {
            PrintLog(`GetTranslatedText - no japanese : ${textInput}`);
            return;
        }
        // 텍스트에 한글이 있는지 체크, 만약 텍스트에 userName이 포함되있다면 번역해야 하는 문장임.
        if (kCheck.test(textInput) && !textInput.includes(userName)) return;

        PrintLog(`GetTranslatedText - className: ${node.className && node.className}, text: ${textInput}`);
        // Filter for avoiding unnecessary computing
        if (
            textInput.includes('<div ') ||
            textInput.includes('img class') ||
            textInput.includes('img src') ||
            textInput.includes('figure class') ||
            textInput.includes('li class') ||
            textInput.includes('a class') ||
            isNaN(textInput) == false || // Only number
            isNaN(textInput.replace('/', '')) == false || // number / number
            node.className && node.className.includes('txt-atk') ||
            node.className && node.className.includes('scene-font-place') ||
            (node.className && node.className.includes('prt-pop-synopsis') && !doc.URL.includes('#sidestory')) ||
            node.className && node.className.includes('txt-supporter-name') ||
            node.className && node.className.includes('txt-name') ||
            node.className && node.className.includes('txt-message')
        )
            passOrNot = false;

        // Add exception's exception.
        if (
            node.className && node.className.includes('name') ||
            node.className && node.className.includes('message') ||
            node.className && node.className.includes('comment') ||
            node.className && node.className.includes('effect') ||
            node.className && node.className.includes('time') ||
            node.className && node.className.includes('txt-withdraw-trialbatle') ||
            node.className && node.className.includes('prt-popup-header') ||
            node.className && node.className.includes('prt-attribute-bonus')
        )
            passOrNot = true;

        if (passOrNot) {
            // If the text contains any number, save the number and replace it to "*"
            var number = textInput.replace(/[^0-9]/g, '');
            if (number.length > 0) {
                textInput = textInput.replace(/[0-9]/g, '*');
            }
            // Filter for the number only with some special characters eg. 1,000,000
            var specialtest = textInput.replace(kCheckSpecial, "").replace(/ /gi, "").trim();
            if (specialtest.length < 1)
                return;

            if (userName.length > 0 &&
                textInput.includes(userName) &&
                !textInput.includes('グランブル') && //'그랑블루~~' 어쩌구 하는 텍스트에서 '그랑' 부분을 유저네임으로 인식하는 것을 방지.
                !textInput.toLowerCase().includes('granblue')) {
                textInput = textInput.split(userName).join(generalConfig.defaultName);
            }

            // console.log(textInput);

            if (exMode)
                PushCSV(textInput, miscs);
            PrintLog(`Send:${textInput} class name: ${node.className && node.className}`);
            // !!! Execute Translate !!!
            if (transMode) {
                translatedText = translate(textInput, csv);
                if (!translatedText) return;
            }

            PrintLog('traslated text: ' + translatedText);
            if (translatedText) {
                if (translatedText.length > 0) {
                    if (number.length > 0) {
                        // If it contains number("*"), recover it from the saved number
                        for (var i = 0; i < number.length; i++) {
                            translatedText = translatedText.slice(0, translatedText.indexOf('*')) + number[i] + translatedText.slice(translatedText.indexOf('*') + 1);
                        }
                    }
                    PrintLog(`Take:${translatedText}`);
                    if (computedStyleCheck && computedStyleCheck != 'none') {
                        if (node.className && !node.className.includes('-translated')) {
                            var style = doc.createElement('style');
                            style.type = 'text/css';
                            var classNames = node.className.replace(' ', '.');
                            style.innerText = `.${classNames}-translated::after{ content: "${translatedText}" !important; }`;
                            doc.head.appendChild(style);
                            node.className += ' ' + node.className + '-translated';
                        }
                    } else {
                        if (node.className && node.className.includes('prt-confirm-inner')) {
                            node.childNodes[0].textContent = translatedText;
                        } else if (node.innerHTML)
                            node.innerHTML = translatedText;
                    }
                }
            }
        }
    }
}

function GetTranslatedStoryText(node, csv) {
    if (node) {
        var textInput = node.innerHTML.replace(/(\r\n|\n|\r)/gm, '').trim();
        if (node.className && node.className.includes('prt-log-display')) {
            var tmpLogNode = doc.getElementsByClassName('txt-log-message')[0];
            if (tmpLogNode) {
                node = tmpLogNode;
                textInput = node.innerHTML;
                textInput = textInput.replace(/(\r\n|\n|\r)/gm, '').trim();
            }
        }

        var txtMessageNode = doc.getElementsByClassName('txt-message')[0];
        var translatedText = '';
        // var sex = doc.getElementsByClassName('cnt-quest-scene')[0];
        // if (!sex)
        //     return;
        // sex = sex.attributes[2].value;
        //kCheck 테스트 수행 안함.
        //스토리 텍스트에는 유저네임이 한글일 경우 kCheck에 걸려버려서 번역 안되는 경우가 튜토리얼 번역중 발생함.

        PrintLog(`GetTranslatedStoryText - className: ${node.className}, text: ${textInput}`);

        if (transMode)
            translatedText = translate_StoryText(textInput, csv);
        if (!translatedText) return;

        PrintLog(`GetTranslatedStoryText - traslated text: ${translatedText}`);

        if (translatedText.length > 0) {
            node.innerHTML = translatedText;

            if (node.className.includes('prt-pop-synopsis')) {
                return;
            }

            if (node.className.includes('txt-sel')) {
                // txtMessageNode.innerHTML = '';
                return;
            }

            /* 사용자가 auto-text 기능 사용 중일 경우 텍스트창에 출력되는 더러운 효과들을
            화면에서 가려버리기 위한 코드*/

            txtMessageNode.innerHTML = document.getElementsByClassName('txt-log-message')[0].innerHTML;
            txtMessageNode.innerHTML += '<br><br><br><br><br>';
        }
    }
}

function GetTranslatedBattleText(node, csv) {
    var translatedText = '';
    if (node) {
        if (node.className.includes('txt-body') ||
            node.className.includes('txt-title') ||
            node.className.includes('prt-advice')) {
            PrintLog(`전투 텍스트 노드 : ${node}`)
            if (transMode) {
                translatedText = translate_BattleText(node.innerHTML, csv);
                if (translatedText) {
                    PrintLog(`[번역 성공] 전투 텍스트 : ${translatedText}`);
                    node.innerHTML = translatedText;
                }
            }
        }
    }
}

function GetTranslatedImage(node, csv) {
    if (node.className) {
        var imageInput = node.currentSrc;
        var textInput = node.innerHTML.replace(/(\r\n|\n|\r)/gm, '').trim();
        var translatedText = '';
        PrintLog(`className: ${node.className}`);
        if (!imageInput) return;
        if (imageInput.includes(generalConfig.origin)) return;
        if (
            (!imageInput.includes('png') && !imageInput.includes('jpg')) ||
            imageInput.includes('/ui/') ||
            imageInput.includes('/raid/') ||
            imageInput.includes('/number/')
        )
            return;
        if (
            textInput.includes('img class') ||
            // || (textInput.includes("img src"))
            textInput.includes('figure class') ||
            textInput.includes('li class') ||
            textInput.includes('a class')
        )
            return;
        PrintLog(`Send Image URL:${imageInput}`);
        if (transMode && doImageSwap)
            translatedText = GetTranslatedImageURL(imageInput, csv);
        if (translatedText.length > 0) {
            // When it founds the translated text
            PrintLog(`Take translated URL:${translatedText}`);
            node.setAttribute('src', translatedText);
        }
    }
}

function GetTranslatedImageDIV(node, csv) {
    if (node.className) {
        var passOrNot = true;
        var imageStyle = window.getComputedStyle(node).backgroundImage;
        var textInput = node.innerHTML.replace(/(\r\n|\n|\r)/gm, '').trim();
        var imageStyleCompute = window.getComputedStyle(node).backgroundImage;
        var imageStyleComputeAfter = window.getComputedStyle(node, ':after').backgroundImage;
        var UseCompute = (imageStyleCompute.includes('.png') || imageStyleCompute.includes('.jpg')) ?
            true :
            false;
        var UseComputeAfter = (imageStyleComputeAfter.includes('.png') || imageStyleComputeAfter.includes('.jpg')) ?
            true :
            false;
        var translatedImage = '';
        if (node.className == 'btn-assist' /* includes로 검사하면 비슷한 이름의 노드가 2개 걸림. */ ||
            node.className.includes('btn-alliance') ||
            node.className.includes('btn-logs')) {
            if (imageStyle.includes('none') /* 화면이 완전히 표시되기전까지는 none값으로 있음. */ ) {
                window.setTimeout(() => {
                    GetTranslatedImageDIV(node, csv);
                    return;
                }, generalConfig.refreshRate);
            }
        }
        if (UseCompute)
            imageStyle = imageStyleCompute;
        if (UseComputeAfter)
            imageStyle = imageStyleComputeAfter;
        if (!imageStyle) return;
        if (textInput.includes(generalConfig.origin)) return;
        if (!imageStyle.includes('png') ||
            imageStyle.includes('/ui/') ||
            imageStyle.includes('/raid/') ||
            imageStyle.includes('/number/')
        )
            passOrNot = false;
        if (
            textInput.includes('img class') ||
            textInput.includes('img src') ||
            textInput.includes('figure class') ||
            textInput.includes('li class') ||
            textInput.includes('a class')
        )
            passOrNot = false;
        if (
            imageStyle.includes('chara_type') ||
            imageStyle.includes('race') ||
            imageStyle.includes('weapon') ||
            imageStyle.includes('type-') ||
            node.className.includes('btn-switch-') ||
            node.className.includes('btn-image-check') ||
            node.className.includes('btn-reset-') ||
            node.className.includes('btn-link') ||
            UseCompute ||
            UseComputeAfter
        )
            passOrNot = true;
        if (!passOrNot) return;
        PrintLog(`Send DIV:${imageStyle} Class: ${node.className}`);

        if (transMode && doImageSwap)
            translatedImage = GetTranslatedImageStyle(imageStyle, csv);

        if (translatedImage && translatedImage.length > 0) {
            // When it founds the translated text
            if (UseComputeAfter) {
                if (!node.className.includes('-translated')) {
                    var style = doc.createElement('style');
                    style.type = 'text/css';
                    var classNames = node.className.replace(' ', '.');
                    style.innerText = `.${classNames}::after{ background-image: ${translatedImage}!important; }`;
                    doc.head.appendChild(style);
                    node.className += ' ' + node.className + '-translated';
                }
            } else node.style.backgroundImage = translatedImage;
            PrintLog(`Take DIV:${translatedImage} Class: ${node.className}`);
        }
    }
}

function IsSceneCodeInDB(sceneCodeInput) {
    // it returns
    //    - 0: no code in the DB
    //    - 1: code found but no trans
    //    - 2: code and trans found
    sceneCodeInput = sceneCodeInput.replace(/['"]+/g, '');
    checkResult = 0;

    if (sceneCodeInput == '') {
        checkResult = 0;
        return;
    }

    questJson.some(function (item) {
        if (item.SceneCode) {
            if (item.SceneCode.includes(sceneCodeInput)) {
                if (item.Korean) {
                    if (item.Korean.length > 0) {
                        checkResult = 2;
                        return;
                    } else {
                        checkResult = 1;
                        return
                    }
                }
            }
        }
    });
    return checkResult;
}

// Observers
var sceneObserver = new MutationObserver(function (mutations) {
    sceneObserver.disconnect();
    mutations.some(function (mutation) {
        if (mutation.target) {
            if (mutation.target.className &&
                mutation.target.className.includes('btn-send-name') &&
                doc.URL.includes('/#tutorial/6')) {
                var tutorialUserName = document.getElementById('name_set').value;

                if (document.getElementById('name_set').value.length == 0) {
                    tutorialUserName = document.getElementById('name_set').placeholder;
                }
                PrintLog('tutorialUserName SET !!');
                PrintLog(tutorialUserName);
                if (tutorialUserName)
                    userName = tutorialUserName;
                updateDBUserName(tutorialUserName);
            }
        }

        if (mutation.target.className &&
            (mutation.target.className.includes('prt-message-area') ||
                mutation.target.className.includes('txt-message') ||
                mutation.target.className.includes('prt-log-display') ||
                mutation.target.className.includes('txt-character-name')) ||
            mutation.target.className.includes('prt-sel-area')) {
            walkDownTree(mutation.target, GetTranslatedText, nameJson);
            walkDownTree(mutation.target, GetTranslatedStoryText, questJson);
        }

    });

    //줄거리 창 번역에 어려움이 있음.
    //DB 원문에 남캐로 시작하면 소년, 여캐로 시작하면 소녀로 변화무쌍하게 입력되어있음.
    //그런 경우를 다 커버하기위해 단순히 처리함.
    //각각의 신코드에서 Type이 Synopsis 인것은 반드시 하나만 존재하므로 줄거리 창에 그대로 박아넣기.
    var popSynopsisNode = doc.getElementsByClassName('prt-pop-synopsis')[0];
    if (popSynopsisNode) {
        cachedSceneData.some(function (item) {
            if (item.Type == 'synopsis') {
                if (!item.Korean) {
                    return true;
                }

                popSynopsisNode.innerHTML = item.Korean;

                if (item.Korean.includes(generalConfig.defaultName)) {
                    var resultUserName = getTransDefaultUserName(userName);
                    popSynopsisNode.innerHTML = item.Korean.split(generalConfig.defaultName).join(resultUserName);
                    return true;
                }
            }
        });
    }

    ObserveSceneText();
});

var archiveObserver = new MutationObserver(function (mutations) {
    archiveObserver.disconnect();

    PrintLog('archiveObserver : USER NAME');
    PrintLog(userName);

    var newUserName = getUserName();
    if (newUserName && newUserName.length > 0 && userName != newUserName) {
        userName = newUserName;
        PrintLog(`USER NAME CHANGED !! ===> ${userName}`);
        updateDBUserName(userName);
    }

    PrintLog('Archive Observer Mutations :');
    PrintLog(mutations);

    mutations.some(mutation => {
        if (mutation.target) {
            if (mutation.target.className && mutation.target.className == 'lis-deck flex-active-slide') {
                walkDownTree(mutation.target, GetTranslatedText, archiveJson);
                return true;
            }
            if (!(mutation.target.id && mutation.target.id == 'wrapper') &&
                !(mutation.target.className && mutation.target.className.includes('contents')) &&
                !(mutation.target.tagName && mutation.target.tagName.toLowerCase() == 'script') &&
                !(mutation.target.tagName && mutation.target.tagName.toLowerCase() == 'img') &&
                !(mutation.target.className && mutation.target.className == 'lis-deck') &&
                !(mutation.target.className && mutation.target.className.includes('lis-treasure')) &&
                !(mutation.target.className && mutation.target.className.includes('prt-treasure-slider')) &&
                !(mutation.target.className && mutation.target.className.includes('flex-viewport')) &&
                !(mutation.target.className && mutation.target.className.includes('cnt-treasure-footer')) &&
                !(mutation.target.className && mutation.target.className.includes('guild-name')) &&
                (mutation.target.innerText && mutation.target.innerText.length > 0)) {
                walkDownTree(mutation.target, GetTranslatedText, archiveJson);
            }
        }
    });

    var noticeNode = doc.getElementsByClassName('prt-log prt-log-important')[0];
    if (noticeNode) {
        walkDownTree(noticeNode, GetTranslatedText, archiveJson);
    }

    var footerLinkNode = doc.querySelectorAll('[class^="atx-lead-link"]');
    if (footerLinkNode) {
        footerLinkNode.forEach(node => {
            walkDownTree(node, GetTranslatedText, archiveJson);
        });
    }

    ObserverArchive();
});
var ImageObserver = new MutationObserver(function (mutations) {
    PrintLog('ImageObserver mutations');
    PrintLog(mutations);
    ImageObserver.disconnect();

    if (doImageSwap) {
        mutations.some(mutation => {
            if (mutation.target) {
                if (!(mutation.target.id && mutation.target.id == 'wrapper') &&
                    !(mutation.target.className && mutation.target.className.includes('contents')) &&
                    !(mutation.target.tagName && mutation.target.tagName.toLowerCase() == 'script') &&
                    !(mutation.target.className && mutation.target.className.includes('lis-treasure')) &&
                    !(mutation.target.className && mutation.target.className.includes('lis-deck')) &&
                    !(mutation.target.className && mutation.target.className.includes('cnt-treasure-footer')) &&
                    !(mutation.target.className && mutation.target.className.includes('img-treasure')) &&
                    !(mutation.target.className && mutation.target.className.includes('flex-prev')) &&
                    !(mutation.target.className && mutation.target.className.includes('flex-next')) &&
                    !(mutation.target.className && mutation.target.className.includes('flex-viewport')) &&
                    !(mutation.target.className && mutation.target.className.includes('prt-treasure-slider'))
                ) {
                    walkDownTreeSrc(mutation.target, GetTranslatedImage, imageBlobsUrl);
                    // walkDownTreeSrc(mutation.target, GetTranslatedImage, imageBlobs);
                }

            }

        });

        //어떠한 술수를 부려도 mutation이 감지가 안되는 이미지들은 하드 코딩으로 번역.
        var banner = doc.querySelectorAll('[class^="btn-banner"]');
        if (banner) {
            banner.forEach(image => {
                walkDownTreeSrc(image, GetTranslatedImage, imageBlobsUrl);
                // walkDownTreeSrc(mutation.target, GetTranslatedImage, imageBlobs);
            });
        }

        var global_banner = doc.querySelectorAll('[class^="btn-global-banner"]');
        if (global_banner) {
            global_banner.forEach(image => {
                walkDownTreeSrc(image, GetTranslatedImage, imageBlobsUrl);
                // walkDownTreeSrc(mutation.target, GetTranslatedImage, imageBlobs);
            });
        }
    }
    ObserverImage();
});
var ImageObserverDIV = new MutationObserver(function (mutations) {
    PrintLog('ImageObserverDIV mutations');
    PrintLog(mutations);
    ImageObserverDIV.disconnect();

    if (doImageSwap) {
        mutations.some(mutation => {
            if (mutation.target) {
                if (mutation.target.className && mutation.target.className.includes('contents')) {
                    walkDownTreeStyle(mutation.target, GetTranslatedImageDIV, imageBlobsUrl);
                    // walkDownTreeStyle(mutation.target, GetTranslatedImageDIV, imageBlobs);
                    return true;
                }
                if (!(mutation.target.id && mutation.target.id == 'wrapper') &&
                    !(mutation.target.className && mutation.target.className.includes('contents')) &&
                    !(mutation.target.tagName && mutation.target.tagName.toLowerCase() == 'script') &&
                    !(mutation.target.className && mutation.target.className.includes('lis-treasure')) &&
                    !(mutation.target.className && mutation.target.className.includes('lis-deck')) &&
                    !(mutation.target.className && mutation.target.className.includes('img-treasure')) &&
                    !(mutation.target.className && mutation.target.className.includes('cnt-treasure-footer')) &&
                    !(mutation.target.className && mutation.target.className.includes('flex-prev')) &&
                    !(mutation.target.className && mutation.target.className.includes('flex-next')) &&
                    !(mutation.target.className && mutation.target.className.includes('flex-viewport')) &&
                    !(mutation.target.className && mutation.target.className.includes('prt-treasure-slider'))
                ) {
                    walkDownTreeStyle(mutation.target, GetTranslatedImageDIV, imageBlobsUrl);
                    // walkDownTreeStyle(mutation.target, GetTranslatedImageDIV, imageBlobs);
                }

            }
        });
    }
    ObserverImageDIV();
});

var BattleObserver = new MutationObserver(function (mutations) {
    BattleObserver.disconnect();
    mutations.some(mutation => {
        if (mutation.target) {
            walkDownTree(mutation.target, GetTranslatedText, archiveJson);
            walkDownTree(mutation.target, GetTranslatedBattleText, battleJson);
            //GetTranslatedBattleText(mutation.target, battleJson /* battleJson은 questJson과 다르게 sceneCode값이 없는 말풍선 번역문들이기 때문에 archiveJson과 합쳐도 무방해보임. 좀 더 생각해보기.*/ );
        }
    });
    ObserverBattle();
});

var BattleImageObserver = new MutationObserver(function (mutations) {
    BattleImageObserver.disconnect();
    mutations.some(mutation => {
        if (mutation.target) {
            // walkDownTreeStyle(mutation.target, GetTranslatedImageDIV, imageJson);
            walkDownTreeStyle(mutation.target, GetTranslatedImageDIV, imageBlobsUrl);
        }
    });
    ObserverBattle();
});

// Queue for each observers
async function ObserveSceneText() {
    // var oText = doc.getElementsByClassName('prt-log-display')[0];
    // var txtMessageNode = doc.getElementsByClassName('prt-message-area')[0];

    var oText = doc.getElementById('wrapper');
    // if (!oText || !txtMessageNode) {
    if (!oText) {
        //The node we need does not exist yet.
        //Wait 500ms and try again
        window.setTimeout(ObserveSceneText, generalConfig.refreshRate);
        return;
    }
    if (doc.URL.includes('#raid') || (doc.URL.includes('#tutorial') && doc.getElementsByClassName('cnt-raid')[0])) {
        sceneObserver.disconnect();
        window.setTimeout(ObserveSceneText, generalConfig.refreshRate);
        return;
    }

    if (
        doc.URL.includes('archive') ||
        doc.URL.includes('scene') ||
        doc.URL.includes('story')
    ) {
        sceneObserver.observe(oText, config);
    } else if (doc.URL.includes('tutorial')) {
        sceneObserver.observe(oText, config_full);
    } else {
        //#quest 링크로 넘어가게됐을때 게임에서 새로고침을 수행함.
        //문제는 새로고침 수행하고 #raid 페이지나 #archive 페이지로 이동할때에 새로고침을 수행하지않음.
        //새로고침을 수행하지않으므로 함수에서 URL 검사를 새로 안함.
        //ObserveSceneText 함수처럼 특정 링크일때만 observe 수행하는 함수들은 그대로 옵저버가 끊김.
        window.setTimeout(ObserveSceneText, generalConfig.refreshRate);
    }
}

async function ObserverArchive() {
    var oText = doc.getElementById('wrapper');

    if (!oText && popNode) {
        //The node we need does not exist yet.
        //Wait 500ms and try again
        window.setTimeout(ObserverArchive, generalConfig.refreshRate);
        return;
    }
    //전투 화면에 있거나, 튜토리얼 전투 화면에 있다면.
    if (doc.URL.includes('#raid') || (doc.URL.includes('#tutorial') && doc.getElementsByClassName('cnt-raid')[0])) {
        archiveObserver.disconnect();
        window.setTimeout(ObserverArchive, generalConfig.refreshRate);
        return;
    }
    if (doc.URL.includes('#result')) {
        archiveObserver.observe(oText, config_image);
    } else {
        archiveObserver.observe(oText, config_full);
    }
}

async function ObserverBattle() {
    // var oText = doc.querySelector(".prt-scroll-title");
    // var oText = doc.querySelectorAll('[class^="prt-command-chara"]')[0];
    var oText = doc.getElementById('wrapper');
    if (!oText) {
        //The node we need does not exist yet.
        //Wait 500ms and try again
        window.setTimeout(ObserverBattle, generalConfig.refreshRate);
        return;
    }
    if (doc.URL.includes('#raid') || doc.URL.includes('/#tutorial/') /* for tutorial page */ ) {
        if (doBattleTrans) {
            BattleObserver.observe(oText, config);
            BattleImageObserver.observe(oText, config);
        } else {
            BattleObserver.disconnect();
            BattleImageObserver.disconnect();
            window.setTimeout(ObserverBattle, generalConfig.refreshRate);
            return;
        }
    } else {
        //#quest 링크로 넘어가게됐을때 게임에서 새로고침을 수행함.
        //문제는 새로고침 수행하고 #raid 페이지나 #archive 페이지로 이동할때에 새로고침을 수행하지않음.
        //새로고침을 수행하지않으므로 ObserveSceneText 함수처럼 특정 링크일때만 observe 수행하는 함수들은 그대로 옵저버가 끊김.
        //대표적인 경우는 아카룸에서 전투 수행할때 발생함.
        window.setTimeout(ObserverBattle, generalConfig.refreshRate);
    }
}
async function ObserverImage() {
    var allElements = doc.getElementById('wrapper');
    if (!allElements) {
        //The node we need does not exist yet.
        //Wait 500ms and try again
        window.setTimeout(ObserverImage, generalConfig.refreshRate);
        return;
    }
    //전투 화면에 있거나, 튜토리얼 전투 화면에 있다면.
    if (doc.URL.includes('#raid') || (doc.URL.includes('#tutorial') && doc.getElementsByClassName('cnt-raid')[0])) {
        ImageObserver.disconnect();
        ImageObserverDIV.disconnect();
        archiveObserver.disconnect();
        window.setTimeout(ObserverImage, generalConfig.refreshRate);
        return;
    }

    ImageObserver.observe(allElements, config_full);
}
async function ObserverImageDIV() {
    var allElements = doc.getElementById('wrapper');
    if (!allElements) {
        //The node we need does not exist yet.
        //Wait 500ms and try again
        window.setTimeout(ObserverImageDIV, generalConfig.refreshRate);
        return;
    }
    //전투 화면에 있거나, 튜토리얼 전투 화면에 있다면.
    if (doc.URL.includes('#raid') || (doc.URL.includes('#tutorial') && doc.getElementsByClassName('cnt-raid')[0])) {
        ImageObserver.disconnect();
        ImageObserverDIV.disconnect();
        archiveObserver.disconnect();
        window.setTimeout(ObserverImageDIV, generalConfig.refreshRate);
        return;
    }

    ImageObserverDIV.observe(allElements, config_full);
}


window.addEventListener("extract_archiveText", function (e) {
    if (e.detail) {
        var text = e.detail;
        var language = doc.title == 'Granblue Fantasy' ? 'English' : 'Japanese';
        // var defaultUserName = getDefaultUserName();

        // if (!text.includes(userName) && text.includes(defaultUserName)) {
        //     userName = defaultUserName;
        // }

        //1차 변환 과정 - 유저 네임 변환
        if (userName.length > 0) {
            if (text.includes(userName)) {
                if (language == 'Japanese') {
                    //원래는 성별과 언어에 따라서 유저네임을 치환할려했지만 
                    //archive Json 의 번역 속도는 항상 빨라야하기때문에,
                    //userName 부분을 항상 "[플레이어]" 으로 추출하게함. 
                    //원래 의도대로 성별과 언어에 따라 구분해서 추출하게하면 번역할 때 성능에 지장이 있을 수 있다고 생각해서 이렇게 조정함.
                    text = text.split(userName).join(generalConfig.defaultName);
                }
            }
        }

        //2차 변환 과정 - 숫자 문자 변환, 특수 문자 필터링
        var number = text.replace(/[^0-9]/g, '');
        if (number.length > 0) {
            text = text.replace(/[0-9]/g, '*');
        }

        var specialtest = text.replace(kCheckSpecial, "").replace(/ /gi, "").trim();
        if (specialtest.length < 1)
            return;



        PushCSV(text, miscs);
    }
});

window.addEventListener("extract_storyText", function (e) {
    if (e.detail) {
        var obj = e.detail;

        if (obj.type == 'scenecode') {
            PrintLog('SceneCodeFrom -- XHR OPEN');
            PrintLog(obj.data);

            extractedSceneCode = obj.data;
        } else if (obj.type == 'texts') {
            PrintLog('Got story texts. Print Raw Texts.');
            PrintLog('SceneCode');
            PrintLog(extractedSceneCode);
            PrintLog('Raw Story Texts');
            PrintLog(obj.data);

            PushCSV_StoryText(obj.data);
        }
    }
});

window.addEventListener("extract_battleText", function (e) {
    if (e.detail) {
        PushCSV_BattleText(e.detail);
    }
});


window.addEventListener("console_log", function (e) {
    console.log(e.detail);
});

const main = async () => {
    /* @license
       biuuu/ShinyColors
       https://github.com/biuuu/ShinyColors
       License: MIT
    */
    await InitList();
    PrintLog(`ORIGIN: ${generalConfig.origin}`);
    try {
        await Promise.all(ObserverList); //
    } catch (e) {
        PrintLog(e);
    }
};
main();