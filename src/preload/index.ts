import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  ALLOWED_EVENT_CHANNELS,
  ALLOWED_INVOKE_CHANNELS,
  type IpcEventChannel,
  type IpcInvokeChannel
} from '../shared/ipc-channels'

const isInvokeChannel = (channel: string): channel is IpcInvokeChannel =>
  (ALLOWED_INVOKE_CHANNELS as readonly string[]).includes(channel)

const isEventChannel = (channel: string): channel is IpcEventChannel =>
  (ALLOWED_EVENT_CHANNELS as readonly string[]).includes(channel)

const ALLOWED_SEND_CHANNELS = ['overlay:set-ignore-mouse'] as const

const api = {
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> => {
    if (!isInvokeChannel(channel)) {
      return Promise.reject(new Error(`IPC invoke channel "${channel}" is not allowed`))
    }
    return ipcRenderer.invoke(channel, ...args)
  },
  on: (channel: string, callback: (...args: unknown[]) => void): (() => void) => {
    if (!isEventChannel(channel)) {
      throw new Error(`IPC event channel "${channel}" is not allowed`)
    }
    const listener = (_event: IpcRendererEvent, ...args: unknown[]): void => callback(...args)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
  send: (channel: string, ...args: unknown[]): void => {
    if ((ALLOWED_SEND_CHANNELS as readonly string[]).includes(channel)) {
      ipcRenderer.send(channel, ...args)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error fallback for non-isolated context
  window.api = api
}
