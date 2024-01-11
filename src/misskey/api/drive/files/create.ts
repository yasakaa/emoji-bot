import { DefineMethods } from "aspida"

export type Methods = DefineMethods<{
    post: {
        reqBody: {
            i: string,
            force: boolean,
            file: Blob,
            folderId?: string,
            name: string
        },
        reqFormat: FormData,
        resBody: {
            id: string
        }
    }
}>