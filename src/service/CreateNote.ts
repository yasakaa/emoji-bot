import { ApiInstance } from "../misskey/api/$api"
import { Logger } from "../utils/logger"

export class CreateNote {
    constructor(private api: ApiInstance, private token: string) {}

    async execute(message: string, visibility: string = "public", localOnly: boolean,cw: string | null = null) {
        const params = {
            i: this.token,
            text: message,
            visibility: visibility, // public or home
            localOnly: localOnly,
            cw: cw // 注釈に設定する文字列
        }
        this.api.notes.create.post({body: params}).then ( response => {
            if(response.status == 200) {
                Logger.success(params.text)
            }
        }).catch( error => {
            Logger.error(error)
        })
    }
}