import { DefineMethods } from "aspida";
import { ModerationLog } from "../../model/ModerationLog";

export type Methods = DefineMethods<{
    post: {
        reqBody: {
            allowPartial: boolean,
            i: string,
            limit: number,
            type: string | null,
            untilId?: string
        }
        resBody: ModerationLog[]
    }
}>