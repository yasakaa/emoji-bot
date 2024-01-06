
export type CustomEmoji = {
    id: string,
    aliases: string[],
    name: string,
    category: string,
    host: string,
    publicUrl: string,
    originalUrl: string,
    license: string,
    isSensitive: boolean,
    localOnly: boolean,
    roleIdsThatCanBeUsedThisEmojiAsReaction: string[]
}
