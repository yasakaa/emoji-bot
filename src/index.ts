import axios from 'axios'
import * as fs from 'fs'
import 'dotenv/config'

// 対象のホスト名 - 例：misskey.io / kasei.ski 等
const host = process.env.HOST_NAME

// BOTアカウントのAPI token。ノートの投稿の権限さえあればOK
const token = process.env.API_TOKEN

// 実際にノートを投稿するかどうか。true ならノートを投稿しない。
// 初回起動時など、大量のノートを送信する可能性がある場合はtrueにしたほうが良い
const isDryRun = process.env.IS_DRY_RUN

// 何秒に１度ポーリングを実行するか
const intervals = process.env.INTERVALS

// 一度に受け取る絵文字の数(APIのデフォルト)
const limit = 30

// green と reset 以外使ってない
const red     = '\u001b[31m'
const green   = '\u001b[32m'
const yellow  = '\u001b[33m'
const magenta = '\u001b[35m'
const cyan    = '\u001b[36m'
const reset   = '\u001b[0m'

// 将来的にDBに持たせたりしたほうが良いけど、今は雑に手元のローカルに保存すればよし
// 定期的に admin/emoji/list を見に行って、ローカルのDBにコピーしていくスタイル
let emojidb: Reaction[] = []

const api = axios.create({
    baseURL: `https://${host}/api/`,
    timeout: 3000,
    headers: {
    } 
})

interface Reaction {
    id: string,
    aliases: string[],
    name: string,
    category: string,
    host: string,
    url: string,
    license: string,
    isSensitive: boolean,
    localOnly: boolean,
    roleIdsThatCanBeUsedThisEmojiAsReaction: string[]
}

// 起動時にemojidb を読み込み
if (fs.existsSync("emojidb.json")) {
    emojidb = JSON.parse(fs.readFileSync("emojidb.json", 'utf8')) as Reaction[]
}

async function pullEmojis() {
    let new_reactions: Reaction[] = []
    let response_count = 0
    let untilId = null
    do {
        let params
        if (untilId) {
            params = {
                i: token,
                limit: limit,
                query: null,
                untilId: untilId
            }
        } else {
            params = {
                i: token,
                limit: limit,
                query: null,
            }
        }
        await api.post('/admin/emoji/list', params).then (response => {
            if(response.status == 200) {
                const reactions = JSON.parse(JSON.stringify(response.data)) as Reaction[]
                response_count = reactions.length
                new_reactions = new_reactions.concat(reactions.filter(reaction => !emojidb.find(e => e.id == reaction.id)));
                untilId = reactions.pop()?.id
            }
        }).catch( error => {
            console.log(error)
        })
    } while(response_count != 0 && new_reactions.length >= response_count);

    new_reactions.forEach (reaction => {
        const params = {
            i: token,
            text: `新しい絵文字が追加されたかも!\n\`:${reaction.name}:\` => :${reaction.name}:`,
        }
        api.post('/notes/create', params).then (response => {
            if(response.status == 200) {
                console.log(green + params.text+ reset)
            }
        }).catch( error => {
            console.log(error)
        })
    })

    // db に追加して、ローカルのjsonファイルに書き出し
    emojidb = emojidb.concat(new_reactions)

    fs.writeFileSync("emojidb.json", JSON.stringify(emojidb))
}

let interval_ms
if(!intervals || Number.isNaN((interval_ms = parseInt(intervals) * 1000))) 
{  
    // デフォルトは60秒に1回ポーリング
    interval_ms = 60 * 1000
}

// Promise を使って、もうちょっとちゃんと綺麗に実装してどうぞ
setInterval( pullEmojis,  interval_ms)


