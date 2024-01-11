import { DefineMethods } from "aspida"
import { User } from "../model/User"

export type Methods = DefineMethods<{
    post: {
        reqBody: {
            i: string // token
        }
        resBody: User
    }
}>