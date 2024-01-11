import { ApiInstance } from "../misskey/api/$api"
import { User } from "../misskey/model/User"
import { Logger } from "../utils/logger"

export class Self {
    constructor(private api: ApiInstance, private token: string) {}

    // TODO: User | undefined 以外にいい方法ある？
    async execute(): Promise<User | undefined> {
        const params = {
            i: this.token,
        }
        return this.api.i.post({body: params}).then(response => {
            const user = response.body
            if(response.status == 200) {
                Logger.success(`Login success: @${user.username}`)
                return user
            }
            else {
                Logger.error(`Login failed`)
            }
            return undefined
        }).catch( error => {
            Logger.error(error)
            return undefined
        })
    }
}