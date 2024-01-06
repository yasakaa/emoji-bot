
export type ModerationLog = {
    id: string,
    createdAt: string, // Dateでいけたっけ
    type: string,
    info: any,
    userId: string, // なんでuserとuseridがあるんですかねぇ
    user: any, // TODO: userを作る必要がある
}
