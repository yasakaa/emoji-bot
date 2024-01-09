# emoji-bot

Misskey インスタンスに絵文字が追加された事を知らせるBOTです。
使用する際は、`.env.example` をコピーし `.env` を作成して利用してください

Misskey バージョン 2023.12.1 以降はアクセストークンに以下の権限が必要です。
```js
"permission": [
    "read:admin:show-moderation-log",
    "write:notes",
    "read:drive",
    "write:drive",
    "read:admin:emoji",
    "write:admin:emoji"
]
```

## `pnpm` を利用した起動方法

``sh
pnpm install
pnpm start
``

## Docker を利用した起動方法

``sh
docker compose build
docker compose up -d
``
