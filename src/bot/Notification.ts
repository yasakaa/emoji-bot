import axios from 'axios';
import { AvatorDecoration } from '../misskey/model/AvatorDecoration';
import { CustomEmoji } from '../misskey/model/CustomEmoji';
import { ModerationLog } from '../misskey/model/ModerationLog';
import { User } from '../misskey/model/User';
import { CreateDriveFile } from '../service/CreateDriveFile';
import { CreateNote } from '../service/CreateNote';
import { UpdateEmoji } from '../service/UpdateEmoji';
import { Logger } from '../utils/logger';
import { EmojiBotOptions } from './options';
import { sleep } from '../utils/sleep';

export class Notification {
  protected options: EmojiBotOptions;
  protected user?: User;

  constructor(
    private createNote: CreateNote,
    private createDriveFile: CreateDriveFile,
    private updateEmoji: UpdateEmoji,
    options: EmojiBotOptions,
  ) {
    this.options = options;
  }

  // カスタム絵文字が追加された時の処理
  private addCustomEmoji(moderationLog: ModerationLog) {
    const emoji = moderationLog.info.emoji as CustomEmoji;
    const user = moderationLog.user as User;

    if (user.username != this.user?.username) {
      // 絵文字をアップロードしなおす
      if (this.options.isReUpload) {
        this.reuploadEmoji(emoji);
      }

      // 通知
      const cw = this.options.useCW.add
        ? `新しい絵文字が追加されたっぽいかも～ :${emoji.name}:\n`
        : null;
      const header = this.options.useCW.add
        ? ''
        : '新しい絵文字が追加されたっぽいかも～ \n';
      const message = `${header}\`:${emoji.name}:\` => :${emoji.name}: \n\n【カテゴリー】\n\`${emoji.category}\`\n\n【タグ】\n\`${emoji.aliases}\`\n\n【ライセンス】\n\`${emoji.license}\`\n\n追加した人：@${user.username}`;

      if (this.options.isDryRun) {
        Logger.info('isDryRun=true のため投稿しません');
        Logger.info(message);
      } else {
        this.createNote.execute(
          message,
          this.options.visibility.add,
          this.options.localOnly,
          cw,
        );
      }
    }
  }

  // カスタム絵文字が更新された時の処理
  private updateCustomEmoji(moderationLog: ModerationLog) {
    const after = moderationLog.info.after as CustomEmoji;
    const before = moderationLog.info.before as CustomEmoji;
    const user = moderationLog.user as User;

    if (user.username != this.user?.username) {
      // 画像のURLが変わっている場合、画像が差し替えられている
      if (after.publicUrl != before.publicUrl) {
        // 絵文字をアップロードしなおす
        if (this.options.isReUpload) {
          this.reuploadEmoji(after);
        }
      }

      // 通知
      const cw = this.options.useCW.update
        ? `絵文字が更新されたっぽいかも～  :${after.name}:\n`
        : null;
      const header = this.options.useCW.update
        ? ''
        : '絵文字が更新されたっぽいかも～ \n';
      const message = `${header}\`:${after.name}:\` => :${after.name}: \n\n【カテゴリー】\n\`${after.category}\`\n\n【タグ】\n\`${after.aliases}\`\n\n【ライセンス】\n\`${after.license}\`\n\n更新した人：@${user.username}`;
      if (this.options.isDryRun) {
        Logger.info('isDryRun=true のため投稿しません');
        Logger.info(message);
      } else {
        this.createNote.execute(
          message,
          this.options.visibility.update,
          this.options.localOnly,
          cw,
        );
      }
    }
  }

  private createAvatarDecoration(moderationLog: ModerationLog) {
    const deco = moderationLog.info.avatarDecoration as AvatorDecoration;
    const user = moderationLog.user as User;

    const cw = this.options.useCW.add
      ? `新しいデコレーションが追加されたっぽいかも～\n\`${deco.name}\``
      : null;
    const header = this.options.useCW.add
      ? ''
      : '新しいデコレーションが追加されたっぽいかも～\n';
    const message = `${header}\`${deco.name}\` => ${deco.url} \n\n追加した人：@${user.username}`;
    if (this.options.isDryRun) {
      Logger.info('isDryRun=true のため投稿しません');
      Logger.info(message);
    } else {
      this.createNote.execute(
        message,
        this.options.visibility.add,
        this.options.localOnly,
        cw,
      );
    }
  }

  private updateAvatorDecoration(moderationLog: ModerationLog) {
    const deco = moderationLog.info.after as AvatorDecoration;
    const user = moderationLog.user as User;

    const cw = this.options.useCW.update
      ? `デコレーションが更新されたっぽいかも～\n\`${deco.name}\``
      : null;
    const header = this.options.useCW.update
      ? ''
      : 'デコレーションが更新されたっぽいかも～\n';
    const message = `${header}\`${deco.name}\` => ${deco.url} \n\n更新した人：@${user.username}`;
    if (this.options.isDryRun) {
      Logger.info('isDryRun=true のため投稿しません');
      Logger.info(message);
    } else {
      this.createNote.execute(
        message,
        this.options.visibility.update,
        this.options.localOnly,
        cw,
      );
    }
  }

  // モデレーションログを受け取って、それを元に何かしらの処理を実行するメソッド
  notify(moderationLog: ModerationLog, user: User) {
    this.user = user;
    switch (moderationLog.type) {
      case 'addCustomEmoji':
        this.addCustomEmoji(moderationLog);
        break;
      case 'updateCustomEmoji':
        this.updateCustomEmoji(moderationLog);
        break;
      case 'createAvatarDecoration':
        this.createAvatarDecoration(moderationLog);
        break;
      case 'updateAvatarDecoration':
        this.updateAvatorDecoration(moderationLog);
        break;
      default:
        Logger.info('その他なんか:' + moderationLog);
        break;
    }
  }

  protected async reuploadEmoji(emoji: CustomEmoji) {
    // TODO: 別メソッドかサービスか何かに分けたほうが良い
    const response = await axios.get(emoji.publicUrl, {
      responseType: 'arraybuffer',
    });
    const content_type = response.headers['content-type'].toString();
    const file = new Blob([Buffer.from(response.data)], { type: content_type });

    if (this.options.isDryRun) {
      Logger.info('isDryRun=true のためドライブにアップしません');
      Logger.info(emoji.name);
    } else {
      const filename = `${emoji.name}`;
      const id = await this.createDriveFile.execute(filename, file);
      if (id) {
        await sleep(5000);
        await this.updateEmoji.execute(emoji, id!);
      }
    }
  }
}
