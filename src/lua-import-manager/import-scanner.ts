import * as vscode from 'vscode';
import { LuaScanner } from '../file-scanner/lua-scanner';
import { Module } from '../module';
import { LuaImportCache } from './import-cache';


export class LuaImportScanner extends Module {

    private static luaClassNamePattern = /(?<=--- @class )(\w+(?:Class|Lib|Ids?))/gm;

    private static luaAddonPath: string;

    public static initialize( context: vscode.ExtensionContext, config: vscode.WorkspaceConfiguration ){
        LuaImportScanner.luaAddonPath = config.get<string>( "LuaAddonPath" )!.trim().toLowerCase();

        LuaScanner.addCallback( LuaImportScanner.scanLuaForImportables );
    }

    /**
     * Determines the path to be used in the Lua import statement for a given absolute file path URI
     */
    private static getImportPath( uri: vscode.Uri ): string {
        const importPathStartIndex = uri.path.indexOf( LuaImportScanner.luaAddonPath ) + LuaImportScanner.luaAddonPath.length;
        let importPath = uri.path.substring( importPathStartIndex ).trim();
        
        
        if( importPath.startsWith( "/" ) ) {
            importPath = importPath.substring( 1 );
        }
        return importPath;
    }

    /**
     * Finds the Lua class or library (if any) in a given Lua file's contents and caches it as an importable
     */
    public static scanLuaForImportables( file: vscode.Uri, fileContent: string ) {
        const luaClassMatches = fileContent.match( LuaImportScanner.luaClassNamePattern );

        // Find the first Lua class or library defined in this file
        let luaClass: string | undefined;
        if( luaClassMatches !== null ) {
            luaClass = luaClassMatches[0];
        }

        // There are no importable classes within this Lua file
        if( luaClass === undefined ) {
            return;
        }

        // Find the Lua file path in the format we need it in to import it
        let importPath = LuaImportScanner.getImportPath( file );

        

        LuaImportCache.storeImportable( luaClass, importPath );
    }
}
