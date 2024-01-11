import { ASCII } from "./ascii"

// 将来的に良い感じにするかも。
// 今のところただの console.logのラッパー
export class Logger {
    static warn(message: string) {
        console.log(`${ASCII.yellow}${message}${ASCII.reset}`)
    }
    static error(message: string) {
        console.log(`${ASCII.red}${message}${ASCII.reset}`)
    }
    static success(message: string) {
        console.log(`${ASCII.green}${message}${ASCII.reset}`)
    }
    static debug(message: string) {
        console.log(`${ASCII.magenta}${message}${ASCII.reset}`)
    }
    static info(message: string) {
        console.log(`${ASCII.cyan}${message}${ASCII.reset}`)
    }
}