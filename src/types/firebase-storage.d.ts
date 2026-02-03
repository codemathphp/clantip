declare module 'firebase/storage' {
  export function getStorage(app?: any): any
  export function ref(storage: any, path: string): any
  export function uploadString(storageRef: any, data: string, format?: string): Promise<any>
  export function getDownloadURL(storageRef: any): Promise<string>
}
