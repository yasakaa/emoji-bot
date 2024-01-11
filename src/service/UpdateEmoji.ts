import { ApiInstance } from "../misskey/api/$api"
import { CustomEmoji } from "../misskey/model/CustomEmoji"
import { Logger } from "../utils/logger"

export class UpdateEmoji {
    constructor(private api: ApiInstance, private token: string) {}

    async execute(emoji: CustomEmoji, fileId: string) {
        const params = {
            i: this.token,
            aliases: emoji.aliases,
            category: emoji.category,
            fileId: fileId,
            id: emoji.id,
            isSensitive: emoji.isSensitive,
            license : emoji.license,
            localOnly: emoji.localOnly,
            name: emoji.name,
            roleIdsThatCanBeUsedThisEmojiAsReaction: emoji.roleIdsThatCanBeUsedThisEmojiAsReaction
        }
        return this.api.admin.emoji.update.post({body: params}).then(response => {
            if(response.status == 204) {
                Logger.success(`reuploaded: ${params.name} => ${fileId}`)
            }
        }).catch( error => {
            Logger.error(error)
        })
    }
}