import { ApiInstance } from "../misskey/api/$api"
import { ModerationLog } from "../misskey/model/ModerationLog"
import { Logger } from "../utils/logger"

export class GetRecentModerationLogs {
    constructor(private api: ApiInstance, private token: string) {}

    async execute(lastModified: Date, limit: number = 30): Promise<ModerationLog[]>  {
        let moderationLogs: ModerationLog[] = []
        let newLastModified: Date = new Date() // 命名もうちょっとどうにかならんか…？
        let untilId = null
    
        do {
            let params
            if (untilId) {
                params = {
                    allowPartial: true,
                    i: this.token,
                    limit: limit,
                    type: null,
                    userId: null,
                    untilId: untilId
                }
            } else {
                params = {
                    allowPartial: true,
                    i: this.token,
                    limit: limit,
                    userId: null,
                    type: null
                }
            }
            await this.api.admin.show_moderation_logs.post({body: params}).then (response => {
                if(response.status == 200) {
                    const newModerationLogs = JSON.parse(JSON.stringify(response.body)) as ModerationLog[]
                    untilId = newModerationLogs.pop()?.id
                    // nullとか知らん
                    newLastModified = new Date(newModerationLogs.pop()!.createdAt)
                    moderationLogs = moderationLogs.concat(newModerationLogs)
                }
            }).catch( error => {
                Logger.error(error)
            })
        } while(newLastModified > lastModified)
    
        // 新しいのだけに絞る
        moderationLogs = moderationLogs.filter(l => new Date(l.createdAt) > lastModified)
    
        // 新しい順になっているので古い順に変える
        moderationLogs = moderationLogs.reverse()
    
        return moderationLogs
    }
}
