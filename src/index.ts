import axios from 'axios'
import * as fs from 'fs'
import 'dotenv/config'
import sharp from 'sharp'

// 対象のホスト名 - 例：misskey.io / kasei.ski 等
const host = process.env.HOST_NAME

// BOTアカウントのAPI token。ノートの投稿の権限さえあればOK
const token = process.env.API_TOKEN

// 実際にノートを投稿するかどうか。true ならノートを投稿しない。
// 初回起動時など、大量のノートを送信する可能性がある場合はtrueにしたほうが良い
const isDryRun: boolean = JSON.parse(process.env.IS_DRY_RUN?.toString() ?? "true") as boolean

// 何秒に１度ポーリングを実行するか
const intervals: number = parseInt(process.env.INTERVALS ?? "60")

// 一度に受け取る絵文字の数(APIのデフォルト)
const limit = 30

// ※ 壊れています
// 送られてきたカスタム絵文字をemoji_bot君が再投稿しなおすかどうか
const isReUpload: boolean = JSON.parse(process.env.IS_REUPLOAD?.toString() ?? "false") as boolean

// ※ 壊れています
// 再投稿する際にWebpにするかどうか
const isConvert: boolean = JSON.parse(process.env.IS_CONVERT?.toString() ?? "false") as boolean

const dbfilename = "moderation.json"

const tmp_directory = "tmp"

// green と reset 以外使ってない
const red     = '\u001b[31m'
const green   = '\u001b[32m'
const yellow  = '\u001b[33m'
const magenta = '\u001b[35m'
const cyan    = '\u001b[36m'
const reset   = '\u001b[0m'

// 将来的にDBに持たせたりしたほうが良いけど、今は雑に手元のローカルに保存すればよし
// 定期的に admin/emoji/list を見に行って、ローカルのDBにコピーしていくスタイル
let emojidb: CustomEmoji[] = []

const api = axios.create({
    baseURL: `https://${host}/api/`,
    timeout: 3000,
    headers: {
    } 
})

interface CustomEmoji {
    id: string,
    aliases: string[],
    name: string,
    category: string,
    host: string,
    publicUrl: string,
    originalUrl: string,
    license: string,
    isSensitive: boolean,
    localOnly: boolean,
    roleIdsThatCanBeUsedThisEmojiAsReaction: string[]
}

interface AvatorDecoration {
    id: string,
    url: string,
    name: string,
    description: string,
    updatedAt: string
}

// モデレーションログ
interface ModerationLog {
    id: string,
    createdAt: string, // Dateでいけたっけ
    type: string,
    info: any,
    userId: string, // なんでuserとuseridがあるんですかねぇ
    user: any, // userを作る必要がある
}

// 起動時に最後のモデレーションログを読み込み。
// 存在しなければ、現在時刻を返す
let lastModified: Date
if (fs.existsSync(dbfilename)) {
    let lastModetationLog: ModerationLog
    lastModetationLog = JSON.parse(fs.readFileSync(dbfilename, 'utf8')) as ModerationLog
    lastModified= new Date(lastModetationLog.createdAt)
} else {
    lastModified = new Date()
}

let moderationLogs: ModerationLog[] = []

async function pullModerationLogs() {
    let newModerationLogs: ModerationLog[] = []
    let newLastModified: Date = new Date() // 命名もうちょっとどうにかならんか…？
    let untilId = null

    do {
        let params
        if (untilId) {
            params = {
                allowPartial: true,
                i: token,
                limit: limit,
                type: null,
                untilId: untilId
            }
        } else {
            params = {
                allowPartial: true,
                i: token,
                limit: limit,
                type: null
            }
        }
        await api.post('/admin/show-moderation-logs', params).then (response => {
            if(response.status == 200) {
                const moderationLogs = JSON.parse(JSON.stringify(response.data)) as ModerationLog[]
                untilId = moderationLogs.pop()?.id
                // nullとか知らん
                newLastModified = new Date(moderationLogs.pop()?.createdAt!)
                newModerationLogs = newModerationLogs.concat(moderationLogs)
            }
        }).catch( error => {
            console.log(error)
        })
    } while(newLastModified > lastModified);

    // 新しいのだけに絞る
    newModerationLogs = newModerationLogs.filter(l => new Date(l.createdAt) > lastModified)

    newModerationLogs.forEach( moderationLog => {
        switch(moderationLog.type) {
            case "addCustomEmoji":
                const emoji = moderationLog.info.emoji as CustomEmoji
                if(moderationLog.user.username != "emoji_bot") {
                    resendToAssets(emoji);
                    createNote(`新しい絵文字が追加されたかも!\n\`:${emoji.name}:\` => :${emoji.name}: \n\n【カテゴリー】\n\`${emoji.category}\`\n\n【ライセンス】\n\`${emoji.license}\`\n\n追加した人：@${moderationLog.user.username}`)
                }
                break
            case "updateCustomEmoji":
                const after = moderationLog.info.after as CustomEmoji
                const before = moderationLog.info.before as CustomEmoji
                if(moderationLog.user.username != "emoji_bot") {
                    // publicUrlが変わってたらカスタム絵文字も再生成
                    if(after.publicUrl != before.publicUrl) {
                        resendToAssets(after);
                    }
                    createNote(`絵文字が更新されたかも!\n\`:${after.name}:\` => :${after.name}: \n\n【カテゴリー】\n\`${after.category}\`\n\n【ライセンス】\n\`${after.license}\`\n\n更新した人：@${moderationLog.user.username}`)
                }
                break
            case "deleteCustomEmoji":
                const deleted_emoji = moderationLog.info.emoji as CustomEmoji
                if(moderationLog.user.username != "emoji_bot") {
                    createNote(`カスタム絵文字が削除されたみたい…\n\`:${deleted_emoji.name}:\` \n\n削除した人：@${moderationLog.user.username}`)
                }
                break
            case "createAvatarDecoration":
                const deco = moderationLog.info.avatarDecoration as AvatorDecoration 
                createNote(`新しいデコレーションが追加されたかも!\n\`${deco.name}\` => ${deco.url} \n\n追加した人：@${moderationLog.user.username}`)
                break
            case "updateAvatarDecoration":
                const afterd = moderationLog.info.after as AvatorDecoration 
                createNote(`デコレーションが更新されたかも!\n\`${afterd.name}\` => ${afterd.url} \n\n更新した人：@${moderationLog.user.username}`)
                break
            case "deleteAvatarDecoration":
                const deleted = moderationLog.info.avatarDecoration as AvatorDecoration 
                createNote(`デコレーションが削除されたみたい…\n\`${deleted.name}\` \n\n更新した人：@${moderationLog.user.username}`)
                break
            default:
                console.log("その他なんか:" + moderationLog)
                break
        }
    })

    // 最終更新日を記録して、ローカルのjsonファイルに書き出し
    if(newModerationLogs[0]) {
        fs.writeFileSync(dbfilename, JSON.stringify(newModerationLogs[0]))
        lastModified = new Date(newModerationLogs[0].createdAt)
    }

}

let interval_ms
if(!intervals || Number.isNaN((interval_ms = intervals * 1000))) 
{  
    // デフォルトは60秒に1回ポーリング
    interval_ms = 60 * 1000
}

// Promise を使って、もうちょっとちゃんと綺麗に実装してどうぞ
setInterval( pullModerationLogs,  interval_ms)

async function createNote(message: string, visibility: string = "public") {
    const params = {
        i: token,
        text: message,
        visibility: visibility, // public or home
        localOnly: true, // 連合無しに
    }
    if(isDryRun) {
        console.log("isDryRun=true のため投稿しません")
        console.log(yellow + params.text+ reset)
    }
    else {
        api.post('/notes/create', params).then (response => {
            if(response.status == 200) {
                console.log(green + params.text+ reset)
            }
        }).catch( error => {
            console.log(error)
        })
    }
}

async function createDriveFile(name: string,buffer: Buffer): Promise<string>{
    const file = new Blob([buffer.buffer], { type: "image/webp" });

    const formData = new FormData();
    formData.append('i', token!);
    formData.append('force', 'true');
    formData.append('file', file);
    formData.append('name', name);

    return api.post('/drive/files/create', formData).then (response => {
        if(response.status == 200) {
            console.log(green + response.data.id + ": " + name+ reset)
            return response.data.id
        }
    }).catch( error => {
        console.log(error)
    })
}

async function updateEmoji(emoji: CustomEmoji, fileId: string) {
    const params = {
        i: token,
        aliases: emoji.aliases,
        category: emoji.category,
        fileId: fileId,
        id: emoji.id,
        isSensitive: emoji.isSensitive,
        lisence: emoji.license,
        localOnly: emoji.localOnly,
        name: emoji.name,
        roleIdsThatCanBeUsedThisEmojiAsReaction: emoji.roleIdsThatCanBeUsedThisEmojiAsReaction
    }
    return api.post('/admin/emoji/update', params).then (response => {
        if(response.status == 204) {
            console.log(green + params.name+ reset)
        }
    }).catch( error => {
        console.log(error)
    })
}

// カスタム絵文字をローカルにダウンロードしてきて
// (webpじゃなければwebpに変換して)
// 再度カスタム絵文字を更新する処理
async function resendToAssets(emoji: CustomEmoji){

    // ドライブにアップロードして絵文字を更新
    if(isDryRun) {
        console.log("isDryRun=true のためドライブにアップしません")
        console.log(yellow + emoji.name+ reset)
    } else if(isReUpload) {

        // webp に変換済みのデータ
        const buffer = await convert(emoji.publicUrl)
        const filename = `${emoji.name}.webp`

        const id = await createDriveFile(filename, buffer)
        await sleep(5000);
        await updateEmoji(emoji, id)
    }
}

const convert = async (url: string): Promise<Buffer> => {
    const res = await axios.get(url, {responseType: 'arraybuffer'})
    const buf = Buffer.from(res.data)

    return sharp(buf).resize({height:128}).webp().toBuffer()
}

async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }