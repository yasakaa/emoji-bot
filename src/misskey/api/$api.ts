import type { AspidaClient } from 'aspida';
import type { Methods as Methods_rfcdeg } from './admin/emoji/update';
import type { Methods as Methods_qujrqa } from './admin/show-moderation-logs';
import type { Methods as Methods_1387vwk } from './notes/create';

const api = <T>({ baseURL, fetch }: AspidaClient<T>) => {
  const prefix = (baseURL === undefined ? '' : baseURL).replace(/\/$/, '');
  const PATH0 = '/admin/emoji/update';
  const PATH1 = '/admin/show-moderation-logs';
  const PATH2 = '/notes/create';
  const POST = 'POST';

  return {
    admin: {
      emoji: {
        update: {
          post: (option: { body: Methods_rfcdeg['post']['reqBody'], config?: T | undefined }) =>
            fetch<Methods_rfcdeg['post']['resBody']>(prefix, PATH0, POST, option).json(),
          $post: (option: { body: Methods_rfcdeg['post']['reqBody'], config?: T | undefined }) =>
            fetch<Methods_rfcdeg['post']['resBody']>(prefix, PATH0, POST, option).json().then(r => r.body),
          $path: () => `${prefix}${PATH0}`,
        },
      },
      show_moderation_logs: {
        post: (option: { body: Methods_qujrqa['post']['reqBody'], config?: T | undefined }) =>
          fetch<Methods_qujrqa['post']['resBody']>(prefix, PATH1, POST, option).json(),
        $post: (option: { body: Methods_qujrqa['post']['reqBody'], config?: T | undefined }) =>
          fetch<Methods_qujrqa['post']['resBody']>(prefix, PATH1, POST, option).json().then(r => r.body),
        $path: () => `${prefix}${PATH1}`,
      },
    },
    notes: {
      create: {
        post: (option: { body: Methods_1387vwk['post']['reqBody'], config?: T | undefined }) =>
          fetch<Methods_1387vwk['post']['resBody']>(prefix, PATH2, POST, option).json(),
        $post: (option: { body: Methods_1387vwk['post']['reqBody'], config?: T | undefined }) =>
          fetch<Methods_1387vwk['post']['resBody']>(prefix, PATH2, POST, option).json().then(r => r.body),
        $path: () => `${prefix}${PATH2}`,
      },
    },
  };
};

export type ApiInstance = ReturnType<typeof api>;
export default api;
