import * as vscode from 'vscode';
import { config } from '../extension';

export class ConfigUtils {
    public static getString( key: string ): string {
        const configString = config.get<string>( key );
        if( configString === undefined ){
            throw new Error( `Unable to retrieve key '${key}' from config` );
        }
        return configString;
    }
}