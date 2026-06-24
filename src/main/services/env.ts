import { app } from 'electron'
import { config } from 'dotenv'
import { existsSync } from 'fs'
import { dirname, join, resolve } from 'path'

/** 运行时加载 .env，不把密钥打进安装包 */
export function loadAppEnv(): void {
  const candidates = [resolve(process.cwd(), '.env'), join(dirname(process.execPath), '.env')]

  if (app.isReady()) {
    candidates.push(join(app.getPath('userData'), '.env'))
  }

  for (const path of candidates) {
    if (existsSync(path)) {
      config({ path })
      return
    }
  }
}
