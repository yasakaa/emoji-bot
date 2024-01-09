import { ApiInstance } from "../misskey/api/$api"
import { Logger } from "../utils/logger"

export class CreateDriveFile {
    api: ApiInstance
    token: string

    constructor(api: ApiInstance, token: string) {
        this.api = api
        this.token = token
    }

    async execute(name: string, file: Blob) {
        const formData = {
            i: this.token,
            force: true,
            file: file,
            name: name
        }
        const id = await this.api.drive.files.create.post({body: formData}).then ( response => {
            if(response.status == 200) {
                Logger.success(response.body.id + ": " + name)
                return response.body.id!
            }
        }).catch( error => {
            Logger.error(error)
        })
        return id
    }
}