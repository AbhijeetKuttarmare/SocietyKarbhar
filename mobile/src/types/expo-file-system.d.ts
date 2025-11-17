declare module 'expo-file-system' {
  export const cacheDirectory: string;
  export const documentDirectory: string;
  export const EncodingType: any;
  export function writeAsStringAsync(uri: string, data: string, options?: any): Promise<any>;
  export function readAsStringAsync(uri: string, options?: any): Promise<string>;
  export function downloadAsync(
    url: string,
    fileUri: string,
    options?: any
  ): Promise<{ uri: string }>;
  const FileSystem: any;
  export default FileSystem;
}
