import { DefineMethods } from "aspida"

export type Methods = DefineMethods<{
    post: {
        reqBody: {
            i: string,
            text: string,
            visibility: string,
            localOnly: boolean,
            cw: string | null
        }
        resBody: {
            // nothing
        }
    }
}>