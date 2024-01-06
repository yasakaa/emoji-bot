import { DefineMethods } from "aspida";

export type Methods = DefineMethods<{
    post: {
        reqBody: {
            i: string,
            aliases: string[],
            category: string,
            fileId: string,
            id: string,
            isSensitive: boolean,
            lisence: string,
            localOnly: boolean,
            name: string,
            roleIdsThatCanBeUsedThisEmojiAsReaction: string[]
            }
        resBody: {}
    }
}>