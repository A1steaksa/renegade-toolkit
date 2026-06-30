import * as vscode from 'vscode';
import { config } from '../extension';

export class ConfigUtils {
    
    private static getString( key: string ): string {
        const configString = config.get<string>( key );
        if( configString === undefined ){
            throw new Error( `Unable to retrieve key '${key}' from config` );
        }
        return configString;
    }

    /**
     * CPP
     */

    public static GetCppWorkspaceFolderName(): string {
        return ConfigUtils.getString( "cpp.workspaceFolderName" );
    }

    public static GetCppCodeRoot(): string {
        return ConfigUtils.getString( "cpp.codeRoot" );
    }

    public static GetCppClassCacheFilePath(): string {
        return ConfigUtils.getString( "cpp.classCacheFile" );
    }


    /**
     * Lua
     */

    public static GetLuaWorkspaceFolderName(): string {
        return ConfigUtils.getString( "lua.workspaceFolderName" );
    }

    public static GetLuaCodeRoot(): string {
        return ConfigUtils.getString( "lua.codeRoot" );
    }

    public static GetLuaClassDefinitionRootPath(): string {
        return ConfigUtils.getString( "lua.classDefinitionRootPath" );
    }

    /**
     * Lua > Templates
     */

    public static GetLuaClassTemplateFilePath(): string {
        return ConfigUtils.getString( "lua.templates.classTemplateFile" );
    }
}