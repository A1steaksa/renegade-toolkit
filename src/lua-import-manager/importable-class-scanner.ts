import * as vscode from 'vscode';
import { LuaScanner } from '../file-scanner/lua-scanner';
import { Module } from '../module';
import { LuaImportableCache } from './importable-class-cache';
import { config } from '../extension';
import { LuaEnum } from './importables/lua-enum';
import { LuaClass } from './importables/lua-class';


export class LuaImportableClassScanner extends Module {

    private static luaClassNamePattern = /--- @class\s+(\w+(?:Class|Lib|Ids|Utils|Types))/m;
    private static luaEnumNamePattern = /--+\s*@enum\s+(\w+)/gm;

    public static initialize( context: vscode.ExtensionContext ){
        LuaScanner.addFileChangeCallback( ( file, fileContent ) => {
            LuaImportableClassScanner.scanLuaFile( file, fileContent );
        } );
    }

    public static scanLuaFile( file: vscode.Uri, fileContent: string ){
        // Check if this is an importable Lua class
        const importableClass = this.scanLuaForImportableClass( file, fileContent );
        if( importableClass === undefined ){
            return;
        }
        LuaImportableCache.storeImportableClass( importableClass );

        // Find any importable Lua enums defined within this importable Lua class
        const importableEnums = this.scanLuaForImportableEnums( importableClass, fileContent );
        if( importableEnums === undefined ){
            return;
        }

        LuaImportableCache.storeImportableEnums( importableEnums );
    }

    /**
     * Finds the Lua class or library (if any) in a given Lua file's contents and caches it as an importable
     */
    public static scanLuaForImportableClass( file: vscode.Uri, fileContent: string ) : LuaClass | undefined {
        // Find the first class defined in the file (not counting the Renegade class)
        const luaClassMatches = this.luaClassNamePattern.exec( fileContent );
        if( luaClassMatches === null ){
            return;
        }

        const luaClassName = luaClassMatches[1];

        return new LuaClass( luaClassName, file );
    }

    /**
     * Finds the Lua enums (if any) in a given Lua class file's contents and caches it
     */
    public static scanLuaForImportableEnums( luaClass: LuaClass, fileContent: string ) : LuaEnum[] {
        let luaEnums: LuaEnum[] = [];

        let luaEnumMatches = this.luaEnumNamePattern.exec( fileContent );
        while( luaEnumMatches !== null ){
            const luaEnumName = luaEnumMatches[1];

            luaEnums.push( new LuaEnum( luaEnumName, luaClass ) );

            luaEnumMatches = this.luaEnumNamePattern.exec( fileContent );
        }

        return luaEnums;
    }
}
