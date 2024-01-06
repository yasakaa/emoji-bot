import axios from 'axios'
import * as fs from 'fs'
import 'dotenv/config'
import sharp from 'sharp'
import { ModerationLog } from './misskey/model/ModerationLog'
import { CustomEmoji } from './misskey/model/CustomEmoji'
import { AvatorDecoration } from './misskey/model/AvatorDecoration'
import { Logger } from './utils/logger'

// TODO: クラスにしてconstructor にしてもいいかもしれん。
// TODO: そもそも EmojiBot というクラスを用意してあげるべき
type EmojiBotOptions = {
    // 対象のホスト名 - 例：misskey.io / kasei.ski 等
    host: string,

    // BOTアカウントのAPI token。ノートの投稿の権限さえあればOK
    token: string,

    // 実際にノートを投稿するかどうか。true ならノートを投稿しない。
    // 初回起動時など、大量のノートを送信する可能性がある場合はtrueにしたほうが良い
    isDryRun: boolean,

    // 何秒に１度ポーリングを実行するか
    intervals: number,

    // 一度に受け取る絵文字の数(APIのデフォルト)
    limit: number,

    // Bot のアカウント名（@を除く）
    botName: string,

    // 送られてきたカスタム絵文字をemoji_bot君が再投稿しなおすかどうか
    isReUpload: boolean,

    // 再投稿する際にWebpにするかどうか
    isConvert: boolean,

    // 投稿範囲の設定（add:追加, update:更新, delete:削除）
    visibility: {
        add: string,
        update: string,
        delete: string,
    },

    // CWをかけるかどうか（add:追加, update:更新, delete:削除）
    useCW: {
        add: boolean,
        update: boolean,
        delete: boolean,
    },

    // 連合をオフにするかどうか
    localOnly: boolean
}

function loadEmojiBotOptions(): EmojiBotOptions {

    if (!process.env.HOST_NAME) {
        console.log("HOST_NAME が指定されていません")
        process.exit(1)
    }
    if (!process.env.API_TOKEN) {
        console.log("API_TOKENが指定されていません")
        process.exit(1)
    }
    if (!process.env.BOT_NAME) {
        console.log("BOT_NAMEが指定されていません")
        process.exit(1)
    }

    const options: EmojiBotOptions = {
        host: process.env.HOST_NAME,
        token: process.env.API_TOKEN,
        isDryRun: JSON.parse(process.env.IS_DRY_RUN?.toString() ?? "true") as boolean,
        intervals: parseInt(process.env.INTERVALS ?? "60"),
        limit: parseInt(process.env.API_LIMIT ?? "30"),
        botName: process.env.BOT_NAME,
        isReUpload: JSON.parse(process.env.IS_REUPLOAD?.toString() ?? "false") as boolean,
        isConvert: JSON.parse(process.env.IS_CONVERT?.toString() ?? "false") as boolean,
        visibility: {
            add: process.env.VISIBILITY_ADD ?? "public",
            update: process.env.VISIBILITY_UPDATE ?? "home",
            delete: process.env.VISIBILITY_DELETE ?? "home", 
        },
        useCW: {
            add: JSON.parse(process.env.USE_CW_ADD?.toString() ?? "false") as boolean,
            update: JSON.parse(process.env.USE_CW_UPDATE?.toString() ?? "false") as boolean,
            delete: JSON.parse(process.env.USE_CW_DELETE?.toString() ?? "false") as boolean,
        },
        localOnly: JSON.parse(process.env.LOCAL_ONLY?.toString() ?? "false") as boolean
    }
    return options
}

const options = loadEmojiBotOptions()

const dbfilename = "moderation.json"

const tmp_directory = "tmp"

// 将来的にDBに持たせたりしたほうが良いけど、今は雑に手元のローカルに保存すればよし
// 定期的に admin/emoji/list を見に行って、ローカルのDBにコピーしていくスタイル
let emojidb: CustomEmoji[] = []

const api = axios.create({
    baseURL: `https://${options.host}/api/`,
    timeout: 3000,
    headers: {
    } 
})

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

// TODO: この変数使っていない説がある
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
                i: options.token,
                limit: options.limit,
                type: null,
                untilId: untilId
            }
        } else {
            params = {
                allowPartial: true,
                i: options.token,
                limit: options.limit,
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

    // 新しい順になっているので古い順に変える
    newModerationLogs = newModerationLogs.reverse()

    newModerationLogs.forEach( moderationLog => {
        switch(moderationLog.type) {
            case "addCustomEmoji":
                const emoji = moderationLog.info.emoji as CustomEmoji
                if(moderationLog.user.username != options.botName) {
                    resendToAssets(emoji);
                    let cwAdd : string | null
                    let headerAdd : string
                    if(options.useCW.add) {
                        cwAdd = `新しい絵文字が追加されたかも! :${emoji.name}:\n`
                        headerAdd = ""
                    } else {
                        cwAdd = null
                        headerAdd = `新しい絵文字が追加されたかも!\n`
                    }
                    createNote(`${headerAdd}\`:${emoji.name}:\` => :${emoji.name}: \n\n【カテゴリー】\n\`${emoji.category}\`\n\n【ライセンス】\n\`${emoji.license}\`\n\n追加した人：@${moderationLog.user.username}`, options.visibility.add, cwAdd)
                }
                break
            case "updateCustomEmoji":
                const after = moderationLog.info.after as CustomEmoji
                const before = moderationLog.info.before as CustomEmoji
                if(moderationLog.user.username != options.botName) {
                    // publicUrlが変わってたらカスタム絵文字も再生成
                    if(after.publicUrl != before.publicUrl) {
                        resendToAssets(after);
                    }
                    let cwUpdate : string | null
                    let headerUpdate : string
                    if(options.useCW.update) {
                        cwUpdate = `絵文字が更新されたかも! :${after.name}:\n`
                        headerUpdate = ""
                    } else {
                        cwUpdate = null
                        headerUpdate = `絵文字が更新されたかも!\n`
                    }
                    createNote(`${headerUpdate}\`:${after.name}:\` => :${after.name}: \n\n【カテゴリー】\n\`${after.category}\`\n\n【ライセンス】\n\`${after.license}\`\n\n更新した人：@${moderationLog.user.username}`, options.visibility.update, cwUpdate)
                }
                break
            case "deleteCustomEmoji":
                const deleted_emoji = moderationLog.info.emoji as CustomEmoji
                if(moderationLog.user.username != options.botName) {
                    let cwDelete : string | null
                    let headerDelete : string
                    if(options.useCW.delete) {
                        cwDelete = `カスタム絵文字が削除されたみたい…\n`
                        headerDelete = ""
                    } else {
                        cwDelete = null
                        headerDelete = `カスタム絵文字が削除されたみたい…\n`
                    }
                    createNote(`${headerDelete}\`:${deleted_emoji.name}:\` \n\n削除した人：@${moderationLog.user.username}`, options.visibility.delete, cwDelete)
                }
                break
            case "createAvatarDecoration":
                const deco = moderationLog.info.avatarDecoration as AvatorDecoration
                let cwdAdd : string | null
                let headerdAdd : string
                if(options.useCW.add) {
                    cwdAdd = `新しいデコレーションが追加されたかも!\n\`${deco.name}\``
                    headerdAdd = ""
                } else {
                    cwdAdd = null
                    headerdAdd = `新しいデコレーションが追加されたかも!\n`
                } 
                createNote(`${headerdAdd}\`${deco.name}\` => ${deco.url} \n\n追加した人：@${moderationLog.user.username}`, options.visibility.add, cwdAdd)
                break
            case "updateAvatarDecoration":
                const afterd = moderationLog.info.after as AvatorDecoration 
                let cwdUpdate : string | null
                let headerdUpdate : string
                if(options.useCW.update) {
                    cwdUpdate = `デコレーションが更新されたかも!\n\`${afterd.name}\``
                    headerdUpdate = ""
                } else {
                    cwdUpdate = null
                    headerdUpdate = `デコレーションが更新されたかも!\n`
                }
                createNote(`${headerdUpdate}\`${afterd.name}\` => ${afterd.url} \n\n更新した人：@${moderationLog.user.username}`, options.visibility.update, cwdUpdate)
                break
            case "deleteAvatarDecoration":
                const deleted = moderationLog.info.avatarDecoration as AvatorDecoration 
                let cwdDelete : string | null
                let headerdDelete : string
                if(options.useCW.delete) {
                    cwdDelete = `デコレーションが削除されたみたい…\n`
                    headerdDelete = ""
                } else {
                    cwdDelete = null
                    headerdDelete = `デコレーションが削除されたみたい…\n`
                }
                createNote(`${headerdDelete}\`${deleted.name}\` \n\n更新した人：@${moderationLog.user.username}`, options.visibility.delete, cwdDelete)
                break
            default:
                console.log("その他なんか:" + moderationLog)
                break
        }
    })

    // 最終更新日を記録して、ローカルのjsonファイルに書き出し
    const latestModerationLog = newModerationLogs.at(-1)
    if(latestModerationLog) {
        fs.writeFileSync(dbfilename, JSON.stringify(latestModerationLog))
        lastModified = new Date(latestModerationLog.createdAt)
    }

}

let interval_ms
if(!options.intervals || Number.isNaN((interval_ms = options.intervals * 1000))) 
{  
    // デフォルトは60秒に1回ポーリング
    interval_ms = 60 * 1000
}

// TODO: Promise を使って、もうちょっとちゃんと綺麗に実装してどうぞ
setInterval( pullModerationLogs,  interval_ms)

async function createNote(message: string, visibility: string = "public", cw: string | null = null) {
    const params = {
        i: options.token,
        text: message,
        visibility: visibility, // public or home
        localOnly: options.localOnly, // 連合をオフにするかどうか
        cw: cw // 注釈に設定する文字列
    }
    if(options.isDryRun) {
        Logger.info("isDryRun=true のため投稿しません")
        Logger.info(params.text)
    }
    else {
        api.post('/notes/create', params).then (response => {
            if(response.status == 200) {
                Logger.success(params.text)
            }
        }).catch( error => {
            console.log(error)
        })
    }
}

async function createDriveFile(name: string,buffer: Buffer): Promise<string>{
    const file = new Blob([buffer.buffer], { type: "image/webp" });

    const formData = new FormData();
    formData.append('i', options.token!);
    formData.append('force', 'true');
    formData.append('file', file);
    formData.append('name', name);

    return api.post('/drive/files/create', formData).then (response => {
        if(response.status == 200) {
            Logger.success(response.data.id + ": " + name)
            return response.data.id
        }
    }).catch( error => {
        console.log(error)
    })
}

async function updateEmoji(emoji: CustomEmoji, fileId: string) {
    const params = {
        i: options.token,
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
            Logger.success(params.name)
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
    if(options.isDryRun) {
        Logger.info("isDryRun=true のためドライブにアップしません")
        Logger.info(emoji.name)
    } else if(options.isReUpload) {

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
